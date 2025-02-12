use crate::callbacks::callbacks::DepthData;
use crate::ml_knn_wo_learning;
use crate::ml_knn_wo_learning::{run_strategy, MarketData};
use chrono::{DateTime, Utc};
use redis::{Client, Connection};
use redis::Commands;
use serde::Deserialize;
use serde::Serialize;
use std::error::Error;

#[derive(Debug, Deserialize)]
struct KlineData {
    open: String,
    high: String,
    low: String,
    close: String,
    volume: String,
    close_time: i64,
}
#[derive(Debug, Serialize, Deserialize)]
struct MlOneData {
    hold: i64,
    buy: i64,
    sell: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndicatorData {
    ma: f64,
    ema: f64,
    pma: f64,
    rsi: Vec<f64>,
    macd: Vec<f64>,
    ml1: MlOneData,
    ml_volume: MlOneData,
    bollinger_bands: Vec<(f64, f64, f64)>,
    timestamp: i64,
}



pub struct Indicators<'a> {
    redis_client: &'a mut Connection,
    symbol: String,
    frequency: String,
}

impl<'a> Indicators<'a> {
    pub fn new(client: &'a mut Connection, symbol: &str) -> Result<Self, Box<dyn Error>> {
        Ok(Self {
            symbol: symbol.to_string(),
            redis_client: client,
            frequency: "1s".to_string(),
        })
    }

    // Fetch last set of prices from sorted set "klines:{symbol}:{frequency}"
    pub async fn fetch_prices(&mut self) -> Result<Vec<f64>, Box<dyn Error>> {
        let con = &mut self.redis_client;

        let now = Utc::now().timestamp() * 1000;
        let mut start = now - (60 * 1000);

        if self.frequency == "1m" {
            start = now - (60 * 60 * 1000);
        }

        let values: Vec<String> = con.zrangebyscore(
            format!("klines:{}:{}", self.symbol, self.frequency),
            start,
            now,
        ).unwrap();

        let mut prices = Vec::new();
        for value in values {
            // Parse JSON and extract the "close" price
            if let Ok(data) = serde_json::from_str::<KlineData>(&value) {
                if let Ok(close) = data.close.parse::<f64>() {
                    prices.push(close);
                }
            }
        }

        Ok(prices)
    }

    pub fn set_frequency(&mut self, frequency: &str) {
        self.frequency = frequency.to_string();
    }

    // Run indicator collection: fetch prices and compute signals.
    pub async fn run(&mut self) -> Result<(), Box<dyn Error>> {
        let prices = self.fetch_prices().await?;

        if prices.len() < 20 {
            println!("{}:{} indicators says: Prices not met... {}", self.symbol, self.frequency, prices.len());

            return Ok(());
        }

        let ma = rust_ti::moving_average::single::moving_average(
            &prices,
            &rust_ti::MovingAverageType::Simple,
        );

        let ema = rust_ti::moving_average::single::moving_average(
            &prices,
            &rust_ti::MovingAverageType::Exponential,
        );

        // The values used in the example for the personalised moving average are random.
        // If using the PMA, it is recommended to look into how the moving averages are calculated before using values.
        let pma = rust_ti::moving_average::single::moving_average(
            &prices,
            &rust_ti::MovingAverageType::Personalised(&5.0, &3.0),
        );

        let rsi = rust_ti::momentum_indicators::bulk::relative_strength_index(
            &prices,
            &rust_ti::ConstantModelType::SmoothedMovingAverage,
            &prices.len(),
        );

        let macd = rust_ti::momentum_indicators::bulk::macd_line(
            &prices,
            &10,
            &rust_ti::ConstantModelType::SimpleMovingAverage,
            &prices.len(),
            &rust_ti::ConstantModelType::SimpleMovingAverage,
        );

        // let bollinger_bands = &rust_ti::standard_indicators::bulk::bollinger_bands(&prices)[0..10];
        let bollinger_bands: Vec<(f64, f64, f64)> =
            rust_ti::standard_indicators::bulk::bollinger_bands(&prices)
                .iter()
                .take(10)
                .cloned()
                .collect();
        let ml1 = self.ml_one();
        let ml_volume = self.ml_volume();

        let timestamp = Utc::now().timestamp();

        let values = IndicatorData {
            ma,
            bollinger_bands,
            ema,
            pma,
            rsi,
            macd,
            ml1,
            ml_volume,
            timestamp
        };

        let value = serde_json::to_string(&values).unwrap(); // Serialize struct to JSON

        let now = Utc::now().timestamp();

        let mut con = &mut self.redis_client;

        let _: () = con
            .zadd(format!("indicators:{}:{}", self.symbol, self.frequency), value, now)
            .unwrap();

        Ok(())
    }

