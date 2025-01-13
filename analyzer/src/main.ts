import { Worker } from 'worker_threads';
import * as path from 'path';

export class SupervisorCluster {
    private workers: Map<string, Worker> = new Map();
    private readonly NUM_ANALYZERS = 2; // Number of market analyzer workers

    constructor() {
        this.initializeWorkers();
    }

    private initializeWorkers() {
        // Start Market Analyzer workers
        for (let i = 0; i < this.NUM_ANALYZERS; i++) {
            const worker = new Worker(path.join(__dirname, 'workers/marketAnalyzer.worker.js'), {
                workerData: {
                    workerId: `analyzer-${i}`,
                    symbols: this.getSymbolsForWorker(i)
                }
            });

            worker.on('message', (message) => {
                console.log(`Message from Analyzer ${i}:`, message);
            });

            worker.on('error', (error) => {
                console.error(`Error in Analyzer ${i}:`, error);
                // Restart worker on error
                this.restartWorker('analyzer', i);
            });

            this.workers.set(`analyzer-${i}`, worker);
        }

        // Start Supervisor worker
        const supervisorWorker = new Worker(path.join(__dirname, 'workers/supervisor.worker.js'));

        supervisorWorker.on('message', (message) => {
            console.log('Message from Supervisor:', message);
        });

        supervisorWorker.on('error', (error) => {
            console.error('Error in Supervisor:', error);
            this.restartWorker('supervisor', 0);
        });

        this.workers.set('supervisor', supervisorWorker);
    }

    private getSymbolsForWorker(workerId: number): string[] {
        // Distribute symbols among workers
        const allSymbols = ['BTCUSDT'];
        return allSymbols.filter((_, index) => index % this.NUM_ANALYZERS === workerId);
    }

    private async restartWorker(type: 'analyzer' | 'supervisor', id: number) {
        const workerId = type === 'supervisor' ? 'supervisor' : `analyzer-${id}`;
        const oldWorker = this.workers.get(workerId);

        if (oldWorker) {
            await oldWorker.terminate();
            this.workers.delete(workerId);
        }

        this.initializeWorkers();
    }

    public shutdown() {
        console.log('Shutting down supervisor cluster...');
        return Promise.all(
            Array.from(this.workers.values()).map(worker => worker.terminate())
        );
    }
}

export default SupervisorCluster;