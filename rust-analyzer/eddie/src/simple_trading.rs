use chrono::Utc;
use redis::Commands;

pub struct SimpleTrading {
    pub symbol: String,
    pub last_price: f64,
    pub watch_price: f64,
    pub buy_price: f64,
    pub sell_price: f64,
    pub stop_loss: f64,
    pub take_profit: f64,
    pub profits: f64,
    pub losses: f64,
    pub trade_active: bool,
    pub redis: redis::Client,
    pub take_profit_percentage: f64,
    pub stop_loss_value_usd: f64,
    pub watch_movement_percentage: f64,
}

impl SimpleTrading {
    pub fn new(
        symbol: String,
        price: f64,
        take_profit_percentage: f64,
        stop_loss_value_usd: f64,
        watch_movement_percentage: f64,
    ) -> Self {
        Self {
            take_profit_percentage,
            stop_loss_value_usd,
            watch_movement_percentage,
            redis: redis::Client::open("redis://127.0.01:6179").unwrap(),
            symbol,
            watch_price: price,
            last_price: 0.0,
            buy_price: 0.0,
            sell_price: 0.0,
            stop_loss: 0.0,
            take_profit: 0.0,
            profits: 0.0,
            losses: 0.0,
            trade_active: false,
        }
    }

    pub fn movement_percentage(&self) -> f64 {
        let price_diff = self.last_price - self.watch_price;
        (price_diff / self.watch_price) * 100.0
    }

    fn reset(&mut self) {
        self.watch_price = 0.0;
        self.last_price = 0.0;
        self.buy_price = 0.0;
        self.sell_price = 0.0;
        self.stop_loss = 0.0;
        self.take_profit = 0.0;
        self.trade_active = false;
    }

    pub fn run(&mut self, price: f64) {
        // println!("Current price: {}", current_price);

        // check for price movement when there is no active trade.
        if self.last_price != 0.0 && (self.buy_price == 0.0 && self.sell_price == 0.0) {
            let price_diff_percentage = self.movement_percentage();

            if price_diff_percentage.abs() > (self.watch_movement_percentage / 100.0) {
                if price_diff_percentage > 0.0 {
                    let [p, s, t] = self.buy(price);

                    self.buy_price = p;
                    self.stop_loss = s;
                    self.take_profit = t;

                    // println!(
                    //     "{}, BUY TIME!! {}, {}%, SL: {}, TP: {}",
                    //     self.symbol,
                    //     &price, price_diff_percentage, self.stop_loss, self.take_profit
                    // );
                } else {
                    let [p, s, t] = self.sell(price);

                    self.sell_price = p;
                    self.stop_loss = s;
                    self.take_profit = t;

                    // println!(
                    //     "{}, SELL TIME!! {}, {}%, SL: {}, TP: {}",
                    //     self.symbol,
                    //     &price, price_diff_percentage, self.stop_loss, self.take_profit
                    // );
                }
            }
        }

        // check when there is a buy trade
        if self.buy_price != 0.0 {
            if self.trade_active == false {
                self.trade_active = true;
                self.buy_price = price;

                let [current_price, stop_loss, take_profit] = self.buy(price);
                self.stop_loss = stop_loss;
                self.take_profit = take_profit;
            }

            if price >= self.take_profit {
                // println!("{}, Take profit hit: {}, {}", self.symbol, price, self.take_profit);
                // println!("{}, We have made: {:.3}$", self.symbol, price - self.buy_price);
                self.profits += price - self.buy_price;

                self.reset();
            } else if price <= self.stop_loss {
                // println!("{}, Stop loss hit: {}, {}", self.symbol, price, self.stop_loss);
                // println!(
                //     "{}, We have lost: {:.3}$",
                //     self.symbol,
                //     f64::max(price - self.buy_price, -self.stop_loss_value_usd)
                // );

                self.losses -= f64::max(price - self.buy_price, -self.stop_loss_value_usd);

                self.reset();
            }
        }

        // check when there is a buy trade
        if self.sell_price != 0.0 {
            if self.trade_active == false {
                self.trade_active = true;
                self.sell_price = price;

                let [current_price, stop_loss, take_profit] = self.sell(price);
                self.stop_loss = stop_loss;
                self.take_profit = take_profit;
            }

            if price <= self.take_profit {
                // println!("{}, Take profit hit: {}, {}", self.symbol, price, self.take_profit);
                // println!("{}, We have made: {:.3}$", self.symbol, self.sell_price - price);
                self.profits += self.sell_price - price;

                self.reset();
            } else if price >= self.stop_loss {
                // println!("{}, Stop loss hit: {}, {}", self.symbol, price, self.stop_loss);
                // println!(
                //     "{}, We have lost: {:.3}$",
                //     self.symbol,
                //     f64::max(self.sell_price - price, -self.stop_loss_value_usd)
                // );

                self.losses -= f64::max(self.sell_price - price, -self.stop_loss_value_usd);

                self.reset();
            }
        }

        if self.watch_price == 0.0 && (self.buy_price == 0.0 && self.sell_price == 0.0) {
            self.watch_price = price;

            let diff = self.watch_price * (self.watch_movement_percentage / 100.0);

            // println!(
            //     "{}, Setting watch price: {}, BUY @ {:.3}, SELL @ {:.3}, DIFF in $ {:.1}",
            //     self.symbol,
            //     self.watch_price,
            //     self.watch_price + diff,
            //     self.watch_price - diff,
            //     diff,
            // );

            let score = Utc::now().timestamp();

            let _: () = self
                .redis
                .get_connection()
                .unwrap()
                .hset(
                    "trades:debile".to_string(),
                    self.symbol.to_string(),
                    format!(
                        "Total Profits: {:.3}, Total Losses {:.3}",
                        self.profits, self.losses
                    ),
                )
                .unwrap();

            // println!(
            //     "{}, Total Profits: {:.3}, Total Losses {:.3}",
            //     self.symbol,
            //     self.profits, self.losses
            // );
        }

        self.last_price = price;
    }