    fn ml_one(&mut self) -> MlOneData {
        let mut con = &mut self.redis_client;

        let prices: Vec<String> = con
            .zrange(format!("klines:{}:{}", self.symbol, self.frequency), -100, -1)
            .unwrap();

        // Let's group prices by close_time
        let mut data: MarketData = MarketData {
            close: Vec::new(),
            high: Vec::new(),
            low: Vec::new(),
            volume: Vec::new(),
            timestamp: Vec::new(),
        };

        for i in 0..prices.len() {
            let price = prices[i].clone();
            let kline: KlineData = serde_json::from_str(&price).unwrap();

            data.close.push(kline.close.parse().unwrap());
            data.high.push(kline.high.parse().unwrap());
            data.low.push(kline.low.parse().unwrap());
            data.volume.push(kline.volume.parse().unwrap());

            let seconds = kline.close_time / 1000;
            let millis = (kline.close_time % 1000) as u32;
            let nanos = millis * 1_000_000;

            // Convert to a timezone-aware DateTime<Utc>
            let datetime: Option<DateTime<Utc>> = DateTime::from_timestamp(seconds, nanos);

            data.timestamp.push(datetime.unwrap());
        }

        let signals = run_strategy(data);

        let mut output = MlOneData {
            hold: 0,
            buy: 0,
            sell: 0,
        };

        for signal in signals {
            match signal {
                ml_knn_wo_learning::BUY => {
                    output.buy += 1;
                }
                ml_knn_wo_learning::SELL => {
                    output.sell += 1;
                }
                ml_knn_wo_learning::CLEAR => {
                    output.hold += 1;
                }
                _ => {}
            }
        }

        output
    }

    fn ml_volume(&mut self) -> MlOneData {
        let mut con = &mut self.redis_client;
        let volumes: Vec<String> = con
            .zrange(format!("depths:{}", self.symbol), -500, -1)
            .unwrap();

        // Let's group prices by close_time
        let mut data: MarketData = MarketData {
            close: Vec::new(),
            high: Vec::new(),
            low: Vec::new(),
            volume: Vec::new(),
            timestamp: Vec::new(),
        };

        let mut temp = Vec::new();

        for i in 0..volumes.len() {
            let volume = volumes[i].clone();
            let depth: DepthData = serde_json::from_str(&volume).unwrap();

            temp.push(depth.total_volume);

            if temp.len() == 5 {
                let sum: f64 = temp.iter().sum();

                data.close.push(depth.total_volume);
                data.high.push(
                    temp.clone()
                        .into_iter()
                        .max_by(|a, b| a.partial_cmp(b).unwrap())
                        .unwrap()
                        .to_owned(),
                );
                data.low.push(
                    temp.clone()
                        .into_iter()
                        .min_by(|a, b| a.partial_cmp(b).unwrap())
                        .unwrap()
                        .to_owned(),
                );
                data.volume.push(sum);
                temp.clear();

                let seconds = depth.timestamp / 1000;
                let millis = (depth.timestamp % 1000) as u32;
                let nanos = millis * 1_000_000;

                // Convert to a timezone-aware DateTime<Utc>
                let datetime: Option<DateTime<Utc>> =
                    DateTime::from_timestamp(seconds as i64, nanos);

                data.timestamp.push(datetime.unwrap());
            }
        }

        let signals = run_strategy(data);

        let mut output = MlOneData {
            hold: 0,
            buy: 0,
            sell: 0,
        };

        for signal in signals {
            match signal {
                ml_knn_wo_learning::BUY => {
                    output.buy += 1;
                }
                ml_knn_wo_learning::SELL => {
                    output.sell += 1;
                }
                ml_knn_wo_learning::CLEAR => {
                    output.hold += 1;
                }
                _ => {}
            }
        }

        output
    }
}
