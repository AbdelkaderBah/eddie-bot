mod callbacks;

use binance::websockets::*;
use callbacks::callbacks::Callbacks;
use redis::{self, Client, Commands};
use std::sync::atomic::AtomicBool;
use tokio;
use tokio::task;
use tokio::time::{self, Duration};

mod definitions;
mod indicators;
mod ml_knn_wo_learning;
mod strategy_builder;

use indicators::Indicators;

const SYMBOLS: [&str; 3] = ["BTCUSDT", "ETHUSDT", "ETHBTC"];

fn endpoints() -> Vec<String> {
    SYMBOLS
        .iter()
        .map(|symbol| {
            vec![
                format!("{}@kline_1s", symbol.to_lowercase()),
                format!("{}@kline_1m", symbol.to_lowercase()),
                format!("{}@depth@1000ms", symbol.to_lowercase()),
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
    collect_indicators();
    setup_binance();

    loop {
        tokio::time::sleep(Duration::from_secs(30)).await;

        // let mut conn = client.get_connection().unwrap();
        // let value: String = conn.hget("strategies", "scalping_low_risk").unwrap();
        //
        // let builder = StrategyBuilder::new(
        //     "redis://127.0.0.1:6179", strategy_builder::load_strategy_config(&*value).unwrap()
        // ).unwrap();
        //
        // let value = builder.evaluate("indicators:BTCUSDT:1s").unwrap();
        //
        // println!("Strategy response: {:?}", &value);
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
                    .zremrangebyrank(format!("depths:{}", symbol), 0, LENGTH_LIMIT)
                    .unwrap();

                let _: () = con
                    .zremrangebyrank(format!("klines:{}:1s", symbol), 0, LENGTH_LIMIT)
                    .unwrap();

                let _: () = con
                    .zremrangebyrank(format!("klines:{}:1m", symbol), 0, LENGTH_LIMIT)
                    .unwrap();

                let _: () = con
                    .zremrangebyrank(format!("indicators:{}:1s", symbol), 0, LENGTH_LIMIT)
                    .unwrap();

                let _: () = con
                    .zremrangebyrank(format!("indicators:{}:1m", symbol), 0, LENGTH_LIMIT)
                    .unwrap();
            }
        }
    });
}

fn setup_binance() {
    task::spawn(async move {
        let keep_running = AtomicBool::new(true); // Used to control the event loop
        let mut callback: Callbacks = Callbacks::new();

        let mut market_redis: Client = Client::open("redis://127.0.0.1:6179").unwrap();

        let mut web_socket = WebSockets::new(|event: WebsocketEvent| {
            match event {
                WebsocketEvent::Kline(event) => callback.kline(event, &mut market_redis),
                WebsocketEvent::DepthOrderBook(event) => callback.depth(event, &mut market_redis),
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

fn collect_indicators() {
    for symbol in SYMBOLS {
        for frequency in ["1s", "1m"].iter() {
            let mut indicators = Indicators::new(symbol).unwrap();

            task::spawn(async move {
                let mut interval = time::interval(Duration::from_secs(match { frequency } {
                    &"1s" => 10,
                    &"1m" => 60,
                    _ => 10,
                }));

                loop {
                    interval.tick().await;

                    // println!("{}:{} indicators says: Running...", symbol, frequency);

                    indicators.set_frequency(frequency);
                    indicators.run().await.unwrap();
                }
            });
        }
    }
}
