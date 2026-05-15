// ============================================================
// BLOXVIEW - ECONOMY SYSTEM
// Price calculations, fees, market stability
// ============================================================

const Economy = {
    // Configuration
    config: {
        maxDailyIncrease: 15,      // Max 15% increase per day
        maxDailyDecrease: 10,      // Max 10% decrease per day
        maxWeeklyChange: 25,       // Max 25% change per week
        volatilityFloor: 0.5,      // Minimum 0.5% change
        volatilityCeiling: 5.0,    // Maximum 5% change per update
        depositFee: 0,
        withdrawFee: 2.5,
        tradeFee: 1.0,
        burnRate: 0.5,
        rewardPoolPercentage: 30
    },
    
    // Price history tracking
    priceHistory: {},
    
    // Supply/Demand tracking
    supply: {},
    demand: {},
    
    // Calculate new price based on market factors
    calculateNewPrice(item, volume) {
        let change = 0;
        
        // Demand factor (0.5x to 2.0x)
        const demandMultiplier = item.demand === 'high' ? 1.5 : item.demand === 'medium' ? 1.0 : 0.7;
        
        // Supply factor (inverse relationship)
        const supplyMultiplier = Math.max(0.5, Math.min(1.5, 1000 / (item.stock + 100)));
        
        // Volume factor (trading activity)
        const volumeMultiplier = Math.min(1.3, 1 + (volume / 10000));
        
        change = (demandMultiplier * supplyMultiplier * volumeMultiplier - 1) * 100;
        
        // Apply limits
        change = Math.max(-this.config.maxDailyDecrease, Math.min(this.config.maxDailyIncrease, change));
        
        // Apply volatility limits
        change = Math.max(this.config.volatilityFloor, Math.min(this.config.volatilityCeiling, Math.abs(change))) * Math.sign(change);
        
        return Math.round(item.value * (1 + change / 100));
    },
    
    // Calculate transaction fee
    calculateFee(amount, transactionType) {
        let baseFee = this.config[`${transactionType}Fee`] || 0;
        
        // Progressive fees for large amounts
        if (amount >= 50000) baseFee = 3.0;
        else if (amount >= 10000) baseFee = 2.0;
        else if (amount >= 5000) baseFee = 1.5;
        else if (amount >= 1000) baseFee = 1.0;
        
        const fee = (amount * baseFee) / 100;
        const burned = (fee * this.config.burnRate) / 100;
        const rewardPool = (fee * this.config.rewardPoolPercentage) / 100;
        
        return { fee, burned, rewardPool, netAmount: amount - fee };
    },
    
    // Update supply/demand metrics
    updateMetrics(itemId, action, quantity) {
        if (action === 'deposit') {
            this.supply[itemId] = (this.supply[itemId] || 0) + quantity;
        } else if (action === 'withdraw') {
            this.supply[itemId] = Math.max(0, (this.supply[itemId] || 0) - quantity);
        }
        
        // Update demand based on activity
        const recentActivity = this.getRecentActivity(itemId);
        this.demand[itemId] = Math.min(100, recentActivity * 10);
        
        return { supply: this.supply[itemId], demand: this.demand[itemId] };
    },
    
    // Track price history
    recordPrice(itemId, price) {
        if (!this.priceHistory[itemId]) {
            this.priceHistory[itemId] = [];
        }
        
        this.priceHistory[itemId].push({
            price: price,
            timestamp: Date.now()
        });
        
        // Keep only last 1000 entries
        if (this.priceHistory[itemId].length > 1000) {
            this.priceHistory[itemId].shift();
        }
    },
    
    // Get recent activity count
    getRecentActivity(itemId, hours = 24) {
        const history = this.priceHistory[itemId] || [];
        const cutoff = Date.now() - (hours * 3600000);
        return history.filter(h => h.timestamp > cutoff).length;
    },
    
    // Calculate volatility (standard deviation of recent prices)
    calculateVolatility(itemId, periods = 24) {
        const history = this.priceHistory[itemId] || [];
        const recent = history.slice(-periods);
        if (recent.length < 2) return 0;
        
        const prices = recent.map(h => h.price);
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
        
        return Math.sqrt(variance);
    },
    
    // Get stability index (0-100)
    getStabilityIndex(itemId) {
        const volatility = this.calculateVolatility(itemId);
        return Math.max(0, Math.min(100, 100 - volatility));
    },
    
    // Anti-manipulation detection
    detectManipulation(userId, tradeData) {
        const flags = [];
        
        // Check for excessive volume
        if (tradeData.volume > 1000) {
            flags.push('EXCESSIVE_VOLUME');
        }
        
        // Check for price manipulation
        if (Math.abs(tradeData.priceChange) > 20) {
            flags.push('PRICE_MANIPULATION_ATTEMPT');
        }
        
        // Check for rapid trading
        const lastTrade = this.getLastTradeTime(userId);
        if (lastTrade && (Date.now() - lastTrade) < 60000) {
            flags.push('RAPID_TRADING');
        }
        
        return flags;
    },
    
    getLastTradeTime(userId) {
        const trades = Storage.get(`user_trades_${userId}`, []);
        return trades.length > 0 ? trades[trades.length - 1].timestamp : null;
    },
    
    // Market maker - provide liquidity
    generateMarketOrders(item, currentPrice) {
        const orders = [];
        const spread = 0.05; // 5% spread
        
        // Generate buy orders (below market)
        for (let i = 1; i <= 5; i++) {
            const price = currentPrice * (1 - spread * i);
            const quantity = Math.floor(Math.random() * 3) + 1;
            orders.push({ price, quantity, type: 'BUY', id: generateId() });
        }
        
        // Generate sell orders (above market)
        for (let i = 1; i <= 5; i++) {
            const price = currentPrice * (1 + spread * i);
            const quantity = Math.floor(Math.random() * 3) + 1;
            orders.push({ price, quantity, type: 'SELL', id: generateId() });
        }
        
        return orders;
    }
};

// Initialize economy tracking
function initEconomy() {
    // Load saved data
    Economy.supply = Storage.get('economy_supply', {});
    Economy.demand = Storage.get('economy_demand', {});
    Economy.priceHistory = Storage.get('economy_price_history', {});
    
    // Save periodically
    setInterval(() => {
        Storage.set('economy_supply', Economy.supply);
        Storage.set('economy_demand', Economy.demand);
        Storage.set('economy_price_history', Economy.priceHistory);
    }, 60000); // Every minute
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Economy, initEconomy };
}
