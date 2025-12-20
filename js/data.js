/**
 * Data Layer
 * Handles portfolio state and market data fetching (Mock/Simulated for now)
 */

const API_BASE_URL = 'http://127.0.0.1:8080';

const PortfolioDefaults = [
    { id: 'nasdaq', ticker: 'QQQ', name: 'KODEX Nasdaq100 TR', targetWeight: 0.30, type: 'GROWTH', shares: 100, price: 0, currency: 'KRW' },
    { id: 'dbmf', ticker: 'DBMF', name: 'iMGP DBi Managed Futures', targetWeight: 0.30, type: 'DEFENSE', shares: 100, price: 0, currency: 'USD' },
    { id: 'china', ticker: 'CSI300', name: 'RISE China CSI300', targetWeight: 0.10, type: 'GROWTH_HEDGE', shares: 100, price: 0, currency: 'KRW' },
    { id: 'bond', ticker: 'TLT', name: 'ACE 30Y Treasury', targetWeight: 0.10, type: 'HEDGE', shares: 100, price: 0, currency: 'KRW' },
    { id: 'gold', ticker: 'GLDM', name: 'GLDM', targetWeight: 0.10, type: 'HEDGE_INF', shares: 100, price: 0, currency: 'USD' },
    { id: 'crypto', ticker: 'MSTR', name: 'MicroStrategy', targetWeight: 0.10, type: 'ALPHA', shares: 10, price: 0, currency: 'USD' },
    { id: 'nifty', ticker: 'NIFTY', name: 'TIGER India Nifty50', targetWeight: 0.00, type: 'ROTATION', shares: 0, price: 0, currency: 'KRW' },
    { id: 'cash_krw', ticker: 'BIL', name: 'TIGER US Ultra-Short Bond', targetWeight: 0.00, type: 'CASH_KRW', shares: 0, price: 0, currency: 'KRW' },
    { id: 'pfix', ticker: 'PFIX', name: 'Simplify Interest Rate', targetWeight: 0.00, type: 'HEDGE_RATE', shares: 0, price: 0, currency: 'USD' },
    { id: 'cash_usd', ticker: 'VBIL', name: 'Vanguard 0-3 Month Treasury', targetWeight: 0.00, type: 'CASH_USD', shares: 0, price: 0, currency: 'USD' }
];

// Mock Historical Data for Indicators (to calculate MA/RSI/Z-Score)
// In a real app, this would fetch from Yahoo Finance API via Proxy
function generateMockHistory(basePrice, days = 300) {
    let prices = [basePrice];
    for (let i = 1; i < days; i++) {
        const change = (Math.random() - 0.5) * (basePrice * 0.05);
        prices.push(prices[i - 1] + change);
    }
    return prices;
}

