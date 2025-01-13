// src/workers/supervisor.worker.ts
import { parentPort } from 'worker_threads';
import { SupervisorService } from '../services/SupervisorService';

if (!parentPort) throw new Error('Parent port is undefined');

const supervisor = new SupervisorService(process.env.REDIS_URL || '');

// Handle messages from main thread
parentPort.on('message', (message) => {
    if (message.type === 'shutdown') {
        supervisor.close();
        process.exit(0);
    }
});

// Report status to main thread
parentPort.postMessage({
    type: 'status',
    status: 'running'
});