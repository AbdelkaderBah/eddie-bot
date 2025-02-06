// src/workers/trader.worker.ts
import { parentPort } from 'worker_threads';
import { TradeService } from '../services/TradeService';

if (!parentPort) throw new Error('Parent port is undefined');

const tradeService = new TradeService(process.env.REDIS_URL || '');

// Handle messages from main thread
parentPort.on('message', (message) => {
    if (message.type === 'shutdown') {
        tradeService.close();
        process.exit(0);
    }
});

// Report status to main thread
parentPort.postMessage({
    type: 'status',
    status: 'running'
});