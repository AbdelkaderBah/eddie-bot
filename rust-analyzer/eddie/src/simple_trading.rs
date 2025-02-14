use crate::STOP_LOSS_VALUE;

pub struct SimpleTrading {
    pub symbol: String,
    pub last_price: f64,
    pub watch_price: f64,
    pub buy_price: f64,
    pub sell_price: f64,
    pub stop_loss: f64,
    pub take_profit: f64,
    pub trade_active: bool,
}

const TAKE_PROFIT_PERCENTAGE: f64 = 0.02;
const STOP_LOSS_VALUE_USD: f64 = 5.0;
const WATCH_MOVEMENT_PERCENTAGE: f64 = 0.04;

impl SimpleTrading {
    pub fn new(symbol: String, price: f64) -> Self {
        Self {
            symbol,
            watch_price: price,
            last_price: 0.0,
            buy_price: 0.0,
            sell_price: 0.0,
            stop_loss: 0.0,
            take_profit: 0.0,
            trade_active: false,
        }
    }

    pub fn movement_percentage(&self) -> f64 {
        let price_diff = self.last_price - self.watch_price;
        (price_diff / self.watch_price) * 100.0
    }

    pub fn run(&mut self, price: f64) {
        // println!("Current price: {}", current_price);

        // check for price movement when there is no active trade.
        if self.last_price != 0.0 && (self.buy_price == 0.0 && self.sell_price == 0.0) {
            let price_diff_percentage = self.movement_percentage();

            if price_diff_percentage.abs() > WATCH_MOVEMENT_PERCENTAGE {
                if price_diff_percentage > 0.0 {
                    println!("BUY TIME!! {}, {}%", &price, price_diff_percentage);

                    let [p, s, t] = Self::buy(price);

                    self.buy_price = p;
                    self.stop_loss = s;
                    self.take_profit = t;
                } else {
                    println!("SELL TIME!! {}, {}%", &price, price_diff_percentage);
                    let [p, s, t] = Self::sell(price);

                    self.sell_price = p;
                    self.stop_loss = s;
                    self.take_profit = t;
                }
            }
        }

        // check when there is a buy trade
        if self.buy_price != 0.0 {
            if self.trade_active == false {
                self.trade_active = true;
                self.buy_price = price;
            }

            if price >= self.take_profit {
                println!("Take profit hit: {}, {}", price, self.take_profit);
                println!("We have made: {}$", self.take_profit - self.buy_price);
                self.buy_price = 0.0;
                self.stop_loss = 0.0;
                self.take_profit = 0.0;
                self.trade_active = false;
            } else if price <= self.stop_loss {
                println!("Stop loss hit: {}, {}", price, self.stop_loss);
                println!("We have lost: {}$", self.stop_loss - self.buy_price);
                self.buy_price = 0.0;
                self.stop_loss = 0.0;
                self.take_profit = 0.0;
                self.trade_active = false;
            }
        }

        // check when there is a buy trade
        if self.sell_price != 0.0 {
            if self.trade_active == false {
                self.trade_active = true;
                self.sell_price = price;
            }

            if price <= self.take_profit {
                println!("Take profit hit: {}, {}", price, self.take_profit);
                println!("We have made: {}$", self.sell_price - self.take_profit);
                self.sell_price = 0.0;
                self.stop_loss = 0.0;
                self.take_profit = 0.0;
                self.trade_active = false;
            } else if price >= self.stop_loss {
                println!("Stop loss hit: {}, {}", price, self.stop_loss);
                println!("We have lost: {}$", self.sell_price - self.stop_loss);
                self.sell_price = 0.0;
                self.stop_loss = 0.0;
                self.take_profit = 0.0;
                self.trade_active = false;
            }
        }

        if self.watch_price == 0.0 && (self.buy_price == 0.0 && self.sell_price == 0.0) {
            self.watch_price = price;
        }

        self.last_price = price;
    }

    fn buy(current_price: f64) -> [f64; 3] {
        let stop_loss = current_price - STOP_LOSS_VALUE;
        let take_profit = current_price + (current_price * crate::TAKE_PROFIT_PERCENTAGE);

        [current_price, stop_loss, take_profit]
    }

    fn sell(current_price: f64) -> [f64; 3] {
        let stop_loss = current_price + STOP_LOSS_VALUE;
        let take_profit = current_price - (current_price * crate::TAKE_PROFIT_PERCENTAGE);

        [current_price, stop_loss, take_profit]
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_movement_percentage() {
        let mut trader = super::SimpleTrading::new("BTC".to_string(), 100_000.0);

        let movements = [100_001.0, 100_002.2, 150_000.00];

        for movement in movements.iter() {
            trader.run(*movement);
        }

        let movement_percentage = trader.movement_percentage();

        assert_eq!(movement_percentage, 50.0);
    }

    macro_rules! trade_tests {
        ($($name:ident: $value:expr,)*) => {
        $(
            #[test]
            fn $name() {
                let (movements, expected_prices, expected_trade_status) = $value;

                let mut trader = super::SimpleTrading::new("TEST".to_string(), movements[0]);

                for movement in movements.iter() {
                    trader.run(*movement);
                }

                let [b, s] = expected_prices;

                assert_eq!(trader.buy_price, b);
                assert_eq!(trader.sell_price, s);
                assert_eq!(trader.trade_active, expected_trade_status);
            }
        )*
        }
    }

    trade_tests! {
        no_trade: ([100_010.0, 100_020.0, 100_039.00, 100_039.0, 100_039.0], [0.0, 0.0], false),
        no_trade: ([100_010.0, 100_020.0, 100_039.00, 100_039.0, 100_039.0], [0.0, 0.0], false),
    }

    // #[test]
    // fn test_no_trade() {
    //     let mut trader = super::SimpleTrading::new("BTC".to_string(), 100_000.0);
    //
    //     let movements = [100_010.0, 100_020.0, 100_039.00, 100_039.0, 100_039.0];
    //
    //     for movement in movements.iter() {
    //         trader.run(*movement);
    //
    //         let movement_percentage = trader.movement_percentage();
    //
    //         assert_eq!(trader.buy_price, 0.0);
    //         assert_eq!(trader.sell_price, 0.0);
    //         assert_eq!(trader.trade_active, false);
    //     }
    // }
    //
    // #[test]
    // fn test_buy_trade() {
    //     let mut trader = super::SimpleTrading::new("BTC".to_string(), 100_000.0);
    //
    //     let movements = [100_010.0, 100_020.0, 100_042.00, 100_042.0, 100_042.0];
    //
    //     for movement in movements.iter() {
    //         trader.run(*movement);
    //
    //         let movement_percentage = trader.movement_percentage();
    //     }
    //
    //     assert_eq!(trader.buy_price, 100_042.0);
    //     assert_eq!(trader.sell_price, 0.0);
    //     assert_eq!(trader.trade_active, true);
    // }
    //
    // #[test]
    // fn test_sell_trade() {
    //     let mut trader = super::SimpleTrading::new("BTC".to_string(), 100_000.0);
    //
    //     let movements = [
    //         100_010.0,
    //         100_020.0,
    //         100_000.00 - 42.0,
    //         100_000.00 - 42.0,
    //         100_000.00 - 42.0,
    //     ];
    //
    //     for movement in movements.iter() {
    //         trader.run(*movement);
    //
    //         let movement_percentage = trader.movement_percentage();
    //     }
    //
    //     assert_eq!(trader.buy_price, 0.0);
    //     assert_eq!(trader.sell_price, 100_000.00 - 42.0);
    //     assert_eq!(trader.trade_active, true);
    // }
}
