#![allow(dead_code)]
#![allow(unused_variables)]

use crate::processors::binance_hooks::binance_hooks::Hooks;
use binance::websockets::*;
use redis::{self, Client, Commands};
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use binance::futures::account::FuturesAccount;
use binance::api::Binance;
use binance::config::Config;
use binance::general::General;
use tokio;
use tokio::task;
use tokio::time::{self, Duration};

mod definitions;
mod processors;
mod utils;
mod simple_trading;

const SYMBOLS: [&str; 1] = ["BTCUSDT"];

fn endpoints() -> Vec<String> {
    SYMBOLS
        .iter()
        .map(|symbol| vec![format!("{}@kline_1s", symbol.to_lowercase())])
        .flatten()
        .collect::<Vec<String>>()
}

// #[tokio::main]
fn main() {
    setup_binance_trades().unwrap();

    // setup_binance();

    // loop {
    //     tokio::time::sleep(Duration::from_secs(30)).await;
    // }
}

fn setup_binance_trades() -> Result<(), Box<dyn std::error::Error>> {
    // let api_key = Some("RHibjd8tUPgykKsKDacWY93o6cxJQtGdCqbphCGWG5htevMcNQbUg5Bp5c1vfZpQ".into());
    // let secret_key = Some("jhb8mgc6KC0q1D7ZMUagog6VsZ4PVn4CcwsyrQ8hnsQCZUxhSzMUmaY0BySb7WNk".into());

    // testnet credentials
    // let api_key = Some("PX4tYSb6nBGMC87oNUWvFgAJxj7fAlfHysMB0ZLG2aN3yvGTI1sIxGK9oUHyhxGR".into());
    // let secret_key = Some("aFhUuyDJJPifrlSDz5WWTYuU0UZ839RGP3Sm62t8u5YSLFPYyT5qrpa8FG1X8Jtz".into());

    // testnet credentials (Futures)
    let api_key = Some("56d2f4cb15d3adc743f493ca31d588457ec80af37fb27126c8884bdf6df6124c".into());
    let secret_key = Some("5c3e116b5e49ada0ef08aa56334c9e1f46b739bc9d669f1ba3c1ea52ca30f31f".into());


    let config = Config::default().set_rest_api_endpoint("https://testnet.binancefuture.com")
        .set_futures_rest_api_endpoint("https://testnet.binancefuture.com");
    // let config = Config::default().set_rest_api_endpoint("https://testnet.binance.vision");
    // let config = Config::default().set_rest_api_endpoint("https://fapi.binance.com");

    let account: FuturesAccount = Binance::new_with_config(api_key, secret_key, &config);

    let redis = Client::open("redis://127.0.0.1:6179")?;

    redis.get_connection().unwrap().hset("test_key", "test_value", "AAA").unwrap();

    match account.account_balance() {
        Ok(answer) => println!("{:?}", answer),
        Err(e) => println!("Error: {:?}", e),
    }

    // match account.get_open_orders("BTCUSDT") {
    //     Ok(answer) => println!("{:?}", answer),
    //     Err(e) => println!("Error: {:?}", e),
    // }

    Ok(())
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

    web_socket.connect_multiple_streams(&endpoints()).unwrap(); // check error
                                                                // web_socket.connect(&depth).unwrap(); // check error

    if let Err(e) = web_socket.event_loop(&keep_running) {
        match e {
            err => {
                println!("Error: {:?}", err);
            }
        }
    }

    web_socket.disconnect().unwrap();
}