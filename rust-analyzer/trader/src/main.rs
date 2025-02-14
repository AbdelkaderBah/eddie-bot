use binance::api::Binance;
use binance::config::Config;
use binance::futures::account::FuturesAccount;
use redis::{self, Client, PubSubCommands};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // testnet credentials (Futures)
    let api_key = Some("56d2f4cb15d3adc743f493ca31d588457ec80af37fb27126c8884bdf6df6124c".into());
    let secret_key =
        Some("5c3e116b5e49ada0ef08aa56334c9e1f46b739bc9d669f1ba3c1ea52ca30f31f".into());

    let config = Config::default()
        .set_rest_api_endpoint("https://testnet.binancefuture.com")
        .set_futures_rest_api_endpoint("https://testnet.binancefuture.com");

    let account: FuturesAccount = Binance::new_with_config(api_key, secret_key, &config);

    let client = Client::open("redis://127.0.0.1:6179")?;

    let mut con = client.get_connection()?;

    let mut pubsub = con.as_pubsub();

    pubsub.subscribe("trades")?;

    loop {
        let msg = pubsub.get_message()?;
        let payload: String = msg.get_payload()?;
        println!("channel '{}': {}", msg.get_channel_name(), payload);

        if payload == "buy" {
            match account.market_buy("BTCUSDT", 0.002) {
                Ok(answer) => println!("{:?}", answer),
                Err(e) => println!("Error: {:?}", e),
            }
        }

        if payload == "sell" {
            match account.market_sell("BTCUSDT", 0.0001) {
                Ok(answer) => println!("{:?}", answer),
                Err(e) => println!("Error: {:?}", e),
            }
        }
    }
}
