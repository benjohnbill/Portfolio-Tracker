/**
 * Strategy Engine - Jin Geun Index Fund
 * Complete 15-Rule Algo System (8 SELL + 7 BUY)
 * 
 * HIERARCHY: Algo Switching >>> Passive Rebalancing (±30%)
 * EXECUTION: Fridays Only
 */

const Strategy = {
    // ═══════════════════════════════════════════════════════════════════
    // RULE DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════
    
    SELL_RULES: {
        SELL_HARD_EXIT: {
            id: 'SELL_HARD_EXIT',
            priority: 1,
            desc: 'Hard Exit: Euphoria Safety',
            from: 'MSTR',
            to: 'BIL',
            returnCondition: 'Z < 0 (BUY_OPPORTUNITY)'
        },
        SELL_PROFIT_LOCK: {
            id: 'SELL_PROFIT_LOCK',
            priority: 2,
            desc: 'Profit Locking: Normalization',
            from: 'MSTR',
            to: 'DBMF',
            returnCondition: 'Z < 1.5 AND MSTR > 20MA (BUY_TREND_REENTRY)'
        },
        SELL_HEDGE_UNWIND: {
            id: 'SELL_HEDGE_UNWIND',
            priority: 3,
            desc: 'Hedge Unwind: Quick Release',
            from: 'PFIX',
            to: 'GLDM',
            returnCondition: 'TLT < 50MA < 250MA (BUY_CRISIS_DEFENSE)'
        },
        SELL_GLDM_CASH: {
            id: 'SELL_GLDM_CASH',
            priority: 4,
            desc: 'Overseas Cash',
            from: 'GLDM',
            to: 'VBIL',
            returnCondition: 'GLDM > 250MA (BUY_GLDM_REENTRY)'
        },
        SELL_TLT_CASH: {
            id: 'SELL_TLT_CASH',
            priority: 5,
            desc: 'ISA Cash',
            from: 'TLT',
            to: 'BIL',
            returnCondition: 'TLT > 250MA (BUY_TLT_REENTRY)'
        },
        SELL_SOFT_ROTATE: {
            id: 'SELL_SOFT_ROTATE',
            priority: 6,
            desc: 'Soft Rotation',
            from: 'MSTR',
            to: 'DBMF',
            amount: '10%',
            returnCondition: 'Z < 0 (BUY_OPPORTUNITY)'
        },
        SELL_CHINA_WEAK: {
            id: 'SELL_CHINA_WEAK',
            priority: 7,
            desc: 'Tactical Switch: China to India',
            from: 'CSI300',
            to: 'Nifty50',
            returnCondition: 'CSI300 > 250MA (BUY_EM_RETURN)'
        },
        SELL_EM_FAIL: {
            id: 'SELL_EM_FAIL',
            priority: 8,
            desc: 'Flight to Quality: EM Fail',
            from: 'Nifty50',
            to: 'QQQ',
            returnCondition: 'CSI300 > 250MA OR Nifty50 > 250MA'
        }
    },

    BUY_RULES: {
        BUY_OPPORTUNITY: {
            id: 'BUY_OPPORTUNITY',
            priority: 1,
            desc: 'Opportunity Scramble',
            from: 'DBMF',
            to: 'MSTR',
            amount: '10%',
            returnCondition: 'Z > 1.0 (SELL_SOFT_ROTATE)'
        },
        BUY_TREND_REENTRY: {
            id: 'BUY_TREND_REENTRY',
            priority: 2,
            desc: 'Trend Re-entry: Dip Buying',
            from: 'BIL',
            to: 'MSTR',
            amount: '10%',
            returnCondition: 'Z > 2.0 (SELL_PROFIT_LOCK)'
        },
        BUY_CRISIS_DEFENSE: {
            id: 'BUY_CRISIS_DEFENSE',
            priority: 3,
            desc: 'Crisis Defense Activation',
            from: 'GLDM',
            to: 'PFIX',
            returnCondition: 'TLT > 50MA (SELL_HEDGE_UNWIND)'
        },
        BUY_EM_RETURN: {
            id: 'BUY_EM_RETURN',
            priority: 4,
            desc: 'Return Base: EM Leader',
            from: 'Nifty50',
            to: 'CSI300',
            returnCondition: 'CSI300 < 250MA (SELL_CHINA_WEAK)'
        },
        BUY_INDIA_STRONG: {
            id: 'BUY_INDIA_STRONG',
            priority: 5,
            desc: 'Tactical Return: India Strong',
            from: 'QQQ',
            to: 'Nifty50',
            returnCondition: 'Nifty50 < 250MA (SELL_EM_FAIL)'
        },
        BUY_TLT_REENTRY: {
            id: 'BUY_TLT_REENTRY',
            priority: 6,
            desc: 'ISA Re-entry',
            from: 'BIL',
            to: 'TLT',
            returnCondition: 'TLT < 250MA (SELL_TLT_CASH)'
        },
        BUY_GLDM_REENTRY: {
            id: 'BUY_GLDM_REENTRY',
            priority: 7,
            desc: 'Overseas Re-entry',
            from: 'VBIL',
            to: 'GLDM',
            returnCondition: 'GLDM < 250MA (SELL_GLDM_CASH)'
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // RULE EVALUATION ENGINE
    // ═══════════════════════════════════════════════════════════════════
    
    /**
     * Evaluate all SELL rules in priority order
     * @param {Object} context - { marketData, portfolio, mstrInputs, mstrState }
     * @returns {Array} - Array of triggered signals
     */
    evaluateSellRules: (context) => {
        const signals = [];
        const { marketData, portfolio, mstrInputs, mstrState } = context;

        // Helpers
        const getAsset = (ticker) => portfolio.find(a => a.ticker === ticker);
        const hasHoldings = (ticker) => {
            const asset = getAsset(ticker);
            return asset && asset.shares > 0;
        };

        // Get manual MSTR inputs (MNAV/Z-Score)
        const mnav = mstrInputs?.mnav || null;
        const zScore = mstrInputs?.zScore || null;
        const mstrInputsValid = mnav !== null && zScore !== null;

        // Get market data for assets
        const tlt = marketData?.TLT_US || marketData?.TLT;
        const gldm = marketData?.GLDM;
        const csi300 = marketData?.CSI300;
        const nifty50 = marketData?.Nifty50;

        // ═══════════════════════════════════════════════════════════════
        // SELL RULE 1: Hard Exit (Z > 3.5 OR MNAV > 2.5)
        // 100% of MSTR → DBMF
        // ═══════════════════════════════════════════════════════════════
        if (mstrInputsValid && hasHoldings('MSTR')) {
            if (zScore > 3.5 || mnav > 2.5) {
                signals.push({
                    ...Strategy.SELL_RULES.SELL_HARD_EXIT,
                    type: 'SELL',
                    msg: `🚨 HARD EXIT: Z=${zScore.toFixed(2)}, MNAV=${mnav.toFixed(2)} → MSTR(100%) → DBMF`
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // SELL RULE 2: Profit Locking (Z > 2.0 AND boughtAtLow)
        // 50% of MSTR holdings → DBMF
        // ═══════════════════════════════════════════════════════════════
        if (mstrInputsValid && hasHoldings('MSTR') && mstrState?.boughtAtLow) {
            if (zScore > 2.0) {
                signals.push({
                    ...Strategy.SELL_RULES.SELL_PROFIT_LOCK,
                    type: 'SELL',
                    msg: `💰 PROFIT LOCK: Z=${zScore.toFixed(2)} (bought low) → MSTR(50%) → DBMF`
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // SELL RULE 3: Hedge Unwind (TLT > 50MA AND RSI > 50)
        // ═══════════════════════════════════════════════════════════════
        if (tlt && hasHoldings('PFIX')) {
            const tltPrice = tlt.price || tlt.current;
            const tlt50ma = tlt.ma50;
            if (tltPrice > tlt50ma && tlt.rsi > 50) {
                signals.push({
                    ...Strategy.SELL_RULES.SELL_HEDGE_UNWIND,
                    type: 'SELL',
                    msg: `🔓 HEDGE UNWIND: TLT > 50MA, RSI=${tlt.rsi?.toFixed(1)} → PFIX → GLDM`
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // SELL RULE 4: GLDM Cash (GLDM < 250MA AND RSI > 35)
        // ═══════════════════════════════════════════════════════════════
        if (gldm && hasHoldings('GLDM')) {
            const gldmPrice = gldm.price || gldm.current;
            const gldm250ma = gldm.ma250;
            if (gldmPrice < gldm250ma && gldm.rsi > 35) {
                signals.push({
                    ...Strategy.SELL_RULES.SELL_GLDM_CASH,
                    type: 'SELL',
                    msg: `💵 OVERSEAS CASH: GLDM < 250MA, RSI=${gldm.rsi?.toFixed(1)} → GLDM → VBIL`
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // SELL RULE 5: TLT Cash (TLT < 250MA AND RSI > 35)
        // ═══════════════════════════════════════════════════════════════
        if (tlt && hasHoldings('TLT')) {
            const tltPrice = tlt.price || tlt.current;
            const tlt250ma = tlt.ma250;
            if (tltPrice < tlt250ma && tlt.rsi > 35) {
                signals.push({
                    ...Strategy.SELL_RULES.SELL_TLT_CASH,
                    type: 'SELL',
                    msg: `💵 ISA CASH: TLT < 250MA, RSI=${tlt.rsi?.toFixed(1)} → TLT → BIL`
                });
            }
        }

        // [DEPRECATED] SELL RULE 6: Soft Rotation (Z > 1.0) - REMOVED per new algo spec

        // ═══════════════════════════════════════════════════════════════
        // SELL RULE 7: China Weak (CSI300 < 250MA AND RSI > 35)
        // ═══════════════════════════════════════════════════════════════
        if (csi300 && hasHoldings('CSI300')) {
            const csi300Price = csi300.price || csi300.current;
            const csi300_250ma = csi300.ma250;
            if (csi300Price < csi300_250ma && csi300.rsi > 35) {
                // Check if Nifty50 is strong (alternative destination)
                const niftyStrong = nifty50 && (nifty50.price || nifty50.current) > nifty50.ma250;
                const dest = niftyStrong ? 'Nifty50' : 'QQQ';
                signals.push({
                    ...Strategy.SELL_RULES.SELL_CHINA_WEAK,
                    to: dest,
                    type: 'SELL',
                    msg: `🇨🇳 CHINA WEAK: CSI300 < 250MA → CSI300 → ${dest}`
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // SELL RULE 8: EM Fail (Nifty50 < 250MA AND CSI300 < 250MA)
        // ═══════════════════════════════════════════════════════════════
        if (nifty50 && csi300 && hasHoldings('Nifty50')) {
            const nifty50Price = nifty50.price || nifty50.current;
            const csi300Price = csi300.price || csi300.current;
            if (nifty50Price < nifty50.ma250 && csi300Price < csi300.ma250) {
                signals.push({
                    ...Strategy.SELL_RULES.SELL_EM_FAIL,
                    type: 'SELL',
                    msg: `✈️ FLIGHT TO QUALITY: Both EM < 250MA → Nifty50 → QQQ`
                });
            }
        }

        return signals;
    },

    /**
     * Evaluate all BUY rules in priority order
     * @param {Object} context - { marketData, portfolio, mstrInputs, mstrState }
     * @returns {Array} - Array of triggered signals
     */
    evaluateBuyRules: (context) => {
        const signals = [];
        const { marketData, portfolio, mstrInputs, mstrState } = context;

        // Helpers
        const getAsset = (ticker) => portfolio.find(a => a.ticker === ticker);
        const hasHoldings = (ticker) => {
            const asset = getAsset(ticker);
            return asset && asset.shares > 0;
        };

        // Get manual MSTR inputs
        const mnav = mstrInputs?.mnav || null;
        const zScore = mstrInputs?.zScore || null;
        const mstrInputsValid = mnav !== null && zScore !== null;

        // Get market data
        const tlt = marketData?.TLT_US || marketData?.TLT;
        const gldm = marketData?.GLDM;
        const mstr = marketData?.MSTR;
        const csi300 = marketData?.CSI300;
        const nifty50 = marketData?.Nifty50;

        // ═══════════════════════════════════════════════════════════════
        // BUY RULE 1: Opportunity Scramble (Z < 0)
        // ═══════════════════════════════════════════════════════════════
        if (mstrInputsValid && hasHoldings('DBMF')) {
            if (zScore < 0) {
                signals.push({
                    ...Strategy.BUY_RULES.BUY_OPPORTUNITY,
                    type: 'BUY',
                    msg: `🎯 OPPORTUNITY: Z=${zScore.toFixed(2)} < 0 → DBMF(10%) → MSTR`
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // BUY RULE 2: Trend Re-entry (Z < 1.5 AND MSTR > 20MA AND soldAtHigh)
        // ═══════════════════════════════════════════════════════════════
        if (mstrInputsValid && hasHoldings('BIL') && mstrState?.soldAtHigh) {
            const mstrPrice = mstr?.price || mstr?.current;
            const mstr20ma = mstr?.ma20;
            if (zScore < 1.5 && mstrPrice && mstr20ma && mstrPrice > mstr20ma) {
                signals.push({
                    ...Strategy.BUY_RULES.BUY_TREND_REENTRY,
                    type: 'BUY',
                    msg: `📈 TREND RE-ENTRY: Z=${zScore.toFixed(2)}, MSTR > 20MA → BIL(10%) → MSTR`
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // BUY RULE 3: Crisis Defense (TLT < 50MA < 250MA AND RSI < 50)
        // ═══════════════════════════════════════════════════════════════
        if (tlt && (hasHoldings('GLDM') || hasHoldings('VBIL'))) {
            const tltPrice = tlt.price || tlt.current;
            const tlt50ma = tlt.ma50;
            const tlt250ma = tlt.ma250;
            // Death cross structure: Price < 50MA < 250MA
            if (tltPrice < tlt50ma && tlt50ma < tlt250ma && tlt.rsi < 50) {
                const source = hasHoldings('GLDM') ? 'GLDM' : 'VBIL';
                signals.push({
                    ...Strategy.BUY_RULES.BUY_CRISIS_DEFENSE,
                    from: source,
                    type: 'BUY',
                    msg: `🛡️ CRISIS DEFENSE: TLT Death Cross, RSI=${tlt.rsi?.toFixed(1)} → ${source} → PFIX`
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // BUY RULE 4: EM Return (CSI300 > 250MA OR GoldenCross)
        // ONLY triggers when CSI300/Nifty50 was previously absorbed by QQQ (Tactical state)
        // ═══════════════════════════════════════════════════════════════
        const csi300InTactical = typeof tacticalTargets !== 'undefined' && tacticalTargets['CSI300'];
        const nifty50InTactical = typeof tacticalTargets !== 'undefined' && tacticalTargets['Nifty50'];
        
        if (csi300 && (csi300InTactical || nifty50InTactical) && hasHoldings('QQQ')) {
            const csi300Price = csi300.price || csi300.current;
            const goldenCross = csi300.goldenCross || false;
            if (csi300Price > csi300.ma250 || goldenCross) {
                signals.push({
                    ...Strategy.BUY_RULES.BUY_EM_RETURN,
                    from: 'QQQ',
                    type: 'BUY',
                    msg: `🇨🇳 EM RETURN: CSI300 > 250MA → QQQ(Tactical) → CSI300`
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // BUY RULE 5: India Strong (CSI300 < 250MA AND Nifty50 > 250MA)
        // ONLY triggers when Nifty50 was absorbed by QQQ (Tactical state)
        // ═══════════════════════════════════════════════════════════════
        if (nifty50 && csi300 && nifty50InTactical && hasHoldings('QQQ')) {
            const nifty50Price = nifty50.price || nifty50.current;
            const csi300Price = csi300.price || csi300.current;
            if (csi300Price < csi300.ma250 && nifty50Price > nifty50.ma250) {
                signals.push({
                    ...Strategy.BUY_RULES.BUY_INDIA_STRONG,
                    type: 'BUY',
                    msg: `🇮🇳 INDIA STRONG: CSI300 weak, Nifty50 > 250MA → QQQ → Nifty50`
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // BUY RULE 6: TLT Re-entry (TLT > 250MA AND RSI < 65)
        // ONLY triggers when TLT was previously switched to BIL (Tactical state)
        // ═══════════════════════════════════════════════════════════════
        const tltInTactical = typeof tacticalTargets !== 'undefined' && tacticalTargets['TLT'];
        
        if (tlt && tltInTactical && hasHoldings('BIL')) {
            const tltPrice = tlt.price || tlt.current;
            const tlt250ma = tlt.ma250;
            if (tltPrice > tlt250ma && tlt.rsi < 65) {
                signals.push({
                    ...Strategy.BUY_RULES.BUY_TLT_REENTRY,
                    type: 'BUY',
                    msg: `📈 ISA RE-ENTRY: TLT > 250MA, RSI=${tlt.rsi?.toFixed(1)} → BIL(Tactical) → TLT`
                });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // BUY RULE 7: GLDM Re-entry (GLDM > 250MA AND RSI < 65)
        // ONLY triggers when GLDM was previously switched to VBIL (Tactical state)
        // ═══════════════════════════════════════════════════════════════
        const gldmInTactical = typeof tacticalTargets !== 'undefined' && tacticalTargets['GLDM'];
        
        if (gldm && gldmInTactical && hasHoldings('VBIL')) {
            const gldmPrice = gldm.price || gldm.current;
            const gldm250ma = gldm.ma250;
            if (gldmPrice > gldm250ma && gldm.rsi < 65) {
                signals.push({
                    ...Strategy.BUY_RULES.BUY_GLDM_REENTRY,
                    type: 'BUY',
                    msg: `📈 GOLD RE-ENTRY: GLDM > 250MA, RSI=${gldm.rsi?.toFixed(1)} → VBIL → GLDM`
                });
            }
        }

        return signals;
    },

    /**
     * Evaluate ALL rules (SELL + BUY) and combine
     */
    evaluateAllRules: (context) => {
        const sellSignals = Strategy.evaluateSellRules(context);
        const buySignals = Strategy.evaluateBuyRules(context);
        return [...sellSignals, ...buySignals];
    },

    // ═══════════════════════════════════════════════════════════════════
    // UTILITY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    // Execution Day Check (Friday)
    isExecutionDay: () => {
        const today = new Date();
        return today.getDay() === 5; // 5 = Friday
    },

    // Last Friday of Month Check
    isLastFridayOfMonth: () => {
        const today = new Date();
        if (today.getDay() !== 5) return false;
        
        // Check if next Friday is in a different month
        const nextFriday = new Date(today);
        nextFriday.setDate(today.getDate() + 7);
        return nextFriday.getMonth() !== today.getMonth();
    },

    // ═══════════════════════════════════════════════════════════════════
    // REBALANCING (30% Relative Threshold)
    // ═══════════════════════════════════════════════════════════════════
    
    checkRebalancing: (portfolio) => {
        const totalValue = portfolio.reduce((sum, asset) => sum + (asset.value || 0), 0);
        if (totalValue === 0) return [];

        const actions = [];

        portfolio.forEach(asset => {
            // Get effective target (Tactical if active, otherwise original)
            // Use global function if available
            let targetWeight = asset.targetWeight;
            let isTactical = false;
            
            if (typeof getEffectiveTarget === 'function') {
                const effectiveTarget = getEffectiveTarget(asset.ticker);
                targetWeight = effectiveTarget.weight;
                isTactical = effectiveTarget.isTactical;
            }
            
            // Skip assets with 0% target weight (Transition/Cash assets)
            if (targetWeight === 0) return;

            const currentWeight = asset.value / totalValue;
            const diff = currentWeight - targetWeight;

            // 30% relative threshold: |Actual - Target| / Target >= 0.3
            const relativeDeviation = Math.abs(diff) / targetWeight;
            const threshold = 0.3;

            const diffValue = asset.value - (totalValue * targetWeight);
            const absAmount = Math.abs(diffValue);
            const formattedAmount = '₩' + Math.round(absAmount).toLocaleString();
            const diffPercent = Math.abs(diff * 100).toFixed(1);
            
            // Add tactical indicator to message if applicable
            const tacticalTag = isTactical ? ' 🔄' : '';

            if (relativeDeviation >= threshold) {
                if (diff > 0) {
                    actions.push({
                        type: 'SELL',
                        asset: asset,
                        isTactical: isTactical,
                        msg: `SELL ${asset.ticker}${tacticalTag} (${formattedAmount}) - Overweight by ${diffPercent}%`
                    });
                } else {
                    actions.push({
                        type: 'BUY',
                        asset: asset,
                        isTactical: isTactical,
                        msg: `BUY ${asset.ticker}${tacticalTag} (${formattedAmount}) - Underweight by ${diffPercent}%`
                    });
                }
            }
        });

        return actions;
    }
};
