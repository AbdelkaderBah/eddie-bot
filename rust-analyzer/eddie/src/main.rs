#![allow(dead_code)]
#![allow(unused_variables)]

use binance::api::Binance;
use binance::websockets::*;
use redis::{self, Commands, PubSubCommands};
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

    let mut simple_trading = simple_trading::SimpleTrading::new("BTCUSDT:DEFAULT".to_string(), 0.0, 0.03 / 100.0, 5.0, 0.04);
    let mut simple_trading_v2 = simple_trading::SimpleTrading::new("BTCUSDT:V0".to_string(), 0.0, 0.03 / 100.0, 5.0, 0.06);
    let mut simple_trading_v3 = simple_trading::SimpleTrading::new("BTCUSDT:V1".to_string(), 0.0, 0.03 / 100.0, 5.0, 0.09);
    let mut simple_trading_v4 = simple_trading::SimpleTrading::new("BTCUSDT:V2".to_string(), 0.0, 0.03 / 100.0, 5.0, 0.1);
    let mut simple_trading_v5 = simple_trading::SimpleTrading::new("BTCUSDT:V3".to_string(), 0.0, 0.07 / 100.0, 15.0, 0.12);
    let mut simple_trading_v6 = simple_trading::SimpleTrading::new("BTCUSDT:V4".to_string(), 0.0, 0.1 / 100.0, 25.0, 0.15);
    let mut simple_trading_v7 = simple_trading::SimpleTrading::new("BTCUSDT:V5".to_string(), 0.0, 0.07 / 100.0, 25.0, 0.07);
    let mut simple_trading_v8 = simple_trading::SimpleTrading::new("BTCUSDT:V6".to_string(), 0.0, 0.02 / 100.0, 0.0, 0.04);
    let mut simple_trading_v9 = simple_trading::SimpleTrading::new("BTCUSDT:V7".to_string(), 0.0, 0.02 / 100.0, 0.0, 0.08);
    let mut simple_trading_v10 = simple_trading::SimpleTrading::new("BTCUSDT:V8".to_string(), 0.0, 0.035 / 100.0, 10.0, 0.08);

    let mut web_socket = WebSockets::new(|event: WebsocketEvent| {
        match event {
            WebsocketEvent::Kline(event) => {
                simple_trading.run(event.kline.close.parse::<f64>().unwrap());
                simple_trading_v2.run(event.kline.close.parse::<f64>().unwrap());
                simple_trading_v3.run(event.kline.close.parse::<f64>().unwrap());
                simple_trading_v4.run(event.kline.close.parse::<f64>().unwrap());
                simple_trading_v5.run(event.kline.close.parse::<f64>().unwrap());
                simple_trading_v6.run(event.kline.close.parse::<f64>().unwrap());
                simple_trading_v7.run(event.kline.close.parse::<f64>().unwrap());
                simple_trading_v8.run(event.kline.close.parse::<f64>().unwrap());
                simple_trading_v9.run(event.kline.close.parse::<f64>().unwrap());
                simple_trading_v10.run(event.kline.close.parse::<f64>().unwrap());
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
