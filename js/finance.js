/**
 * Financial Calculation Library
 */

const Finance = {
    // Standard Risk-Free Rate (Annualized)
    RISK_FREE_RATE: 0.05,

    /**
     * Calculate Simple Moving Average
     * @param {number[]} prices - Array of prices (newest last)
     * @param {number} period - Period for MA (e.g. 50, 250)
     * @returns {number|null}
     */
    calculateMA: (prices, period) => {
        if (!prices || prices.length < period) return null;
        const slice = prices.slice(-period);
        const sum = slice.reduce((a, b) => a + b, 0);
        return sum / period;
    },

    /**
     * Calculate RSI (Relative Strength Index)
     * @param {number[]} prices 
     * @param {number} period - Standard is 14
     * @returns {number|null}
     */
    calculateRSI: (prices, period = 14) => {
        if (!prices || prices.length < period + 1) return null;

        let gains = 0;
        let losses = 0;

        // Calculate initial regular average
        for (let i = 1; i <= period; i++) {
            const change = prices[i] - prices[i - 1];
            if (change >= 0) gains += change;
            else losses += Math.abs(change);
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        // Wilder's Smoothing for subsequent steps
        for (let i = period + 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            const currentGain = change > 0 ? change : 0;
            const currentLoss = change < 0 ? Math.abs(change) : 0;

            avgGain = ((avgGain * (period - 1)) + currentGain) / period;
            avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
        }

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    },

    /**
     * Calculate Z-Score for MSTR (using simple std dev from MA)
     * Note: True Z-score is (Val - Mean) / StdDev
     * @param {number} currentPrice 
     * @param {number[]} history 
     * @param {number} period 
     */
    calculateZScore: (currentPrice, history, period = 50) => {
        if (!history || history.length < period) return 0;

        const slice = history.slice(-period);
        const mean = slice.reduce((a, b) => a + b, 0) / period;

        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) return 0;
        return (currentPrice - mean) / stdDev;
    },

    /**
     * Format currency to KRW/USD string
     */
    formatCurrency: (value, currency = 'KRW') => {
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(value);
    },

    formatNumber: (value, decimals = 2) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(value);
    },

    /**
     * Calculate Portfolio Risk Metrics (Simulated/Mock)
     * In a real app, this implies creating a synthetic history of the total portfolio value
     */
    calculatePortfolioStats: (portfolio, marketData) => {
        // Mocking complexity: Generating a 'fake' portfolio history based on weighted asset histories
        // Check if we have history
        const sampleAsset = Object.values(marketData)[0];
        if (!sampleAsset || !sampleAsset.history) return null;

        const historyLength = sampleAsset.history.length;
        const portfolioHistory = new Array(historyLength).fill(0);

        // Aggregate history
        portfolio.forEach(asset => {
            const data = marketData[asset.ticker];
            if (data && data.history) {
                for (let i = 0; i < historyLength; i++) {
                    portfolioHistory[i] += (data.history[i] * asset.shares);
                }
            }
        });

        // Current Value
        const startValue = portfolioHistory[0];
        const endValue = portfolioHistory[historyLength - 1];

        // CAGR (assuming history is ~1 year or 300 days as per data.js)
        // 300 mock days ~= 0.82 years
        const years = 300 / 365;
        const cagr = Math.pow(endValue / startValue, 1 / years) - 1;

        // Returns Array
        const returns = [];
        for (let i = 1; i < historyLength; i++) {
            returns.push((portfolioHistory[i] - portfolioHistory[i - 1]) / portfolioHistory[i - 1]);
        }

        // Std Dev (Annualized)
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance) * Math.sqrt(252); // Annualize

        // Sharpe (Risk Free Rate assumed 5%)
        const rf = Finance.RISK_FREE_RATE;
        const sharpe = (cagr - rf) / stdDev;

        // Sortino (Downside risk only)
        const negativeReturns = returns.filter(r => r < 0);
        const downsideVariance = negativeReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / returns.length;
        const downsideDev = Math.sqrt(downsideVariance) * Math.sqrt(252);
        const sortino = (cagr - rf) / downsideDev;

        // Weekly Return (Last 7 days)
        // Mock data has daily steps.
        const weekStartVal = portfolioHistory[historyLength - 6]; // 5 trading days ago
        const weeklyReturn = (endValue - weekStartVal) / weekStartVal;

        return {
            cagr: cagr * 100, // %
            stdDev: stdDev * 100, // %
            sharpe: sharpe,
            sortino: sortino,
            beta: 0.85, // Hardcoded benchmark beta for now as we lack SPY history
            weeklyReturn: weeklyReturn * 100
        };
    },

    // =====================================================
    // Snapshot-Based Calculations (TWR - Time Weighted Return)
    // Properly handles deposits/withdrawals
    // =====================================================

    /**
     * Create a daily snapshot of portfolio value
     */
    createSnapshot: (portfolio, totalValue, cashFlow = 0) => {
        const today = new Date().toISOString().split('T')[0];
        return {
            date: today,
            totalValue: totalValue,
            holdings: portfolio.map(a => ({
                ticker: a.ticker,
                value: a.value || 0,
                shares: a.shares || 0
            })),
            cashFlow: cashFlow
        };
    },

    /**
     * Calculate Time-Weighted Return (TWR)
     * Handles deposits/withdrawals correctly
     */
    calculateTWR: (snapshots) => {
        if (!snapshots || snapshots.length < 2) return null;

        const sorted = [...snapshots].sort((a, b) => new Date(a.date) - new Date(b.date));
        let twr = 1;

        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];

            // Adjust for cash flow: value before cash flow
            const adjustedPrevValue = prev.totalValue;
            const valueBeforeCashFlow = curr.totalValue - (curr.cashFlow || 0);

            if (adjustedPrevValue > 0) {
                const periodReturn = valueBeforeCashFlow / adjustedPrevValue;
                twr *= periodReturn;
            }
        }

        return twr - 1; // Return as decimal (e.g., 0.15 = 15%)
    },

    /**
     * Calculate CAGR from snapshots
     */
    calculateCAGRfromSnapshots: (snapshots) => {
        if (!snapshots || snapshots.length < 2) return null;

        const sorted = [...snapshots].sort((a, b) => new Date(a.date) - new Date(b.date));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        const startDate = new Date(first.date);
        const endDate = new Date(last.date);
        const years = (endDate - startDate) / (365.25 * 24 * 60 * 60 * 1000);

        if (years <= 0 || first.totalValue <= 0) return null;

        const twr = Finance.calculateTWR(snapshots);
        if (twr === null) return null;

        // CAGR = (1 + TWR)^(1/years) - 1
        return Math.pow(1 + twr, 1 / years) - 1;
    },

    /**
     * Get daily returns from snapshots
     */
    getDailyReturnsFromSnapshots: (snapshots) => {
        if (!snapshots || snapshots.length < 2) return [];

        const sorted = [...snapshots].sort((a, b) => new Date(a.date) - new Date(b.date));
        const returns = [];

        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            const adjustedValue = curr.totalValue - (curr.cashFlow || 0);

            if (prev.totalValue > 0) {
                returns.push({
                    date: curr.date,
                    return: (adjustedValue / prev.totalValue) - 1
                });
            }
        }

        return returns;
    },

    /**
     * Calculate StdDev from snapshots
     */
    calculateStdDevFromSnapshots: (snapshots) => {
        const returns = Finance.getDailyReturnsFromSnapshots(snapshots);
        if (returns.length < 2) return null;

        const values = returns.map(r => r.return);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

        return Math.sqrt(variance) * Math.sqrt(252); // Annualized
    },

    /**
     * Calculate Downside StdDev for Sortino
     */
    calculateDownsideStdDevFromSnapshots: (snapshots, targetReturn = 0) => {
        const returns = Finance.getDailyReturnsFromSnapshots(snapshots);
        if (returns.length < 2) return null;

        const downside = returns.map(r => r.return).filter(r => r < targetReturn);
        if (downside.length === 0) return 0;

        const variance = downside.reduce((sum, v) => sum + Math.pow(v - targetReturn, 2), 0) / returns.length;
        return Math.sqrt(variance) * Math.sqrt(252);
    },

    /**
     * Calculate Beta vs Benchmark
     */
    calculateBetaFromSnapshots: (snapshots, benchmarkReturns) => {
        const portfolioReturns = Finance.getDailyReturnsFromSnapshots(snapshots);
        if (portfolioReturns.length < 10 || !benchmarkReturns || benchmarkReturns.length < 10) return null;

        const matched = [];
        portfolioReturns.forEach(pr => {
            const br = benchmarkReturns.find(b => b.date === pr.date);
            if (br) matched.push({ p: pr.return, b: br.return });
        });

        if (matched.length < 10) return null;

        const pMean = matched.reduce((s, m) => s + m.p, 0) / matched.length;
        const bMean = matched.reduce((s, m) => s + m.b, 0) / matched.length;

        let covariance = 0, bVariance = 0;
        matched.forEach(m => {
            covariance += (m.p - pMean) * (m.b - bMean);
            bVariance += Math.pow(m.b - bMean, 2);
        });

        if (bVariance === 0) return null;
        return covariance / bVariance;
    },

    /**
     * Calculate Sharpe from snapshots
     */
    calculateSharpeFromSnapshots: (snapshots, riskFreeRate = Finance.RISK_FREE_RATE) => {
        const cagr = Finance.calculateCAGRfromSnapshots(snapshots);
        const stdDev = Finance.calculateStdDevFromSnapshots(snapshots);
        if (cagr === null || stdDev === null || stdDev === 0) return null;
        return (cagr - riskFreeRate) / stdDev;
    },

    /**
     * Calculate Sortino from snapshots
     */
    calculateSortinoFromSnapshots: (snapshots, riskFreeRate = Finance.RISK_FREE_RATE) => {
        const cagr = Finance.calculateCAGRfromSnapshots(snapshots);
        const downside = Finance.calculateDownsideStdDevFromSnapshots(snapshots);
        if (cagr === null || downside === null || downside === 0) return null;
        return (cagr - riskFreeRate) / downside;
    },

    /**
     * Calculate all metrics from snapshots
     */
    calculateAllMetricsFromSnapshots: (snapshots, benchmarkReturns = null, riskFreeRate = Finance.RISK_FREE_RATE) => {
        return {
            cagr: Finance.calculateCAGRfromSnapshots(snapshots),
            stdDev: Finance.calculateStdDevFromSnapshots(snapshots),
            beta: benchmarkReturns ? Finance.calculateBetaFromSnapshots(snapshots, benchmarkReturns) : null,
            sharpe: Finance.calculateSharpeFromSnapshots(snapshots, riskFreeRate),
            sortino: Finance.calculateSortinoFromSnapshots(snapshots, riskFreeRate)
        };
    },

    // =====================================================
    // Historical AUM Reconstruction (Backfill from Logs)
    // =====================================================

    /**
     * Reconstruct historical AUM from current holdings, logs, and price history
     * @param {Array} portfolio - Current holdings [{ ticker, shares, ... }]
     * @param {Array} logs - Historical events [{ date, type, ticker, shares, ... }]
     * @param {Object} priceHistories - { ticker: { history: [prices], dates: [dates] } }
     * @param {number} fxRate - USD to KRW exchange rate
     * @returns {Array} - [{ date, totalValue, breakdown: { ticker: value } }, ...]
     */
    reconstructHistoricalAUM: (portfolio, logs, priceHistories, fxRate = 1410) => {
        if (!portfolio || !priceHistories) return [];

        // 1. Collect all date arrays from assets and find COMMON date range
        // We need to find the date where ALL assets have data (the latest "first date" among all assets)
        
        const allDateSets = [];
        const tickersWithData = [];
        
        portfolio.forEach(asset => {
            const ticker = asset.ticker;
            const priceData = priceHistories[ticker];
            
            if (priceData && priceData.dates && priceData.dates.length > 0 && asset.shares > 0) {
                allDateSets.push({
                    ticker: ticker,
                    dates: priceData.dates,
                    firstDate: priceData.dates[0],
                    lastDate: priceData.dates[priceData.dates.length - 1]
                });
                tickersWithData.push(ticker);
            }
        });

        if (allDateSets.length === 0) {
            console.warn("No dates available from any asset");
            return [];
        }

        // Find the COMMON start date (the latest "first date" among all assets)
        // This ensures all assets have data from this date forward
        let commonStartDate = allDateSets[0].firstDate;
        allDateSets.forEach(ds => {
            if (ds.firstDate > commonStartDate) {
                commonStartDate = ds.firstDate;
            }
        });

        // Use the first asset's dates as base, but filter to start from commonStartDate
        const baseDates = allDateSets[0].dates;
        const dates = baseDates.filter(d => d >= commonStartDate);
        const historyLength = dates.length;

        // Debug: log the date range
        console.log("AUM Common start date:", commonStartDate);
        console.log("AUM Date range:", dates[0], "to", dates[dates.length - 1], "(" + historyLength + " trading days)");
        console.log("Assets included:", tickersWithData.join(", "));

        // 2. Build shares timeline for each asset
        // Start with current shares for ALL dates, then adjust for dates BEFORE each log
        const sharesTimeline = {};
        
        portfolio.forEach(asset => {
            sharesTimeline[asset.ticker] = new Array(historyLength).fill(asset.shares);
        });

        // Sort logs by date ascending (oldest first) for easier processing
        const sortedLogs = [...(logs || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Apply logs to reconstruct historical shares
        // For each log, adjust shares for dates BEFORE the log date
        // 
        // Current log formats:
        // - Deposit: { type: 'Deposit', transactions: [{ asset: 'QQQ', shares: 10 }] }
        // - Withdraw: { type: 'Withdraw', transactions: [{ asset: 'QQQ', shares: 10 }] }
        // - Rebalancing/Switch: { type: 'Rebalancing'|'Switch', transactions: [{ fromAsset, fromShares, toAsset, toShares }] }
        //
        sortedLogs.forEach(log => {
            const logDate = log.date;
            if (!logDate) return;
            
            // Process based on log type
            if (log.type === 'Deposit' && log.transactions) {
                // Deposit: Before this date, we had FEWER shares
                log.transactions.forEach(tx => {
                    const ticker = tx.asset;
                    const shares = parseFloat(tx.shares) || 0;
                    if (!ticker || !sharesTimeline[ticker]) return;
                    
                    dates.forEach((d, i) => {
                        if (d < logDate) {
                            sharesTimeline[ticker][i] -= shares;
                        }
                    });
                });
            } else if (log.type === 'Withdraw' && log.transactions) {
                // Withdraw: Before this date, we had MORE shares
                log.transactions.forEach(tx => {
                    const ticker = tx.asset;
                    const shares = parseFloat(tx.shares) || 0;
                    if (!ticker || !sharesTimeline[ticker]) return;
                    
                    dates.forEach((d, i) => {
                        if (d < logDate) {
                            sharesTimeline[ticker][i] += shares;
                        }
                    });
                });
            } else if ((log.type === 'Rebalancing' || log.type === 'Switch') && log.transactions) {
                // Rebalancing/Switch: Before this date, fromAsset had MORE, toAsset had FEWER
                log.transactions.forEach(tx => {
                    const fromTicker = tx.fromAsset;
                    const fromShares = parseFloat(tx.fromShares) || 0;
                    const toTicker = tx.toAsset;
                    const toShares = parseFloat(tx.toShares) || 0;
                    
                    dates.forEach((d, i) => {
                        if (d < logDate) {
                            // Before the switch/rebalance, we had more of fromAsset
                            if (fromTicker && sharesTimeline[fromTicker]) {
                                sharesTimeline[fromTicker][i] += fromShares;
                            }
                            // Before the switch/rebalance, we had fewer of toAsset
                            if (toTicker && sharesTimeline[toTicker]) {
                                sharesTimeline[toTicker][i] -= toShares;
                            }
                        }
                    });
                });
            }
            // Legacy format support (type: 'BUY'/'SELL' with direct ticker/shares)
            else if (log.type === 'BUY' && log.ticker && sharesTimeline[log.ticker]) {
                dates.forEach((d, i) => {
                    if (d < logDate) {
                        sharesTimeline[log.ticker][i] -= (log.shares || 0);
                    }
                });
            } else if (log.type === 'SELL' && log.ticker && sharesTimeline[log.ticker]) {
                dates.forEach((d, i) => {
                    if (d < logDate) {
                        sharesTimeline[log.ticker][i] += (log.shares || 0);
                    }
                });
            }
        });

        // Ensure no negative shares
        Object.keys(sharesTimeline).forEach(ticker => {
            sharesTimeline[ticker] = sharesTimeline[ticker].map(s => Math.max(0, s));
        });

        // 3. Build a price lookup map for each asset: { date -> price }
        const priceMaps = {};
        portfolio.forEach(asset => {
            const ticker = asset.ticker;
            const priceData = priceHistories[ticker];
            priceMaps[ticker] = {};
            
            if (priceData && priceData.dates && priceData.history) {
                priceData.dates.forEach((d, i) => {
                    priceMaps[ticker][d] = priceData.history[i];
                });
            }
        });

        // 4. Calculate AUM for each date
        const result = [];
        
        for (let i = 0; i < historyLength; i++) {
            const currentDate = dates[i];
            let totalValue = 0;
            const breakdown = {};

            portfolio.forEach(asset => {
                const ticker = asset.ticker;
                const priceData = priceHistories[ticker];
                
                if (!priceData) return;

                const shares = sharesTimeline[ticker]?.[i] || 0;
                
                // Look up price by date, or find nearest previous date
                let price = priceMaps[ticker][currentDate];
                
                // If no price for this exact date, find the most recent previous price
                if (price === undefined || price === null) {
                    // Find the nearest previous trading day for this asset
                    const assetDates = priceData.dates || [];
                    for (let j = assetDates.length - 1; j >= 0; j--) {
                        if (assetDates[j] <= currentDate) {
                            price = priceData.history[j];
                            break;
                        }
                    }
                }

                // Handle potential null/undefined prices
                if (price === null || price === undefined || isNaN(price)) {
                    price = 0;
                }

                // Convert USD to KRW
                if (priceData.currency === 'USD') {
                    price = price * fxRate;
                }

                const value = shares * price;
                breakdown[ticker] = value;
                totalValue += value;
            });

            result.push({
                date: currentDate,
                totalValue: totalValue,
                breakdown: breakdown
            });
        }

        // Debug: log first and last AUM
        if (result.length > 0) {
            console.log("AUM first:", result[0].date, result[0].totalValue);
            console.log("AUM last:", result[result.length-1].date, result[result.length-1].totalValue);
        }

        return result;
    },

    /**
     * Calculate Maximum Drawdown from AUM history
     * @param {Array} aumHistory - [{ date, totalValue }, ...]
     * @returns {Object} - { mdd: number (decimal), peak: number, trough: number, peakDate, troughDate }
     */
    calculateMDD: (aumHistory) => {
        if (!aumHistory || aumHistory.length < 2) return { mdd: 0 };

        let peak = aumHistory[0].totalValue;
        let peakDate = aumHistory[0].date;
        let maxDrawdown = 0;
        let troughValue = peak;
        let troughDate = peakDate;
        let mddPeakDate = peakDate;

        for (let i = 1; i < aumHistory.length; i++) {
            const value = aumHistory[i].totalValue;
            
            if (value > peak) {
                peak = value;
                peakDate = aumHistory[i].date;
            }

            const drawdown = (peak - value) / peak;
            
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
                troughValue = value;
                troughDate = aumHistory[i].date;
                mddPeakDate = peakDate;
            }
        }

        return {
            mdd: maxDrawdown,  // As decimal (e.g., 0.15 = 15%)
            peak: peak,
            trough: troughValue,
            peakDate: mddPeakDate,
            troughDate: troughDate
        };
    },

    /**
     * Normalize a price series to start at a given value
     * Used for comparing portfolio AUM vs SPY on same scale
     * @param {Array} prices - Array of prices
     * @param {number} startValue - Value to normalize to (e.g., initial portfolio AUM)
     * @returns {Array} - Normalized prices
     */
    normalizeToStartValue: (prices, startValue) => {
        if (!prices || prices.length === 0 || !startValue) return [];
        
        const initialPrice = prices[0];
        if (initialPrice === 0) return prices;

        return prices.map(p => (p / initialPrice) * startValue);
    },

    /**
     * Calculate daily returns from AUM history
     * @param {Array} aumHistory - [{ date, totalValue }, ...]
     * @returns {Array} - [{ date, return: decimal }, ...]
     */
    calculateDailyReturnsFromAUM: (aumHistory) => {
        if (!aumHistory || aumHistory.length < 2) return [];

        const returns = [];
        for (let i = 1; i < aumHistory.length; i++) {
            const prevValue = aumHistory[i - 1].totalValue;
            const currValue = aumHistory[i].totalValue;

            if (prevValue > 0) {
                returns.push({
                    date: aumHistory[i].date,
                    return: (currValue - prevValue) / prevValue
                });
            }
        }

        return returns;
    },

    /**
     * Calculate all performance metrics from reconstructed AUM history
     * @param {Array} aumHistory - [{ date, totalValue }, ...]
     * @param {Array} benchmarkPrices - SPY prices (normalized)
     * @param {number} riskFreeRate - Annual risk-free rate (default 5%)
     * @returns {Object} - { cagr, mdd, stdDev, sharpe, sortino, beta }
     */
    calculatePerformanceMetrics: (aumHistory, benchmarkPrices = null, riskFreeRate = Finance.RISK_FREE_RATE) => {
        if (!aumHistory || aumHistory.length < 2) {
            return { cagr: null, mdd: null, stdDev: null, sharpe: null, sortino: null, beta: null };
        }
        // CAGR
        const first = aumHistory[0];
        const last = aumHistory[aumHistory.length - 1];
        const startDate = new Date(first.date);
        const endDate = new Date(last.date);
        const years = (endDate - startDate) / (365.25 * 24 * 60 * 60 * 1000);
        
        let cagr = null;
        if (years > 0 && first.totalValue > 0) {
            cagr = Math.pow(last.totalValue / first.totalValue, 1 / years) - 1;
        }

        // MDD
        const mddResult = Finance.calculateMDD(aumHistory);

        // Daily returns for StdDev, Sharpe, Sortino
        const dailyReturns = Finance.calculateDailyReturnsFromAUM(aumHistory);
        const returnValues = dailyReturns.map(r => r.return);

        // StdDev (Annualized)
        let stdDev = null;
        if (returnValues.length >= 2) {
            const mean = returnValues.reduce((s, v) => s + v, 0) / returnValues.length;
            const variance = returnValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / returnValues.length;
            stdDev = Math.sqrt(variance) * Math.sqrt(252);
        }

        // Sharpe
        let sharpe = null;
        if (cagr !== null && stdDev !== null && stdDev > 0) {
            sharpe = (cagr - riskFreeRate) / stdDev;
        }

        // Sortino (Downside deviation)
        let sortino = null;
        if (returnValues.length >= 2) {
            const negReturns = returnValues.filter(r => r < 0);
            if (negReturns.length > 0) {
                const downsideVariance = negReturns.reduce((s, v) => s + Math.pow(v, 2), 0) / returnValues.length;
                const downsideDev = Math.sqrt(downsideVariance) * Math.sqrt(252);
                if (downsideDev > 0 && cagr !== null) {
                    sortino = (cagr - riskFreeRate) / downsideDev;
                }
            }
        }

        // SPY Benchmark Metrics
        let beta = null;
        let spyCagr = null;
        let spyStdDev = null;
        let spyMdd = null;
        let spySharpe = null;
        let spySortino = null;
        let alpha = null;
        let rsRatio = null;
        let correlation = null;
        
        let benchReturns = [];

        if (benchmarkPrices && benchmarkPrices.length >= 10) {
            // Calculate benchmark returns
            for (let i = 1; i < benchmarkPrices.length; i++) {
                if (benchmarkPrices[i - 1] > 0) {
                    benchReturns.push((benchmarkPrices[i] - benchmarkPrices[i - 1]) / benchmarkPrices[i - 1]);
                }
            }

            // SPY CAGR
            const spyFirst = benchmarkPrices[0];
            const spyLast = benchmarkPrices[benchmarkPrices.length - 1];
            if (years > 0 && spyFirst > 0) {
                spyCagr = Math.pow(spyLast / spyFirst, 1 / years) - 1;
            }

            // SPY StdDev (Annualized)
            if (benchReturns.length >= 2) {
                const bMean = benchReturns.reduce((s, v) => s + v, 0) / benchReturns.length;
                const bVariance = benchReturns.reduce((s, v) => s + Math.pow(v - bMean, 2), 0) / benchReturns.length;
                spyStdDev = Math.sqrt(bVariance) * Math.sqrt(252);
            }

            // SPY MDD
            const spyAumHistory = benchmarkPrices.map((p, i) => ({
                date: aumHistory[i] ? aumHistory[i].date : i.toString(),
                totalValue: p
            }));
            const spyMddResult = Finance.calculateMDD(spyAumHistory);
            spyMdd = spyMddResult.mdd;

            // SPY Sharpe
            if (spyCagr !== null && spyStdDev !== null && spyStdDev > 0) {
                spySharpe = (spyCagr - riskFreeRate) / spyStdDev;
            }

            // SPY Sortino
            if (benchReturns.length >= 2) {
                const bNegReturns = benchReturns.filter(r => r < 0);
                if (bNegReturns.length > 0) {
                    const bDownsideVariance = bNegReturns.reduce((s, v) => s + Math.pow(v, 2), 0) / benchReturns.length;
                    const bDownsideDev = Math.sqrt(bDownsideVariance) * Math.sqrt(252);
                    if (bDownsideDev > 0 && spyCagr !== null) {
                        spySortino = (spyCagr - riskFreeRate) / bDownsideDev;
                    }
                }
            }

            // Beta
            const minLen = Math.min(returnValues.length, benchReturns.length);
            if (minLen >= 10) {
                const pReturns = returnValues.slice(-minLen);
                const bReturns = benchReturns.slice(-minLen);

                const pMean = pReturns.reduce((s, v) => s + v, 0) / minLen;
                const bMean = bReturns.reduce((s, v) => s + v, 0) / minLen;

                let covariance = 0, bVariance = 0;
                for (let i = 0; i < minLen; i++) {
                    covariance += (pReturns[i] - pMean) * (bReturns[i] - bMean);
                    bVariance += Math.pow(bReturns[i] - bMean, 2);
                }

                if (bVariance > 0) {
                    beta = covariance / bVariance;
                }

                // Alpha (Jensen's Alpha): α = Rp - [Rf + β × (Rm - Rf)]
                if (beta !== null && cagr !== null && spyCagr !== null) {
                    alpha = cagr - (riskFreeRate + beta * (spyCagr - riskFreeRate));
                }
            }

            // RS Ratio (Relative Strength)
            if (stdDev !== null && spyStdDev !== null && spyStdDev > 0 && cagr !== null && spyCagr !== null) {
                // RS Ratio = (Portfolio Return / SPY Return) adjusted for time
                if (spyCagr > 0) {
                    rsRatio = cagr / spyCagr;
                } else if (spyCagr < 0 && cagr > 0) {
                    rsRatio = 2.0; // Portfolio positive while benchmark negative
                } else {
                    rsRatio = 1.0;
                }
            }

            // Benchmark Correlation (Pearson correlation coefficient)
            const corrMinLen = Math.min(returnValues.length, benchReturns.length);
            if (corrMinLen >= 10) {
                const pRet = returnValues.slice(-corrMinLen);
                const bRet = benchReturns.slice(-corrMinLen);

                const pMeanCorr = pRet.reduce((s, v) => s + v, 0) / corrMinLen;
                const bMeanCorr = bRet.reduce((s, v) => s + v, 0) / corrMinLen;

                let sumProduct = 0, sumPSq = 0, sumBSq = 0;
                for (let i = 0; i < corrMinLen; i++) {
                    const pDiff = pRet[i] - pMeanCorr;
                    const bDiff = bRet[i] - bMeanCorr;
                    sumProduct += pDiff * bDiff;
                    sumPSq += pDiff * pDiff;
                    sumBSq += bDiff * bDiff;
                }

                const denominator = Math.sqrt(sumPSq) * Math.sqrt(sumBSq);
                if (denominator > 0) {
                    correlation = sumProduct / denominator;
                }
            }
        }

        return {
            cagr: cagr,
            mdd: mddResult.mdd,
            stdDev: stdDev,
            sharpe: sharpe,
            sortino: sortino,
            beta: beta,
            alpha: alpha,
            rsRatio: rsRatio,
            correlation: correlation,
            spyCagr: spyCagr,
            spyStdDev: spyStdDev,
            spyMdd: spyMdd,
            spySharpe: spySharpe,
            spySortino: spySortino,
            mddDetails: mddResult
        };
    },

    /**
     * Calculate Week-over-Week (WoW) Delta for Identity metrics
     * Compares current SI metrics (full period) with last Friday's SI metrics
     * Same period as WTD Return: Last Friday → Current
     * @param {Array} aumHistory - Full AUM history
     * @param {Array} spyPricesMatched - Matched SPY prices
     * @param {number} riskFreeRate - Risk-free rate
     * @returns {Object} - { aumDelta, cagrDelta, stdDevDelta, calmarDelta, lastWeekMetrics }
     */
    calculateWoWDelta: (aumHistory, spyPricesMatched, riskFreeRate = 0.05) => {
        const result = {
            aumDelta: null,
            cagrDelta: null,
            stdDevDelta: null,
            calmarDelta: null,
            lastWeekMetrics: null
        };

        if (!aumHistory || aumHistory.length < 10) {
            return result;
        }

        // Check if we're in freeze mode
        const displayPeriod = Finance.getWTDDisplayPeriod();
        const isFrozen = displayPeriod.period === 'weekend_freeze';

        // For WoW Delta, we need to compare two points:
        // - Active mode: LAST Friday → Current (today)
        // - Freeze mode: LAST-LAST Friday → LAST Friday (completed week)
        
        const now = new Date();
        const dayOfWeek = now.getDay();
        const hour = now.getHours();
        
        let baseFridayDaysAgo, endFridayDaysAgo;
        
        if (isFrozen) {
            // Freeze mode: Compare LAST-LAST Friday → LAST Friday
            if (dayOfWeek === 6) { // Saturday
                baseFridayDaysAgo = 8;  // LAST-LAST Friday
                endFridayDaysAgo = 1;   // LAST Friday (yesterday)
            } else if (dayOfWeek === 0) { // Sunday
                baseFridayDaysAgo = 9;
                endFridayDaysAgo = 2;
            } else if (dayOfWeek === 1 && hour < 9) { // Monday before 09:00
                baseFridayDaysAgo = 10;
                endFridayDaysAgo = 3;
            } else {
                baseFridayDaysAgo = 7;
                endFridayDaysAgo = 0; // Today (fallback)
            }
        } else {
            // Active mode: Compare LAST Friday → Current
            if (dayOfWeek === 1 && hour >= 9) { // Monday after 09:00
                baseFridayDaysAgo = 3;
            } else if (dayOfWeek === 5) { // Friday
                baseFridayDaysAgo = 7;
            } else if (dayOfWeek >= 2 && dayOfWeek <= 4) { // Tue-Thu
                baseFridayDaysAgo = dayOfWeek + 2;
            } else {
                baseFridayDaysAgo = 7;
            }
            endFridayDaysAgo = 0; // Use current (today)
        }

        // Calculate base Friday date
        const baseFridayDate = new Date(now);
        baseFridayDate.setDate(baseFridayDate.getDate() - baseFridayDaysAgo);
        const baseFriday = baseFridayDate.toISOString().split('T')[0];

        // Find index for base Friday in aumHistory
        let baseFridayIdx = -1;
        for (let i = aumHistory.length - 1; i >= 0; i--) {
            if (aumHistory[i].date <= baseFriday) {
                baseFridayIdx = i;
                break;
            }
        }

        if (baseFridayIdx < 5) {
            console.warn("Not enough data for WoW calculation, baseFridayIdx:", baseFridayIdx);
            return result;
        }

        // Determine end index
        let endIdx;
        if (isFrozen) {
            // Find end Friday in aumHistory
            const endFridayDate = new Date(now);
            endFridayDate.setDate(endFridayDate.getDate() - endFridayDaysAgo);
            const endFriday = endFridayDate.toISOString().split('T')[0];
            
            endIdx = aumHistory.length - 1; // Default to last
            for (let i = aumHistory.length - 1; i >= 0; i--) {
                if (aumHistory[i].date <= endFriday) {
                    endIdx = i;
                    break;
                }
            }
        } else {
            endIdx = aumHistory.length - 1; // Current (today)
        }

        // Current/End metrics
        const endHistory = aumHistory.slice(0, endIdx + 1);
        const endSpy = spyPricesMatched ? spyPricesMatched.slice(0, endIdx + 1) : null;
        const endMetrics = Finance.calculatePerformanceMetrics(endHistory, endSpy, riskFreeRate);
        const endAUM = endHistory[endHistory.length - 1]?.totalValue || 0;
        const endCalmar = Finance.calculateCalmarRatio(endMetrics.cagr, endMetrics.mdd);

        // Base Friday's metrics
        const baseHistory = aumHistory.slice(0, baseFridayIdx + 1);
        const baseSpy = spyPricesMatched ? spyPricesMatched.slice(0, baseFridayIdx + 1) : null;
        const baseMetrics = Finance.calculatePerformanceMetrics(baseHistory, baseSpy, riskFreeRate);
        const baseAUM = baseHistory[baseHistory.length - 1]?.totalValue || 0;
        const baseCalmar = Finance.calculateCalmarRatio(baseMetrics.cagr, baseMetrics.mdd);

        // Calculate deltas
        result.aumDelta = baseAUM > 0 ? (endAUM - baseAUM) / baseAUM : null;
        result.cagrDelta = (endMetrics.cagr !== null && baseMetrics.cagr !== null)
            ? endMetrics.cagr - baseMetrics.cagr
            : null;
        result.stdDevDelta = (endMetrics.stdDev !== null && baseMetrics.stdDev !== null)
            ? endMetrics.stdDev - baseMetrics.stdDev
            : null;
        result.calmarDelta = (endCalmar !== null && baseCalmar !== null)
            ? endCalmar - baseCalmar
            : null;

        result.lastWeekMetrics = {
            aum: baseAUM,
            cagr: baseMetrics.cagr,
            stdDev: baseMetrics.stdDev,
            calmar: baseCalmar
        };

        console.log("WoW Delta:", {
            mode: isFrozen ? 'FROZEN' : 'ACTIVE',
            baseFriday: baseFriday,
            endDate: aumHistory[endIdx]?.date,
            aumDelta: result.aumDelta ? (result.aumDelta * 100).toFixed(2) + '%' : '--',
            cagrDelta: result.cagrDelta ? (result.cagrDelta * 100).toFixed(2) + 'pp' : '--',
            stdDevDelta: result.stdDevDelta ? (result.stdDevDelta * 100).toFixed(2) + 'pp' : '--',
            calmarDelta: result.calmarDelta ? result.calmarDelta.toFixed(3) : '--'
        });

        return result;
    },

    /**
     * Calculate 60-day Moving Average for AUM history
     * @param {Array} aumHistory - [{ date, totalValue }, ...]
     * @returns {Array} - [{ date, ma60 }, ...] (null for first 59 days)
     */
    calculateAUM_MA: (aumHistory, period = 60) => {
        if (!aumHistory || aumHistory.length < period) return [];

        const result = [];
        for (let i = 0; i < aumHistory.length; i++) {
            if (i < period - 1) {
                result.push({ date: aumHistory[i].date, ma: null });
            } else {
                const slice = aumHistory.slice(i - period + 1, i + 1);
                const sum = slice.reduce((s, item) => s + item.totalValue, 0);
                result.push({ date: aumHistory[i].date, ma: sum / period });
            }
        }

        return result;
    },

    /**
     * Calculate Risk-Free Rate from BIL (T-Bill ETF) price history
     * Uses annualized return over the matching date range
     * @param {Object} bilData - { history: [prices], dates: [dates] }
     * @param {Array} aumHistory - Portfolio AUM history to match date range
     * @returns {number} - Annualized risk-free rate (e.g., 0.05 = 5%)
     */
    calculateRiskFreeRate: (bilData, aumHistory) => {
        const DEFAULT_RF = 0.05; // Fallback to 5% if BIL data unavailable

        if (!bilData || !bilData.history || bilData.history.length < 10) {
            console.warn("BIL data unavailable, using default risk-free rate:", DEFAULT_RF);
            return DEFAULT_RF;
        }

        try {
            const bilPrices = bilData.history;
            const bilDates = bilData.dates || [];

            // If we have aumHistory, match the date range
            let startPrice, endPrice, years;

            if (aumHistory && aumHistory.length >= 2 && bilDates.length > 0) {
                // Find BIL prices matching aumHistory date range
                const aumStartDate = aumHistory[0].date;
                const aumEndDate = aumHistory[aumHistory.length - 1].date;

                // Build date -> price map for BIL
                const bilPriceMap = {};
                bilDates.forEach((d, i) => {
                    bilPriceMap[d] = bilPrices[i];
                });

                // Find matching or nearest prices
                startPrice = bilPriceMap[aumStartDate];
                endPrice = bilPriceMap[aumEndDate];

                // If exact match not found, find nearest dates
                if (startPrice === undefined) {
                    for (let i = 0; i < bilDates.length; i++) {
                        if (bilDates[i] >= aumStartDate) {
                            startPrice = bilPrices[i];
                            break;
                        }
                    }
                }
                if (endPrice === undefined) {
                    for (let i = bilDates.length - 1; i >= 0; i--) {
                        if (bilDates[i] <= aumEndDate) {
                            endPrice = bilPrices[i];
                            break;
                        }
                    }
                }

                // Calculate years from aumHistory
                const startDate = new Date(aumStartDate);
                const endDate = new Date(aumEndDate);
                years = (endDate - startDate) / (365.25 * 24 * 60 * 60 * 1000);
            } else {
                // Use full BIL history
                startPrice = bilPrices[0];
                endPrice = bilPrices[bilPrices.length - 1];

                // Estimate years from BIL dates or assume ~1 year for 252 trading days
                if (bilDates.length >= 2) {
                    const startDate = new Date(bilDates[0]);
                    const endDate = new Date(bilDates[bilDates.length - 1]);
                    years = (endDate - startDate) / (365.25 * 24 * 60 * 60 * 1000);
                } else {
                    years = bilPrices.length / 252; // Approximate trading days
                }
            }

            if (!startPrice || !endPrice || startPrice <= 0 || years <= 0) {
                console.warn("Invalid BIL data for RF calculation, using default:", DEFAULT_RF);
                return DEFAULT_RF;
            }

            // Calculate annualized return (CAGR)
            const totalReturn = endPrice / startPrice;
            const riskFreeRate = Math.pow(totalReturn, 1 / years) - 1;

            // Sanity check: RF should be between 0% and 10%
            if (riskFreeRate < 0 || riskFreeRate > 0.10) {
                console.warn("Calculated RF out of range:", riskFreeRate, "using default:", DEFAULT_RF);
                return DEFAULT_RF;
            }

            console.log("Risk-Free Rate calculated from BIL:", (riskFreeRate * 100).toFixed(2) + "%");
            return riskFreeRate;

        } catch (error) {
            console.error("Error calculating RF from BIL:", error);
            return DEFAULT_RF;
        }
    },

    /**
     * Calculate Excess Returns (Portfolio Return - Benchmark Return)
     * @param {Array} portfolioReturns - [{ date, return }, ...]
     * @param {Array} benchmarkReturns - [number, number, ...]  (aligned with portfolioReturns)
     * @returns {Array} - [{ date, excessReturn }, ...]
     */
    calculateExcessReturns: (portfolioReturns, benchmarkReturns) => {
        if (!portfolioReturns || !benchmarkReturns) return [];

        const minLen = Math.min(portfolioReturns.length, benchmarkReturns.length);
        const excessReturns = [];

        for (let i = 0; i < minLen; i++) {
            const pReturn = portfolioReturns[i].return;
            const bReturn = benchmarkReturns[i] || 0;
            excessReturns.push({
                date: portfolioReturns[i].date,
                excessReturn: (pReturn - bReturn) * 100  // Convert to percentage
            });
        }

        return excessReturns;
    },

    /**
     * Create Histogram Bins from Excess Returns (0.5% interval)
     * @param {Array} excessReturns - [{ date, excessReturn (%) }, ...]
     * @param {number} binSize - Size of each bin in % (default 0.5)
     * @returns {Object} - { labels: ['-3.0%', '-2.5%', ...], counts: [5, 10, ...] }
     */
    createHistogramBins: (excessReturns, binSize = 0.5) => {
        if (!excessReturns || excessReturns.length === 0) {
            return { labels: [], counts: [], colors: [] };
        }

        const values = excessReturns.map(e => e.excessReturn);
        
        // Find range
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        // Extend range to include 0 and be symmetric-ish
        const absMax = Math.max(Math.abs(min), Math.abs(max));
        const rangeMax = Math.ceil(absMax / binSize) * binSize + binSize;
        const rangeMin = -rangeMax;

        // Create bins
        const bins = {};
        const labels = [];
        
        for (let edge = rangeMin; edge < rangeMax; edge += binSize) {
            const label = edge.toFixed(1) + '%';
            labels.push(label);
            bins[label] = 0;
        }

        // Count values in each bin
        values.forEach(val => {
            // Find which bin this value belongs to
            const binIndex = Math.floor((val - rangeMin) / binSize);
            const binLabel = labels[binIndex];
            if (binLabel !== undefined) {
                bins[binLabel]++;
            }
        });

        const counts = labels.map(l => bins[l]);
        
        // Colors: negative bins are red, positive are green
        const colors = labels.map(l => {
            const val = parseFloat(l);
            if (val < 0) return 'rgba(255, 10, 78, 0.7)';  // Red
            if (val > 0) return 'rgba(6, 214, 160, 0.7)';  // Green
            return 'rgba(100, 116, 139, 0.7)';  // Gray for 0
        });

        return { labels, counts, colors };
    },

    /**
     * Calculate Cumulative Alpha over time
     * @param {Array} excessReturns - [{ date, excessReturn (%) }, ...]
     * @returns {Array} - [{ date, cumulativeAlpha (%) }, ...]
     */
    calculateCumulativeAlpha: (excessReturns) => {
        if (!excessReturns || excessReturns.length === 0) return [];

        const result = [];
        let cumulative = 0;

        excessReturns.forEach(item => {
            cumulative += item.excessReturn;
            result.push({
                date: item.date,
                cumulativeAlpha: cumulative
            });
        });

        return result;
    },

    // =====================================================
    // Week-to-Date (WTD) Return System
    // Fixed weekly cycle: Saturday 06:00 KST → Next Saturday 06:00 KST
    // Base_NAV = Last Friday's closing NAV (= Saturday 06:00 price)
    // =====================================================

    /**
     * Get the BASE Friday's date string (YYYY-MM-DD format)
     * This is the starting point for WTD calculation.
     * 
     * WTD Reset Logic:
     * - Base Price: Friday closing price (the week's starting point)
     * - Reset Timing: Monday 09:00 KST (new week starts)
     * 
     * Timeline:
     * - Friday (market open): LAST Friday (7 days ago) - current week in progress
     * - Saturday: LAST-LAST Friday (8 days ago) - freeze, show completed week
     * - Sunday: LAST-LAST Friday (9 days ago) - freeze continues
     * - Monday 00:00 ~ 08:59: LAST-LAST Friday (10 days ago) - freeze continues
     * - Monday 09:00+: LAST Friday (3 days ago) - new week starts!
     * - Tue~Thu: Most recent Friday - current week in progress
     * 
     * @param {Date} referenceDate - The date to find base Friday from
     * @returns {string} - Base Friday's date in YYYY-MM-DD format
     */
    getLastFridayDate: (referenceDate = new Date()) => {
        const date = new Date(referenceDate);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
        const hour = date.getHours();
        
        let daysToSubtract;
        
        // Monday: Check if before 09:00 (market open)
        if (dayOfWeek === 1) {
            if (hour < 9) {
                // Monday before 09:00: Freeze mode, use LAST-LAST Friday (10 days ago)
                daysToSubtract = 10;
            } else {
                // Monday 09:00+: New week started! Use LAST Friday (3 days ago)
                daysToSubtract = 3;
            }
        } else if (dayOfWeek === 0) {
            // Sunday: Freeze mode, use LAST-LAST Friday (9 days ago)
            // WTD will compare this to LAST Friday (2 days ago) = completed week
            daysToSubtract = 9;
        } else if (dayOfWeek === 6) {
            // Saturday: Freeze mode, use LAST-LAST Friday (8 days ago)
            // WTD will compare this to LAST Friday (1 day ago) = completed week
            daysToSubtract = 8;
        } else if (dayOfWeek === 5) {
            // Friday: Current week in progress, use LAST Friday (7 days ago)
            daysToSubtract = 7;
        } else {
            // Tuesday (2) to Thursday (4): Use the most recent Friday
            daysToSubtract = dayOfWeek + 2;
        }
        
        date.setDate(date.getDate() - daysToSubtract);
        return date.toISOString().split('T')[0];
    },

    /**
     * Determine the current display period for WTD return
     * 
     * Freeze Mode: Saturday 00:00 ~ Monday 08:59
     * Active Mode: Monday 09:00 ~ Friday market close
     * 
     * @param {Date} now - Current date/time
     * @returns {Object} - { period: 'active'|'weekend_freeze', description: string }
     */
    getWTDDisplayPeriod: (now = new Date()) => {
        const dayOfWeek = now.getDay();
        const hour = now.getHours();
        const mondayMarketOpen = 9; // 09:00 KST
        
        // Weekend Freeze: Saturday (all day), Sunday (all day), Monday before 09:00
        if (dayOfWeek === 6) {
            // Saturday: Week completed, freeze mode
            return { period: 'weekend_freeze', description: 'Weekend - Showing completed week return' };
        } else if (dayOfWeek === 0) {
            // Sunday: Freeze mode continues
            return { period: 'weekend_freeze', description: 'Weekend - Showing completed week return' };
        } else if (dayOfWeek === 1 && hour < mondayMarketOpen) {
            // Monday before 09:00: Last chance to see last week's result
            return { period: 'weekend_freeze', description: 'Pre-market - Showing last week return' };
        }
        
        // Active Trading: Monday 09:00 ~ Friday market close
        return { period: 'active', description: 'Active trading period' };
    },

    /**
     * Calculate Base_NAV from last Friday's closing prices
     * @param {Object} priceHistories - { ticker: { history: [], dates: [], currency: 'USD'|'KRW' } }
     * @param {Array} portfolio - Current portfolio with shares
     * @param {Array} logs - Historical transaction logs
     * @param {number} fxRate - USD to KRW exchange rate
     * @returns {Object} - { baseNAV: number, baseDate: string, shares: {} }
     */
    calculateBaseNAV: (priceHistories, portfolio, logs, fxRate = 1410) => {
        const lastFriday = Finance.getLastFridayDate();
        
        // Get shares as of last Friday (using log reconstruction logic)
        const sharesOnFriday = {};
        portfolio.forEach(asset => {
            sharesOnFriday[asset.ticker] = asset.shares;
        });
        
        // Adjust for transactions that happened AFTER Friday
        const sortedLogs = [...(logs || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
        sortedLogs.forEach(log => {
            if (log.date > lastFriday) {
                // This transaction happened after Friday, reverse it to get Friday's state
                if (log.type === 'Deposit' && log.transactions) {
                    log.transactions.forEach(tx => {
                        if (sharesOnFriday[tx.asset] !== undefined) {
                            sharesOnFriday[tx.asset] -= parseFloat(tx.shares) || 0;
                        }
                    });
                } else if (log.type === 'Withdraw' && log.transactions) {
                    log.transactions.forEach(tx => {
                        if (sharesOnFriday[tx.asset] !== undefined) {
                            sharesOnFriday[tx.asset] += parseFloat(tx.shares) || 0;
                        }
                    });
                } else if ((log.type === 'Rebalancing' || log.type === 'Switch') && log.transactions) {
                    log.transactions.forEach(tx => {
                        if (sharesOnFriday[tx.fromAsset] !== undefined) {
                            sharesOnFriday[tx.fromAsset] += parseFloat(tx.fromShares) || 0;
                        }
                        if (sharesOnFriday[tx.toAsset] !== undefined) {
                            sharesOnFriday[tx.toAsset] -= parseFloat(tx.toShares) || 0;
                        }
                    });
                }
            }
        });
        
        // Ensure no negative shares
        Object.keys(sharesOnFriday).forEach(ticker => {
            sharesOnFriday[ticker] = Math.max(0, sharesOnFriday[ticker]);
        });
        
        // Calculate Base_NAV using Friday's prices
        let baseNAV = 0;
        
        portfolio.forEach(asset => {
            const ticker = asset.ticker;
            const priceData = priceHistories[ticker];
            if (!priceData || !priceData.dates || !priceData.history) return;
            
            // Find Friday's price from history
            const fridayIndex = priceData.dates.indexOf(lastFriday);
            let fridayPrice;
            
            if (fridayIndex >= 0) {
                fridayPrice = priceData.history[fridayIndex];
            } else {
                // Friday not in data (maybe holiday), find nearest previous date
                for (let i = priceData.dates.length - 1; i >= 0; i--) {
                    if (priceData.dates[i] <= lastFriday) {
                        fridayPrice = priceData.history[i];
                        break;
                    }
                }
            }
            
            if (!fridayPrice) return;
            
            // Convert USD to KRW
            let priceInKRW = fridayPrice;
            if (priceData.currency === 'USD') {
                priceInKRW = fridayPrice * fxRate;
            }
            
            const shares = sharesOnFriday[ticker] || 0;
            baseNAV += shares * priceInKRW;
        });
        
        return {
            baseNAV,
            baseDate: lastFriday,
            shares: sharesOnFriday
        };
    },

    /**
     * Calculate Week-to-Date (WTD) Return
     * Formula: ((Current NAV) / (Base_NAV)) - 1
     * @param {number} currentNAV - Current total portfolio value
     * @param {number} baseNAV - Base NAV from last Friday
     * @returns {number} - WTD return as percentage (e.g., 2.5 for +2.5%)
     */
    calculateWTDReturn: (currentNAV, baseNAV) => {
        if (!baseNAV || baseNAV <= 0 || !currentNAV) return 0;
        return ((currentNAV / baseNAV) - 1) * 100;
    },

    /**
     * Get the complete WTD status for display
     * Combines all WTD logic into one result object
     * 
     * During freeze mode (Sat~Mon 08:59):
     * - Base: LAST-LAST Friday's closing NAV
     * - End: LAST Friday's closing NAV (the week that just ended)
     * - Result: Completed week's performance
     * 
     * During active mode (Mon 09:00 ~ Fri):
     * - Base: LAST Friday's closing NAV
     * - End: Current NAV (real-time)
     * - Result: Current week's progress
     * 
     * @param {number} currentNAV - Current portfolio value
     * @param {Object} priceHistories - Price data with history
     * @param {Array} portfolio - Current portfolio
     * @param {Array} logs - Transaction logs
     * @param {number} fxRate - Exchange rate
     * @returns {Object} - { wtdReturn, baseNAV, baseDate, endNAV, endDate, period, isFrozen }
     */
    getWTDStatus: (currentNAV, priceHistories, portfolio, logs, fxRate = 1410) => {
        const baseResult = Finance.calculateBaseNAV(priceHistories, portfolio, logs, fxRate);
        const displayPeriod = Finance.getWTDDisplayPeriod();
        
        let wtdReturn;
        let endNAV = currentNAV;
        let endDate = new Date().toISOString().split('T')[0];
        
        if (displayPeriod.period === 'weekend_freeze') {
            // Freeze mode: Calculate the "End Friday" NAV (the week that just closed)
            // End Friday is the Friday right before the weekend
            const now = new Date();
            const dayOfWeek = now.getDay();
            
            // Calculate the End Friday date
            let endFridayDaysAgo;
            if (dayOfWeek === 6) { // Saturday
                endFridayDaysAgo = 1; // Yesterday
            } else if (dayOfWeek === 0) { // Sunday
                endFridayDaysAgo = 2;
            } else if (dayOfWeek === 1) { // Monday (before 09:00)
                endFridayDaysAgo = 3;
            } else {
                endFridayDaysAgo = 1; // Fallback
            }
            
            const endFridayDate = new Date(now);
            endFridayDate.setDate(endFridayDate.getDate() - endFridayDaysAgo);
            endDate = endFridayDate.toISOString().split('T')[0];
            
            // Calculate End Friday's NAV using the same logic as calculateBaseNAV
            // but with the End Friday date
            endNAV = Finance.calculateNAVAtDate(priceHistories, portfolio, logs, endDate, fxRate);
            
            wtdReturn = Finance.calculateWTDReturn(endNAV, baseResult.baseNAV);
        } else {
            // Active trading - real-time calculation
            endNAV = currentNAV;
            wtdReturn = Finance.calculateWTDReturn(currentNAV, baseResult.baseNAV);
        }
        
        return {
            wtdReturn,
            baseNAV: baseResult.baseNAV,
            baseDate: baseResult.baseDate,
            endNAV: endNAV,
            endDate: endDate,
            period: displayPeriod.period,
            periodDescription: displayPeriod.description,
            isFrozen: displayPeriod.period === 'weekend_freeze'
        };
    },

    /**
     * Calculate NAV at a specific date using historical prices
     * @param {Object} priceHistories - Price data with history
     * @param {Array} portfolio - Current portfolio with shares
     * @param {Array} logs - Transaction logs
     * @param {string} targetDate - Target date in YYYY-MM-DD format
     * @param {number} fxRate - Exchange rate
     * @returns {number} - NAV at the target date
     */
    calculateNAVAtDate: (priceHistories, portfolio, logs, targetDate, fxRate = 1410) => {
        let nav = 0;
        
        portfolio.forEach(asset => {
            const ticker = asset.ticker;
            const priceData = priceHistories[ticker];
            if (!priceData || !priceData.dates || !priceData.history) return;
            
            // Find price at target date
            const dateIndex = priceData.dates.indexOf(targetDate);
            let price;
            
            if (dateIndex >= 0) {
                price = priceData.history[dateIndex];
            } else {
                // Find nearest previous date
                for (let i = priceData.dates.length - 1; i >= 0; i--) {
                    if (priceData.dates[i] <= targetDate) {
                        price = priceData.history[i];
                        break;
                    }
                }
            }
            
            if (!price) return;
            
            // Convert USD to KRW
            if (priceData.currency === 'USD') {
                price = price * fxRate;
            }
            
            // Use current shares (simplified - could be enhanced to use historical shares)
            nav += asset.shares * price;
        });
        
        return nav;
    },

    // =====================================================
    // Weekly Metrics (Friday → Thursday, 7-day periods)
    // =====================================================

    /**
     * Calculate weekly returns from AUM history
     * Week defined as Friday to Thursday (7 calendar days)
     * @param {Array} aumHistory - [{ date, totalValue }, ...]
     * @returns {Array} - [{ weekEnd, return: decimal, startValue, endValue }, ...]
     */
    calculateWeeklyReturns: (aumHistory) => {
        if (!aumHistory || aumHistory.length < 7) return [];

        // Sort by date
        const sorted = [...aumHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const weeklyReturns = [];
        
        // Find all Fridays in the data
        const fridays = sorted.filter(item => {
            const date = new Date(item.date);
            return date.getDay() === 5; // Friday = 5
        });

        if (fridays.length < 2) {
            // Not enough Fridays, use weekly intervals instead
            // Group by 7-day periods
            for (let i = 7; i < sorted.length; i += 7) {
                const weekStart = sorted[Math.max(0, i - 7)];
                const weekEnd = sorted[Math.min(i, sorted.length - 1)];
                
                if (weekStart.totalValue > 0) {
                    weeklyReturns.push({
                        weekEnd: weekEnd.date,
                        return: (weekEnd.totalValue - weekStart.totalValue) / weekStart.totalValue,
                        startValue: weekStart.totalValue,
                        endValue: weekEnd.totalValue
                    });
                }
            }
        } else {
            // Use Friday to Friday (next Friday's data represents end of week)
            for (let i = 1; i < fridays.length; i++) {
                const weekStart = fridays[i - 1];
                const weekEnd = fridays[i];
                
                if (weekStart.totalValue > 0) {
                    weeklyReturns.push({
                        weekEnd: weekEnd.date,
                        return: (weekEnd.totalValue - weekStart.totalValue) / weekStart.totalValue,
                        startValue: weekStart.totalValue,
                        endValue: weekEnd.totalValue
                    });
                }
            }
        }

        return weeklyReturns;
    },

    /**
     * Calculate Gain/Loss Ratio (Weekly)
     * = Average Win % / Average Loss %
     * @param {Array} weeklyReturns - from calculateWeeklyReturns
     * @returns {Object} - { ratio, avgWin, avgLoss, winCount, lossCount }
     */
    calculateGainLossRatio: (weeklyReturns) => {
        if (!weeklyReturns || weeklyReturns.length === 0) {
            return { ratio: null, avgWin: 0, avgLoss: 0, winCount: 0, lossCount: 0 };
        }

        const winningWeeks = weeklyReturns.filter(w => w.return > 0);
        const losingWeeks = weeklyReturns.filter(w => w.return < 0);

        const winCount = winningWeeks.length;
        const lossCount = losingWeeks.length;

        // Average Win (as percentage)
        const avgWin = winCount > 0 
            ? (winningWeeks.reduce((sum, w) => sum + w.return, 0) / winCount) * 100 
            : 0;

        // Average Loss (absolute value, as percentage)
        const avgLoss = lossCount > 0 
            ? Math.abs(losingWeeks.reduce((sum, w) => sum + w.return, 0) / lossCount) * 100 
            : 0;

        // Ratio
        const ratio = avgLoss > 0.0001 ? avgWin / avgLoss : (avgWin > 0 ? 99.99 : null);

        return {
            ratio: ratio,
            avgWin: avgWin,
            avgLoss: avgLoss,
            winCount: winCount,
            lossCount: lossCount
        };
    },

    /**
     * Calculate Win Rate (Weekly)
     * = Winning Weeks / Total Weeks × 100
     * @param {Array} weeklyReturns - from calculateWeeklyReturns
     * @returns {Object} - { winRate, winCount, totalCount }
     */
    calculateWeeklyWinRate: (weeklyReturns) => {
        if (!weeklyReturns || weeklyReturns.length === 0) {
            return { winRate: null, winCount: 0, totalCount: 0 };
        }

        const winningWeeks = weeklyReturns.filter(w => w.return > 0);
        const totalCount = weeklyReturns.length;
        const winCount = winningWeeks.length;

        const winRate = totalCount > 0 ? (winCount / totalCount) * 100 : null;

        return {
            winRate: winRate,
            winCount: winCount,
            totalCount: totalCount
        };
    },

    /**
     * Calculate Calmar Ratio
     * = CAGR / |MDD|
     * @param {number} cagr - Annual return as decimal (e.g., 0.15 = 15%)
     * @param {number} mdd - Max drawdown as decimal (e.g., 0.10 = 10%)
     * @returns {number|null}
     */
    calculateCalmarRatio: (cagr, mdd) => {
        if (cagr === null || mdd === null || mdd === 0) return null;
        return cagr / Math.abs(mdd);
    },

    /**
     * Calculate Expectancy (Weekly Expected Return)
     * = (Win Rate × Avg Win %) - ((1 - Win Rate) × Avg Loss %)
     * @param {Object} glResult - from calculateGainLossRatio
     * @param {Object} wrResult - from calculateWeeklyWinRate
     * @returns {Object} - { expectancy, status }
     */
    calculateExpectancy: (glResult, wrResult) => {
        if (!glResult || !wrResult || wrResult.winRate === null) {
            return { expectancy: null, status: 'unknown' };
        }

        const winRate = wrResult.winRate / 100; // Convert to decimal
        const avgWin = glResult.avgWin; // Already in %
        const avgLoss = glResult.avgLoss; // Already in %, absolute value

        // Expectancy = (WinRate × AvgWin%) - ((1 - WinRate) × AvgLoss%)
        const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

        // Determine status based on threshold
        let status;
        if (expectancy > 0.2) {
            status = 'good'; // Green
        } else if (expectancy >= 0) {
            status = 'warning'; // Yellow
        } else {
            status = 'bad'; // Red
        }

        return { expectancy, status };
    },

    /**
     * Calculate Sigma Statistics for Weekly Returns (Hybrid Sigma Gauge)
     * Uses all available historical weekly data
     * @param {Array} weeklyReturns - from calculateWeeklyReturns
     * @returns {Object} - { mean, stdDev, twoSigma, dataCount, min, max }
     */
    getWeeklySigmaStats: (weeklyReturns) => {
        if (!weeklyReturns || weeklyReturns.length < 2) {
            return { 
                mean: 0, 
                stdDev: 0, 
                twoSigma: 0.05, // Default 5% if not enough data
                dataCount: 0,
                min: -0.05,
                max: 0.05
            };
        }

        // Extract return values (as decimals)
        const returns = weeklyReturns.map(w => w.return);
        const n = returns.length;

        // Calculate Mean (μ)
        const mean = returns.reduce((sum, r) => sum + r, 0) / n;

        // Calculate Variance and Standard Deviation (σ)
        const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
        const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / (n - 1); // Sample variance
        const stdDev = Math.sqrt(variance);

        // Two-sigma range
        const twoSigma = stdDev * 2;

        // Min/Max for reference
        const min = Math.min(...returns);
        const max = Math.max(...returns);

        return {
            mean,           // Historical average (decimal)
            stdDev,         // Standard deviation (decimal)
            twoSigma,       // 2σ range (decimal)
            dataCount: n,   // Number of weeks analyzed
            min,            // Worst week
            max             // Best week
        };
    },

    /**
     * Get last Friday's date string (YYYY-MM-DD)
     * DEPRECATED: Use getLastFridayDate() instead for consistent WTD calculations
     * This function now simply calls getLastFridayDate() for backward compatibility
     * @returns {string} Last Friday's date (based on WTD reset logic)
     */
    getLastFriday: () => {
        // Delegate to the canonical function for consistency
        return Finance.getLastFridayDate();
    },

    /**
     * Calculate WTD (Week-to-Date) return for an asset
     * Based on last Friday's close price (same as Portfolio WTD)
     * 
     * During freeze mode (Sat~Mon 08:59):
     * - Base: LAST-LAST Friday's close
     * - End: LAST Friday's close (completed week)
     * 
     * During active mode:
     * - Base: LAST Friday's close
     * - End: Current price
     * 
     * @param {Object} priceData - { history: [...], dates: [...], price: current }
     * @returns {number} WTD return as decimal
     */
    calculateAssetWTD: (priceData) => {
        if (!priceData || !priceData.history || !priceData.dates || priceData.history.length < 2) {
            return 0;
        }

        const displayPeriod = Finance.getWTDDisplayPeriod();
        const isFrozen = displayPeriod.period === 'weekend_freeze';
        
        const dates = priceData.dates;
        const history = priceData.history;

        // Get base Friday date (using canonical function)
        const baseFriday = Finance.getLastFridayDate();
        
        // Find base Friday's price
        let basePrice = null;
        for (let i = dates.length - 1; i >= 0; i--) {
            if (dates[i] <= baseFriday) {
                basePrice = history[i];
                break;
            }
        }
        if (basePrice === null || basePrice === 0) {
            basePrice = history[0];
        }
        if (basePrice === 0) return 0;

        // Determine end price
        let endPrice;
        if (isFrozen) {
            // Freeze mode: Use LAST Friday's close as end price
            const now = new Date();
            const dayOfWeek = now.getDay();
            const hour = now.getHours();
            
            let endFridayDaysAgo;
            if (dayOfWeek === 6) endFridayDaysAgo = 1;      // Saturday
            else if (dayOfWeek === 0) endFridayDaysAgo = 2; // Sunday
            else if (dayOfWeek === 1 && hour < 9) endFridayDaysAgo = 3; // Monday pre-market
            else endFridayDaysAgo = 1; // Fallback
            
            const endFridayDate = new Date(now);
            endFridayDate.setDate(endFridayDate.getDate() - endFridayDaysAgo);
            const endFriday = endFridayDate.toISOString().split('T')[0];
            
            // Find end Friday's price
            endPrice = null;
            for (let i = dates.length - 1; i >= 0; i--) {
                if (dates[i] <= endFriday) {
                    endPrice = history[i];
                    break;
                }
            }
            if (endPrice === null) endPrice = priceData.price;
        } else {
            // Active mode: Use current price
            endPrice = priceData.price;
        }
        
        return (endPrice - basePrice) / basePrice;
    },

    /**
     * Calculate 1-Year Total Return for an asset
     * @param {Object} priceData - { history: [...], dates: [...], price: current }
     * @returns {number} 1Y return as decimal
     */
    calculateAsset1YReturn: (priceData) => {
        if (!priceData || !priceData.history || priceData.history.length < 10) {
            return 0;
        }

        const currentPrice = priceData.price;
        const prices = priceData.history;
        
        // Use the first available price (approximately 1 year ago)
        const startPrice = prices[0];

        if (startPrice === 0) return 0;
        
        return (currentPrice - startPrice) / startPrice;
    },

    /**
     * Calculate YTD (Year-to-Date) return for an asset
     * Based on this year's January 1st close price
     * Automatically resets when a new year begins
     * @param {Object} priceData - { history: [...], dates: [...], price: current }
     * @returns {number} YTD return as decimal
     */
    calculateAssetYTD: (priceData) => {
        if (!priceData || !priceData.history || !priceData.dates || priceData.history.length < 2) {
            return 0;
        }

        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);  // January 1st of current year
        const yearStartStr = yearStart.toISOString().split('T')[0];
        
        const currentPrice = priceData.price;
        const dates = priceData.dates;
        const history = priceData.history;

        // Find the first trading day on or after January 1st
        let ytdStartPrice = null;
        for (let i = 0; i < dates.length; i++) {
            if (dates[i] >= yearStartStr) {
                ytdStartPrice = history[i];
                break;
            }
        }

        // If no price found after Jan 1 (unlikely), use first available
        if (ytdStartPrice === null || ytdStartPrice === 0) {
            ytdStartPrice = history[0];
        }

        if (ytdStartPrice === 0) return 0;
        
        return (currentPrice - ytdStartPrice) / ytdStartPrice;
    },

    /**
     * Calculate daily returns from price history
     * @param {Array} prices - Array of prices
     * @returns {Array} Array of daily returns (decimals)
     */
    calculateDailyReturnsFromPrices: (prices) => {
        if (!prices || prices.length < 2) return [];
        
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            if (prices[i - 1] > 0) {
                returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
            }
        }
        return returns;
    },

    /**
     * Calculate Pearson correlation coefficient between two return series
     * @param {Array} returns1 - First asset's returns
     * @param {Array} returns2 - Second asset's returns
     * @returns {number} Correlation coefficient (-1 to 1)
     */
    calculateCorrelation: (returns1, returns2) => {
        const n = Math.min(returns1.length, returns2.length);
        if (n < 10) return 0;

        const r1 = returns1.slice(-n);
        const r2 = returns2.slice(-n);

        const mean1 = r1.reduce((s, v) => s + v, 0) / n;
        const mean2 = r2.reduce((s, v) => s + v, 0) / n;

        let covariance = 0;
        let var1 = 0;
        let var2 = 0;

        for (let i = 0; i < n; i++) {
            const d1 = r1[i] - mean1;
            const d2 = r2[i] - mean2;
            covariance += d1 * d2;
            var1 += d1 * d1;
            var2 += d2 * d2;
        }

        if (var1 === 0 || var2 === 0) return 0;
        
        return covariance / Math.sqrt(var1 * var2);
    },

    /**
     * Calculate 6x6 Correlation Matrix for portfolio assets
     * @param {Object} marketData - { ticker: { history: [...] } }
     * @param {Array} tickers - ['QQQ', 'CTA', 'CSI300', 'TLT', 'GLDM', 'MSTR']
     * @param {number} lookbackDays - Number of trading days to use (60=3M, 252=1Y, null=all)
     * @returns {Object} { matrix: [[...], ...], tickers: [...] }
     */
    calculateCorrelationMatrix: (marketData, tickers = ['QQQ', 'DBMF', 'CSI300', 'TLT', 'GLDM', 'MSTR'], lookbackDays = 252) => {
        // Calculate daily returns for each asset
        const returnsMap = {};
        
        tickers.forEach(ticker => {
            const data = marketData[ticker];
            if (data && data.history) {
                let prices = data.history;
                
                // Apply lookback window if specified
                if (lookbackDays !== null && prices.length > lookbackDays) {
                    prices = prices.slice(-lookbackDays);
                }
                
                returnsMap[ticker] = Finance.calculateDailyReturnsFromPrices(prices);
            } else {
                returnsMap[ticker] = [];
            }
        });

        // Build correlation matrix
        const matrix = [];
        
        for (let i = 0; i < tickers.length; i++) {
            const row = [];
            for (let j = 0; j < tickers.length; j++) {
                if (i === j) {
                    row.push(1.0); // Self-correlation
                } else {
                    const corr = Finance.calculateCorrelation(
                        returnsMap[tickers[i]],
                        returnsMap[tickers[j]]
                    );
                    row.push(corr);
                }
            }
            matrix.push(row);
        }

        return { matrix, tickers };
    },

    // =====================================================
    // Cumulative Attribution System
    // Calculates true contribution based on historical holdings
    // =====================================================

    /**
     * Extract all assets that were held during the trailing period from logs
     * @param {Array} logs - Historical transaction logs
     * @param {Array} currentPortfolio - Current portfolio holdings
     * @param {number} months - Trailing period in months (default 13)
     * @returns {Array} - List of all tickers that were held (including past holdings)
     */
    getHistoricalAssets: (logs, currentPortfolio, months = 13) => {
        const assetSet = new Set();
        
        // Add all current portfolio assets
        currentPortfolio.forEach(asset => {
            assetSet.add(asset.ticker);
        });

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        // Scan logs for assets that were traded in the trailing period
        (logs || []).forEach(log => {
            if (log.date < cutoffStr) return;

            // Deposit/Withdraw format
            if ((log.type === 'Deposit' || log.type === 'Withdraw') && log.transactions) {
                log.transactions.forEach(tx => {
                    if (tx.asset) assetSet.add(tx.asset);
                });
            }
            
            // Rebalancing/Switch format
            if ((log.type === 'Rebalancing' || log.type === 'Switch') && log.transactions) {
                log.transactions.forEach(tx => {
                    if (tx.fromAsset) assetSet.add(tx.fromAsset);
                    if (tx.toAsset) assetSet.add(tx.toAsset);
                });
            }

            // Legacy format
            if (log.ticker) assetSet.add(log.ticker);
        });

        return Array.from(assetSet);
    },

    /**
     * Calculate YTD Attribution for each asset
     * Similar to Cumulative Attribution but only from January 1st of current year
     * Automatically resets when a new year begins
     * 
     * @param {Array} aumHistory - Reconstructed AUM history with breakdown
     * @param {Object} priceHistories - { ticker: { history: [], dates: [] } }
     * @param {Array} allAssets - List of all assets to calculate attribution for
     * @param {number} fxRate - USD to KRW exchange rate
     * @returns {Object} - { ticker: { ytdContrib: decimal, wasHeldYTD: boolean } }
     */
    calculateYTDAttribution: (aumHistory, priceHistories, allAssets, fxRate = 1410) => {
        if (!aumHistory || aumHistory.length < 7 || !priceHistories) {
            return {};
        }

        const result = {};
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearStartStr = yearStart.toISOString().split('T')[0];

        // Initialize result for all assets
        allAssets.forEach(ticker => {
            result[ticker] = {
                ytdContrib: 0,
                wasHeldYTD: false
            };
        });

        // Filter aumHistory to only include dates from January 1st
        const ytdHistory = aumHistory.filter(item => item.date >= yearStartStr);
        
        if (ytdHistory.length < 2) {
            console.warn("Not enough YTD data for attribution calculation");
            return result;
        }

        // Group YTD history by weeks (every 5 trading days)
        const weeklySnapshots = [];
        for (let i = 0; i < ytdHistory.length; i += 5) {
            if (ytdHistory[i]) {
                weeklySnapshots.push(ytdHistory[i]);
            }
        }

        if (weeklySnapshots.length < 2) {
            return result;
        }

        // Build price maps for each asset
        const priceMaps = {};
        allAssets.forEach(ticker => {
            const priceData = priceHistories[ticker];
            priceMaps[ticker] = {};
            if (priceData && priceData.dates && priceData.history) {
                priceData.dates.forEach((d, i) => {
                    priceMaps[ticker][d] = priceData.history[i];
                });
            }
        });

        // Calculate weekly attribution for each asset (YTD only)
        for (let w = 1; w < weeklySnapshots.length; w++) {
            const prevWeek = weeklySnapshots[w - 1];
            const currWeek = weeklySnapshots[w];

            if (!prevWeek.totalValue || prevWeek.totalValue === 0) continue;

            allAssets.forEach(ticker => {
                const priceData = priceHistories[ticker];
                if (!priceData) return;

                const assetValuePrev = prevWeek.breakdown?.[ticker] || 0;
                const weightAtWeek = assetValuePrev / prevWeek.totalValue;

                if (weightAtWeek === 0) return;

                result[ticker].wasHeldYTD = true;

                const prevPrice = priceMaps[ticker][prevWeek.date];
                const currPrice = priceMaps[ticker][currWeek.date];

                if (!prevPrice || !currPrice || prevPrice === 0) return;

                const assetWeeklyReturn = (currPrice - prevPrice) / prevPrice;
                const weekContrib = weightAtWeek * assetWeeklyReturn;

                result[ticker].ytdContrib += weekContrib;
            });
        }

        console.log("YTD Attribution calculated:", 
            Object.keys(result).map(t => `${t}: ${(result[t].ytdContrib * 100).toFixed(2)}%`).join(', ')
        );

        return result;
    },

    /**
     * Calculate Cumulative Attribution for each asset
     * Formula: Sum of (Weight_at_Week_i × Asset_Return_at_Week_i) for trailing 52 weeks
     * 
     * @param {Array} aumHistory - Reconstructed AUM history with breakdown
     * @param {Object} priceHistories - { ticker: { history: [], dates: [] } }
     * @param {Array} allAssets - List of all assets to calculate attribution for
     * @param {number} fxRate - USD to KRW exchange rate
     * @returns {Object} - { ticker: { totalContrib: decimal, weeklyData: [] } }
     */
    calculateCumulativeAttribution: (aumHistory, priceHistories, allAssets, fxRate = 1410) => {
        if (!aumHistory || aumHistory.length < 7 || !priceHistories) {
            return {};
        }

        const result = {};

        // Initialize result for all assets
        allAssets.forEach(ticker => {
            result[ticker] = {
                totalContrib: 0,
                weeklyData: [],
                wasHeld: false
            };
        });

        // Group AUM history by weeks (every 5 trading days)
        const weeklySnapshots = [];
        for (let i = 0; i < aumHistory.length; i += 5) {
            if (aumHistory[i]) {
                weeklySnapshots.push(aumHistory[i]);
            }
        }

        if (weeklySnapshots.length < 2) {
            console.warn("Not enough weekly snapshots for attribution calculation");
            return result;
        }

        // Build price maps for each asset
        const priceMaps = {};
        allAssets.forEach(ticker => {
            const priceData = priceHistories[ticker];
            priceMaps[ticker] = {};
            if (priceData && priceData.dates && priceData.history) {
                priceData.dates.forEach((d, i) => {
                    priceMaps[ticker][d] = priceData.history[i];
                });
            }
        });

        // Calculate weekly attribution for each asset
        for (let w = 1; w < weeklySnapshots.length; w++) {
            const prevWeek = weeklySnapshots[w - 1];
            const currWeek = weeklySnapshots[w];

            if (!prevWeek.totalValue || prevWeek.totalValue === 0) continue;

            allAssets.forEach(ticker => {
                const priceData = priceHistories[ticker];
                if (!priceData) return;

                // Get weight at start of week (using previous week's breakdown)
                const assetValuePrev = prevWeek.breakdown?.[ticker] || 0;
                const weightAtWeek = assetValuePrev / prevWeek.totalValue;

                // Skip if weight was 0 (not held)
                if (weightAtWeek === 0) return;

                result[ticker].wasHeld = true;

                // Get asset's weekly return
                const prevPrice = priceMaps[ticker][prevWeek.date];
                const currPrice = priceMaps[ticker][currWeek.date];

                if (!prevPrice || !currPrice || prevPrice === 0) return;

                const assetWeeklyReturn = (currPrice - prevPrice) / prevPrice;

                // Contribution = Weight × Return
                const weekContrib = weightAtWeek * assetWeeklyReturn;

                result[ticker].totalContrib += weekContrib;
                result[ticker].weeklyData.push({
                    date: currWeek.date,
                    weight: weightAtWeek,
                    return: assetWeeklyReturn,
                    contrib: weekContrib
                });
            });
        }

        // Debug output
        console.log("Cumulative Attribution calculated:", 
            Object.keys(result).map(t => `${t}: ${(result[t].totalContrib * 100).toFixed(2)}%`).join(', ')
        );

        return result;
    },

    /**
     * Build extended asset returns including cumulative attribution
     * Combines market returns (1Y, WTD) with portfolio-specific contribution
     * 
     * @param {Array} portfolio - Current portfolio
     * @param {Object} processedMarketData - Market data with price history
     * @param {Array} logs - Transaction logs
     * @param {Array} aumHistory - Reconstructed AUM history
     * @param {number} fxRate - Exchange rate
     * @returns {Object} - { ticker: { wtd, total, contribution, isGhost } }
     */
    buildExtendedAssetReturns: (portfolio, processedMarketData, logs, aumHistory, fxRate = 1410) => {
        const result = {};

        // Get all assets (current + historical)
        const allAssets = Finance.getHistoricalAssets(logs, portfolio, 13);

        // Calculate cumulative attribution (full period)
        const attribution = Finance.calculateCumulativeAttribution(
            aumHistory, 
            processedMarketData, 
            allAssets, 
            fxRate
        );

        // Calculate YTD attribution
        const ytdAttribution = Finance.calculateYTDAttribution(
            aumHistory,
            processedMarketData,
            allAssets,
            fxRate
        );

        // Build current holdings set for quick lookup
        const currentHoldings = new Set(
            portfolio.filter(a => a.shares > 0).map(a => a.ticker)
        );

        // Build result for each asset
        allAssets.forEach(ticker => {
            const marketData = processedMarketData[ticker];
            const isGhost = !currentHoldings.has(ticker);
            const attrData = attribution[ticker] || { totalContrib: 0, wasHeld: false };
            const ytdData = ytdAttribution[ticker] || { ytdContrib: 0, wasHeldYTD: false };

            // Only include ghost assets if they were actually held (have contribution)
            if (isGhost && !attrData.wasHeld) {
                return;
            }

            result[ticker] = {
                // Market-based returns (pure price change, regardless of holdings)
                wtd: marketData ? Finance.calculateAssetWTD(marketData) : 0,
                ytd: marketData ? Finance.calculateAssetYTD(marketData) : 0,
                total: marketData ? Finance.calculateAsset1YReturn(marketData) : 0,
                
                // Portfolio-based contribution (actual realized P&L)
                ytdContrib: ytdData.ytdContrib,
                contribution: attrData.totalContrib,
                
                // Is this a ghost (no longer held) asset?
                isGhost: isGhost
            };
        });

        console.log("Extended Asset Returns:", result);

        return result;
    },

    // =====================================================
    // STRESS TEST SIMULATOR - Fixed Base 6 Allocation
    // Tests structural resilience using worst-case scenario
    // =====================================================

    /**
     * Fixed Base 6 Portfolio Weights (Core Strategic Assets)
     * Used for stress test simulation - excludes tactical/hedging positions
     */
    STRESS_TEST_WEIGHTS: {
        QQQ: 0.30,
        DBMF: 0.30,
        GLDM: 0.10,
        CSI300: 0.10,
        MSTR: 0.10,
        TLT: 0.10
    },

    /**
     * Calculate MDD for stress test scenario
     * Uses Static Weight Injection - applies fixed weights to historical returns
     * 
     * @param {Object} scenarioData - { assets: { ticker: { prices: [], dates: [] } } }
     * @returns {Object} - { portfolioMDD, spyMDD, dailyValues, peakDate, troughDate }
     */
    calculateStressTestMDD: (scenarioData) => {
        if (!scenarioData || !scenarioData.assets) {
            console.warn("Stress test: No scenario data provided");
            return null;
        }

        const weights = Finance.STRESS_TEST_WEIGHTS;
        const assets = scenarioData.assets;

        // Verify all required assets have data
        const requiredAssets = Object.keys(weights);
        const availableAssets = Object.keys(assets);
        
        const missingAssets = requiredAssets.filter(a => !availableAssets.includes(a));
        if (missingAssets.length > 0) {
            console.warn("Stress test: Missing assets:", missingAssets);
        }

        // Get common dates across all assets
        let commonDates = null;
        requiredAssets.forEach(asset => {
            if (assets[asset] && assets[asset].dates) {
                const dates = new Set(assets[asset].dates);
                if (!commonDates) {
                    commonDates = dates;
                } else {
                    commonDates = new Set([...commonDates].filter(d => dates.has(d)));
                }
            }
        });

        if (!commonDates || commonDates.size < 2) {
            console.warn("Stress test: Not enough common dates");
            return null;
        }

        // Sort dates
        const sortedDates = [...commonDates].sort();

        // Build price lookup for each asset
        const priceLookup = {};
        requiredAssets.forEach(asset => {
            priceLookup[asset] = {};
            if (assets[asset]) {
                assets[asset].dates.forEach((d, i) => {
                    priceLookup[asset][d] = assets[asset].prices[i];
                });
            }
        });

        // Calculate daily portfolio values (normalized to 100)
        const portfolioValues = [];
        let initialValue = null;

        sortedDates.forEach((date, idx) => {
            if (idx === 0) {
                // Initialize at 100
                initialValue = 100;
                portfolioValues.push({ date, value: 100 });
            } else {
                // Calculate weighted return for this day
                let portfolioReturn = 0;
                
                requiredAssets.forEach(asset => {
                    const prevPrice = priceLookup[asset][sortedDates[idx - 1]];
                    const currPrice = priceLookup[asset][date];
                    
                    if (prevPrice && currPrice && prevPrice > 0) {
                        const assetReturn = (currPrice - prevPrice) / prevPrice;
                        portfolioReturn += weights[asset] * assetReturn;
                    }
                });

                const prevValue = portfolioValues[portfolioValues.length - 1].value;
                const newValue = prevValue * (1 + portfolioReturn);
                portfolioValues.push({ date, value: newValue });
            }
        });

        // Calculate Portfolio MDD
        let peak = portfolioValues[0].value;
        let peakDate = portfolioValues[0].date;
        let maxDrawdown = 0;
        let troughDate = peakDate;
        let mddPeakDate = peakDate;

        portfolioValues.forEach(pv => {
            if (pv.value > peak) {
                peak = pv.value;
                peakDate = pv.date;
            }

            const drawdown = (peak - pv.value) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
                troughDate = pv.date;
                mddPeakDate = peakDate;
            }
        });

        // Calculate SPY MDD for comparison
        let spyMDD = 0;
        if (assets.SPY && assets.SPY.prices && assets.SPY.prices.length > 1) {
            let spyPeak = assets.SPY.prices[0];
            let spyMaxDD = 0;

            assets.SPY.prices.forEach(price => {
                if (price > spyPeak) spyPeak = price;
                const dd = (spyPeak - price) / spyPeak;
                if (dd > spyMaxDD) spyMaxDD = dd;
            });

            spyMDD = spyMaxDD;
        }

        console.log(`Stress Test [${scenarioData.name}]:`, {
            portfolioMDD: (maxDrawdown * 100).toFixed(2) + '%',
            spyMDD: (spyMDD * 100).toFixed(2) + '%',
            peakDate: mddPeakDate,
            troughDate: troughDate
        });

        return {
            portfolioMDD: maxDrawdown,  // As decimal (e.g., 0.25 = 25%)
            spyMDD: spyMDD,
            dailyValues: portfolioValues,
            peakDate: mddPeakDate,
            troughDate: troughDate,
            scenarioName: scenarioData.name,
            periodStart: scenarioData.start,
            periodEnd: scenarioData.end
        };
    },

    /**
     * Fetch and calculate stress test results for all scenarios
     * @returns {Promise<Object>} - { '2020': { ... }, '2022': { ... } }
     */
    fetchStressTestData: async () => {
        try {
            const response = await fetch('/api/stress-test');
            if (!response.ok) throw new Error('Failed to fetch stress test data');
            
            const data = await response.json();
            const results = {};

            // Calculate MDD for each scenario
            for (const [key, scenario] of Object.entries(data)) {
                results[key] = Finance.calculateStressTestMDD(scenario);
            }

            return results;
        } catch (error) {
            console.error('Stress test fetch error:', error);
            return null;
        }
    },

    // =====================================================
    // SLEEP WELL SCORE - Ulcer Index Based
    // Measures psychological cost of investing
    // =====================================================

    /**
     * Sleep Score Grading Thresholds
     */
    SLEEP_GRADES: {
        DEEP_SLEEP: { min: 90, max: 100, label: 'Deep Sleep', icon: '🌙', color: '#14b8a6' },
        LIGHT_SLEEP: { min: 70, max: 89, label: 'Light Sleep', icon: '💤', color: '#22c55e' },
        RESTLESS: { min: 50, max: 69, label: 'Restless', icon: '😰', color: '#f97316' },
        INSOMNIA: { min: 0, max: 49, label: 'Insomnia', icon: '😵', color: '#ef4444' }
    },

    /**
     * Calculate Ulcer Index from price/value history
     * Measures the depth and duration of drawdowns
     * Unlike StdDev, ignores upside volatility
     * 
     * @param {number[]} prices - Array of daily prices/values (oldest first)
     * @returns {number} - Ulcer Index value (lower is better)
     */
    calculateUlcerIndex: (prices) => {
        if (!prices || prices.length < 2) return null;

        let runningMax = prices[0];
        let sumSquaredDrawdowns = 0;

        for (let i = 0; i < prices.length; i++) {
            const price = prices[i];
            
            // Update running maximum (highest high so far)
            if (price > runningMax) {
                runningMax = price;
            }

            // Calculate percentage drawdown from running max
            const drawdownPct = ((price - runningMax) / runningMax) * 100;
            
            // Square the drawdown (penalizes deep drops heavily)
            sumSquaredDrawdowns += drawdownPct * drawdownPct;
        }

        // Calculate Ulcer Index: sqrt(mean of squared drawdowns)
        const meanSquaredDrawdown = sumSquaredDrawdowns / prices.length;
        const ulcerIndex = Math.sqrt(meanSquaredDrawdown);

        return ulcerIndex;
    },

    /**
     * Convert Ulcer Index to Sleep Well Score (0-100)
     * Higher score = better sleep = less psychological pain
     * 
     * @param {number} ulcerIndex - Ulcer Index value
     * @returns {number} - Sleep Score (0-100)
     */
    calculateSleepScore: (ulcerIndex) => {
        if (ulcerIndex === null || ulcerIndex === undefined) return null;
        
        // Sensitivity factor: 2.5
        // UI of 10 → 25 point deduction → Score 75
        // UI of 40 → 100 point deduction → Score 0
        const score = Math.max(0, 100 - (ulcerIndex * 2.5));
        
        return Math.round(score * 10) / 10; // Round to 1 decimal
    },

    /**
     * Get Sleep Grade from Score
     * @param {number} score - Sleep Score (0-100)
     * @returns {Object} - Grade info { label, icon, color }
     */
    getSleepGrade: (score) => {
        if (score === null || score === undefined) {
            return { label: 'N/A', icon: '❓', color: '#64748b' };
        }

        const grades = Finance.SLEEP_GRADES;
        
        if (score >= grades.DEEP_SLEEP.min) return grades.DEEP_SLEEP;
        if (score >= grades.LIGHT_SLEEP.min) return grades.LIGHT_SLEEP;
        if (score >= grades.RESTLESS.min) return grades.RESTLESS;
        return grades.INSOMNIA;
    },

    /**
     * Calculate Sleep Score comparison for Portfolio vs SPY vs TQQQ
     * 
     * @param {Array} aumHistory - Portfolio AUM history [{ date, totalValue }, ...]
     * @param {Object} marketData - Market data with SPY and TQQQ price histories
     * @param {string} period - 'total' (Since Inception) or '1y' (trailing 1 year)
     * @returns {Object} - { portfolio: { ui, score, grade }, spy: {...}, tqqq: {...} }
     */
    calculateSleepScoreComparison: (aumHistory, marketData, period = 'total') => {
        if (!aumHistory || aumHistory.length < 10) {
            console.warn("Sleep Score: Insufficient portfolio history");
            return null;
        }

        // Determine date range based on period
        let startDate = null;
        const endDate = aumHistory[aumHistory.length - 1].date;

        if (period === '1y') {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            startDate = oneYearAgo.toISOString().split('T')[0];
        } else {
            // Since Inception
            startDate = aumHistory[0].date;
        }

        // Filter portfolio data by period
        const filteredAum = aumHistory.filter(a => a.date >= startDate && a.date <= endDate);
        if (filteredAum.length < 10) {
            console.warn("Sleep Score: Insufficient data for period:", period);
            return null;
        }

        // Extract portfolio values
        const portfolioValues = filteredAum.map(a => a.totalValue);
        const portfolioDates = filteredAum.map(a => a.date);

        // Calculate Portfolio UI and Score
        const portfolioUI = Finance.calculateUlcerIndex(portfolioValues);
        const portfolioScore = Finance.calculateSleepScore(portfolioUI);
        const portfolioGrade = Finance.getSleepGrade(portfolioScore);

        // Helper: Extract benchmark prices for the same date range
        const extractBenchmarkPrices = (ticker) => {
            const data = marketData[ticker];
            if (!data || !data.dates || !data.history) return null;

            const prices = [];
            const dateSet = new Set(portfolioDates);
            
            // Build date -> price map
            const priceMap = {};
            data.dates.forEach((d, i) => {
                priceMap[d] = data.history[i];
            });

            // Get prices for matching dates
            portfolioDates.forEach(date => {
                if (priceMap[date] !== undefined) {
                    prices.push(priceMap[date]);
                }
            });

            return prices.length >= 10 ? prices : null;
        };

        // Calculate SPY UI and Score
        const spyPrices = extractBenchmarkPrices('SPY');
        let spyResult = { ui: null, score: null, grade: Finance.getSleepGrade(null) };
        if (spyPrices) {
            const spyUI = Finance.calculateUlcerIndex(spyPrices);
            const spyScore = Finance.calculateSleepScore(spyUI);
            spyResult = {
                ui: spyUI,
                score: spyScore,
                grade: Finance.getSleepGrade(spyScore)
            };
        }

        // Calculate TQQQ UI and Score
        const tqqqPrices = extractBenchmarkPrices('TQQQ');
        let tqqqResult = { ui: null, score: null, grade: Finance.getSleepGrade(null) };
        if (tqqqPrices) {
            const tqqqUI = Finance.calculateUlcerIndex(tqqqPrices);
            const tqqqScore = Finance.calculateSleepScore(tqqqUI);
            tqqqResult = {
                ui: tqqqUI,
                score: tqqqScore,
                grade: Finance.getSleepGrade(tqqqScore)
            };
        }

        console.log(`Sleep Score [${period}]:`, {
            portfolio: { ui: portfolioUI?.toFixed(2), score: portfolioScore },
            spy: { ui: spyResult.ui?.toFixed(2), score: spyResult.score },
            tqqq: { ui: tqqqResult.ui?.toFixed(2), score: tqqqResult.score }
        });

        return {
            period: period,
            startDate: startDate,
            endDate: endDate,
            dataPoints: filteredAum.length,
            portfolio: {
                ui: portfolioUI,
                score: portfolioScore,
                grade: portfolioGrade
            },
            spy: spyResult,
            tqqq: tqqqResult
        };
    },

    // =====================================================
    // ROTI - Return On Time Invested
    // Measures hourly alpha vs time spent
    // =====================================================

    /**
     * ROTI Configuration
     */
    ROTI_CONFIG: {
        MINUTES_PER_WEEK: 10,  // Assumed operational time per week
        DAY_TRADER_HOURS_PER_WEEK: 40  // For comparison
    },

    /**
     * Calculate ROTI (Return On Time Invested)
     * 
     * Formula:
     * - Total Invested = aumHistory[0] (inception AUM) + Σ(Deposits) - Σ(Withdrawals)
     * - Net Profit = Current AUM - Total Invested
     * - Total Hours = (Weeks × 10 min) / 60
     * - Hourly Alpha = Net Profit / Total Hours
     * 
     * @param {number} currentAUM - Current total AUM value (in KRW)
     * @param {Array} portfolioHistory - Array of log entries with type, amount, date
     * @param {Array} aumHistory - Historical AUM array [{ date, totalValue }, ...]
     * @param {string} inceptionDate - Portfolio inception date (YYYY-MM-DD)
     * @returns {Object} - { hourlyAlpha, netProfit, totalInvested, totalHours, weeksOperating, dayTraderHours }
     */
    calculateROTI: (currentAUM, portfolioHistory, aumHistory, inceptionDate = '2024-03-12') => {
        if (!currentAUM || currentAUM <= 0) {
            console.warn("ROTI: Invalid current AUM");
            return null;
        }

        // Get inception AUM (first data point = initial capital)
        let inceptionAUM = 0;
        if (aumHistory && aumHistory.length > 0) {
            inceptionAUM = aumHistory[0].totalValue || 0;
        }

        // Calculate Deposits and Withdrawals from logs
        let totalDeposits = 0;
        let totalWithdrawals = 0;

        if (portfolioHistory && Array.isArray(portfolioHistory)) {
            portfolioHistory.forEach(log => {
                if (log.type === 'Deposit' && log.amount) {
                    totalDeposits += parseFloat(log.amount) || 0;
                } else if (log.type === 'Withdraw' && log.amount) {
                    totalWithdrawals += parseFloat(log.amount) || 0;
                }
            });
        }

        // Total Invested = Inception AUM + Deposits - Withdrawals
        const totalInvested = inceptionAUM + totalDeposits - totalWithdrawals;
        
        // If no data at all, return null
        if (totalInvested <= 0) {
            console.warn("ROTI: No investment data found (no AUM history or logs)");
            return null;
        }

        // Calculate Net Profit
        const netProfit = currentAUM - totalInvested;

        // Calculate weeks since inception
        const inception = new Date(inceptionDate);
        const today = new Date();
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksOperating = Math.max(1, Math.floor((today - inception) / msPerWeek));

        // Calculate total operational hours (10 min/week)
        const config = Finance.ROTI_CONFIG;
        const totalMinutes = weeksOperating * config.MINUTES_PER_WEEK;
        const totalHours = totalMinutes / 60;

        // Calculate day trader comparison hours
        const dayTraderHours = weeksOperating * config.DAY_TRADER_HOURS_PER_WEEK;

        // Calculate Hourly Alpha
        const hourlyAlpha = netProfit / totalHours;

        // Time saved
        const timeSaved = dayTraderHours - totalHours;

        console.log("ROTI Calculation:", {
            currentAUM: currentAUM.toLocaleString(),
            inceptionAUM: inceptionAUM.toLocaleString(),
            totalDeposits: totalDeposits.toLocaleString(),
            totalWithdrawals: totalWithdrawals.toLocaleString(),
            totalInvested: totalInvested.toLocaleString(),
            netProfit: netProfit.toLocaleString(),
            weeksOperating,
            totalHours: totalHours.toFixed(1),
            hourlyAlpha: hourlyAlpha.toLocaleString()
        });

        return {
            hourlyAlpha,          // KRW per hour
            netProfit,            // KRW
            totalInvested,        // KRW (inception + deposits - withdrawals)
            inceptionAUM,         // KRW (first data point)
            totalDeposits,        // KRW
            totalWithdrawals,     // KRW
            totalHours,           // hours
            weeksOperating,       // weeks
            dayTraderHours,       // hours (for comparison)
            timeSaved             // hours saved vs day trader
        };
    },

    /**
     * Convert ROTI value to different currency
     * @param {number} valueKRW - Value in KRW
     * @param {string} currency - 'KRW' or 'USD'
     * @param {number} fxRate - USD/KRW exchange rate
     * @returns {number} - Converted value
     */
    convertROTICurrency: (valueKRW, currency, fxRate) => {
        if (currency === 'USD' && fxRate > 0) {
            return valueKRW / fxRate;
        }
        return valueKRW;
    },

    // =====================================================
    // COMPOUND VISION SIMULATOR
    // Bidirectional Wealth Projector
    // =====================================================

    /**
     * Suggest next logical milestone based on current AUM
     * @param {number} currentAUM - Current total AUM
     * @returns {number} - Suggested target value
     */
    suggestMilestone: (currentAUM) => {
        const milestones = [
            10000000,    // ₩10M
            30000000,    // ₩30M
            50000000,    // ₩50M
            100000000,   // ₩100M (1억)
            200000000,   // ₩200M
            300000000,   // ₩300M
            500000000,   // ₩500M (5억)
            1000000000,  // ₩1B (10억)
            2000000000,  // ₩2B
            5000000000,  // ₩5B (50억)
            10000000000  // ₩10B (100억)
        ];

        // Find the next milestone above current AUM
        for (const milestone of milestones) {
            if (milestone > currentAUM * 1.2) { // At least 20% above current
                return milestone;
            }
        }

        // If current is very large, suggest 2x
        return Math.ceil(currentAUM * 2 / 100000000) * 100000000;
    },

    /**
     * Calculate years to reach target using CAGR
     * Formula: t = ln(Target / Current) / ln(1 + CAGR)
     * @param {number} currentValue - Current AUM
     * @param {number} targetValue - Target AUM
     * @param {number} cagr - CAGR as decimal (e.g., 0.15 for 15%)
     * @returns {number} - Years to reach target
     */
    calculateTimeToTarget: (currentValue, targetValue, cagr) => {
        if (currentValue >= targetValue) return 0;
        if (cagr <= 0) return Infinity;
        
        const years = Math.log(targetValue / currentValue) / Math.log(1 + cagr);
        return years;
    },

    /**
     * Generate projection data points for chart
     * @param {number} startValue - Starting AUM
     * @param {number} cagr - CAGR as decimal
     * @param {number} years - Number of years to project
     * @param {Date} startDate - Starting date
     * @returns {Array} - [{ date, value }, ...]
     */
    generateProjectionData: (startValue, cagr, years, startDate = new Date()) => {
        const dataPoints = [];
        const monthsToProject = Math.ceil(years * 12) + 12; // Extra buffer
        
        for (let month = 0; month <= monthsToProject; month++) {
            const yearFraction = month / 12;
            const projectedValue = startValue * Math.pow(1 + cagr, yearFraction);
            
            const projectedDate = new Date(startDate);
            projectedDate.setMonth(projectedDate.getMonth() + month);
            
            dataPoints.push({
                date: projectedDate.toISOString().split('T')[0],
                value: projectedValue
            });
        }
        
        return dataPoints;
    },

    /**
     * Calculate Compound Vision Comparison
     * @param {number} currentAUM - Current portfolio value
     * @param {number} targetValue - User-defined target
     * @param {number} portfolioCAGR - Portfolio CAGR (decimal)
     * @param {number} benchmarkCAGR - SPY CAGR (decimal)
     * @param {number} portfolioMDD - Portfolio max drawdown (decimal, e.g., -0.15)
     * @param {number} benchmarkMDD - SPY max drawdown (decimal)
     * @returns {Object} - Complete comparison result
     */
    calculateCompoundVision: (currentAUM, targetValue, portfolioCAGR, benchmarkCAGR, portfolioMDD = 0, benchmarkMDD = 0) => {
        if (!currentAUM || currentAUM <= 0 || !targetValue || targetValue <= currentAUM) {
            console.warn("Compound Vision: Invalid inputs");
            return null;
        }

        // Calculate time to target
        const timePortfolio = Finance.calculateTimeToTarget(currentAUM, targetValue, portfolioCAGR);
        const timeBenchmark = Finance.calculateTimeToTarget(currentAUM, targetValue, benchmarkCAGR);

        // Determine scenario
        const portfolioWins = timePortfolio < timeBenchmark;
        const timeDifference = Math.abs(timeBenchmark - timePortfolio);
        const mddDifference = Math.abs(benchmarkMDD - portfolioMDD) * 100; // Convert to percentage

        // Calculate value at opponent's finish line
        let valueAtOpponentFinish;
        if (portfolioWins) {
            // When portfolio finishes, where is SPY?
            valueAtOpponentFinish = currentAUM * Math.pow(1 + benchmarkCAGR, timePortfolio);
        } else {
            // When SPY finishes, where is portfolio?
            valueAtOpponentFinish = currentAUM * Math.pow(1 + portfolioCAGR, timeBenchmark);
        }
        const wealthGap = targetValue - valueAtOpponentFinish;

        // Generate projection data (extend to the slower one's finish)
        const maxYears = Math.max(timePortfolio, timeBenchmark);
        const portfolioProjection = Finance.generateProjectionData(currentAUM, portfolioCAGR, maxYears);
        const benchmarkProjection = Finance.generateProjectionData(currentAUM, benchmarkCAGR, maxYears);

        // Generate message
        let scenario, primaryMessage, secondaryMessage, tone;
        
        if (portfolioWins) {
            scenario = 'WIN';
            tone = 'celebratory';
            primaryMessage = `🚀 Time Saved: ${timeDifference.toFixed(1)} Years Faster`;
            secondaryMessage = `💰 Wealth Gap: At your finish line, SPY is still ₩${(wealthGap / 10000).toFixed(0)}만 behind.`;
        } else {
            scenario = 'LAG';
            tone = 'honest';
            primaryMessage = `⏳ Time Delay: ${timeDifference.toFixed(1)} Years Later`;
            secondaryMessage = `🛡️ Safety Premium: You accept ${timeDifference.toFixed(1)} year delay to reduce drawdown risk by ${mddDifference.toFixed(1)}%.`;
        }

        // Calculate finish dates
        const today = new Date();
        const portfolioFinishDate = new Date(today);
        portfolioFinishDate.setMonth(portfolioFinishDate.getMonth() + Math.round(timePortfolio * 12));
        
        const benchmarkFinishDate = new Date(today);
        benchmarkFinishDate.setMonth(benchmarkFinishDate.getMonth() + Math.round(timeBenchmark * 12));

        console.log("Compound Vision:", {
            currentAUM: currentAUM.toLocaleString(),
            targetValue: targetValue.toLocaleString(),
            portfolioCAGR: (portfolioCAGR * 100).toFixed(1) + '%',
            benchmarkCAGR: (benchmarkCAGR * 100).toFixed(1) + '%',
            timePortfolio: timePortfolio.toFixed(2) + ' years',
            timeBenchmark: timeBenchmark.toFixed(2) + ' years',
            scenario
        });

        return {
            // Input values
            currentAUM,
            targetValue,
            portfolioCAGR,
            benchmarkCAGR,
            
            // Time calculations
            timePortfolio,           // Years for portfolio to reach target
            timeBenchmark,           // Years for benchmark to reach target
            timeDifference,          // Absolute difference in years
            
            // Scenario
            scenario,                // 'WIN' or 'LAG'
            portfolioWins,           // Boolean
            tone,                    // 'celebratory' or 'honest'
            
            // Messages
            primaryMessage,
            secondaryMessage,
            
            // Finish dates
            portfolioFinishDate,
            benchmarkFinishDate,
            
            // Wealth gap
            wealthGap,
            valueAtOpponentFinish,
            mddDifference,
            
            // Chart projection data
            portfolioProjection,
            benchmarkProjection
        };
    }
};
