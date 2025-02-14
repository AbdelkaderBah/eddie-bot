// Define period for each technical indicator that we use, using terms such as: ULTRA SHORT, SHORT, MEDIUM, LONG

#[derive(Debug)]
pub struct IndicatorPeriods {
    pub name: String,
    pub ultra_short: usize,
    pub short: usize,
    pub medium: usize,
    pub long: usize,
}

impl IndicatorPeriods {
    pub fn new(name: String, ultra_short: usize, short: usize, medium: usize, long: usize) -> Self {
        Self {
            name,
            ultra_short,
            short,
            medium,
            long,
        }
    }
}

pub struct TechnicalIndicatorPeriods {
    pub price_variation: IndicatorPeriods,
    pub volume_variation: IndicatorPeriods,
    pub rsi: IndicatorPeriods,
    pub ema: IndicatorPeriods,
    pub sma: IndicatorPeriods,
}

impl TechnicalIndicatorPeriods {
    pub fn new() -> Self {
        Self {
            price_variation: IndicatorPeriods::new("price_variation".to_string(), 7, 14, 21, 28),
            volume_variation: IndicatorPeriods::new("volume_variation".to_string(), 7, 14, 21, 28),
            rsi: IndicatorPeriods::new("rsi".to_string(), 7, 14, 21, 28),
            ema: IndicatorPeriods::new("ema".to_string(), 5, 10, 20, 50),
            sma: IndicatorPeriods::new("sma".to_string(), 5, 10, 20, 50),
        }
    }

    pub fn all_indicators(&self) -> Vec<&IndicatorPeriods> {
        vec![
            &self.price_variation,
            &self.volume_variation,
            &self.rsi,
            &self.ema,
            &self.sma,
        ]
    }

    pub fn long_periods(&self) -> Vec<usize> {
        vec![
            self.price_variation.long,
            self.volume_variation.long,
            self.rsi.long,
            self.ema.long,
            self.sma.long,
        ]
    }
}

pub fn get_longest_period(technical_indicator_periods: &TechnicalIndicatorPeriods) -> usize {
    let mut longest_period = 0;

    for value in technical_indicator_periods.long_periods() {
        let longest = value;
        if longest > longest_period {
            longest_period = longest;
        }
    }

    longest_period
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_longest_strategy_period() {
        let periods = TechnicalIndicatorPeriods::new();
        let longest_period = get_longest_period(&periods);

        assert_eq!(longest_period, 50);
    }

    #[test]
    fn test_output_definitions() {
        let periods = TechnicalIndicatorPeriods::new();
        let indicators = periods.all_indicators();

        for indicator in indicators {
            println!(
                "name: {}, Ultra short: {}, Short: {}, Medium: {}, Long: {}",
                indicator.name,
                indicator.ultra_short,
                indicator.short,
                indicator.medium,
                indicator.long
            );
        }
    }
}
