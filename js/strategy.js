/**
 * Strategy Engine
 * Defines rules for Buying, Selling, and Rebalancing
 */

const Strategy = {
    // 1. Sell Rules (with source asset holding check)
    evaluateSellRules: (context) => {
        const signals = [];
        const { marketData, derivedStats, portfolio } = context;

        // Helper to get asset and check if it has holdings
        const getAsset = (ticker) => portfolio.find(a => a.ticker === ticker);
        const hasHoldings = (ticker) => {
            const asset = getAsset(ticker);
            return asset && asset.shares > 0;
        };

        // --- Rule 1: TLT Switching ---
        // If TLT RSI > 70 (Overbought) -> Sell TLT -> Buy BIL (Cash)
        // Only show if TLT has holdings (source asset)
        // Use TLT_US (real US TLT) for accurate signal analysis
        const tlt = marketData?.TLT_US;
        if (tlt && tlt.rsi > 70 && hasHoldings('TLT')) {
            signals.push({ type: 'SELL', msg: 'TLT RSI > 70: Sell TLT → Switch to BIL' });
        }

        // --- Rule 2: Crypto/Gold Profit Taking ---
        // If MSTR Z-Score > 6.0 -> Sell MSTR -> Buy VBIL (USD Cash)
        // Only show if MSTR has holdings
        if (derivedStats?.zScoreMSTR > 6.0 && hasHoldings('MSTR')) {
            signals.push({ type: 'SELL', msg: 'MSTR Z-Score > 6.0: Sell MSTR → Switch to VBIL' });
        }

        // If GLDM RSI > 80 -> Sell GLDM -> Buy VBIL
        // Only show if GLDM has holdings
        const gldm = marketData?.GLDM;
        if (gldm && gldm.rsi > 80 && hasHoldings('GLDM')) {
            signals.push({ type: 'SELL', msg: 'GLDM RSI > 80: Sell GLDM → Switch to VBIL' });
        }

        return signals;
    },

    // 2. Buy Rules (with source asset holding check)
    evaluateBuyRules: (context) => {
        const signals = [];
        const { marketData, derivedStats, portfolio } = context;

        // Helper to check if source has holdings
        const getAsset = (ticker) => portfolio.find(a => a.ticker === ticker);
        const hasHoldings = (ticker) => {
            const asset = getAsset(ticker);
            return asset && asset.shares > 0;
        };

        // --- Rule 1: TLT Oversold ---
        // If TLT RSI < 30 -> Buy TLT (using BIL)
        // Only show if BIL (source) has holdings
        // Use TLT_US (real US TLT) for accurate signal analysis
        const tlt = marketData?.TLT_US;
        if (tlt && tlt.rsi < 30 && hasHoldings('BIL')) {
            signals.push({ type: 'BUY', msg: 'TLT RSI < 30: Buy TLT (using BIL)' });
        }

        // --- Rule 2: Crypto Opportunity ---
        // If MSTR Z-Score < 0 -> Buy MSTR (using VBIL/CTA)
        // Only show if VBIL (source) has holdings
        if (derivedStats?.zScoreMSTR < 0 && hasHoldings('VBIL')) {
            signals.push({ type: 'BUY', msg: 'MSTR Z-Score < 0: Buy MSTR (using VBIL)' });
        }

        return signals;
    },

    // 3. Execution Day Check (Friday)
    isExecutionDay: () => {
        const today = new Date();
        return today.getDay() === 5; // 5 = Friday
    },

    // 4. Rebalancing Check (30% relative threshold)
    checkRebalancing: (portfolio) => {
        const totalValue = portfolio.reduce((sum, asset) => sum + (asset.value || 0), 0);
        if (totalValue === 0) return [];

        const actions = [];

        portfolio.forEach(asset => {
            // Skip assets with 0% target weight (Transition/Cash assets)
            if (asset.targetWeight === 0) return;

            const currentWeight = asset.value / totalValue;
            const diff = currentWeight - asset.targetWeight;

            // NEW: 30% relative threshold
            // |Actual - Target| / Target >= 0.3
            const relativeDeviation = Math.abs(diff) / asset.targetWeight;
            const threshold = 0.3; // 30% relative

            // Calculate precise amount needed to reach target
            const diffValue = asset.value - (totalValue * asset.targetWeight); // Positive = Overweight, Negative = Underweight
            const absAmount = Math.abs(diffValue);
            const formattedAmount = '₩' + Math.round(absAmount).toLocaleString();
            const diffPercent = Math.abs(diff * 100).toFixed(1);

            if (relativeDeviation >= threshold) {
                if (diff > 0) {
                    actions.push({
                        type: 'SELL',
                        asset: asset,
                        msg: `SELL ${asset.ticker} (${formattedAmount}) - Overweight by ${diffPercent}%`
                    });
                } else {
                    actions.push({
                        type: 'BUY',
                        asset: asset,
                        msg: `BUY ${asset.ticker} (${formattedAmount}) - Underweight by ${diffPercent}%`
                    });
                }
            }
        });

        return actions;
    }
};
