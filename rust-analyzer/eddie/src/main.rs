#![allow(dead_code)]
#![allow(unused_variables)]

use binance::api::Binance;
use binance::websockets::*;
use redis::{self, Commands, PubSubCommands};
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use tokio;
use tokio::time::{self, Duration};

mod definitions;
mod processors;
mod simple_trading;
mod utils;

const SYMBOLS: [&str; 1] = ["BTCUSDT"];

fn endpoints() -> Vec<String> {
    SYMBOLS
        .iter()
        .map(|symbol| vec![format!("{}@kline_1s", symbol.to_lowercase())])
        .flatten()
        .collect::<Vec<String>>()
}

#[tokio::main]
async fn main() {
    setup_binance();

    loop {
        tokio::time::sleep(Duration::from_secs(30)).await;
    }
}

fn setup_binance() {
    let keep_running = AtomicBool::new(true); // Used to control the event loop

    let mut vhakms = vec![
        simple_trading::SimpleTrading::new(
            "BTCUSDT:BIRTH".to_string(),
            0.0,
            0.03 / 100.0,
            5.0,
            0.04,
        ),
        simple_trading::SimpleTrading::new("BTCUSDT:V0".to_string(), 0.0, 0.03 / 100.0, 5.0, 0.06),
        simple_trading::SimpleTrading::new("BTCUSDT:V1".to_string(), 0.0, 0.03 / 100.0, 5.0, 0.09),
        simple_trading::SimpleTrading::new("BTCUSDT:V2".to_string(), 0.0, 0.03 / 100.0, 5.0, 0.1),
        simple_trading::SimpleTrading::new("BTCUSDT:V3".to_string(), 0.0, 0.07 / 100.0, 15.0, 0.12),
        simple_trading::SimpleTrading::new("BTCUSDT:V4".to_string(), 0.0, 0.1 / 100.0, 25.0, 0.15),
        simple_trading::SimpleTrading::new("BTCUSDT:V5".to_string(), 0.0, 0.07 / 100.0, 25.0, 0.07),
        simple_trading::SimpleTrading::new("BTCUSDT:V6".to_string(), 0.0, 0.02 / 100.0, 0.0, 0.04),
        simple_trading::SimpleTrading::new("BTCUSDT:V7".to_string(), 0.0, 0.02 / 100.0, 0.0, 0.08),
        simple_trading::SimpleTrading::new(
            "BTCUSDT:V8".to_string(),
            0.0,
            0.035 / 100.0,
            10.0,
            0.08,
        ),
    ];

    let mut chatgpts = vec![
        simple_trading::SimpleTrading::new("BTCUSDT:V1".to_string(), 0.0, 0.025 / 100.0, 5.0, 0.05),
        simple_trading::SimpleTrading::new(
            "BTCUSDT:V2".to_string(),
            0.0,
            0.035 / 100.0,
            10.0,
            0.08,
        ),
        simple_trading::SimpleTrading::new(
            "CHATGPT:BTCUSDT:V3".to_string(),
            0.0,
            0.05 / 100.0,
            15.0,
            0.10,
        ),
        simple_trading::SimpleTrading::new(
            "CHATGPT:BTCUSDT:V4".to_string(),
            0.0,
            0.02 / 100.0,
            8.0,
            0.06,
        ),
        simple_trading::SimpleTrading::new(
            "CHATGPT:BTCUSDT:V5".to_string(),
            0.0,
            0.06 / 100.0,
            20.0,
            0.12,
        ),
        simple_trading::SimpleTrading::new(
            "CHATGPT:BTCUSDT:V6".to_string(),
            0.0,
            0.04 / 100.0,
            12.0,
            0.09,
        ),
        simple_trading::SimpleTrading::new(
            "CHATGPT:BTCUSDT:V7".to_string(),
            0.0,
            0.03 / 100.0,
            10.0,
            0.07,
        ),
        simple_trading::SimpleTrading::new(
            "CHATGPT:BTCUSDT:V8".to_string(),
            0.0,
            0.07 / 100.0,
            25.0,
            0.15,
        ),
        simple_trading::SimpleTrading::new(
            "CHATGPT:BTCUSDT:V9".to_string(),
            0.0,
            0.045 / 100.0,
            18.0,
            0.11,
        ),
        simple_trading::SimpleTrading::new(
            "CHATGPT:BTCUSDT:V10".to_string(),
            0.0,
            0.015 / 100.0,
            7.0,
            0.04,
        ),
    ];

    let mut gemini_bots = gemini_bots();

    let mut web_socket = WebSockets::new(|event: WebsocketEvent| {
        match event {
            WebsocketEvent::Kline(event) => {
                let current_price = event.kline.close.parse::<f64>().unwrap();

                for bot in &mut vhakms {
                    bot.run(current_price);
                }

                for bot in &mut chatgpts {
                    bot.run(current_price);
                }

                for bot in &mut gemini_bots {
                    bot.run(current_price);
                }

            }
            _ => {
                println!("Received event: {:?}", event);
            }
        };
        Ok(())
    });

    web_socket.connect_multiple_streams(&endpoints()).unwrap();

    if let Err(e) = web_socket.event_loop(&keep_running) {
        match e {
            err => {
                println!("Error: {:?}", err);
            }
        }
    }

    web_socket.disconnect().unwrap();
}

use simple_trading::SimpleTrading; // Assuming this is needed in your Rust code

fn gemini_bots() -> Vec<SimpleTrading> {
    let configs = vec![
        (
            "BTCUSDT:ScalperV1",
            0.015 / 100.0,
            5.0,
            0.02,
        ),
        (
            "BTCUSDT:DayTraderV2",
            0.25 / 100.0,
            15.0,
            0.05,
        ),
        (
            "BTCUSDT:SwingTraderV3",
            0.75 / 100.0,
            30.0,
            0.10,
        ),
        (
            "BTCUSDT:BreakoutHunterV4",
            0.5 / 100.0,
            20.0,
            0.08,
        ),
        (
            "BTCUSDT:ReversalCatcherV5",
            0.3 / 100.0,
            10.0,
            0.03,
        ),
        (
            "BTCUSDT:TrendFollowerV6",
            1.0 / 100.0,
            40.0,
            0.12,
        ),
        (
            "BTCUSDT:VolatilityPlayerV7",
            0.6 / 100.0,
            35.0,
            0.15,
        ),
        (
            "BTCUSDT:RangeBoundV8",
            0.2 / 100.0,
            12.0,
            0.04,
        ),
        (
            "BTCUSDT:MomentumTraderV9",
            0.8 / 100.0,
            25.0,
            0.09,
        ),
        (
            "BTCUSDT:MeanReversionV10",
            0.18 / 100.0,
            8.0,
            0.025,
        ),
    ];

    let trading_bots: Vec<SimpleTrading> = configs.into_iter().map(|config| {
        SimpleTrading::new(
            format!("gemini:{}", config.0.to_string()), // Name
            0.0,                 // Starting price
            config.1,             // Take profit percentage
            config.2,             // Stop loss value in usd
            config.3,             // Price moving in percentage
        )
    }).collect();

    trading_bots
}
