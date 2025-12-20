/**
 * Strategy Engine
 * Defines rules for Buying, Selling, and Rebalancing
 */

const Strategy = {
    // 1. Sell Rules (with source asset holding check)
    // Z-Score 5-Zone Logic:
    //   🔵 Blue (<0): Strong Buy
    //   🟢 Green (0-1.5): Fair Value / Hold
    //   🟡 Yellow (1.5-2.0): Buffer / No Trading
    //   🟠 Orange (2.0-3.5): 50% Profit Locking
    //   🔴 Red (>3.5): 100% Hard Exit
    evaluateSellRules: (context) => {
        const signals = [];
        const { marketData, derivedStats, portfolio } = context;

        // Helper to get asset and check if it has holdings
        const getAsset = (ticker) => portfolio.find(a => a.ticker === ticker);
        const hasHoldings = (ticker) => {
            const asset = getAsset(ticker);
            return asset && asset.shares > 0;
        };

        // Get MNAV from localStorage (user-input gauge value)
        const savedMNAV = parseFloat(localStorage.getItem('jg_gauge_mnav')) || null;
        const savedZScore = parseFloat(localStorage.getItem('jg_gauge_zscore')) || null;
        const zScore = savedZScore !== null ? savedZScore : (derivedStats?.zScoreMSTR || 0);

        // --- Rule 1: TLT Switching ---
        // If TLT RSI > 70 (Overbought) -> Sell TLT -> Buy BIL (Cash)
        const tlt = marketData?.TLT_US;
        if (tlt && tlt.rsi > 70 && hasHoldings('TLT')) {
            signals.push({ type: 'SELL', msg: 'TLT RSI > 70: Sell TLT → Switch to BIL' });
        }

        // --- Rule 2: MSTR Z-Score Based Selling (5-Zone) ---
        if (hasHoldings('MSTR')) {
            // 🔴 Red Zone (Z > 3.5): 100% Hard Exit
            if (zScore > 3.5) {
                signals.push({ 
                    type: 'SELL', 
                    msg: `🔴 Z-Score ${zScore.toFixed(2)} > 3.5: FULL EXIT MSTR → DBMF`,
                    priority: 'critical'
                });
            }
            // 🟠 Orange Zone (2.0 < Z <= 3.5): 50% Profit Locking
            else if (zScore > 2.0) {
                signals.push({ 
                    type: 'SELL', 
                    msg: `🟠 Z-Score ${zScore.toFixed(2)} > 2.0: 50% Harvest MSTR → DBMF`,
                    priority: 'high'
                });
            }
        }

        // --- Rule 3: MNAV Risk-Off ---
        // If MNAV > 2.8 -> Sell MSTR (Overvalued)
        if (savedMNAV !== null && savedMNAV > 2.8 && hasHoldings('MSTR')) {
            signals.push({ 
                type: 'SELL', 
                msg: `MNAV ${savedMNAV.toFixed(2)} > 2.8: MSTR Overvalued → Sell`,
                priority: 'high'
            });
        }

        // --- Rule 4: GLDM Profit Taking ---
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

        // Get MNAV and Z-Score from localStorage (user-input gauge values)
        const savedMNAV = parseFloat(localStorage.getItem('jg_gauge_mnav')) || null;
        const savedZScore = parseFloat(localStorage.getItem('jg_gauge_zscore')) || null;
        const zScore = savedZScore !== null ? savedZScore : (derivedStats?.zScoreMSTR || 0);

        // --- Rule 1: TLT Oversold ---
        // If TLT RSI < 30 -> Buy TLT (using BIL)
        const tlt = marketData?.TLT_US;
        if (tlt && tlt.rsi < 30 && hasHoldings('BIL')) {
            signals.push({ type: 'BUY', msg: 'TLT RSI < 30: Buy TLT (using BIL)' });
        }

        // --- Rule 2: MSTR Z-Score Based Buying (5-Zone) ---
        // 🔵 Blue Zone (Z < 0): Strong Buy signal
        if (zScore < 0 && (hasHoldings('VBIL') || hasHoldings('DBMF'))) {
            signals.push({ 
                type: 'BUY', 
                msg: `🔵 Z-Score ${zScore.toFixed(2)} < 0: STRONG BUY MSTR`,
                priority: 'high'
            });
        }
        // 🟢 Green Zone Re-entry (Z drops below 1.5 after being higher)
        else if (zScore > 0 && zScore <= 1.5 && (hasHoldings('VBIL') || hasHoldings('DBMF'))) {
            signals.push({ 
                type: 'BUY', 
                msg: `🟢 Z-Score ${zScore.toFixed(2)} in Fair Value: Accumulate MSTR`,
                priority: 'normal'
            });
        }

        // --- Rule 3: MNAV + Z-Score Combo (Risk-On) ---
        // If MNAV < 1.3 AND Z-Score < 0.5 -> Strong Buy signal
        if (savedMNAV !== null && savedMNAV < 1.3 && zScore < 0.5 && (hasHoldings('VBIL') || hasHoldings('DBMF'))) {
            signals.push({ 
                type: 'BUY', 
                msg: `💎 MNAV ${savedMNAV.toFixed(2)} < 1.3 & Z ${zScore.toFixed(2)} < 0.5: STRONG BUY`,
                priority: 'critical'
            });
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
