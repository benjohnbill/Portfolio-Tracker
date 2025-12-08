/**
 * Financial Calculation Library
 */

const Finance = {
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

        // Sharpe (Risk Free Rate assumed 3%)
        const rf = 0.03;
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
    calculateSharpeFromSnapshots: (snapshots, riskFreeRate = 0.05) => {
        const cagr = Finance.calculateCAGRfromSnapshots(snapshots);
        const stdDev = Finance.calculateStdDevFromSnapshots(snapshots);
        if (cagr === null || stdDev === null || stdDev === 0) return null;
        return (cagr - riskFreeRate) / stdDev;
    },

    /**
     * Calculate Sortino from snapshots
     */
    calculateSortinoFromSnapshots: (snapshots, riskFreeRate = 0.05) => {
        const cagr = Finance.calculateCAGRfromSnapshots(snapshots);
        const downside = Finance.calculateDownsideStdDevFromSnapshots(snapshots);
        if (cagr === null || downside === null || downside === 0) return null;
        return (cagr - riskFreeRate) / downside;
    },

    /**
     * Calculate all metrics from snapshots
     */
    calculateAllMetricsFromSnapshots: (snapshots, benchmarkReturns = null, riskFreeRate = 0.05) => {
        return {
            cagr: Finance.calculateCAGRfromSnapshots(snapshots),
            stdDev: Finance.calculateStdDevFromSnapshots(snapshots),
            beta: benchmarkReturns ? Finance.calculateBetaFromSnapshots(snapshots, benchmarkReturns) : null,
            sharpe: Finance.calculateSharpeFromSnapshots(snapshots, riskFreeRate),
            sortino: Finance.calculateSortinoFromSnapshots(snapshots, riskFreeRate)
        };
    }
};