    fn buy(&self, current_price: f64) -> [f64; 3] {
        let stop_loss = current_price - self.stop_loss_value_usd;
        let take_profit = current_price * (1.0 + (self.take_profit_percentage));

        // println!(
        //     "{}, Setting up Buy: {}, SL: {}, TP:{}",
        //     self.symbol,
        //     current_price, stop_loss, take_profit
        // );

        [current_price, stop_loss, take_profit]
    }

    fn sell(&self, current_price: f64) -> [f64; 3] {
        let stop_loss = current_price + self.stop_loss_value_usd;
        let take_profit = current_price * (1.0 - self.take_profit_percentage);

        // println!(
        //     "{}, Setting up Sell: PRICE: {}, SL: {}, TP: {}",
        //     self.symbol,
        //     current_price, stop_loss, take_profit
        // );

        [current_price, stop_loss, take_profit]
    }
}

#[cfg(test)]
mod tests {
    macro_rules! trade_tests {
        ($($name:ident: $value:expr,)*) => {
        $(
            #[test]
            fn $name() {
                let (movements, expected_prices, expected_trade_status) = $value;

                let mut trader = super::SimpleTrading::new("TEST".to_string(), movements[0], 0.0, 0.03 / 100.0, 5.0, 0.04);

                for movement in movements.iter() {
                    trader.run(*movement);
                }

                let [b, s, tp, sl] = expected_prices;

                assert_eq!(format!("{:.3}", trader.buy_price), format!("{:.3}", b));
                assert_eq!(format!("{:.3}", trader.sell_price), format!("{:.3}", s));
                assert_eq!(format!("{:.3}", trader.profits), format!("{:.3}", tp));
                assert_eq!(format!("{:.3}", trader.losses), format!("{:.3}", sl));
                assert_eq!(trader.trade_active, expected_trade_status);
            }
        )*
        }
    }

    trade_tests! {
        // (movement array, (buy_price, sell_price, take_profit, stop_loss), trade_active)
        none: ([100_010.0, 100_020.0, 100_039.00, 100_039.0, 100_039.0], [0.0, 0.0, 0.0, 0.0], false),
        buy: ([100_000.0, 100_010.0, 100_020.0, 100_042.00, 100_042.0, 100_042.0], [100_042.0, 0.0, 0.0, 0.0], true),
        buy_tp: ([100_000.0, 100_010.0, 100_042.0, 100_042.00, 100_042.0 * 1.00031, 100_042.0 * 1.00031], [0.0, 0.0,  100_042.0 * 0.00031, 0.0], false),
        buy_sl: ([100_000.0, 100_010.0, 100_042.0, 100_042.00, 100_042.0 * (1.0 - 0.00031), 100_042.0 * (1.0 - 0.00031)], [0.0, 0.0, 0.0, 100_042.0 * (0.00031)], false),
        sell: ([100_000.0, 100_010.0, 100_020.0, 100_000.00- 42.0, 100_000.00- 42.0, 100_000.00- 42.0], [0.0, 100_000.00- 42.0, 0.0, 0.0], true),
        sell_tp: ([100_000.0, 100_000.0 - 10.0, 100_000.0 - 42.0, 100_000.0 - 42.0, (100_000.0 - 42.0) * (1.0 - 0.00031), (100_000.0 - 42.0) * (1.0 - 0.00031)], [0.0, 0.0,  (100_000.0 - 42.0) * 0.00031, 0.0], false),
        sell_sl: ([100_000.0, 100_000.0 - 10.0, 100_000.0 - 42.0, 100_000.0 - 42.0, (100_000.0 - 42.0) * (1.0 + 0.00031), (100_000.0 - 42.0) * (1.0 + 0.00031)], [0.0, 0.0,  0.0, (100_000.0 - 42.0) * (0.00031)], false),
    }

    #[test]
    fn test_movement_percentage() {
        let mut trader = super::SimpleTrading::new("BTC".to_string(), 100_000.0, 0.03 / 100.0, 5.0, 0.04);

        let movements = [100_001.0, 100_002.2, 150_000.00];

        for movement in movements.iter() {
            trader.run(*movement);
        }

        let movement_percentage = trader.movement_percentage();

        assert_eq!(movement_percentage, 50.0);
    }
}
