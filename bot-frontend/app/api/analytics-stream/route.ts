// app/api/stream/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSubscriber } from '@/lib/redis-subscriber';
import { Redis } from 'ioredis';
import { redisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';
// export const runtime = 'edge';

const getLastPrice = async (period = 28) => {
  const prices = await redisClient.zrange('events:BTCUSDT:prices', -100, -1);

  const lastPrices = prices.map((price) => JSON.parse(price));

  const open: number = lastPrices[lastPrices.length - (period)].price;
  const close: number = lastPrices[lastPrices.length - 1].price;

  return (close - open) / open * 100;
};

const getLastVolume = async (period = 14) => {
  const volumes = await redisClient.zrange('events:BTCUSDT:depths', -100, -1);

  const lastVolumes = volumes.map(volume => JSON.parse(volume));

  let BuyVolume = 0.0001;
  let SellVolume = 0.0001;

  lastVolumes.slice(lastVolumes.length - (period ?? 0)).map((v) => {
    BuyVolume += v.additionalData.buyVolume;
    SellVolume += v.additionalData.sellVolume;
  });

  const totalVolume = BuyVolume + SellVolume;

  const buyPercentage = (BuyVolume / totalVolume) * 100;
  const sellPercentage = (SellVolume / totalVolume) * 100;
  
  return {
    totalVolume,
    buyPercentage,
    sellPercentage,
  }
};

export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get('channel') || 'market_events';

  console.log('Subscribing to channel:', channel);

  let unsubscribe = () => {};

  const encoder = new TextEncoder();
  const customReadable = new ReadableStream({
    async start(controller) {
      controller.enqueue('data: Connected\n\n');
      
      setInterval(async () => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ 
            price: await getLastPrice(),
            volume: await getLastVolume()
          })}\n\n`)
        );
      }, 1000);

      // unsubscribe = redisClient.subscribe(channel, (message) => {
      //   try {
      //     const encodedData = encoder.encode(
      //       `data: ${JSON.stringify(message)}\n\n`
      //     );
      //     controller.enqueue(encodedData);
      //   } catch (error) {
      //     console.error('Error processing message:', error);
      //   }
      // });
      //
      // req.signal.addEventListener('abort', () => {
      //   unsubscribe();
      // });
    },
    cancel() {
      // Cleanup
      unsubscribe();
    }
  });

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  });
}
