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

    let mut simple_trading = simple_trading::SimpleTrading::new("BTCUSDT".to_string(), 0.0);

    let mut web_socket = WebSockets::new(|event: WebsocketEvent| {
        match event {
            WebsocketEvent::Kline(event) => {
                simple_trading.run(event.kline.close.parse::<f64>().unwrap());
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