const DataService = {
    /**
     * Ticker migration map: deprecated tickers -> new tickers
     * Add new migrations here as needed
     */
    TICKER_MIGRATIONS: {
        'CTA': 'DBMF'
    },

    /**
     * Migrate deprecated tickers to new ones
     * @param {Array} portfolio - Portfolio array
     * @returns {Array} - Migrated portfolio
     */
    migratePortfolio: (portfolio) => {
        let migrated = false;
        const result = portfolio.map(asset => {
            const newTicker = DataService.TICKER_MIGRATIONS[asset.ticker];
            if (newTicker) {
                console.log(`🔄 Ticker migrated: ${asset.ticker} → ${newTicker}`);
                migrated = true;
                return { ...asset, ticker: newTicker };
            }
            return asset;
        });
        
        if (migrated) {
            // Save migrated portfolio back
            DataService.savePortfolio(result);
            console.log('✅ Portfolio migration completed and saved');
        }
        
        return result;
    },

    /**
     * Load portfolio holdings from LocalStorage or Defaults
     * Automatically migrates deprecated tickers
     */
    loadPortfolio: () => {
        const stored = localStorage.getItem('jg_portfolio');
        if (stored) {
            const portfolio = JSON.parse(stored);
            // Apply ticker migrations
            return DataService.migratePortfolio(portfolio);
        }
        return JSON.parse(JSON.stringify(PortfolioDefaults));
    },

    /**
     * Save portfolio to LocalStorage
     */
    savePortfolio: (portfolio) => {
        localStorage.setItem('jg_portfolio', JSON.stringify(portfolio));
    },

    loadHistory: () => {
        const stored = localStorage.getItem('jg_history');
        return stored ? JSON.parse(stored) : [];
    },

    saveHistory: (history) => {
        localStorage.setItem('jg_history', JSON.stringify(history));
    },

    /**
     * Fetch Market Data (Real via Python Server)
     */
    fetchMarketData: async () => {
        try {
            console.log("Fetching market data from server...");
            const response = await fetch(`${API_BASE_URL}/api/market-data`, {
                mode: 'cors',
                method: 'GET'
            });
            if (!response.ok) {
                throw new Error('Server error');
            }
            const data = await response.json();

            // Handle Loading State - allow loading if server says so
            if (data.status === 'loading') {
                console.warn("Server is loading data...");
                // Return empty/loading state object instead of mock
                return { status: 'loading' };
            }

            return data;
        } catch (error) {
            console.error("Failed to fetch real data from server:", error);
            // Fallback: Return empty to indicate connection failure, NOT mock data.
            // This forces the user to ensure the server is running.
            return {};
        }
    },

    /**
     * Fetch USD/KRW exchange rate from server
     */
    fetchExchangeRate: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/exchange-rate`, {
                mode: 'cors',
                method: 'GET'
            });
            if (!response.ok) {
                throw new Error('Server error');
            }
            const data = await response.json();
            return data.rate || 1410;
        } catch (error) {
            console.error("Failed to fetch exchange rate:", error);
            return 1410; // Fallback rate
        }
    },

    /**
     * Fetch Macro Vitals (Net Liquidity & Real Yield) from server
     */
    fetchMacroVitals: async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/macro-vitals`, {
                mode: 'cors',
                method: 'GET',
                cache: 'no-store'
            });
            if (!response.ok) {
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch macro vitals:", error);
            return null;
        }
    },

    generateMockData: async () => {
        // SIMULATION: Generate random market movements to verify logic
        // ... (Keep existing mock logic here as fallback or for testing without server)
        const marketData = {
            MSTR: { price: 0, ma50: 0, ma250: 0, rsi: 0, history: [] },
            TLT: { price: 0, ma50: 0, ma250: 0, rsi: 0 },
            GLDM: { price: 0, ma250: 0, rsi: 0 },
            CSI300: { price: 0, ma50: 0, ma250: 0, rsi: 0 },
            Z_Score_MSTR: 0,
            MNAV_MSTR: 0,
            MVRV_BTC: 0
        };

        const makeAssetData = (basePrice) => {
            const history = generateMockHistory(basePrice);
            const current = history[history.length - 1];
            return {
                price: current,
                history: history,
                // Add fake MA/RSI for fallback
                ma50: current * 0.98,
                ma250: current * 0.90,
                rsi: 50 + (Math.random() * 20 - 10)
            };
        };

        return {
            QQQ: { ...makeAssetData(20000), currency: 'KRW' },
            DBMF: { ...makeAssetData(30), currency: 'USD' },
            CSI300: { ...makeAssetData(12000), currency: 'KRW' },
            TLT: { ...makeAssetData(10000), currency: 'KRW' },
            GLDM: { ...makeAssetData(54), currency: 'USD' },
            MSTR: { ...makeAssetData(1500), currency: 'USD' },
            PFIX: { ...makeAssetData(80), currency: 'USD' },
            NIFTY: { ...makeAssetData(10000), currency: 'KRW' },
            BIL: { ...makeAssetData(10000), currency: 'KRW' },
            VBIL: { ...makeAssetData(90), currency: 'USD' },
            MNAV_MSTR: 1.8 + Math.random(),
            MVRV_BTC: 1.5 + Math.random()
        };
    },

    // =====================================================
    // Daily Snapshot Management
    // =====================================================

    /**
     * Load daily snapshots from localStorage
     * Automatically migrates deprecated tickers in holdings
     */
    loadSnapshots: () => {
        const stored = localStorage.getItem('jg_snapshots');
        if (!stored) return [];
        
        let snapshots = JSON.parse(stored);
        let migrated = false;
        
        // Migrate tickers in each snapshot's holdings
        snapshots = snapshots.map(snapshot => {
            if (snapshot.holdings && Array.isArray(snapshot.holdings)) {
                const migratedHoldings = snapshot.holdings.map(holding => {
                    const newTicker = DataService.TICKER_MIGRATIONS[holding.ticker];
                    if (newTicker) {
                        migrated = true;
                        return { ...holding, ticker: newTicker };
                    }
                    return holding;
                });
                return { ...snapshot, holdings: migratedHoldings };
            }
            return snapshot;
        });
        
        if (migrated) {
            DataService.saveSnapshots(snapshots);
            console.log('✅ Snapshots ticker migration completed');
        }
        
        return snapshots;
    },

    /**
     * Save daily snapshots to localStorage
     */
    saveSnapshots: (snapshots) => {
        localStorage.setItem('jg_snapshots', JSON.stringify(snapshots));
    },

    /**
     * Add or update today's snapshot
     * Only one snapshot per day, updates if already exists
     */
    addSnapshot: (portfolio, totalValue, cashFlow = 0) => {
        const snapshots = DataService.loadSnapshots();
        const today = new Date().toISOString().split('T')[0];

        const newSnapshot = {
            date: today,
            totalValue: totalValue,
            holdings: portfolio.map(a => ({
                ticker: a.ticker,
                value: a.value || 0,
                shares: a.shares || 0
            })),
            cashFlow: cashFlow
        };

        // Check if today's snapshot exists
        const existingIndex = snapshots.findIndex(s => s.date === today);
        if (existingIndex >= 0) {
            // Update existing, accumulate cashFlow
            snapshots[existingIndex].totalValue = totalValue;
            snapshots[existingIndex].holdings = newSnapshot.holdings;
            snapshots[existingIndex].cashFlow = (snapshots[existingIndex].cashFlow || 0) + cashFlow;
        } else {
            snapshots.push(newSnapshot);
        }

        // Keep only last 365 days
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const filtered = snapshots.filter(s => new Date(s.date) >= oneYearAgo);

        DataService.saveSnapshots(filtered);
        return filtered;
    },

    /**
     * Update today's snapshot with cash flow from Log event
     */
    updateSnapshotCashFlow: (cashFlow) => {
        const snapshots = DataService.loadSnapshots();
        const today = new Date().toISOString().split('T')[0];

        const existingIndex = snapshots.findIndex(s => s.date === today);
        if (existingIndex >= 0) {
            snapshots[existingIndex].cashFlow = (snapshots[existingIndex].cashFlow || 0) + cashFlow;
            DataService.saveSnapshots(snapshots);
        }
        return snapshots;
    },

    // =====================================================
    // Export / Import All Data
    // =====================================================

    /**
     * Export all application data as a JSON file
     * Includes: portfolio, history, snapshots
     * @param {boolean} isSimulation - If true, marks export as simulation data
     */
    exportAllData: (isSimulation = false) => {
        const data = {
            exportDate: new Date().toISOString(),
            appVersion: localStorage.getItem('jg_app_version') || 'unknown',
            mode: isSimulation ? 'simulation' : 'real',
            portfolio: DataService.loadPortfolio(),
            history: DataService.loadHistory(),
            snapshots: DataService.loadSnapshots()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Format date as YYMMDD
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateStr = `${yy}${mm}${dd}`;
        
        const filename = isSimulation 
            ? `${dateStr}_Portfolio_Backup_SIM.json`
            : `${dateStr}_Portfolio_Backup.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    },

    /**
     * Import all application data from a JSON file
     * Returns { success: boolean, message: string }
     */
    importAllData: (jsonString) => {
        try {
            const data = JSON.parse(jsonString);

            // Validate structure
            if (!data.portfolio || !Array.isArray(data.portfolio)) {
                return { success: false, message: 'Invalid file: missing portfolio data' };
            }
            if (!data.history || !Array.isArray(data.history)) {
                return { success: false, message: 'Invalid file: missing history data' };
            }

            // Validate portfolio structure
            const requiredFields = ['ticker', 'shares'];
            for (const item of data.portfolio) {
                for (const field of requiredFields) {
                    if (!(field in item)) {
                        return { success: false, message: `Invalid portfolio item: missing ${field}` };
                    }
                }
            }

            // All validations passed - save data
            DataService.savePortfolio(data.portfolio);
            DataService.saveHistory(data.history);

            if (data.snapshots && Array.isArray(data.snapshots)) {
                DataService.saveSnapshots(data.snapshots);
            }

            // Check if data was from simulation mode
            const simWarning = data.mode === 'simulation' 
                ? ' ⚠️ 이 데이터는 Simulation에서 내보낸 데이터입니다.' 
                : '';

            return {
                success: true,
                message: `Successfully imported ${data.portfolio.length} holdings and ${data.history.length} log entries${simWarning}`,
                isSimulation: data.mode === 'simulation'
            };
        } catch (error) {
            return { success: false, message: `Parse error: ${error.message}` };
        }
    },

    /**
     * Get data summary for display
     */
    getDataSummary: () => {
        const portfolio = DataService.loadPortfolio();
        const history = DataService.loadHistory();
        const snapshots = DataService.loadSnapshots();

        // Calculate days tracked
        let daysTracked = 0;
        if (snapshots.length >= 2) {
            const oldest = new Date(snapshots[0].date);
            const newest = new Date(snapshots[snapshots.length - 1].date);
            daysTracked = Math.floor((newest - oldest) / (1000 * 60 * 60 * 24));
        }

        // Count weekly snapshots (Fridays)
        const weeklySnapshots = snapshots.filter(s => {
            const d = new Date(s.date);
            return d.getDay() === 5; // Friday
        }).length;

        // Data health check
        let dataHealth = 'OK';
        if (snapshots.length < 10) {
            dataHealth = 'Low Data';
        } else if (snapshots.length > 0) {
            const lastDate = new Date(snapshots[snapshots.length - 1].date);
            const daysSinceLastSnap = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
            if (daysSinceLastSnap > 7) {
                dataHealth = 'Stale';
            } else if (snapshots.length >= 100) {
                dataHealth = 'Excellent';
            }
        }

        return {
            holdingsCount: portfolio.length,
            historyCount: history.length,
            snapshotsCount: snapshots.length,
            oldestSnapshot: snapshots.length > 0 ? snapshots[0].date : null,
            newestSnapshot: snapshots.length > 0 ? snapshots[snapshots.length - 1].date : null,
            daysTracked: daysTracked,
            weeklySnapshots: weeklySnapshots,
            dataHealth: dataHealth
        };
    }
};
