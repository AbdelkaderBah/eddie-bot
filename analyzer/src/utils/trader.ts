import {Redis} from 'ioredis';

// Define possible reasons for liquidity snapshots.
type SnapshotReason = 'stopLoss' | 'takeProfit' | 'liquidation';

// Define the liquidity snapshot structure.
interface LiquiditySnapshot {
    timestamp: number;
    currentPrice: number;
    reason: SnapshotReason;
}

// Define the trade data structure.
export interface TradeData {
    price: number; // Entry price
    quantity: number;
    side: 'LONG' | 'SHORT';
    leverage: number;
    timestamp: number;
    status: string;
    stopLoss?: number;    // Optional stop loss level
    takeProfit?: number;  // Optional take profit level
    pnlSnapshots?: { [interval: string]: number };
    liquiditySnapshots?: LiquiditySnapshot[];
    closedAt?: number;
}


export function convertToBtc(currentPriceInUSD: number, amountInUsd: number): number {
    // @ts-ignore
    return (amountInUsd / currentPriceInUSD).toFixed(8) * 1;
}

// Create a Redis client.
const client = new Redis(process.env.REDIS_URL || '');

client.on('error', (err) => console.error('Redis Client Error', err));

// Ensure Redis connection.
async function connectRedis(): Promise<void> {
    // if (!client.isOpen) {
    //     await client.connect();
    // }
}

/**
 * Executes a trade by saving its initial data in Redis.
 * @param tradeId Unique trade identifier.
 * @param tradeData Initial trade details.
 */
export async function executeTrade(tradeId: string, tradeData: TradeData): Promise<void> {
    await connectRedis();
    await client.set(`trade:${tradeId}`, JSON.stringify(tradeData));
    console.log(`Trade ${tradeId} executed and saved.`);
}

/**
 * Calculates the profit and loss (PNL) for a trade.
 * For LONG trades, PNL = (currentPrice - entryPrice) * quantity * leverage.
 * For SHORT trades, PNL = (entryPrice - currentPrice) * quantity * leverage.
 */
function calculatePNL(entryPrice: number, currentPrice: number, quantity: number, side: 'LONG' | 'SHORT', leverage: number): number {
    if (side === 'LONG') {
        return (currentPrice - entryPrice) * quantity * leverage;
    } else {
        return (entryPrice - currentPrice) * quantity * leverage;
    }
}

/**
 * Records a liquidity snapshot to the trade data and persists it in Redis.
 */
async function recordLiquiditySnapshot(tradeKey: string, tradeData: TradeData, currentPrice: number, reason: SnapshotReason): Promise<void> {
    const snapshot: LiquiditySnapshot = {
        timestamp: Date.now(),
        currentPrice,
        reason
    };

    tradeData.liquiditySnapshots = tradeData.liquiditySnapshots || [];
    tradeData.liquiditySnapshots.push(snapshot);
    // Persist the updated trade data.
    await client.set(tradeKey, JSON.stringify(tradeData));
    console.log(`Liquidity snapshot recorded:`, snapshot);
}

/**
 * Updates the trade's PNL at specified intervals, checks for stop loss, take profit, and liquidation conditions,
 * and records liquidity snapshots if any of these conditions are triggered.
 * @param tradeId Unique trade identifier.
 * @param getCurrentPrice Function that returns the current market price.
 * @param intervals List of time intervals (in seconds) for the PNL updates.
 */
export async function updateTradePNL(
    tradeId: string,
    getCurrentPrice: () => Promise<number>,
    intervals: number[] = [10, 20, 30, 60]
): Promise<void> {
    await connectRedis();
    const tradeKey = `trade:${tradeId}`;
    const tradeStr = await client.get(tradeKey);

    if (!tradeStr) {
        console.error(`Trade ${tradeId} not found.`);
        return;
    }

    const tradeData: TradeData = JSON.parse(tradeStr);
    const entryPrice = tradeData.price;
    const quantity = tradeData.quantity;
    const side = tradeData.side;
    const leverage = tradeData.leverage;
    const pnlSnapshots: { [interval: string]: number } = {};

    // Define a liquidation threshold (for simulation) as 1/leverage.
    // For example, a 10x leveraged LONG might be liquidated if price falls 10% below entry.
    const liquidationThreshold = 1 / leverage;
    let tradeClosedEarly = false;

    for (const seconds of intervals) {
        // Wait for the specified interval.
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));

        // Get the current price.
        const currentPrice = await getCurrentPrice();

        // Check stop loss, take profit, and liquidation conditions.
        if (side === 'LONG') {
            if (tradeData.stopLoss !== undefined && currentPrice <= tradeData.stopLoss) {
                console.log(`Stop loss reached for LONG trade at price ${currentPrice}`);
                await recordLiquiditySnapshot(tradeKey, tradeData, currentPrice, 'stopLoss');
                tradeClosedEarly = true;
                break;
            }
            if (tradeData.takeProfit !== undefined && currentPrice >= tradeData.takeProfit) {
                console.log(`Take profit reached for LONG trade at price ${currentPrice}`);
                await recordLiquiditySnapshot(tradeKey, tradeData, currentPrice, 'takeProfit');
                tradeClosedEarly = true;
                break;
            }
            if (currentPrice <= entryPrice * (1 - liquidationThreshold)) {
                console.log(`Liquidation condition met for LONG trade at price ${currentPrice}`);
                await recordLiquiditySnapshot(tradeKey, tradeData, currentPrice, 'liquidation');
                tradeClosedEarly = true;
                break;
            }
        } else if (side === 'SHORT') {
            if (tradeData.stopLoss !== undefined && currentPrice >= tradeData.stopLoss) {
                console.log(`Stop loss reached for SHORT trade at price ${currentPrice}`);
                await recordLiquiditySnapshot(tradeKey, tradeData, currentPrice, 'stopLoss');
                tradeClosedEarly = true;
                break;
            }
            if (tradeData.takeProfit !== undefined && currentPrice <= tradeData.takeProfit) {
                console.log(`Take profit reached for SHORT trade at price ${currentPrice}`);
                await recordLiquiditySnapshot(tradeKey, tradeData, currentPrice, 'takeProfit');
                tradeClosedEarly = true;
                break;
            }
            if (currentPrice >= entryPrice * (1 + liquidationThreshold)) {
                console.log(`Liquidation condition met for SHORT trade at price ${currentPrice}`);
                await recordLiquiditySnapshot(tradeKey, tradeData, currentPrice, 'liquidation');
                tradeClosedEarly = true;
                break;
            }
        }

        // Calculate PNL and update snapshot.
        const pnl = calculatePNL(entryPrice, currentPrice, quantity, side, leverage);
        pnlSnapshots[`${seconds}s`] = pnl;
        tradeData.pnlSnapshots = pnlSnapshots;

        // Save the updated trade data.
        await client.set(tradeKey, JSON.stringify(tradeData));
        console.log(`Updated PNL at ${seconds}s: ${pnl}`);
    }

    // Close the trade if it wasn't already closed by a trigger.
    tradeData.status = 'closed';
    tradeData.closedAt = Date.now();
    tradeData.pnlSnapshots = pnlSnapshots;
    await client.set(tradeKey, JSON.stringify(tradeData));
    if (!tradeClosedEarly) {
        console.log(`Trade ${tradeId} closed normally. Final PNL snapshots:`, pnlSnapshots);
    } else {
        console.log(`Trade ${tradeId} closed early due to a trigger.`);
    }
}

