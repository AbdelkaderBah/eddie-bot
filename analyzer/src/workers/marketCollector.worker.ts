import { parentPort, workerData } from 'worker_threads';
import { MarketCollector } from '../services/MarketCollector';

if (!parentPort) throw new Error('Parent port is undefined');

const { workerId, symbols } = workerData;

const analyzer = new MarketCollector(process.env.REDIS_URL || '');

// Handle messages from main thread
parentPort.on('message', (message) => {
    if (message.type === 'shutdown') {
        analyzer.close();
        process.exit(0);
    }
});

// Report status to main thread
parentPort.postMessage({
    type: 'status',
    workerId,
    status: 'running',
    symbols
});
