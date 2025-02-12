import {parentPort, workerData} from 'worker_threads';
import {MarketAnalyzer} from "../services/MarketAnalyzer";

if (!parentPort) throw new Error('Parent port is undefined');

const {workerId, symbols} = workerData;

const analyzer = new MarketAnalyzer(process.env.REDIS_URL || '');

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
