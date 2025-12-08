

// App.js Loaded
console.log("App.js Script executing...");

// App State
let portfolio = [];
let portfolioHistory = [];

let marketPrices = {};
let allocationChart = null;
let forceFriday = false;
const FX_RATE = 1410; // Fixed mock rate for USD/KRW

async function initApp() {
    console.log("initApp started");

    // One-time reset to apply new Log/Snapshot/Export system (v3.5)
    const appVersion = 'v3.5';
    if (localStorage.getItem('jg_app_version') !== appVersion) {
        localStorage.removeItem('jg_portfolio');
        localStorage.setItem('jg_app_version', appVersion);
        console.log("Portfolio reset to apply new display settings.");
    }

    // 1. Load Portfolio & History
    portfolio = DataService.loadPortfolio();
    portfolioHistory = DataService.loadHistory();

    // 2. Initialize Chart
    initChart();

    // 3. Render Initial UI (Friday Check)
    const isFriday = Strategy.isExecutionDay() || forceFriday;
    UI.renderHeader(isFriday);

    // 4. Fetch Market Data & Update
    try {
        await updateDashboard();
    } catch (e) {
        console.error("Critical Error in updateDashboard:", e);
    }

    // 5. Setup Event Listeners
    setupEventListeners();
}

function initChart() {
    const ctx = document.getElementById('allocationChart').getContext('2d');
    allocationChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#94a3b8' } }
            }
        }
    });
}

async function updateDashboard() {
    console.log("updateDashboard started");
    // 1. Fetch Data
    const rawData = await DataService.fetchMarketData();
    console.log("Data fetched:", rawData);

    // Check if server is still loading or data is empty
    if (!rawData || rawData.status === 'loading' || Object.keys(rawData).length === 0) {
        console.warn("Server is loading data or not ready. Retrying in 3 seconds...");
        UI.showToast("Fetching market data... (Server Warming Up)"); // Optional user feedback
        setTimeout(updateDashboard, 3000); // Retry logic
        return;
    }

    // 2. Process Data (Calculate Indicators)
    // Map raw history to indicators
    // We assume rawData returns objects like { price: 100, history: [...] }

    const processedMarketData = {};

    // Process each asset
    Object.keys(rawData).forEach(ticker => {
        const data = rawData[ticker];

        // Skip metadata/stats keys that don't have history
        if (!data || !data.history) return;

        const prices = data.history;

        processedMarketData[ticker] = {
            price: data.price,
            ma50: Finance.calculateMA(prices, 50),
            ma250: Finance.calculateMA(prices, 250),
            rsi: Finance.calculateRSI(prices, 14),
            history: prices,
            currency: data.currency || 'KRW'
        };
    });

    // Specific MSTR Z-Score
    let zScoreMSTR = 0;
    if (processedMarketData.MSTR) {
        zScoreMSTR = Finance.calculateZScore(
            processedMarketData.MSTR.price,
            processedMarketData.MSTR.history
        );
    } else {
        console.warn("MSTR data missing for Z-Score calc");
    }

    // Context object for Strategy (must match structure expected by strategy.js)
    const strategyContext = {
        marketData: processedMarketData,
        derivedStats: {
            zScoreMSTR: zScoreMSTR,
            mnavMSTR: rawData.MNAV_MSTR
        },
        portfolio: portfolio
    };

    // Debug
    console.log("Raw Data:", rawData);
    console.log("Processed:", processedMarketData);
    console.log("Portfolio before update:", JSON.parse(JSON.stringify(portfolio)));

    // 3. Update Portfolio Values
    portfolio.forEach(asset => {
        if (processedMarketData[asset.ticker]) {
            asset.price = processedMarketData[asset.ticker].price;
            asset.currency = processedMarketData[asset.ticker].currency;
        }

        // Calculate Value (Convert USD to KRW)
        let priceInKRW = asset.price;
        if (asset.currency === 'USD') {
            priceInKRW = asset.price * FX_RATE;
        }
        asset.value = asset.shares * priceInKRW;
    });

    // 4. Run Strategy Engine (Signals)
    const sellSignals = Strategy.evaluateSellRules(strategyContext);
    const buySignals = Strategy.evaluateBuyRules(strategyContext);

    // Note: Rebalancing check requires calculated weights (#3 above must be done first), 
    // but wait... UI.renderAllocation calculates the weights visually?
    // We should calculate weights formally here in Step 3.

    // Calculate total value
    let totalValue = 0;
    portfolio.forEach(a => totalValue += a.value);

    // Assign weights for strategy
    portfolio.forEach(a => {
        a.actualWeight = totalValue > 0 ? (a.value / totalValue) : 0;
    });

    const rebalanceActions = Strategy.checkRebalancing(portfolio);

    // 5. Render UI
    // Calculate Weighted Weekly Return
    let totalWeightedReturn = 0;
    let totalInvestedValue = 0;

    portfolio.forEach(asset => {
        const md = processedMarketData[asset.ticker];
        if (asset.value > 0 && md && md.history && md.history.length > 5) {
            // Calculate weekly return from history (last 5 trading days)
            const h = md.history;
            const weekAgoPrice = h[h.length - 6] || h[0];
            const currentPrice = h[h.length - 1];
            const weeklyReturn = ((currentPrice - weekAgoPrice) / weekAgoPrice) * 100;

            totalWeightedReturn += weeklyReturn * asset.value;
            totalInvestedValue += asset.value;
        }
    });

    const portfolioWeeklyReturn = totalInvestedValue > 0 ? (totalWeightedReturn / totalInvestedValue) : 0;

    // Risk Metrics Object
    const riskStats = {
        weeklyReturn: portfolioWeeklyReturn,
        cagr: 0.15,      // Placeholder
        stdDev: 0.12,    // Placeholder
        sharpe: 1.25,    // Placeholder
        sortino: 1.8,    // Placeholder
        beta: 0.85       // Placeholder
    };

    // 6. Save Daily Snapshot (for 1-year performance tracking)
    DataService.addSnapshot(portfolio, totalValue, 0);

    // Try to calculate real metrics from snapshots if enough data
    const snapshots = DataService.loadSnapshots();
    if (snapshots.length >= 7) {
        const realMetrics = Finance.calculateAllMetricsFromSnapshots(snapshots);
        if (realMetrics.cagr !== null) riskStats.cagr = realMetrics.cagr;
        if (realMetrics.stdDev !== null) riskStats.stdDev = realMetrics.stdDev;
        if (realMetrics.sharpe !== null) riskStats.sharpe = realMetrics.sharpe;
        if (realMetrics.sortino !== null) riskStats.sortino = realMetrics.sortino;
        if (realMetrics.beta !== null) riskStats.beta = realMetrics.beta;
    }

    UI.renderAllocation(portfolio, allocationChart);
    UI.renderSignals(sellSignals, buySignals, rebalanceActions);
    UI.renderConditions(processedMarketData, {
        zScoreMSTR,
        mnavMSTR: rawData.MNAV_MSTR,
        mvrvBTC: rawData.MVRV_BTC
    });
    UI.renderRisk(riskStats);
    UI.showToast("System Updated");

}

