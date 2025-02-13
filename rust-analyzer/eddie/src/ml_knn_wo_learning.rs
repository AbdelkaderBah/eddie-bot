use chrono::{DateTime, Utc};
use std::collections::VecDeque;

pub(crate) const BUY: i32 = 1;
pub(crate) const SELL: i32 = -1;
pub(crate) const CLEAR: i32 = 0;

#[derive(Debug)]
pub struct MarketData {
    pub close: Vec<f64>,
    pub high: Vec<f64>,
    pub low: Vec<f64>,
    pub volume: Vec<f64>,
    pub timestamp: Vec<DateTime<Utc>>,
}

#[derive(Debug)]
pub struct KnnStrategy {
    short_window: usize,
    long_window: usize,
    base_k: usize,
    k: usize,
    bars_threshold: usize,
    use_volatility_filter: bool,
    feature1: Vec<f64>,
    feature2: Vec<f64>,
    directions: Vec<i32>,
    predictions: VecDeque<i32>,
    current_bars: usize,
    current_signal: i32,
}

impl KnnStrategy {
    pub fn new(
        short_window: usize,
        long_window: usize,
        base_k: usize,
        bars_threshold: usize,
        use_volatility_filter: bool,
    ) -> Self {
        let k = (base_k as f64).sqrt().floor() as usize;
        KnnStrategy {
            short_window,
            long_window,
            base_k,
            k,
            bars_threshold,
            use_volatility_filter,
            feature1: Vec::new(),
            feature2: Vec::new(),
            directions: Vec::new(),
            predictions: VecDeque::with_capacity(k),
            current_bars: 0,
            current_signal: CLEAR,
        }
    }

    fn minimax(series: &[f64], period: usize, min: f64, max: f64) -> f64 {
        if series.len() < period {
            return 0.0;
        }
        let window = &series[series.len().saturating_sub(period)..];
        let hi = window.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));
        let lo = window.iter().fold(f64::INFINITY, |a, &b| a.min(b));
        if (hi - lo).abs() < f64::EPSILON {
            return min;
        }
        (max - min) * (series.last().unwrap() - lo) / (hi - lo) + min
    }

    fn calculate_rsi(&self, prices: &[f64], period: usize) -> f64 {
        if prices.len() < period + 1 {
            return 50.0;
        }

        let mut gains = 0.0;
        let mut losses = 0.0;

        for i in 1..=period {
            let diff = prices[prices.len() - i] - prices[prices.len() - i - 1];
            if diff > 0.0 {
                gains += diff;
            } else {
                losses -= diff;
            }
        }

        if losses == 0.0 {
            return 100.0;
        }

        let rs = gains / losses;
        100.0 - (100.0 / (1.0 + rs))
    }

    fn calculate_features(&self, data: &MarketData) -> (f64, f64) {
        let close_prices = &data.close;
        // let volume = &data.volume;

        let rs = self.calculate_rsi(close_prices, self.long_window);
        let rf = self.calculate_rsi(close_prices, self.short_window);

        // let vs = Self::minimax(volume, self.long_window, 0.0, 99.0);
        // let vf = Self::minimax(volume, self.short_window, 0.0, 99.0);

        (rs, rf)
    }

    pub fn update(&mut self, data: &MarketData) -> i32 {
        if data.close.len() < 2 {
            return CLEAR;
        }

        let (f1, f2) = self.calculate_features(data);

        // Calculate class label based on price movement
        let class_label = if data.close[data.close.len() - 1] > data.close[data.close.len() - 2] {
            BUY
        } else if data.close[data.close.len() - 1] < data.close[data.close.len() - 2] {
            SELL
        } else {
            CLEAR
        };

        // Store training data
        self.feature1.push(f1);
        self.feature2.push(f2);
        self.directions.push(class_label);

        // kNN algorithm implementation
        let mut max_dist = f64::NEG_INFINITY;

        for i in 0..self.directions.len() {
            let d = ((f1 - self.feature1[i]).powi(2) + (f2 - self.feature2[i]).powi(2)).sqrt();

            if d > max_dist {
                max_dist = d;
                if self.predictions.len() >= self.k {
                    self.predictions.pop_front();
                }
                self.predictions.push_back(self.directions[i]);
            }
        }

        // Calculate prediction
        let prediction: i32 = self.predictions.iter().sum();

        // Apply volatility filter if enabled
        let filter_passed = if self.use_volatility_filter {
            // Simplified volatility filter
            true // Implement actual volatility calculation if needed
        } else {
            true
        };

        // Generate trading signal
        let signal = if self.current_bars >= self.bars_threshold {
            self.current_bars = 0;
            CLEAR
        } else {
            self.current_bars += 1;
            if prediction > 0 && filter_passed {
                BUY
            } else if prediction < 0 && filter_passed {
                SELL
            } else {
                self.current_signal
            }
        };

        self.current_signal = signal;
        signal
    }
}

// Example usage function
pub fn run_strategy(data: MarketData) -> Vec<i32> {
    let mut strategy = KnnStrategy::new(14, 28, 252, 300, false);
    let mut signals = Vec::new();

    for i in 0..data.close.len() {
        let subset = MarketData {
            close: data.close[0..=i].to_vec(),
            high: data.high[0..=i].to_vec(),
            low: data.low[0..=i].to_vec(),
            volume: data.volume[0..=i].to_vec(),
            timestamp: data.timestamp[0..=i].to_vec(),
        };

        let signal = strategy.update(&subset);
        signals.push(signal);
    }

    signals
}
