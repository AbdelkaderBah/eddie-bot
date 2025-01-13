// src/index.ts
import { SupervisorCluster } from './main';

async function main() {
    const cluster = new SupervisorCluster();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('Received SIGINT. Graceful shutdown...');
        await cluster.shutdown();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM. Graceful shutdown...');
        await cluster.shutdown();
        process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
        console.error('Uncaught Exception:', error);
        await cluster.shutdown();
        process.exit(1);
    });
}

main().catch(console.error);