function setupEventListeners() {
    const modal = document.getElementById('edit-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const form = document.getElementById('holdings-form');

    // Sidebar: Page Navigation (Scroll)
    document.querySelectorAll('.nav-item[data-target]').forEach(item => {
        item.addEventListener('click', (e) => {
            // Active State
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Scroll
            const targetId = item.dataset.target;
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Sidebar: Modal Triggers (Settings only)
    const settingsBtn = document.getElementById('nav-settings');

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            // Active State
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            settingsBtn.classList.add('active');

            modal.classList.remove('hidden');
            renderEditForm();
            switchTab('holdings');
        });
    }

    // Modal Close
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    // Friday Toggle (Inside Modal)
    const fridayBtn = document.getElementById('toggle-friday-btn');
    if (fridayBtn) {
        fridayBtn.addEventListener('click', () => {
            forceFriday = !forceFriday;
            fridayBtn.style.background = forceFriday ? '#ff0a4e' : '';
            fridayBtn.style.color = forceFriday ? '#fff' : '';
            UI.renderHeader(Strategy.isExecutionDay() || forceFriday);
        });
    }

    // Modal Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // Form Submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveEditForm();
        modal.classList.add('hidden');
        // Reset sidebar active to current section logic if needed (optional)
    });
}

function renderEditForm() {
    const form = document.getElementById('holdings-form');
    form.innerHTML = '';
    form.classList.add('form-grid'); // Enable 2-column grid

    portfolio.forEach((asset, index) => {
        const card = document.createElement('div');
        card.className = 'input-card';
        card.innerHTML = `
            <label class="input-label">${asset.ticker}</label>
            <input type="number" step="0.000001" name="shares-${index}" value="${asset.shares}" class="stylish-input" placeholder="0.000000">
        `;
        form.appendChild(card);
    });
}

function switchTab(tabName) {
    // 1. Update Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // 2. Update Content
    const holdingsTab = document.getElementById('tab-holdings');
    const historyTab = document.getElementById('tab-history');
    const dataTab = document.getElementById('tab-data');

    // Hide all tabs first
    holdingsTab.classList.add('hidden');
    historyTab.classList.add('hidden');
    if (dataTab) dataTab.classList.add('hidden');

    if (tabName === 'holdings') {
        holdingsTab.classList.remove('hidden');
        renderEditForm(); // Refresh Inputs
    } else if (tabName === 'history') {
        historyTab.classList.remove('hidden');
        refreshHistoryView();
    } else if (tabName === 'data') {
        if (dataTab) {
            dataTab.classList.remove('hidden');
            renderDataTab();
        }
    }
}

