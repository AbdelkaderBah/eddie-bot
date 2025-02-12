pub mod callbacks {
    use binance::model::{DepthOrderBookEvent, KlineEvent};
    use redis::{Client, Commands};
    use serde::{Deserialize, Serialize};

    // Define a struct for Binance Kline Data
    #[derive(Debug, Serialize, Deserialize)]
    struct KlineData {
        open: String,
        high: String,
        low: String,
        close: String,
        volume: String,
        close_time: i64,
    }

    // create a struct to hold depth data
    #[derive(Debug, Serialize, Deserialize)]
    pub struct DepthData {
        pub(crate) total_volume: f64,
        total_asks: f64,
        total_bids: f64,
        pub(crate) timestamp: u64,
    }

    pub struct Callbacks {
        last_price: f64,
        // prices: VecDeque<f64>,
        // buy_volumes: VecDeque<f64>,
        // sell_volumes: VecDeque<f64>,
    }

    impl Callbacks {
        pub fn new() -> Self {
            Self {
                last_price: 0.0,
                // prices: VecDeque::with_capacity(100),
                // buy_volumes: VecDeque::with_capacity(100),
                // sell_volumes: VecDeque::with_capacity(100),
            }
        }

        fn save_data(key: String, value: &String, score: u64, redis: &mut Client) {
            let mut con = redis.get_connection().unwrap();

            let _: () = con.zadd(key, value, score).unwrap();
        }

        fn save_one(key: String, field: &String, value: &String, redis: &mut Client) {
            let mut con = redis.get_connection().unwrap();

            let _: () = con.hset(key, field, value).unwrap();
        }

        pub fn kline(&mut self, event: KlineEvent, redis: &mut Client) {
            if event.kline.is_final_bar == false {
                return;
            }

            // if self.prices.len() == 100 {
            //     self.prices.pop_front();
            // }
            //
            // self.prices.push_back(event.kline.close.parse().unwrap());

            if event.kline.interval == "1s" {
                self.last_price = event.kline.close.parse().unwrap();
                Self::save_one("prices".to_string(), &event.symbol, &event.kline.close, redis);
            }

            let key = format!("klines:{}:{}", event.symbol, event.kline.interval);

            let kline = KlineData {
                close: event.kline.close,
                open: event.kline.open,
                high: event.kline.high,
                low: event.kline.low,
                volume: event.kline.volume,
                close_time: event.kline.close_time,
            };

            let value = serde_json::to_string(&kline).unwrap(); // Serialize struct to JSON
            
            Self::save_data(key, &value, event.event_time, redis);
        }

        pub fn depth(&mut self, event: DepthOrderBookEvent, redis: &mut Client) {
            // used to filter out the volumes that are too far from the best ask/bid price
            const MAX_PRICE_DELTA: f64 = 100.0;

            // if price records are empty return
            if self.last_price == 0.0 {
                return;
            }

            let total_asks: f64 = event
                .asks
                .iter()
                .filter(|item| item.price >= self.last_price + MAX_PRICE_DELTA)
                .map(|item| item.qty)
                .sum();

            let total_bids: f64 = event
                .bids
                .iter()
                .filter(|item| item.price >= self.last_price - MAX_PRICE_DELTA)
                .map(|item| item.qty)
                .sum();

            let total_volume = total_asks + total_bids;

            if total_volume == 0.0 {
                return;
            }

            // if self.sell_volumes.len() == 100 {
            //     self.sell_volumes.pop_front();
            //     self.buy_volumes.pop_front();
            // }
            //
            // self.sell_volumes.push_back(total_bids);
            // self.buy_volumes.push_back(total_asks);

            // println!("Received depth event: symbol: {}, total_volume: {}, total bid volume: {}, total ask volume: {}",
            //     event.symbol, total_volume, total_bid_volume, total_ask_volume);

            let key = format!("depths:{}", event.symbol);

            let depth = DepthData {
                total_asks,
                total_bids,
                total_volume,
                timestamp: event.event_time,
            };

            let value = serde_json::to_string(&depth).unwrap(); // Serialize struct to JSON

            Self::save_data(key, &value, event.event_time, redis);
        }
    }
}
