import Redis from 'ioredis';

const redis = new Redis('redis://localhost:6179');

redis.on('connect', async () => {
    console.log('Redis connected');


    const indicators = (await redis.zrange('indicators:BTCUSDT', 0, 100, 'REV')).map(indicator => JSON.parse(indicator)).reverse();

    console.log('Indicators', indicators.slice(-1).map((indicator) => {
        return {
            upper: indicator?.latestBB?.upper ?? 0
        }
    })[0]);

    // indicators.slice().map(indicator => {
    //     console.log('Latest BB', {
    //         upper: indicator?.latestBB?.upper ?? 0,
    //         middle: indicator?.latestBB?.average ?? 0,
    //         lower: indicator?.latestBB?.lower ?? 0,
    //     });
    // })
});
