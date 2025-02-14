# Eddie BOTs

## Setup
```bash
cp eddie.conf /etc/supervisor/conf.d/eddie.conf
```

## Deployment

```bash
chmod +x deploy.sh
./deploy.sh
```

## Helpful commands

```bash
 docker exec c05b70a10248 sh -c "redis-cli --csv hgetall trades:debile"
```


```bash
docker exec redis sh -c "redis-cli --csv ZRANGE indicators:BTCUSDT 0 500 REV > /data/indicators_btc_usdt.csv"
docker cp redis:/data/indicators_btc_usdt.csv indicators_btc_usdt.csv
```