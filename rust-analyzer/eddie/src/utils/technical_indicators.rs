pub mod technical_indicators {
    use std::fmt::format;
    use dotenv::var;
    use redis::{Client, Commands};

    pub struct PriceVolume {
    }

    impl PriceVolume {
        fn process(&self, key: String, prices: Vec<f64>, all_periods: Vec<usize>, client: &mut Client, score: u64) {
            let mut con = client.get_connection().unwrap();

            tokio::spawn(async move {
                for p in all_periods {
                    let variation_percentage = (prices[0] - prices[p - 1]) / prices[p - 1];

                    // save to redis
                    let _: () = con
                        .lpush(
                            format!("indicators:{}:{}", key, p),
                            format!("{:.4}", variation_percentage * 100.0),
                        )
                        .expect("Connection to Redis failed");
                }
            });
        }

        pub fn process_prices(&self, symbol: String, prices: Vec<f64>, all_periods: Vec<usize>, client: &mut Client, score: u64) {
            self.process(format!("price_variation:{}", symbol), prices, all_periods, client, score);
        }

        pub fn process_volumes(&self, symbol: String, volumes: Vec<f64>, all_periods: Vec<usize>, client: &mut Client, score: u64) {
            self.process(format!("volume_variation:{}", symbol), volumes, all_periods, client, score);
        }
    }
}