function renderDataTab() {
    const summaryEl = document.getElementById('data-summary');
    const summary = DataService.getDataSummary();

    summaryEl.innerHTML = `
        <div class="summary-item">
            <div class="summary-label">Holdings</div>
            <div class="summary-value">${summary.holdingsCount}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Log Entries</div>
            <div class="summary-value">${summary.historyCount}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Snapshots</div>
            <div class="summary-value">${summary.snapshotsCount}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Data Range</div>
            <div class="summary-value" style="font-size: 0.75rem;">
                ${summary.oldestSnapshot ? summary.oldestSnapshot + ' ~ ' + summary.newestSnapshot : 'No data'}
            </div>
        </div>
    `;

    // Re-render Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Setup Export Handler
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            DataService.exportAllData();
            UI.showToast('Backup exported successfully!');
        };
    }

    // Setup Import Handler
    const importZone = document.getElementById('import-zone');
    const importInput = document.getElementById('import-file-input');
    const importStatus = document.getElementById('import-status');

    if (importZone && importInput) {
        // Click to select file
        importZone.onclick = () => importInput.click();

        // File selected
        importInput.onchange = (e) => handleImportFile(e.target.files[0]);

        // Drag & Drop
        importZone.ondragover = (e) => {
            e.preventDefault();
            importZone.classList.add('drag-over');
        };
        importZone.ondragleave = () => {
            importZone.classList.remove('drag-over');
        };
        importZone.ondrop = (e) => {
            e.preventDefault();
            importZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                handleImportFile(e.dataTransfer.files[0]);
            }
        };
    }

    function handleImportFile(file) {
        if (!file || !file.name.endsWith('.json')) {
            showImportStatus('Please select a valid JSON file', false);
            return;
        }

        if (!confirm('⚠️ All existing data will be replaced!\n\nAre you sure you want to import this backup?')) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = DataService.importAllData(e.target.result);
            showImportStatus(result.message, result.success);

            if (result.success) {
                // Reload app state
                portfolio = DataService.loadPortfolio();
                portfolioHistory = DataService.loadHistory();
                updateDashboard();
                renderDataTab(); // Refresh summary
            }
        };
        reader.readAsText(file);
    }

    function showImportStatus(message, success) {
        importStatus.textContent = message;
        importStatus.className = 'import-status ' + (success ? 'success' : 'error');
        importStatus.classList.remove('hidden');
    }
}

function refreshHistoryView() {
    // Sort history by date descending for display
    const sortedHistory = [...portfolioHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

    UI.renderHistoryTab(
        sortedHistory,
        // onAddClick
        () => {
            UI.renderEventTypeSelection((selectedType) => {
                UI.renderEventInputForm(selectedType, portfolio, (eventData, isEdit) => {
                    portfolioHistory.push(eventData);
                    DataService.saveHistory(portfolioHistory);
                    goBackToHistoryList();
                    refreshHistoryView();
                });
            });
        },
        // onEditClick
        (item, displayIndex) => {
            // Find actual index in original array by ID
            const actualIndex = portfolioHistory.findIndex(h => h.id === item.id);
            UI.renderEventInputForm(item.type, portfolio, (eventData, isEdit) => {
                if (actualIndex >= 0) {
                    portfolioHistory[actualIndex] = eventData;
                } else {
                    portfolioHistory.push(eventData);
                }
                DataService.saveHistory(portfolioHistory);
                goBackToHistoryList();
                refreshHistoryView();
            }, item);
        },
        // onDeleteClick
        (displayIndex) => {
            const item = sortedHistory[displayIndex];
            const actualIndex = portfolioHistory.findIndex(h => h.id === item.id);
            if (actualIndex >= 0) {
                portfolioHistory.splice(actualIndex, 1);
                DataService.saveHistory(portfolioHistory);
                refreshHistoryView();
            }
        }
    );
}

function goBackToHistoryList() {
    const listEl = document.getElementById('history-log-list');
    const controlsEl = document.getElementById('history-controls');
    const creationEl = document.getElementById('event-creation-container');
    if (listEl) listEl.style.display = 'block';
    if (controlsEl) controlsEl.classList.remove('hidden');
    if (creationEl) creationEl.classList.add('hidden');
}

function saveEditForm() {
    const inputs = document.querySelectorAll('#holdings-form input');
    inputs.forEach((input, index) => {
        portfolio[index].shares = parseFloat(input.value);
    });

    DataService.savePortfolio(portfolio);
    updateDashboard(); // Re-calc with new shares
}

// Start
initApp();
