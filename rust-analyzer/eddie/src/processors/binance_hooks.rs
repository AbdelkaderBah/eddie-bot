pub mod binance_hooks {
    use crate::definitions::{IndicatorPeriods, TechnicalIndicatorPeriods};
    use crate::utils::technical_indicators::technical_indicators::PriceVolume;
    use binance::model::KlineEvent;
    use redis::{Client, Commands};
    use serde::{Deserialize, Serialize};
    use std::collections::VecDeque;
    use chrono::Utc;

    #[derive(Debug, Serialize, Deserialize)]
    struct KlineData {
        open: String,
        high: String,
        low: String,
        close: String,
        volume: String,
        close_time: i64,
    }

    pub struct Hooks {
        symbol: String,
        redis: Client,
        last_price: f64,
        ti: TechnicalIndicatorPeriods,
        prices: VecDeque<f64>,
        volumes: VecDeque<f64>,
    }

    impl Hooks {
        pub fn new(client: &mut Client, symbol: String) -> Self {
            let ti = TechnicalIndicatorPeriods::new();

            Self {
                symbol,
                ti: TechnicalIndicatorPeriods::new(),
                redis: client.clone(),
                last_price: 0.0,
                prices: VecDeque::with_capacity(ti.price_variation.long + 1),
                volumes: VecDeque::with_capacity(ti.volume_variation.long + 1),
            }
        }

        fn save_data(&self, key: String, value: &String, score: u64) {
            let mut con = self.redis.get_connection().unwrap();

            let _: () = con.zadd(key, value, score).unwrap();
        }

        fn save_one(&self, key: String, field: &String, value: &String) {
            let mut con = self.redis.get_connection().unwrap();

            let _: () = con.hset(key, field, value).unwrap();
        }

        pub fn kline(&mut self, event: KlineEvent) {
            if event.kline.is_final_bar == false {
                return;
            }

            let score = Utc::now().timestamp() as u64;


            self.prices.push_front(event.kline.close.parse().unwrap());
            self.volumes.push_front(event.kline.volume.parse().unwrap());

            self.indicators(score);

            if event.kline.interval == "1s" {
                self.last_price = event.kline.close.parse().unwrap();

                self.save_one(
                    "prices".to_string(),
                    &event.symbol,
                    &event.kline.close,
                );
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

            self.save_data(key, &value, event.event_time);
        }

        fn indicators(&mut self, score: u64) {
            if self.prices.len() > self.ti.price_variation.long {
                // remove last element of prices
                self.prices.pop_back();
                self.volumes.pop_back();

                let mut client = self.redis.clone();

                let pv = PriceVolume {};

                pv.process_prices(
                    self.symbol.to_string(),
                    Vec::from(self.prices.clone()),
                    self.ti.price_variation.all_periods(),
                    &mut client,
                    score,
                );

                pv.process_volumes(
                    self.symbol.to_string(),
                    Vec::from(self.volumes.clone()),
                    self.ti.volume_variation.all_periods(),
                    &mut client,
                    score,
                );

            }


        }
    }
}
