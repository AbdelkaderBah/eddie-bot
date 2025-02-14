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

const SYMBOLS: [&str; 3] = ["BTCUSDT", "ETHUSDT", "ETHBTC"];

fn endpoints() -> Vec<String> {
    SYMBOLS
        .iter()
        .map(|symbol| {
            vec![
                format!("{}@kline_1s", symbol.to_lowercase()),
                // format!("{}@kline_1m", symbol.to_lowercase()),
            ]
        })
        .flatten()
        .collect::<Vec<String>>()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // connect redis
    let client = Client::open("redis://127.0.0.1:6179")?;

    purge_market_data(&client);
    setup_binance();

    loop {
        tokio::time::sleep(Duration::from_secs(30)).await;
    }
}

fn purge_market_data(client: &Client) {
    let mut con = client.get_connection().unwrap();

    // 14 days of information
    const LENGTH_LIMIT: isize = -(86400 * 14);

    // Spawn a background task that runs every 10 seconds
    task::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(10));
        loop {
            interval.tick().await;

            for symbol in SYMBOLS {
                let _: () = con
                    .zremrangebyrank(format!("klines:{}:1s", symbol), 0, LENGTH_LIMIT)
                    .unwrap();

                let _: () = con
                    .zremrangebyrank(format!("klines:{}:1m", symbol), 0, LENGTH_LIMIT)
                    .unwrap();
            }
        }
    });
}

fn setup_binance() {
    task::spawn(async move {
        let mut hooks: HashMap<String, Hooks> = HashMap::new();

        let mut market_redis: Client = Client::open("redis://127.0.0.1:6179").unwrap();

        // @todo: remove all symbols data...

        for symbol in SYMBOLS {
            hooks.insert(
                symbol.to_string(),
                Hooks::new(&mut market_redis.clone(), symbol.to_string()),
            );
        }

        let keep_running = AtomicBool::new(true); // Used to control the event loop

        let mut web_socket = WebSockets::new(|event: WebsocketEvent| {
            match event {
                WebsocketEvent::Kline(event) => {
                    // Use get_mut to borrow the hook mutably
                    if let Some(hook) = hooks.get_mut(&event.symbol) {
                        hook.kline(event)
                    } else {
                        println!("No hook found for symbol: {}", event.symbol);
                    }
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
    });
}
