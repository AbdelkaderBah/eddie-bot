pub mod strategy_builder {
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
                let data =
                    self.get_indicator_data(&mut conn, base_key, config.period, config.lookback)?;
                match indicator.as_str() {
                    "ma" => self.evaluate_ma(&data, config, &mut buy_score, &mut sell_score),
                    "ema" => self.evaluate_ema(&data, config, &mut buy_score, &mut sell_score),
                    "pma" => self.evaluate_pma(&data, config, &mut buy_score, &mut sell_score),
                    "rsi" => self.evaluate_rsi(&data, config, &mut buy_score, &mut sell_score),
                    "macd" => self.evaluate_macd(&data, config, &mut buy_score, &mut sell_score),
                    "ml1" => self.evaluate_ml(
                        &data
                            .iter()
                            .map(|item| MLSignals {
                                hold: item.ml1.hold,
                                buy: item.ml1.buy,
                                sell: item.ml1.sell,
                            })
                            .reduce(|item, prev| MLSignals {
                                hold: item.hold + prev.hold,
                                buy: item.buy + prev.buy,
                                sell: item.sell + prev.sell,
                            })
                            .unwrap(),
                        config,
                        &mut buy_score,
                        &mut sell_score,
                    ),
                    "ml_volume" => self.evaluate_ml(
                        &data
                            .iter()
                            .map(|item| MLSignals {
                                hold: item.ml_volume.hold,
                                buy: item.ml_volume.buy,
                                sell: item.ml_volume.sell,
                            })
                            .reduce(|item, prev| MLSignals {
                                hold: item.hold + prev.hold,
                                buy: item.buy + prev.buy,
                                sell: item.sell + prev.sell,
                            })
                            .unwrap(),
                        config,
                        &mut buy_score,
                        &mut sell_score,
                    ),
                    "bollinger" => {
                        self.evaluate_bollinger(&data, config, &mut buy_score, &mut sell_score)
                    }
                    _ => {}
                }
            }

            Ok(self.generate_signal(buy_score, sell_score))
        }

        fn get_indicator_data(
            &self,
            conn: &mut redis::Connection,
            base_key: &str,
            period: i32,
            lookback: Option<i32>,
        ) -> Result<Vec<IndicatorData>, Box<dyn std::error::Error>> {
            let mut data = Vec::new();
            let lookback = lookback.unwrap_or(1);
            let range_end = (period * lookback) as isize - 1;

            // Get data based on period intervals
            let value: Vec<String> = conn.zrevrange(base_key, 0, range_end)?;

            // Process data in period chunks
            for chunk in value.chunks(period as usize) {
                if let Some(latest) = chunk.first() {
                    let indicator_data: IndicatorData = serde_json::from_str(latest)?;
                    data.push(indicator_data);
                }
            }

            Ok(data)
        }

        fn evaluate_ma(
            &self,
            data: &[IndicatorData],
            config: &IndicatorConfig,
            buy_score: &mut f64,
            sell_score: &mut f64,
        ) {
            if data.len() < 2 {
                return;
            }

            let current = &data[0];
            let previous = &data[1];

            let ma_trend = (current.ma - previous.ma) / previous.ma;

            if ma_trend > config.threshold {
                *buy_score += config.weight;
            } else if ma_trend < -config.threshold {
                *sell_score += config.weight;
            }
        }

        fn evaluate_pma(
            &self,
            data: &[IndicatorData],
            config: &IndicatorConfig,
            buy_score: &mut f64,
            sell_score: &mut f64,
        ) {
            if let Some(current) = data.first() {
                if current.pma > current.ma * (1.0 + config.threshold) {
                    *buy_score += config.weight;
                } else if current.pma < current.ma * (1.0 - config.threshold) {
                    *sell_score += config.weight;
                }
            }
        }

        fn evaluate_ema(
            &self,
            data: &[IndicatorData],
            config: &IndicatorConfig,
            buy_score: &mut f64,
            sell_score: &mut f64,
        ) {
            if let Some(current) = data.first() {
                if current.ema > current.ma * (1.0 + config.threshold) {
                    *buy_score += config.weight;
                } else if current.ema < current.ma * (1.0 - config.threshold) {
                    *sell_score += config.weight;
                }
            }
        }

        fn evaluate_rsi(
            &self,
            data: &[IndicatorData],
            config: &IndicatorConfig,
            buy_score: &mut f64,
            sell_score: &mut f64,
        ) {
            if let Some(current) = data.first() {
                if let Some(rsi) = current.rsi.last() {
                    let prev_rsi = data
                        .get(1)
                        .and_then(|d| d.rsi.last())
                        .copied()
                        .unwrap_or(*rsi);

                    let rsi_trend = *rsi - prev_rsi;

                    if *rsi < 30.0 && rsi_trend > 0.0 {
                        *buy_score += config.weight * 1.5; // Amplify oversold conditions
                    } else if *rsi > 70.0 && rsi_trend < 0.0 {
                        *sell_score += config.weight * 1.5;
                    }
                }
            }
        }

        fn evaluate_macd(
            &self,
            data: &[IndicatorData],
            config: &IndicatorConfig,
            buy_score: &mut f64,
            sell_score: &mut f64,
        ) {
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

        fn evaluate_ml(
            &self,
            signals: &MLSignals,
            config: &IndicatorConfig,
            buy_score: &mut f64,
            sell_score: &mut f64,
        ) {
            let total = signals.buy + signals.sell + signals.hold;
            if total == 0 {
                return;
            }

            let buy_ratio = signals.buy as f64 / total as f64;
            let sell_ratio = signals.sell as f64 / total as f64;
            let consensus_strength = (buy_ratio - sell_ratio).abs();

            let adjusted_weight = config.weight * (1.0 + consensus_strength);

            if buy_ratio > config.threshold {
                *buy_score += adjusted_weight;
            } else if sell_ratio > config.threshold {
                *sell_score += adjusted_weight;
            }
        }

        fn evaluate_bollinger(
            &self,
            data: &[IndicatorData],
            config: &IndicatorConfig,
            buy_score: &mut f64,
            sell_score: &mut f64,
        ) {
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
            let adaptive_threshold = 1.0 + (buy_score.max(sell_score) * 0.1);

            if buy_score > adaptive_threshold && buy_score > sell_score * 1.2 {
                Signal::BUY
            } else if sell_score > adaptive_threshold && sell_score > buy_score * 1.2 {
                Signal::SELL
            } else {
                Signal::HOLD
            }
        }
    }

    pub fn load_strategy_config(json_str: &str) -> Result<StrategyConfig, Box<dyn std::error::Error>> {
        let config: StrategyConfig = serde_json::from_str(json_str)?;
        Ok(config)
    }

    pub fn load_strategy_config_from_file(
        path: &str,
    ) -> Result<StrategyConfig, Box<dyn std::error::Error>> {
        let json_str = std::fs::read_to_string(path)?;
        load_strategy_config(&json_str)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_strategy_config() {
        let json = r#"{
            "indicators": {
                "rsi": {
                    "period": 5,
                    "lookback": 3,
                    "threshold": 3.0,
                    "weight": 2.5
                }
            }
        }"#;

        let config = crate::utils::strategy_builder::strategy_builder::load_strategy_config(json).unwrap();
        let rsi_config = config.indicators.get("rsi").unwrap();
        assert_eq!(rsi_config.period, 5);
        assert_eq!(rsi_config.lookback, Some(3));
        assert_eq!(rsi_config.threshold, 3.0);
        assert_eq!(rsi_config.weight, 2.5);
    }

    #[test]
    fn test_strategy_builder() {
        let mut config = std::collections::HashMap::new();
        config.insert(
            "ma".to_string(),
            crate::utils::strategy_builder::strategy_builder::IndicatorConfig {
                period: 14,
                lookback: Some(3),
                threshold: 0.001,
                weight: 1.0,
            },
        );

        let strategy_config = crate::utils::strategy_builder::strategy_builder::StrategyConfig { indicators: config };
        let builder = crate::utils::strategy_builder::strategy_builder::StrategyBuilder::new("redis://127.0.0.1/", strategy_config).unwrap();
    }
}
