use crate::processors::binance_hooks::binance_hooks::Hooks;
use binance::websockets::*;
use redis::{self, Client, Commands};
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
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

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    setup_binance();

    loop {
        tokio::time::sleep(Duration::from_secs(30)).await;
    }
}

const TAKE_PROFIT_PERCENTAGE: f64 = 0.002;
// represented in US$.
const STOP_LOSS_VALUE: f64 = 5.0;

fn setup_binance() {
    let keep_running = AtomicBool::new(true); // Used to control the event loop

    const WATCH_MOVEMENT_PERCENTAGE: f64 = 0.02;

    let mut watch_price: f64 = 0.0;
    let mut last_price: f64 = 0.0;

    let mut stop_loss: f64 = 0.0;
    let mut take_profit: f64 = 0.0;

    let mut trade_active: bool = false;
    let mut buy_price: f64 = 0.0;
    let mut sell_price: f64 = 0.0;

    let mut web_socket = WebSockets::new(|event: WebsocketEvent| {
        match event {
            WebsocketEvent::Kline(event) => {
                let current_price: f64 = event.kline.close.parse().unwrap();

                // println!("Current price: {}", current_price);

                // check for price movement when there is no active trade.
                if last_price != 0.0 && (buy_price == 0.0 && sell_price == 0.0) {
                    let price_diff = watch_price - last_price;
                    let price_diff_percentage = (price_diff / last_price) * 100.0;

                    if price_diff_percentage.abs() > WATCH_MOVEMENT_PERCENTAGE {
                        if price_diff_percentage > 0.0 {
                            println!("BUY TIME!! {}, {}%", current_price, price_diff_percentage);

                            let [p, s, t] = buy(current_price);

                            buy_price = p;
                            stop_loss = s;
                            take_profit = t;
                        } else {
                            println!("SELL TIME!! {}, {}%", current_price, price_diff_percentage);
                            let [p, s, t] = sell(current_price);

                            sell_price = p;
                            stop_loss = s;
                            take_profit = t;
                        }
                    }
                }


                // check when there is a buy trade
                if buy_price != 0.0 {
                    if trade_active == false {
                        trade_active = true;
                        buy_price = current_price;
                    }

                    if current_price >= take_profit {
                        println!("Take profit hit: {}, {}", current_price, take_profit);
                        println!("We have made: {}$", take_profit - buy_price);
                        buy_price = 0.0;
                        stop_loss = 0.0;
                        take_profit = 0.0;
                    } else if current_price <= stop_loss {
                        println!("Stop loss hit: {}, {}", current_price, stop_loss);
                        println!("We have lost: {}$", stop_loss - buy_price);
                        buy_price = 0.0;
                        stop_loss = 0.0;
                        take_profit = 0.0;
                    }
                }

                // check when there is a buy trade
                if sell_price != 0.0 {
                    if trade_active == false {
                        trade_active = true;
                        sell_price = current_price;
                    }

                    if current_price <= take_profit {
                        println!("Take profit hit: {}, {}", current_price, take_profit);
                        println!("We have made: {}$", sell_price - take_profit);
                        sell_price = 0.0;
                        stop_loss = 0.0;
                        take_profit = 0.0;
                    } else if current_price >= stop_loss {
                        println!("Stop loss hit: {}, {}", current_price, stop_loss);
                        println!("We have lost: {}$", sell_price - stop_loss);
                        sell_price = 0.0;
                        stop_loss = 0.0;
                        take_profit = 0.0;
                    }
                }

                if watch_price == 0.0 && (buy_price == 0.0 && sell_price == 0.0) {
                    watch_price = current_price;
                }

                last_price = current_price;
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

fn buy(current_price: f64) -> [f64; 3] {
    let stop_loss = current_price - STOP_LOSS_VALUE;
    let take_profit = current_price + (current_price * TAKE_PROFIT_PERCENTAGE);

    [current_price, stop_loss, take_profit]
}

fn sell(current_price: f64) -> [f64; 3] {
    let stop_loss = current_price + STOP_LOSS_VALUE;
    let take_profit = current_price - (current_price * TAKE_PROFIT_PERCENTAGE);

    [current_price, stop_loss, take_profit]
}
