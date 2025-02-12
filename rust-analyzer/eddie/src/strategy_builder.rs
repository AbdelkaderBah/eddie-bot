use redis::{Client, Commands};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub enum Signal {
    BUY,
    SELL,
    HOLD,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndicatorData {
    ma: f64,
    ema: f64,
    pma: f64,
    rsi: Vec<f64>,
    macd: Vec<f64>,
    ml1: MLSignals,
    ml_volume: MLSignals,
    bollinger_bands: Vec<Vec<f64>>,
    timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MLSignals {
    hold: i32,
    buy: i32,
    sell: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndicatorConfig {
    pub(crate) period: i32,
    pub(crate) lookback: Option<i32>,
    pub(crate) threshold: f64,
    pub(crate) weight: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StrategyConfig {
    pub(crate) indicators: HashMap<String, IndicatorConfig>,
}

pub struct StrategyBuilder {
    redis_client: Client,
    config: StrategyConfig,
}

impl StrategyBuilder {
    pub fn new(redis_url: &str, config: StrategyConfig) -> Result<Self, redis::RedisError> {
        Ok(Self {
            redis_client: Client::open(redis_url)?,
            config,
        })
    }

    pub fn evaluate(&self, base_key: &str) -> Result<Signal, Box<dyn std::error::Error>> {
        let mut conn = self.redis_client.get_connection()?;
        let mut buy_score = 0.0;
        let mut sell_score = 0.0;

        for (indicator, config) in &self.config.indicators {
            let data = self.get_indicator_data(&mut conn, base_key, config.period, config.lookback)?;
            match indicator.as_str() {
                "ma" => self.evaluate_ma(&data, config, &mut buy_score, &mut sell_score),
                "ema" => self.evaluate_ema(&data, config, &mut buy_score, &mut sell_score),
                "pma" => self.evaluate_pma(&data, config, &mut buy_score, &mut sell_score),
                "rsi" => self.evaluate_rsi(&data, config, &mut buy_score, &mut sell_score),
                "macd" => self.evaluate_macd(&data, config, &mut buy_score, &mut sell_score),
                "ml1" => self.evaluate_ml(&data.iter().map(|item| {
                    MLSignals { hold: item.ml1.hold, buy: item.ml1.buy, sell: item.ml1.sell }
                }).reduce(|item, prev| {
                    MLSignals { hold: item.hold + prev.hold, buy: item.buy + prev.buy, sell: item.sell + prev.sell }
                }).unwrap(), config, &mut buy_score, &mut sell_score),
                "ml_volume" => self.evaluate_ml(&data.iter().map(|item| {
                    MLSignals { hold: item.ml_volume.hold, buy: item.ml_volume.buy, sell: item.ml_volume.sell }
                }).reduce(|item, prev| {
                    MLSignals { hold: item.hold + prev.hold, buy: item.buy + prev.buy, sell: item.sell + prev.sell }
                }).unwrap(), config, &mut buy_score, &mut sell_score),
                "bollinger" => self.evaluate_bollinger(&data, config, &mut buy_score, &mut sell_score),
                _ => {}
            }
        }

        Ok(self.generate_signal(buy_score, sell_score))
    }

    fn get_indicator_data(&self, conn: &mut redis::Connection, base_key: &str, period: i32, lookback: Option<i32>)
                          -> Result<Vec<IndicatorData>, Box<dyn std::error::Error>> {
        let mut data = Vec::new();
        let lookback = lookback.unwrap_or(1);

        let key = format!("{}", base_key);

        let value: Vec<String> = conn.zrevrange(&key, 0, lookback as isize)?;

        for i in 0..lookback {
            let indicator_data: IndicatorData = serde_json::from_str(&value[i as usize])?;
            data.push(indicator_data);
        }

        Ok(data)
    }

    fn evaluate_ma(&self, data: &[IndicatorData], config: &IndicatorConfig,
                   buy_score: &mut f64, sell_score: &mut f64) {
        if let Some(current) = data.first() {
            if current.ma > current.ema * (1.0 + config.threshold) {
                *buy_score += config.weight;
            } else if current.ma < current.ema * (1.0 - config.threshold) {
                *sell_score += config.weight;
            }
        }
    }

    fn evaluate_ema(&self, data: &[IndicatorData], config: &IndicatorConfig,
                    buy_score: &mut f64, sell_score: &mut f64) {
        if let Some(current) = data.first() {
            if current.ema > current.ma * (1.0 + config.threshold) {
                *buy_score += config.weight;
            } else if current.ema < current.ma * (1.0 - config.threshold) {
                *sell_score += config.weight;
            }
        }
    }

    fn evaluate_pma(&self, data: &[IndicatorData], config: &IndicatorConfig,
                    buy_score: &mut f64, sell_score: &mut f64) {
        if let Some(current) = data.first() {
            if current.pma > current.ma * (1.0 + config.threshold) {
                *buy_score += config.weight;
            } else if current.pma < current.ma * (1.0 - config.threshold) {
                *sell_score += config.weight;
            }
        }
    }

    fn evaluate_rsi(&self, data: &[IndicatorData], config: &IndicatorConfig,
                    buy_score: &mut f64, sell_score: &mut f64) {
        if let Some(current) = data.first() {
            if let Some(rsi) = current.rsi.last() {
                if *rsi < 30.0 - config.threshold {
                    *buy_score += config.weight;
                } else if *rsi > 70.0 + config.threshold {
                    *sell_score += config.weight;
                }
            }
        }
    }

    fn evaluate_macd(&self, data: &[IndicatorData], config: &IndicatorConfig,
                     buy_score: &mut f64, sell_score: &mut f64) {
        if let Some(current) = data.first() {
            if let Some(macd) = current.macd.last() {
                if *macd > config.threshold {
                    *buy_score += config.weight;
                } else if *macd < -config.threshold {
                    *sell_score += config.weight;
                }
            }
        }
    }

    fn evaluate_ml(&self, signals: &MLSignals, config: &IndicatorConfig,
                   buy_score: &mut f64, sell_score: &mut f64) {
        let total = signals.buy + signals.sell + signals.hold;
        if total == 0 {
            return;
        }

        let buy_ratio = signals.buy as f64 / total as f64;
        let sell_ratio = signals.sell as f64 / total as f64;

        if buy_ratio > config.threshold {
            *buy_score += config.weight;
        } else if sell_ratio > config.threshold {
            *sell_score += config.weight;
        }
    }

    fn evaluate_bollinger(&self, data: &[IndicatorData], config: &IndicatorConfig,
                          buy_score: &mut f64, sell_score: &mut f64) {
        if let Some(current) = data.first() {
            if let Some(latest_band) = current.bollinger_bands.last() {
                if latest_band.len() == 3 {
                    let (lower, middle, upper) = (latest_band[0], latest_band[1], latest_band[2]);
                    let price = current.ma;

                    if price < lower * (1.0 + config.threshold) {
                        *buy_score += config.weight;
                    } else if price > upper * (1.0 - config.threshold) {
                        *sell_score += config.weight;
                    }
                }
            }
        }
    }

    fn generate_signal(&self, buy_score: f64, sell_score: f64) -> Signal {
        let threshold = 1.0;

        if buy_score > threshold && buy_score > sell_score {
            Signal::BUY
        } else if sell_score > threshold && sell_score > buy_score {
            Signal::SELL
        } else {
            Signal::HOLD
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strategy_builder() {
        let mut config = HashMap::new();
        config.insert("ma".to_string(), IndicatorConfig {
            period: 14,
            lookback: Some(3),
            threshold: 0.001,
            weight: 1.0,
        });

        let strategy_config = StrategyConfig { indicators: config };
        let builder = StrategyBuilder::new("redis://127.0.0.1/", strategy_config).unwrap();
    }
}