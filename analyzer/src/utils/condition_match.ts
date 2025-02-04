import {Condition} from "../types/conditions";

export default class ConditionMatch {
    private condition: Condition;
    private lastPrices: any[];
    private lastVolumes: any[];

    constructor(c: Condition, lastPrices: string[], lastVolumes: string[]) {
        this.condition = c;
        this.lastPrices = lastPrices;
        this.lastVolumes = lastVolumes;
    }

    public check(): boolean {
        if(this.condition.type === 'PRICE') {
            return this.price();
        }

        if(this.condition.type === 'VOLUME') {
            return this.volume();
        }

        return false;
    }

    private price() {
        const open: number = this.lastPrices[this.lastPrices.length - (this.condition.period ?? 0)].price;
        const close: number = this.lastPrices[this.lastPrices.length - 1].price;

        const diff = (close - open) / open * 100;

        const percentage = this.condition.percentage ?? 0;

        if(percentage < 0) {
            return percentage >= diff;
        }

        return diff <= percentage;
    }

    private volume() {
        let BuyVolume = 0.0001;
        let SellVolume = 0.0001;

        this.lastVolumes.slice(this.lastVolumes.length - (this.condition.period ?? 0)).map((v) => {
            BuyVolume += v.additionalData.buyVolume;
            SellVolume += v.additionalData.sellVolume;
        });

        const totalVolume = BuyVolume + SellVolume;

        const buyPercentage = (BuyVolume / totalVolume) * 100;
        const sellPercentage = (SellVolume / totalVolume) * 100;

        return this.condition.side === 'BUY' ? buyPercentage >= (this.condition.percentage ?? 0) : sellPercentage >= (this.condition.percentage ?? 0);
    }
}