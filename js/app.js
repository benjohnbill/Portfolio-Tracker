// App.js Loaded
console.log("App.js Script executing...");

// App State
let portfolio = [];
let portfolioHistory = [];

let marketPrices = {};
// Chart variables moved to js/charts.js
const FX_RATE = 1410; // Fixed mock rate for USD/KRW

// ===================================
// SIMULATION MODE STATE
// ===================================
let isSimulationMode = false;
let realPortfolio = null; // Backup of real portfolio when entering sim mode
let realPortfolioHistory = null; // Backup of real history when entering sim mode
let realMNAV = null; // Backup of real MNAV value
let realZScore = null; // Backup of real Z-Score value
let simPortfolio = null; // Simulated portfolio (deep copy)
let simPortfolioHistory = null; // Simulated history (deep copy)
let simMNAV = null; // Simulated MNAV (temporary)
let simZScore = null; // Simulated Z-Score (temporary)

// UI State backup for freeze mode restoration
let prevFreezeState = null; // Backup of freeze mode classes before entering sim

async function initApp() {
  console.log("initApp started");

  // One-time reset to apply new Log/Snapshot/Export system (v3.5)
  const appVersion = "v3.5";
  if (localStorage.getItem("jg_app_version") !== appVersion) {
    localStorage.removeItem("jg_portfolio");
    localStorage.setItem("jg_app_version", appVersion);
    console.log("Portfolio reset to apply new display settings.");
  }

  // 1. Load Portfolio & History
  portfolio = DataService.loadPortfolio();
  portfolioHistory = DataService.loadHistory();

  // 2. Initialize Chart
  initChart();

  // 3. Render Initial UI (Friday Check)
  const isFriday = Strategy.isExecutionDay();
  UI.renderHeader(isFriday);

  // 4. Fetch Market Data & Update
  try {
    await updateDashboard();
  } catch (e) {
    console.error("Critical Error in updateDashboard:", e);
  }

  // 5. Setup Event Listeners
  setupEventListeners();

  // 6. Setup Tooltip Click Toggle for Pulse Cards
  setupTooltipClickToggle();

  // 7. Start Rebalancing Countdown Timer
  updateRebalancingTimer();
  setInterval(updateRebalancingTimer, 60000); // Update every minute
}

// initChart moved to js/charts.js

// histogramChart and alphaCurveChart moved to js/charts.js

// updatePerformanceChart moved to js/charts.js

async function updateDashboard() {
  console.log("updateDashboard started");
  // 1. Fetch Data
  const rawData = await DataService.fetchMarketData();
  console.log("Data fetched:", rawData);

  // Check if server is still loading or data is empty
  if (
    !rawData ||
    rawData.status === "loading" ||
    Object.keys(rawData).length === 0
  ) {
    console.warn(
      "Server is loading data or not ready. Retrying in 3 seconds..."
    );
    UI.showToast("Fetching market data... (Server Warming Up)"); // Optional user feedback
    setTimeout(updateDashboard, 3000); // Retry logic
    return;
  }

  // 2. Process Data (Calculate Indicators)
  // Map raw history to indicators
  // We assume rawData returns objects like { price: 100, history: [...], dates: [...] }

  const processedMarketData = {};

  // Process each asset
  Object.keys(rawData).forEach((ticker) => {
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
      dates: data.dates || [], // Include dates from server!
      currency: data.currency || "KRW",
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
      mnavMSTR: rawData.MNAV_MSTR,
    },
    portfolio: portfolio,
  };

  // Debug
  console.log("Raw Data:", rawData);
  console.log("Processed:", processedMarketData);
  console.log(
    "Portfolio before update:",
    JSON.parse(JSON.stringify(portfolio))
  );

  // 3. Update Portfolio Values
  portfolio.forEach((asset) => {
    if (processedMarketData[asset.ticker]) {
      asset.price = processedMarketData[asset.ticker].price;
      asset.currency = processedMarketData[asset.ticker].currency;
    }

    // Calculate Value (Convert USD to KRW)
    let priceInKRW = asset.price;
    if (asset.currency === "USD") {
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
  portfolio.forEach((a) => (totalValue += a.value));

  // Assign weights for strategy
  portfolio.forEach((a) => {
    a.actualWeight = totalValue > 0 ? a.value / totalValue : 0;
  });

  const rebalanceActions = Strategy.checkRebalancing(portfolio);

  // 5. Render UI
  // Calculate Week-to-Date Return (WTD)
  // Uses fixed weekly cycle: Saturday 06:00 KST → Next Saturday 06:00 KST
  const wtdStatus = Finance.getWTDStatus(
    totalValue,
    processedMarketData,
    portfolio,
    portfolioHistory,
    FX_RATE
  );

  const portfolioWeeklyReturn = wtdStatus.wtdReturn;

  // Debug: Log WTD status
  console.log("WTD Status:", {
    return: portfolioWeeklyReturn.toFixed(2) + "%",
    baseNAV: wtdStatus.baseNAV,
    baseDate: wtdStatus.baseDate,
    period: wtdStatus.period,
    isFrozen: wtdStatus.isFrozen,
  });

  // 6. Save Daily Snapshot (for 1-year performance tracking)
  // Skip in simulation mode to keep real data isolated
  if (!isSimulationMode) {
    DataService.addSnapshot(portfolio, totalValue, 0);
  }

  // 7. Reconstruct Historical AUM from Logs + Price History
  const aumHistory = Finance.reconstructHistoricalAUM(
    portfolio,
    portfolioHistory,
    processedMarketData,
    FX_RATE
  );

  // 8. Get SPY benchmark data and normalize to match aumHistory dates
  let spyNormalized = [];
  let spyPricesMatched = [];

  if (
    processedMarketData.SPY &&
    processedMarketData.SPY.history &&
    processedMarketData.SPY.dates
  ) {
    const spyHistory = processedMarketData.SPY.history;
    const spyDates = processedMarketData.SPY.dates;

    // Build a date -> price map for SPY
    const spyPriceMap = {};
    spyDates.forEach((d, i) => {
      spyPriceMap[d] = spyHistory[i];
    });

    // Extract SPY prices that match aumHistory dates
    spyPricesMatched = aumHistory
      .map((item) => {
        const price = spyPriceMap[item.date];
        if (price !== undefined) return price;
        // Find nearest previous date if exact match not found
        for (let i = spyDates.length - 1; i >= 0; i--) {
          if (spyDates[i] <= item.date) {
            return spyHistory[i];
          }
        }
        return null;
      })
      .filter((p) => p !== null);

    // Normalize SPY to start at same value as portfolio
    const startAUM =
      aumHistory.length > 0 ? aumHistory[0].totalValue : totalValue;
    spyNormalized = Finance.normalizeToStartValue(spyPricesMatched, startAUM);
  }

  // Store global references for Sleep Score calculation
  window._globalAumHistory = aumHistory;
  window._globalMarketData = processedMarketData;
  window._globalSpyNormalized = spyNormalized;

  // 9. Calculate Risk-Free Rate from BIL Data
  const bilData = processedMarketData.BIL || null;
  const riskFreeRate = Finance.calculateRiskFreeRate(bilData, aumHistory);
  console.log("Using Risk-Free Rate:", (riskFreeRate * 100).toFixed(2) + "%");

  // 10. Calculate Performance Metrics from reconstructed history (with dynamic RF)
  const perfMetrics = Finance.calculatePerformanceMetrics(
    aumHistory,
    spyPricesMatched,
    riskFreeRate
  );

  // Debug: Log SPY metrics
  console.log("SPY Prices Matched:", spyPricesMatched.length, "days");
  console.log("Performance Metrics:", perfMetrics);

  // Calculate Weekly Returns for Sigma Gauge
  const weeklyReturns = Finance.calculateWeeklyReturns(aumHistory);
  const sigmaStats = Finance.getWeeklySigmaStats(weeklyReturns);
  console.log("Sigma Stats:", sigmaStats);

  // Calculate WoW (Week-over-Week) Delta for Identity metrics
  const wowDelta = Finance.calculateWoWDelta(aumHistory, spyPricesMatched, riskFreeRate);
  console.log("WoW Delta:", wowDelta);

  // Risk Metrics Object (use reconstructed data)
  const riskStats = {
    weeklyReturn: portfolioWeeklyReturn,
    wtdStatus: wtdStatus, // Include WTD status for UI display
    sigmaStats: sigmaStats, // Include sigma stats for Sigma Gauge
    cagr: perfMetrics.cagr !== null ? perfMetrics.cagr : 0.15,
    stdDev: perfMetrics.stdDev !== null ? perfMetrics.stdDev : 0.12,
    sharpe: perfMetrics.sharpe !== null ? perfMetrics.sharpe : 1.25,
    sortino: perfMetrics.sortino !== null ? perfMetrics.sortino : 1.8,
    beta: perfMetrics.beta !== null ? perfMetrics.beta : 0.85,
    mdd: perfMetrics.mdd !== null ? perfMetrics.mdd : 0,
  };

  // 10. Calculate 60MA for chart
  const ma60Data = Finance.calculateAUM_MA(aumHistory, 60);

  // 11. Calculate daily returns for bar chart
  const dailyReturns = Finance.calculateDailyReturnsFromAUM(aumHistory);

  // 11.5 Calculate benchmark returns array (for histogram/alpha curve)
  let benchmarkReturns = [];
  if (spyPricesMatched && spyPricesMatched.length > 1) {
    for (let i = 1; i < spyPricesMatched.length; i++) {
      if (spyPricesMatched[i - 1] > 0) {
        benchmarkReturns.push(
          (spyPricesMatched[i] - spyPricesMatched[i - 1]) /
            spyPricesMatched[i - 1]
        );
      }
    }
  }

  // 12. Update Performance Chart - pass perfMetrics and benchmark returns
  updatePerformanceChart(
    aumHistory,
    spyNormalized,
    ma60Data,
    dailyReturns,
    perfMetrics,
    benchmarkReturns
  );

  // Store globally for chart restoration when projection/hypothetical is toggled off
  window._globalAumHistory = aumHistory;
  window._globalSpyNormalized = spyNormalized;
  window._globalMa60Data = ma60Data;
  window._globalDailyReturns = dailyReturns;
  window._globalPerfMetrics = perfMetrics;
  window._globalBenchmarkReturns = benchmarkReturns;

  // Register callback for restoring original chart (used when turning off Hypothetical toggle)
  if (typeof setPerformanceChartRefreshCallback === 'function') {
    setPerformanceChartRefreshCallback(() => {
      updatePerformanceChart(
        window._globalAumHistory,
        window._globalSpyNormalized,
        window._globalMa60Data,
        window._globalDailyReturns,
        window._globalPerfMetrics,
        window._globalBenchmarkReturns
      );
    });
  }


  // 12.5 Calculate individual asset returns for Attribution Analysis
  // Now uses Cumulative Attribution based on actual historical holdings from Logs
  const assetReturns = Finance.buildExtendedAssetReturns(
    portfolio,
    processedMarketData,
    portfolioHistory,
    aumHistory,
    FX_RATE
  );
  console.log("Asset Returns (Extended):", assetReturns);

  // Store globally for toggle functionality
  window._assetReturns = assetReturns;
  window._currentViewMode = window._currentViewMode || '1w';

  // 12.6 Calculate Correlation Matrix (default: 1Y = 252 trading days)
  const correlationTickers = ['QQQ', 'DBMF', 'CSI300', 'TLT', 'GLDM', 'MSTR'];
  window._correlationTickers = correlationTickers;
  window._processedMarketData = processedMarketData;
  window._currentCorrView = window._currentCorrView || '1y';
  
  const corrLookback = { '3m': 60, '1y': 252, 'total': null };
  const corrData = Finance.calculateCorrelationMatrix(
    processedMarketData, 
    correlationTickers, 
    corrLookback[window._currentCorrView]
  );
  console.log("Correlation Matrix:", corrData);

  // 13. Render UI
  UI.renderAllocation(portfolio, allocationChart, assetReturns, window._currentViewMode);
  UI.renderSignals(sellSignals, buySignals, rebalanceActions);
  UI.renderConditions(processedMarketData, {
    zScoreMSTR,
    mnavMSTR: rawData.MNAV_MSTR,
    mvrvBTC: rawData.MVRV_BTC,
  });
  UI.renderRisk(riskStats);
  UI.renderWoWDelta(wowDelta);
  UI.renderCorrelationMatrix(corrData);
  
  // Render Performance Scorecard (Unified Metrics View)
  const fundMetrics = {
    cagr: perfMetrics.cagr,
    stdDev: perfMetrics.stdDev,
    sharpe: perfMetrics.sharpe,
    sortino: perfMetrics.sortino,
    mdd: perfMetrics.mdd,
    beta: perfMetrics.beta,
    correlation: perfMetrics.correlation
  };
  const bmMetrics = {
    cagr: perfMetrics.spyCagr,
    stdDev: perfMetrics.spyStdDev,
    sharpe: perfMetrics.spySharpe,
    sortino: perfMetrics.spySortino,
    mdd: perfMetrics.spyMdd
  };
  UI.renderPerformanceScorecard(fundMetrics, bmMetrics);
  
  // Render Risk Insights based on correlation data
  const periodLabel = { '3m': '3M', '1y': '1Y', 'total': 'Total' };
  UI.renderRiskInsights(corrData, periodLabel[window._currentCorrView] || '1Y');

  // 14.5 Load Stress Test Data (Psychological Forensics)
  // Lazy load - don't block main dashboard rendering
  loadStressTestData();

  // 14.6 Load Sleep Score Data (Psychological Forensics)
  loadSleepScoreData('total');

  // 14.7 Calculate and Render ROTI Badge
  loadROTIData(totalValue, portfolioHistory, aumHistory);

  // 14.8 Initialize Compound Vision Simulator
  const benchmarkCAGR = perfMetrics.spyCagr || 0.10; // SPY CAGR or fallback
  const portfolioMDD = perfMetrics.mdd || 0;
  const benchmarkMDD = perfMetrics.spyMdd || 0;
  initCompoundVision(totalValue, perfMetrics.cagr, benchmarkCAGR, portfolioMDD, benchmarkMDD);

  // 15. Apply Weekend Freeze Mode CSS classes
  applyWeekendFreezeMode(wtdStatus);
}

/**
 * Apply Weekend Freeze Mode CSS classes to body
 * @param {Object} wtdStatus - WTD status object from Finance.getWTDStatus()
 */
function applyWeekendFreezeMode(wtdStatus) {
  // Skip automatic freeze application in simulation mode
  // Note: Manual freeze via Ctrl+Shift+F still works (visual only)
  if (isSimulationMode) {
    // Don't remove existing freeze classes (might be manually set)
    // Just skip automatic application based on wtdStatus
    console.log(
      "✨ [Sim] Auto freeze skipped - manual freeze toggle still available"
    );
    return;
  }

  // Skip if we're restoring from simulation (let the restoration handle it)
  if (window._restoringFromSimulation) {
    console.log("📦 Skipping freeze mode apply - restoration in progress");
    return;
  }

  // Remove any existing freeze classes
  document.body.classList.remove("weekend-freeze", "positive", "negative");

  if (wtdStatus && wtdStatus.isFrozen) {
    // Add base freeze class
    document.body.classList.add("weekend-freeze");

    // Add sentiment class based on return
    if (wtdStatus.wtdReturn >= 0) {
      document.body.classList.add("positive");
      console.log("🌅 Weekend Freeze: Warm mode (positive return)");
    } else {
      document.body.classList.add("negative");
      console.log("🧊 Weekend Freeze: Cold mode (negative return)");
    }

    // Update Friday indicator text
    const fridayIndicator = document.getElementById("friday-indicator");
    if (fridayIndicator) {
      const icon = wtdStatus.wtdReturn >= 0 ? "🌅" : "❄️";
      fridayIndicator.innerHTML = `<span>${icon}</span><span>WEEK CLOSED</span>`;
    }
  }
}

/**
 * Load Stress Test Data (Psychological Forensics)
 * Async loader that doesn't block main dashboard rendering
 */
let _stressTestCache = null;
let _stressTestLoading = false;

async function loadStressTestData() {
  // Skip if already loading or cached
  if (_stressTestLoading) return;
  if (_stressTestCache) {
    UI.renderStressTest(_stressTestCache, '2020');
    return;
  }

  _stressTestLoading = true;
  console.log("📊 Loading stress test data...");

  try {
    const results = await Finance.fetchStressTestData();
    
    if (results) {
      _stressTestCache = results;
      UI.renderStressTest(results, '2020');
      console.log("✅ Stress test data loaded:", results);
    } else {
      console.warn("⚠️ Stress test data unavailable");
    }
  } catch (error) {
    console.error("❌ Stress test load error:", error);
  } finally {
    _stressTestLoading = false;
  }
}

/**
 * Load Sleep Score Data (Psychological Forensics)
 * Calculates Ulcer Index based Sleep Score for Portfolio vs SPY vs TQQQ
 */
let _sleepScoreCache = {};
let _currentSleepPeriod = 'total';

function loadSleepScoreData(period = 'total') {
  // Check if we have the required data
  if (!window._globalAumHistory || window._globalAumHistory.length < 10) {
    console.warn("🛏️ Sleep Score: Waiting for AUM history...");
    return;
  }

  if (!window._globalMarketData || !window._globalMarketData.SPY) {
    console.warn("🛏️ Sleep Score: Waiting for market data (SPY/TQQQ)...");
    return;
  }

  _currentSleepPeriod = period;

  // Check cache
  if (_sleepScoreCache[period]) {
    UI.renderSleepScore(_sleepScoreCache[period], period, handleSleepPeriodChange);
    return;
  }

  console.log(`🛏️ Calculating Sleep Score [${period}]...`);

  try {
    const result = Finance.calculateSleepScoreComparison(
      window._globalAumHistory,
      window._globalMarketData,
      period
    );

    if (result) {
      _sleepScoreCache[period] = result;
      UI.renderSleepScore(result, period, handleSleepPeriodChange);
      console.log("✅ Sleep Score calculated:", result);
    } else {
      console.warn("⚠️ Sleep Score calculation failed");
    }
  } catch (error) {
    console.error("❌ Sleep Score error:", error);
  }
}

/**
 * Handle Sleep Score period toggle
 */
function handleSleepPeriodChange(newPeriod) {
  _currentSleepPeriod = newPeriod;
  loadSleepScoreData(newPeriod);
}

/**
 * Load and Render ROTI (Return On Time Invested) Badge
 * @param {number} currentAUM - Current total AUM value
 * @param {Array} portfolioHistory - Logs array with Deposit/Withdraw entries
 */
let _rotiData = null;
let _rotiCurrency = 'KRW';

function loadROTIData(currentAUM, portfolioHistory, aumHistory) {
  if (!currentAUM || currentAUM <= 0) {
    console.warn("🕐 ROTI: No AUM data available");
    return;
  }

  console.log("🕐 Calculating ROTI...");

  try {
    // Calculate ROTI - pass aumHistory for inception AUM
    _rotiData = Finance.calculateROTI(currentAUM, portfolioHistory, aumHistory, '2024-03-12');

    if (_rotiData) {
      // Render with current currency preference
      UI.renderROTIBadge(_rotiData, _rotiCurrency, FX_RATE, handleROTICurrencyToggle);
      console.log("✅ ROTI Badge rendered");
    } else {
      console.warn("⚠️ ROTI calculation returned null (no investment data)");
    }
  } catch (error) {
    console.error("❌ ROTI error:", error);
  }
}

/**
 * Handle ROTI currency toggle
 * @param {string} newCurrency - 'KRW' or 'USD'
 */
function handleROTICurrencyToggle(newCurrency) {
  _rotiCurrency = newCurrency;
  if (_rotiData) {
    UI.renderROTIBadge(_rotiData, _rotiCurrency, FX_RATE, handleROTICurrencyToggle);
  }
}

/**
 * Compound Vision Simulator
 * Bidirectional Wealth Projector
 */
let _compoundVisionData = null;
let _cvProjectionEnabled = false;

function initCompoundVision(currentAUM, portfolioCAGR, benchmarkCAGR, portfolioMDD, benchmarkMDD) {
  // Store current values for recalculation
  window._cvCurrentAUM = currentAUM;
  window._cvPortfolioCAGR = portfolioCAGR;
  window._cvBenchmarkCAGR = benchmarkCAGR;
  window._cvPortfolioMDD = portfolioMDD;
  window._cvBenchmarkMDD = benchmarkMDD;

  // Set suggested milestone
  const suggestedTarget = Finance.suggestMilestone(currentAUM);
  const suggestedEl = document.getElementById('cv-suggested-target');
  if (suggestedEl) {
    suggestedEl.textContent = `Suggested: ₩${(suggestedTarget / 100000000).toFixed(1)}억`;
  }

  // Set default value in input
  const input = document.getElementById('cv-target-input');
  if (input && !input.value) {
    input.value = suggestedTarget;
  }

  console.log("🔮 Compound Vision initialized:", {
    currentAUM: currentAUM.toLocaleString(),
    portfolioCAGR: (portfolioCAGR * 100).toFixed(1) + '%',
    benchmarkCAGR: (benchmarkCAGR * 100).toFixed(1) + '%'
  });
}

function calculateAndDisplayCompoundVision(targetValue) {
  if (!targetValue || targetValue <= 0) {
    console.warn("Compound Vision: Invalid target value");
    return;
  }

  const currentAUM = window._cvCurrentAUM;
  const portfolioCAGR = window._cvPortfolioCAGR;
  const benchmarkCAGR = window._cvBenchmarkCAGR;
  const portfolioMDD = window._cvPortfolioMDD || 0;
  const benchmarkMDD = window._cvBenchmarkMDD || 0;

  if (!currentAUM || !portfolioCAGR) {
    console.warn("Compound Vision: Missing data. Run initCompoundVision first.");
    return;
  }

  // Calculate Compound Vision
  _compoundVisionData = Finance.calculateCompoundVision(
    currentAUM,
    targetValue,
    portfolioCAGR,
    benchmarkCAGR,
    portfolioMDD,
    benchmarkMDD
  );

  if (!_compoundVisionData) {
    console.warn("Compound Vision: Calculation failed (target may be <= current)");
    return;
  }

  // Update UI
  const resultEl = document.getElementById('cv-result');
  const primaryEl = document.getElementById('cv-primary');
  const secondaryEl = document.getElementById('cv-secondary');
  const portDateEl = document.getElementById('cv-port-date');
  const spyDateEl = document.getElementById('cv-spy-date');

  if (resultEl) {
    resultEl.classList.remove('hidden', 'win', 'lag');
    resultEl.classList.add(_compoundVisionData.portfolioWins ? 'win' : 'lag');
  }

  if (primaryEl) {
    primaryEl.textContent = _compoundVisionData.primaryMessage;
  }

  if (secondaryEl) {
    secondaryEl.textContent = _compoundVisionData.secondaryMessage;
  }

  if (portDateEl) {
    const portDate = _compoundVisionData.portfolioFinishDate;
    portDateEl.textContent = `Portfolio: ${portDate.getFullYear()}년 ${portDate.getMonth() + 1}월`;
  }

  if (spyDateEl) {
    const spyDate = _compoundVisionData.benchmarkFinishDate;
    spyDateEl.textContent = `SPY: ${spyDate.getFullYear()}년 ${spyDate.getMonth() + 1}월`;
  }

  // If projection toggle is on, update chart
  if (_cvProjectionEnabled) {
    updateChartWithProjection(_compoundVisionData);
  }

  console.log("✅ Compound Vision calculated:", _compoundVisionData);
}

function updateChartWithProjection(cvData) {
  // Store for reference
  window._cvProjectionData = cvData;
  
  // Call the chart update function
  if (typeof updatePerformanceChartProjection === 'function') {
    updatePerformanceChartProjection(cvData);
  } else {
    console.warn("updatePerformanceChartProjection function not found");
  }
}

function setupCompoundVisionListeners() {
  const input = document.getElementById('cv-target-input');
  const projectionToggle = document.getElementById('cv-projection-toggle');
  const resultToggle = document.getElementById('cv-result-toggle');
  const resultPanel = document.getElementById('cv-result');

  // Helper: Format number with commas
  const formatWithCommas = (value) => {
    const num = value.replace(/,/g, '').replace(/[^0-9]/g, '');
    if (!num) return '';
    return parseInt(num).toLocaleString();
  };

  // Helper: Get raw number from formatted string
  const getRawNumber = (value) => {
    return parseFloat(value.replace(/,/g, '')) || 0;
  };

  // Debounce helper
  let debounceTimer;
  const debounce = (func, delay) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(func, delay);
  };

  // Auto-update chart when input changes (if projection is enabled)
  const handleInputChange = () => {
    const targetValue = getRawNumber(input.value);
    const currentAUM = window._cvCurrentAUM || 0;

    // Only update if target > current AUM and projection is enabled
    if (targetValue > currentAUM && _cvProjectionEnabled) {
      calculateAndDisplayCompoundVision(targetValue);
      updateChartWithProjection(_compoundVisionData);
    } else if (_cvProjectionEnabled) {
      // Clear projection if target <= current AUM
      updatePerformanceChartProjection(null);
    }
  };

  if (input) {
    // Auto-format on input
    input.addEventListener('input', (e) => {
      const cursorPos = e.target.selectionStart;
      const oldLength = e.target.value.length;
      const formatted = formatWithCommas(e.target.value);
      e.target.value = formatted;
      
      // Adjust cursor position after formatting
      const newLength = formatted.length;
      const posDiff = newLength - oldLength;
      e.target.setSelectionRange(cursorPos + posDiff, cursorPos + posDiff);

      // Debounced chart update
      debounce(handleInputChange, 500);
    });

    // Format initial value if present
    if (input.value) {
      input.value = formatWithCommas(input.value);
    }
  }

  // Show Projection Toggle
  if (projectionToggle) {
    projectionToggle.addEventListener('change', (e) => {
      _cvProjectionEnabled = e.target.checked;
      
      if (_cvProjectionEnabled) {
        const targetValue = getRawNumber(input.value);
        const currentAUM = window._cvCurrentAUM || 0;
        
        if (targetValue > currentAUM) {
          calculateAndDisplayCompoundVision(targetValue);
          updateChartWithProjection(_compoundVisionData);
        }
      } else {
        // Clear projection and restore original chart
        window._cvProjectionData = null;
        // Trigger chart rebuild with original data
        if (window._globalAumHistory && window._globalSpyNormalized && window._globalMa60Data) {
          updatePerformanceChart(
            window._globalAumHistory,
            window._globalSpyNormalized,
            window._globalMa60Data,
            window._globalDailyReturns || [],
            window._globalPerfMetrics || {},
            window._globalBenchmarkReturns || []
          );
        }
      }
      
      console.log("🔮 Show Projection:", _cvProjectionEnabled ? 'ON' : 'OFF');
    });
  }

  // Expected Result Toggle
  if (resultToggle && resultPanel) {
    resultToggle.addEventListener('change', (e) => {
      const showResult = e.target.checked;
      
      if (showResult) {
        // Calculate if not already done
        const targetValue = getRawNumber(input.value);
        const currentAUM = window._cvCurrentAUM || 0;
        
        if (targetValue > currentAUM) {
          calculateAndDisplayCompoundVision(targetValue);
          resultPanel.classList.remove('hidden');
        } else {
          // Can't show result if target <= current AUM
          resultPanel.classList.add('hidden');
          e.target.checked = false;
          console.log("⚠️ Target must be greater than current AUM");
        }
      } else {
        resultPanel.classList.add('hidden');
      }
      
      console.log("📊 Expected Result:", showResult ? 'ON' : 'OFF');
    });
  }
}

function setupEventListeners() {
  const modal = document.getElementById("edit-modal");
  const closeBtn = document.getElementById("close-modal-btn");
  const form = document.getElementById("holdings-form");

  // Setup Compound Vision Simulator listeners
  setupCompoundVisionListeners();

  // Allocation View Toggle (1W / Total)
  const viewToggle = document.getElementById("allocation-view-toggle");
  if (viewToggle) {
    viewToggle.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active state
        viewToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Get view mode
        const viewMode = btn.dataset.view;
        window._currentViewMode = viewMode;

        // Re-render allocation table with new view mode
        if (window._assetReturns) {
          UI.renderAllocation(portfolio, allocationChart, window._assetReturns, viewMode);
        }
      });
    });
  }

  // Correlation Matrix View Toggle (3M / 1Y / Total)
  const corrToggle = document.getElementById("correlation-view-toggle");
  if (corrToggle) {
    corrToggle.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active state
        corrToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Get view mode and update title
        const viewMode = btn.dataset.view;
        window._currentCorrView = viewMode;

        const titleEl = document.getElementById('corr-matrix-title');
        if (titleEl) {
          const titles = { '3m': '3M CORRELATION', '1y': '1Y CORRELATION', 'total': 'TOTAL CORRELATION' };
          titleEl.textContent = titles[viewMode] || 'CORRELATION INTELLIGENCE';
        }

        // Recalculate and render correlation matrix + risk insights
        if (window._processedMarketData && window._correlationTickers) {
          const lookback = { '3m': 60, '1y': 252, 'total': null };
          const corrData = Finance.calculateCorrelationMatrix(
            window._processedMarketData,
            window._correlationTickers,
            lookback[viewMode]
          );
          UI.renderCorrelationMatrix(corrData);
          
          // Update Risk Insights with new period
          const periodLabel = { '3m': '3M', '1y': '1Y', 'total': 'Total' };
          UI.renderRiskInsights(corrData, periodLabel[viewMode] || '1Y');
        }
      });
    });
  }

  // Sidebar Toggle
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");

  if (sidebarToggle && sidebar) {
    // Restore state from localStorage
    const isCollapsed = localStorage.getItem("sidebar_collapsed") === "true";
    if (isCollapsed) {
      sidebar.classList.add("collapsed");
    }

    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      const nowCollapsed = sidebar.classList.contains("collapsed");
      localStorage.setItem("sidebar_collapsed", nowCollapsed);

      // Re-render Lucide icons after toggle
      if (typeof lucide !== "undefined") {
        setTimeout(() => lucide.createIcons(), 300);
      }
    });
  }

  // Developer Shortcut: Ctrl+Shift+F to toggle Freeze mode
  // Cycles: Normal → Warm → Cold → Normal
  // NOTE: In Simulation Mode, this only toggles visual effects (no data impact)
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault(); // Prevent browser's find function

      const body = document.body;
      const hasFreeze = body.classList.contains("weekend-freeze");
      const isPositive = body.classList.contains("positive");
      const isNegative = body.classList.contains("negative");

      // Determine current state and cycle to next
      if (!hasFreeze) {
        // Normal → Warm
        body.classList.add("weekend-freeze", "positive");
        if (isSimulationMode) {
          UI.showToast("🌅 [SIM] Warm Freeze 시각 효과 (저장 영향 없음)");
          console.log("✨ [Sim] Freeze Toggle: Normal → Warm (visual only)");
        } else {
          UI.showToast('<i data-lucide="sunrise" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px;"></i> DEV: Warm Freeze 활성화');
          console.log("🎹 Freeze Toggle: Normal → Warm");
        }
      } else if (isPositive) {
        // Warm → Cold
        body.classList.remove("positive");
        body.classList.add("negative");
        if (isSimulationMode) {
          UI.showToast("🧊 [SIM] Cold Freeze 시각 효과 (저장 영향 없음)");
          console.log("✨ [Sim] Freeze Toggle: Warm → Cold (visual only)");
        } else {
          UI.showToast('<i data-lucide="snowflake" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px;"></i> DEV: Cold Freeze 활성화');
          console.log("🎹 Freeze Toggle: Warm → Cold");
        }
      } else if (isNegative) {
        // Cold → Normal
        body.classList.remove("weekend-freeze", "negative");
        if (isSimulationMode) {
          UI.showToast("🔄 [SIM] Normal 모드 복귀");
          console.log("✨ [Sim] Freeze Toggle: Cold → Normal (visual only)");
        } else {
          UI.showToast('<i data-lucide="refresh-cw" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px;"></i> DEV: Normal 모드 복귀');
          console.log("🎹 Freeze Toggle: Cold → Normal");
        }
      }
    }
  });

  // Sidebar: Page Navigation (Scroll)
  document.querySelectorAll(".nav-item[data-target]").forEach((item) => {
    item.addEventListener("click", (e) => {
      // Active State
      document
        .querySelectorAll(".nav-item")
        .forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      // Scroll
      const targetId = item.dataset.target;
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // Sidebar: Modal Triggers (Settings only - no highlight)
  const settingsBtn = document.getElementById("nav-settings");

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      // Do NOT add active state for Settings (no blue highlight)
      modal.classList.remove("hidden");
      renderEditForm();
      switchTab("holdings");
    });
  }

  // Modal Close
  closeBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  // Modal Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      switchTab(e.target.dataset.tab);
    });
  });

  // Form Submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    saveEditForm();
    modal.classList.add("hidden");
    // Reset sidebar active to current section logic if needed (optional)
  });

  // ===================================
  // SIMULATION MODE EVENT LISTENERS
  // ===================================
  const simToggleBtn = document.getElementById("sim-mode-toggle");
  const simBanner = document.getElementById("sim-mode-banner");
  const exitSimBtn = document.getElementById("exit-sim-mode");
  const simEntryModal = document.getElementById("sim-entry-modal");
  const simEntryConfirm = document.getElementById("sim-entry-confirm");
  const simEntryCancel = document.getElementById("sim-entry-cancel");

  // Show entry modal when clicking toggle (if not in sim mode)
  if (simToggleBtn) {
    simToggleBtn.addEventListener("click", () => {
      if (!isSimulationMode) {
        // Show the mystical entry modal
        showSimEntryModal();
      } else {
        exitSimulationMode();
      }
    });
  }

  // Confirm entry - actually enter simulation mode
  if (simEntryConfirm) {
    simEntryConfirm.addEventListener("click", () => {
      hideSimEntryModal();
      enterSimulationMode();
    });
  }

  // Cancel entry - just close modal
  if (simEntryCancel) {
    simEntryCancel.addEventListener("click", () => {
      hideSimEntryModal();
    });
  }

  // Exit from banner button
  if (exitSimBtn) {
    exitSimBtn.addEventListener("click", () => {
      exitSimulationMode();
    });
  }

  // ===================================
  // FUND TITLE EDITABLE (Double-click)
  // ===================================
  const fundTitle = document.getElementById("fund-title");
  if (fundTitle) {
    // Load saved title from localStorage
    const savedTitle = localStorage.getItem("jg_fund_title");
    if (savedTitle) {
      fundTitle.textContent = savedTitle;
    }

    // Double-click to edit
    fundTitle.addEventListener("dblclick", () => {
      const currentTitle = fundTitle.textContent;

      // Create editable input
      const input = document.createElement("input");
      input.type = "text";
      input.value = currentTitle;
      input.className = "fund-title-input";
      input.style.cssText = `
                font-family: var(--font-head);
                font-size: 1.2rem;
                letter-spacing: 1px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid var(--neon-cyan);
                border-radius: 4px;
                color: white;
                padding: 4px 8px;
                width: 100%;
                outline: none;
            `;

      // Replace title with input
      fundTitle.textContent = "";
      fundTitle.appendChild(input);
      input.focus();
      input.select();

      // Save on Enter or blur
      const saveTitle = () => {
        const newTitle = input.value.trim() || "진근 Index Fund";
        fundTitle.textContent = newTitle;
        localStorage.setItem("jg_fund_title", newTitle);
      };

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveTitle();
        } else if (e.key === "Escape") {
          fundTitle.textContent = currentTitle;
        }
      });

      input.addEventListener("blur", saveTitle);
    });

    // Cursor style
    fundTitle.style.cursor = "pointer";
  }
}

function renderEditForm() {
  const form = document.getElementById("holdings-form");
  form.innerHTML = "";
  form.classList.add("form-grid"); // Enable 2-column grid

  portfolio.forEach((asset, index) => {
    const card = document.createElement("div");
    card.className = "input-card";
    card.innerHTML = `
            <label class="input-label">${asset.ticker}</label>
            <input type="number" step="0.000001" name="shares-${index}" value="${asset.shares}" class="stylish-input" placeholder="0.000000">
        `;
    form.appendChild(card);
  });
}

function switchTab(tabName) {
  // 1. Update Buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    if (btn.dataset.tab === tabName) btn.classList.add("active");
    else btn.classList.remove("active");
  });

  // 2. Update Content
  const holdingsTab = document.getElementById("tab-holdings");
  const historyTab = document.getElementById("tab-history");
  const dataTab = document.getElementById("tab-data");

  // Hide all tabs first
  holdingsTab.classList.add("hidden");
  historyTab.classList.add("hidden");
  if (dataTab) dataTab.classList.add("hidden");

  if (tabName === "holdings") {
    holdingsTab.classList.remove("hidden");
    renderEditForm(); // Refresh Inputs
  } else if (tabName === "history") {
    historyTab.classList.remove("hidden");
    refreshHistoryView();
  } else if (tabName === "data") {
    if (dataTab) {
      dataTab.classList.remove("hidden");
      renderDataTab();
    }
  }
}

function renderDataTab() {
  const summaryEl = document.getElementById("data-summary");
  const summary = DataService.getDataSummary();

  // Format dates
  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  summaryEl.innerHTML = `
        <div class="summary-item">
            <div class="summary-label"><i data-lucide="calendar-plus" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i>Tracking Since</div>
            <div class="summary-value">${formatDate(summary.oldestSnapshot)}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label"><i data-lucide="file-text" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i>Log Events</div>
            <div class="summary-value">${summary.historyCount}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label"><i data-lucide="bar-chart-2" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i>Weekly Snapshots</div>
            <div class="summary-value">${summary.weeklySnapshots}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label"><i data-lucide="activity" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i>Data Health</div>
            <div class="summary-value ${summary.dataHealth === 'Excellent' ? 'positive' : summary.dataHealth === 'Low Data' || summary.dataHealth === 'Stale' ? 'negative' : ''}">${summary.dataHealth}</div>
        </div>
    `;

  // Re-render Lucide icons
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  // Setup Export Handler
  const exportBtn = document.getElementById("export-data-btn");
  if (exportBtn) {
    exportBtn.onclick = () => {
      // Pass simulation mode flag to export function
      DataService.exportAllData(isSimulationMode);
      if (isSimulationMode) {
        UI.showToast(
          "✨ [SIMULATION] 백업 완료 → 03_Backup_Data 폴더로 이동하세요"
        );
      } else {
        UI.showToast('<i data-lucide="check-circle" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px;"></i> 백업 완료 → 03_Backup_Data 폴더로 이동하세요');
      }
    };
  }

  // Setup Import Handler
  const importZone = document.getElementById("import-zone");
  const importInput = document.getElementById("import-file-input");
  const importStatus = document.getElementById("import-status");

  if (importZone && importInput) {
    // Click to select file
    importZone.onclick = () => importInput.click();

    // File selected
    importInput.onchange = (e) => handleImportFile(e.target.files[0]);

    // Drag & Drop
    importZone.ondragover = (e) => {
      e.preventDefault();
      importZone.classList.add("drag-over");
    };
    importZone.ondragleave = () => {
      importZone.classList.remove("drag-over");
    };
    importZone.ondrop = (e) => {
      e.preventDefault();
      importZone.classList.remove("drag-over");
      if (e.dataTransfer.files.length > 0) {
        handleImportFile(e.dataTransfer.files[0]);
      }
    };
  }

  function handleImportFile(file) {
    if (!file || !file.name.endsWith(".json")) {
      showImportStatus("Please select a valid JSON file", false);
      return;
    }

    if (
      !confirm(
        "⚠️ All existing data will be replaced!\n\nAre you sure you want to import this backup?"
      )
    ) {
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
    importStatus.className = "import-status " + (success ? "success" : "error");
    importStatus.classList.remove("hidden");
  }
}

function refreshHistoryView() {
  // Sort history by date descending for display
  const sortedHistory = [...portfolioHistory].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  UI.renderHistoryTab(
    sortedHistory,
    // onAddClick
    () => {
      UI.renderEventTypeSelection((selectedType) => {
        UI.renderEventInputForm(
          selectedType,
          portfolio,
          (eventData, isEdit) => {
            if (isSimulationMode) {
              // Simulation mode - update sim state only
              simPortfolioHistory.push(eventData);
              portfolioHistory = JSON.parse(
                JSON.stringify(simPortfolioHistory)
              );
              console.log("✨ [Sim] Log added to simulation state");
            } else {
              // Normal mode - save to localStorage
              portfolioHistory.push(eventData);
              DataService.saveHistory(portfolioHistory);
            }

            // Update Holdings based on event type
            applyEventToHoldings(eventData);

            goBackToHistoryList();
            refreshHistoryView();
            updateDashboard(); // Refresh dashboard with new holdings
          }
        );
        // Setup auto-calculation for new types
        if (selectedType === "SwitchAuto") {
          setupSwitchAutoCalculation();
        } else if (
          selectedType === "DepositAuto" ||
          selectedType === "WithdrawAuto"
        ) {
          setupAutoDistributionCalculation(selectedType);
        } else if (selectedType === "RebalancingAuto") {
          setupRebalancingAutoCalculation();
        }
      });
    },
    // onEditClick
    (item, displayIndex) => {
      // Find actual index in original array by ID
      const actualIndex = portfolioHistory.findIndex((h) => h.id === item.id);
      UI.renderEventInputForm(
        item.type,
        portfolio,
        (eventData, isEdit) => {
          if (actualIndex >= 0) {
            portfolioHistory[actualIndex] = eventData;
          } else {
            portfolioHistory.push(eventData);
          }

          if (isSimulationMode) {
            // Simulation mode - update sim state only
            simPortfolioHistory = JSON.parse(JSON.stringify(portfolioHistory));
            console.log("✨ [Sim] Log edited in simulation state");
          } else {
            // Normal mode - save to localStorage
            DataService.saveHistory(portfolioHistory);
          }

          goBackToHistoryList();
          refreshHistoryView();
        },
        item
      );
    },
    // onDeleteClick
    (displayIndex) => {
      const item = sortedHistory[displayIndex];
      const actualIndex = portfolioHistory.findIndex((h) => h.id === item.id);
      if (actualIndex >= 0) {
        // Show confirmation warning
        const confirmDelete = confirm(
          "⚠️ 이 로그를 삭제하시겠습니까?\n\n" +
            "Performance의 추적기록이 바뀝니다!"
        );

        if (confirmDelete) {
          portfolioHistory.splice(actualIndex, 1);

          if (isSimulationMode) {
            // Simulation mode - update sim state only
            simPortfolioHistory = JSON.parse(JSON.stringify(portfolioHistory));
            console.log("✨ [Sim] Log deleted in simulation state");
          } else {
            // Normal mode - save to localStorage
            DataService.saveHistory(portfolioHistory);
          }

          refreshHistoryView();
        }
      }
    }
  );
}

function goBackToHistoryList() {
  const listEl = document.getElementById("history-log-list");
  const controlsEl = document.getElementById("history-controls");
  const creationEl = document.getElementById("event-creation-container");
  if (listEl) listEl.style.display = "block";
  if (controlsEl) controlsEl.classList.remove("hidden");
  if (creationEl) creationEl.classList.add("hidden");
}

function saveEditForm() {
  const inputs = document.querySelectorAll("#holdings-form input");

  if (isSimulationMode) {
    // In simulation mode, update simPortfolio instead
    inputs.forEach((input, index) => {
      simPortfolio[index].shares = parseFloat(input.value);
    });
    // Also update the working portfolio reference for immediate UI update
    portfolio = JSON.parse(JSON.stringify(simPortfolio));
    console.log("✨ [Sim] Holdings updated in simulation state");
  } else {
    // Normal mode - save to localStorage
    inputs.forEach((input, index) => {
      portfolio[index].shares = parseFloat(input.value);
    });
    DataService.savePortfolio(portfolio);
  }

  updateDashboard(); // Re-calc with new shares
}

/**
 * Setup Asset Switch (Auto) calculation
 * When FROM/TO assets are selected, auto-calculate shares
 */
async function setupSwitchAutoCalculation() {
  const fromAssetSelect = document.getElementById("switch-from-asset");
  const toAssetSelect = document.getElementById("switch-to-asset");
  const fromSharesInput = document.getElementById("switch-from-shares");
  const toSharesInput = document.getElementById("switch-to-shares");

  if (!fromAssetSelect || !toAssetSelect) return;

  // Fetch market data and exchange rate
  const marketData = await DataService.fetchMarketData();
  const exchangeRate = await DataService.fetchExchangeRate();

  const calculateSwitch = () => {
    const fromTicker = fromAssetSelect.value;
    const toTicker = toAssetSelect.value;

    // Find FROM asset in portfolio
    const fromAsset = portfolio.find((a) => a.ticker === fromTicker);
    const toAssetInfo = portfolio.find((a) => a.ticker === toTicker);

    if (!fromAsset || !toAssetInfo) return;

    // Set FROM shares from current holdings
    const fromShares = fromAsset.shares || 0;
    fromSharesInput.value = fromShares;

    // Get prices from market data
    const fromData = marketData[fromTicker];
    const toData = marketData[toTicker];

    if (!fromData || !toData) {
      toSharesInput.value = "";
      return;
    }

    // Calculate FROM value in KRW
    let fromValueKRW = fromShares * fromData.price;
    if (fromData.currency === "USD") {
      fromValueKRW = fromShares * fromData.price * exchangeRate;
    }

    // Calculate TO shares
    let toPrice = toData.price;
    if (toData.currency === "USD") {
      toPrice = toData.price * exchangeRate;
    }

    let toShares = fromValueKRW / toPrice;

    // Apply decimal rules
    toShares = applySharesDecimalRule(toTicker, toShares);

    toSharesInput.value = toShares;
  };

  // Listen for changes
  fromAssetSelect.addEventListener("change", calculateSwitch);
  toAssetSelect.addEventListener("change", calculateSwitch);

  // Initial calculation
  calculateSwitch();

  // Setup MSTR signal verification
  setupMSTRSignalVerification();
}

/**
 * Setup Auto Distribution calculation for Deposit/Withdraw
 */
async function setupAutoDistributionCalculation(type) {
  const amountInput = document.getElementById("auto-total-amount");
  const previewEl = document.getElementById("auto-distribution-preview");

  if (!amountInput || !previewEl) return;

  // Fetch market data and exchange rate
  const marketData = await DataService.fetchMarketData();
  const exchangeRate = await DataService.fetchExchangeRate();

  // Calculate Actual Weights
  let totalValue = 0;
  portfolio.forEach((asset) => {
    const md = marketData[asset.ticker];
    if (md) {
      let priceKRW = md.price;
      if (md.currency === "USD") {
        priceKRW = md.price * exchangeRate;
      }
      asset._currentValue = asset.shares * priceKRW;
      asset._priceKRW = priceKRW;
      asset._priceOriginal = md.price;
      asset._currency = md.currency;
      totalValue += asset._currentValue;
    }
  });

  portfolio.forEach((asset) => {
    asset._actualWeight = totalValue > 0 ? asset._currentValue / totalValue : 0;
  });

  const calculateDistribution = () => {
    const totalAmount = parseFloat(amountInput.value) || 0;

    if (totalAmount <= 0) {
      previewEl.innerHTML =
        '<div class="preview-hint">금액을 입력하면 분배 결과가 표시됩니다</div>';
      delete previewEl.dataset.transactions;
      return;
    }

    const transactions = [];
    let previewHTML = '<div class="distribution-table">';
    previewHTML +=
      '<div class="dist-header"><span>자산</span><span>비율</span><span>금액</span><span>Shares</span></div>';

    portfolio.forEach((asset) => {
      if (asset._actualWeight > 0) {
        const allocatedKRW = totalAmount * asset._actualWeight;
        let shares = allocatedKRW / asset._priceKRW;

        // Apply decimal rules
        shares = applySharesDecimalRule(asset.ticker, shares);

        if (shares > 0) {
          transactions.push({
            asset: asset.ticker,
            shares: shares,
          });

          previewHTML += `
                        <div class="dist-row">
                            <span class="dist-ticker">${asset.ticker}</span>
                            <span class="dist-weight">${(
                              asset._actualWeight * 100
                            ).toFixed(1)}%</span>
                            <span class="dist-amount">₩${Math.round(
                              allocatedKRW
                            ).toLocaleString()}</span>
                            <span class="dist-shares">${shares}</span>
                        </div>
                    `;
        }
      }
    });

    previewHTML += "</div>";
    previewEl.innerHTML = previewHTML;
    previewEl.dataset.transactions = JSON.stringify(transactions);
  };

  // Listen for input changes
  amountInput.addEventListener("input", calculateDistribution);
}

/**
 * Apply decimal rules for shares calculation
 * - 해외주식 (CTA, VBIL 제외): 소수점 6자리
 * - CTA, VBIL, 국내상장 주식: 정수 (반올림)
 */
function applySharesDecimalRule(ticker, shares) {
  // Korean-listed tickers (KRW currency assets)
  const koreanTickers = ["QQQ", "CSI300", "TLT", "NIFTY", "BIL"];
  // CTA and VBIL also require integer shares
  const roundToIntegerTickers = ["DBMF", "VBIL", ...koreanTickers];

  if (roundToIntegerTickers.includes(ticker)) {
    return Math.round(shares);
  } else {
    // Overseas stocks (except CTA): 6 decimal places
    return parseFloat(shares.toFixed(6));
  }
}

// Account group definitions
const ACCOUNT_GROUPS = {
  domestic: ["QQQ", "CSI300", "TLT", "NIFTY", "BIL"],
  overseas: ["DBMF", "GLDM", "MSTR", "PFIX", "VBIL"],
};

function getAccountGroup(ticker) {
  if (ACCOUNT_GROUPS.domestic.includes(ticker)) return "domestic";
  if (ACCOUNT_GROUPS.overseas.includes(ticker)) return "overseas";
  return "unknown";
}

/**
 * MSTR Signal Criteria
 */
const MSTR_SIGNALS = {
  riskOff: {
    trigger: (mnav, zscore) => mnav > 2.8 || zscore > 4.5,
    return: (mnav, zscore) => mnav < 1.8 || zscore < 2.2,
  },
  riskOn: {
    trigger: (mnav, zscore) => mnav < 1.3 && zscore < 0.5,
    return: (mnav, zscore) => mnav > 2.0 || zscore > 2.0,
  },
};

/**
 * Verify MSTR signal based on user-provided MNAV and Z-Score
 */
function verifyMSTRSignal(mnav, zscore, direction) {
  // direction: 'sell' (MSTR -> other) or 'buy' (other -> MSTR)
  if (direction === "sell") {
    // Risk Off trigger: MNAV > 2.8 OR Z-Score > 4.5
    return MSTR_SIGNALS.riskOff.trigger(mnav, zscore);
  } else if (direction === "buy") {
    // Risk On trigger: MNAV < 1.3 AND Z-Score < 0.5
    return MSTR_SIGNALS.riskOn.trigger(mnav, zscore);
  }
  return false;
}

/**
 * Apply event to Holdings (update portfolio)
 */
function applyEventToHoldings(eventData) {
  const type = eventData.type;
  const transactions = eventData.transactions || [];

  if (type === "Switch" || type === "Rebalancing") {
    transactions.forEach((t) => {
      const fromAsset = portfolio.find((a) => a.ticker === t.fromAsset);
      const toAsset = portfolio.find((a) => a.ticker === t.toAsset);
      if (fromAsset) {
        fromAsset.shares = Math.max(
          0,
          (fromAsset.shares || 0) - (t.fromShares || 0)
        );
      }
      if (toAsset) {
        toAsset.shares = (toAsset.shares || 0) + (t.toShares || 0);
      }
    });
  } else if (type === "Deposit") {
    transactions.forEach((t) => {
      const asset = portfolio.find((a) => a.ticker === t.asset);
      if (asset) {
        asset.shares = (asset.shares || 0) + (t.shares || 0);
      }
    });
  } else if (type === "Withdraw") {
    transactions.forEach((t) => {
      const asset = portfolio.find((a) => a.ticker === t.asset);
      if (asset) {
        asset.shares = Math.max(0, (asset.shares || 0) - (t.shares || 0));
      }
    });
  }

  // Save updated portfolio
  DataService.savePortfolio(portfolio);
}

/**
 * Setup MSTR signal verification in Asset Switch (Auto)
 */
function setupMSTRSignalVerification() {
  const fromSelect = document.getElementById("switch-from-asset");
  const toSelect = document.getElementById("switch-to-asset");
  const signalPanel = document.getElementById("mstr-signal-panel");
  const mnavInput = document.getElementById("mstr-mnav-input");
  const zscoreInput = document.getElementById("mstr-zscore-input");
  const signalResult = document.getElementById("mstr-signal-result");
  const verifyBtn = document.getElementById("verify-signal-btn");
  const saveBtn = document.getElementById("save-log-btn");

  if (!signalPanel) return;

  let mstrVerified = false;
  let mstrDirection = null;

  const checkMSTRInvolved = () => {
    const fromTicker = fromSelect?.value;
    const toTicker = toSelect?.value;

    if (fromTicker === "MSTR") {
      mstrDirection = "sell";
      signalPanel.classList.remove("hidden");
      saveBtn.disabled = true;
    } else if (toTicker === "MSTR") {
      mstrDirection = "buy";
      signalPanel.classList.remove("hidden");
      saveBtn.disabled = true;
    } else {
      mstrDirection = null;
      signalPanel.classList.add("hidden");
      saveBtn.disabled = false;
      mstrVerified = false;
    }
  };

  const updateSignalDisplay = () => {
    const mnav = parseFloat(mnavInput?.value) || 0;
    const zscore = parseFloat(zscoreInput?.value) || 0;

    if (!mnav || !zscore) {
      signalResult.innerHTML =
        '<div class="signal-check">MNAV/Z-Score를 입력하세요</div>';
      verifyBtn.disabled = true;
      return;
    }

    verifyBtn.disabled = false;

    const riskOffTrigger = MSTR_SIGNALS.riskOff.trigger(mnav, zscore);
    const riskOnTrigger = MSTR_SIGNALS.riskOn.trigger(mnav, zscore);

    signalResult.innerHTML = `
            <div class="signal-section">
                <div class="signal-label">RISK OFF (매도):</div>
                <div class="signal-criteria">
                    MNAV > 2.8: ${mnav > 2.8 ? "✅" : "❌"} | Z-Score > 4.5: ${
      zscore > 4.5 ? "✅" : "❌"
    }
                </div>
                <div class="signal-verdict ${riskOffTrigger ? "active" : ""}">
                    → 매도 시그널: ${riskOffTrigger ? "✅ 발동" : "❌ 미발동"}
                </div>
            </div>
            <div class="signal-section">
                <div class="signal-label">RISK ON (매수):</div>
                <div class="signal-criteria">
                    MNAV < 1.3: ${mnav < 1.3 ? "✅" : "❌"} | Z-Score < 0.5: ${
      zscore < 0.5 ? "✅" : "❌"
    }
                </div>
                <div class="signal-verdict ${riskOnTrigger ? "active" : ""}">
                    → 매수 시그널: ${
                      riskOnTrigger
                        ? "✅ 발동 (두 조건 모두 만족)"
                        : "❌ 미발동"
                    }
                </div>
            </div>
        `;
  };

  verifyBtn?.addEventListener("click", () => {
    const mnav = parseFloat(mnavInput?.value) || 0;
    const zscore = parseFloat(zscoreInput?.value) || 0;

    const signalValid = verifyMSTRSignal(mnav, zscore, mstrDirection);

    if (signalValid) {
      mstrVerified = true;
      saveBtn.disabled = false;
      UI.showToast('<i data-lucide="check-circle" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px;"></i> 시그널 검증 완료! 저장 가능합니다.');
    } else {
      mstrVerified = false;
      saveBtn.disabled = true;
      UI.showToast('<i data-lucide="x-circle" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px;"></i> 시그널 조건이 충족되지 않습니다.');
    }
  });

  fromSelect?.addEventListener("change", checkMSTRInvolved);
  toSelect?.addEventListener("change", checkMSTRInvolved);
  mnavInput?.addEventListener("input", updateSignalDisplay);
  zscoreInput?.addEventListener("input", updateSignalDisplay);

  checkMSTRInvolved();
}

/**
 * Setup Rebalancing (Auto) calculation
 */
async function setupRebalancingAutoCalculation() {
  const detectionList = document.getElementById("detection-list");
  const tradesList = document.getElementById("trades-list");
  const saveBtn = document.getElementById("save-rebalancing-btn");
  const accountModeRadios = document.querySelectorAll(
    'input[name="accountMode"]'
  );

  if (!detectionList || !tradesList) return;

  // Fetch market data and exchange rate
  const marketData = await DataService.fetchMarketData();
  const exchangeRate = await DataService.fetchExchangeRate();

  // Calculate current values and weights
  let totalValue = 0;
  portfolio.forEach((asset) => {
    const md = marketData[asset.ticker];
    if (md) {
      let priceKRW = md.price;
      if (md.currency === "USD") {
        priceKRW = md.price * exchangeRate;
      }
      asset._currentValue = asset.shares * priceKRW;
      asset._priceKRW = priceKRW;
      asset._currency = md.currency;
      totalValue += asset._currentValue;
    }
  });

  portfolio.forEach((asset) => {
    asset._actualWeight = totalValue > 0 ? asset._currentValue / totalValue : 0;
    // Calculate relative deviation: |Actual - Target| / Target
    if (asset.targetWeight > 0) {
      asset._relativeDeviation =
        Math.abs(asset._actualWeight - asset.targetWeight) / asset.targetWeight;
    } else {
      asset._relativeDeviation = asset._actualWeight > 0 ? 1 : 0; // 100% deviation if target is 0 but has holdings
    }
    asset._weightGap = asset._actualWeight - asset.targetWeight;
  });

  let calculatedTrades = [];

  const calculateRebalancing = () => {
    const accountMode =
      document.querySelector('input[name="accountMode"]:checked')?.value ||
      "identical";

    // Phase 1: Detect assets exceeding 30% relative band
    const overweightAssets = portfolio.filter(
      (a) => a._relativeDeviation > 0.3 && a._weightGap > 0
    );
    const underweightAssets = portfolio.filter(
      (a) => a._relativeDeviation > 0.3 && a._weightGap < 0
    );

    // Display detected assets
    if (overweightAssets.length === 0 && underweightAssets.length === 0) {
      detectionList.innerHTML =
        '<div class="preview-hint">✅ 30% 밴드 초과 자산 없음</div>';
      tradesList.innerHTML =
        '<div class="preview-hint">리밸런싱이 필요하지 않습니다</div>';
      saveBtn.disabled = true;
      calculatedTrades = [];
      return;
    }

    let detectionHTML = "";
    overweightAssets.forEach((a) => {
      detectionHTML += `
                <div class="detection-item overweight">
                    <span class="ticker">${a.ticker}</span>
                    <span class="deviation">+${(
                      a._relativeDeviation * 100
                    ).toFixed(1)}%</span>
                    <span class="direction">과체중 (SELL)</span>
                </div>
            `;
    });
    underweightAssets.forEach((a) => {
      detectionHTML += `
                <div class="detection-item underweight">
                    <span class="ticker">${a.ticker}</span>
                    <span class="deviation">-${(
                      a._relativeDeviation * 100
                    ).toFixed(1)}%</span>
                    <span class="direction">저체중 (BUY)</span>
                </div>
            `;
    });
    detectionList.innerHTML = detectionHTML;

    // Phase 2 & 3: Apply filter and sort by gap
    calculatedTrades = [];

    overweightAssets.forEach((sellAsset) => {
      const sellAccountGroup = getAccountGroup(sellAsset.ticker);

      // Get counterpart pool
      let pool = [...underweightAssets];
      if (accountMode === "identical") {
        pool = pool.filter(
          (a) => getAccountGroup(a.ticker) === sellAccountGroup
        );
      }

      // Sort by underweight (most underweight first)
      pool.sort((a, b) => a._weightGap - b._weightGap);

      // Calculate how much to sell (to reach target weight)
      const excessValue =
        (sellAsset._actualWeight - sellAsset.targetWeight) * totalValue;
      let remainingValue = excessValue;

      // Waterfall through pool
      pool.forEach((buyAsset) => {
        if (remainingValue <= 0) return;

        const deficitValue =
          (buyAsset.targetWeight - buyAsset._actualWeight) * totalValue;
        const transferValue = Math.min(remainingValue, deficitValue);

        if (transferValue > 0) {
          const sellShares = applySharesDecimalRule(
            sellAsset.ticker,
            transferValue / sellAsset._priceKRW
          );
          const buyShares = applySharesDecimalRule(
            buyAsset.ticker,
            transferValue / buyAsset._priceKRW
          );

          calculatedTrades.push({
            fromAsset: sellAsset.ticker,
            fromShares: sellShares,
            toAsset: buyAsset.ticker,
            toShares: buyShares,
            value: transferValue,
          });

          remainingValue -= transferValue;
        }
      });
    });

    // Display trades
    if (calculatedTrades.length === 0) {
      tradesList.innerHTML =
        '<div class="preview-hint">계좌 필터로 인해 대응 가능한 자산이 없습니다</div>';
      saveBtn.disabled = true;
    } else {
      let tradesHTML = "";
      calculatedTrades.forEach((t) => {
        tradesHTML += `
                    <div class="trade-item">
                        <span class="from">${t.fromAsset} ${
          t.fromShares
        }주</span>
                        <span class="arrow">→</span>
                        <span class="to">${t.toAsset} ${t.toShares}주</span>
                        <span class="value">₩${Math.round(
                          t.value
                        ).toLocaleString()}</span>
                    </div>
                `;
      });
      tradesList.innerHTML = tradesHTML;
      saveBtn.disabled = false;

      // Store for form submission
      tradesList.dataset.trades = JSON.stringify(calculatedTrades);
    }
  };

  // Listen for mode changes
  accountModeRadios.forEach((radio) => {
    radio.addEventListener("change", calculateRebalancing);
  });

  // Initial calculation
  calculateRebalancing();
}
// ===================================
// SIMULATION MODE FUNCTIONS
// ===================================

/**
 * Enter Simulation Mode - Creates sandbox copies of all data
 */
function enterSimulationMode() {
  if (isSimulationMode) return;

  console.log("✨ Entering Dimension of Possibilities...");

  // 1. Backup real data
  realPortfolio = JSON.parse(JSON.stringify(portfolio));
  realPortfolioHistory = JSON.parse(JSON.stringify(portfolioHistory));

  // 2. Backup MNAV and Z-Score from localStorage
  realMNAV = localStorage.getItem("jg_mnav_value") || "";
  realZScore = localStorage.getItem("jg_zscore_value") || "";

  // 3. Create simulation copies
  simPortfolio = JSON.parse(JSON.stringify(portfolio));
  simPortfolioHistory = JSON.parse(JSON.stringify(portfolioHistory));
  simMNAV = realMNAV;
  simZScore = realZScore;

  // 4. Set flag
  isSimulationMode = true;

  // 5. Save and clear freeze state (UI Isolation)
  prevFreezeState = {
    hasWeekendFreeze: document.body.classList.contains("weekend-freeze"),
    isPositive: document.body.classList.contains("positive"),
    isNegative: document.body.classList.contains("negative"),
  };
  console.log("📦 Freeze state saved:", prevFreezeState);

  // Remove freeze classes for clean simulation UI
  document.body.classList.remove("weekend-freeze", "positive", "negative");

  // 6. Update UI
  const container = document.querySelector(".dashboard-container");
  const banner = document.getElementById("sim-mode-banner");
  const toggleBtn = document.getElementById("sim-mode-toggle");
  const statusText = document.getElementById("sys-status-text");
  const fridayIndicator = document.getElementById("friday-indicator");

  if (container) container.classList.add("sim-mode");
  if (banner) banner.classList.remove("hidden");
  if (toggleBtn) {
    toggleBtn.title = "Exit Simulation Mode";
    const label = toggleBtn.querySelector(".label");
    if (label) label.textContent = "EXIT";
  }
  if (statusText) statusText.textContent = "SANDBOX";

  // Hide live mode indicators during simulation
  if (fridayIndicator) fridayIndicator.style.display = "none";

  // 6. Re-initialize Lucide icons for simulation mode emojis
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  // 7. Show toast notification
  UI.showToast("✨ 가능성의 차원에 입장했습니다");

  console.log("✅ Simulation Mode activated. All real data backed up.");
}

/**
 * Exit Simulation Mode - Discards all simulation changes
 */
async function exitSimulationMode() {
  if (!isSimulationMode) return;

  // Confirm exit
  const confirmExit = confirm(
    "✨ 현실 세계로 돌아가시겠습니까?\n\n" +
      "이 차원에서의 모든 변화는 사라집니다.\n" +
      "원래의 포트폴리오 데이터로 복원됩니다."
  );

  if (!confirmExit) return;

  console.log("🔄 Returning to reality...");

  // 1. Restore real data
  portfolio = JSON.parse(JSON.stringify(realPortfolio));
  portfolioHistory = JSON.parse(JSON.stringify(realPortfolioHistory));

  // 2. Restore MNAV and Z-Score to UI (from backup)
  const mnavInput = document.getElementById("mnav-input");
  const zscoreInput = document.getElementById("zscore-input");
  if (mnavInput) mnavInput.value = realMNAV;
  if (zscoreInput) zscoreInput.value = realZScore;

  // 3. Clear all simulation state
  realPortfolio = null;
  realPortfolioHistory = null;
  realMNAV = null;
  realZScore = null;
  simPortfolio = null;
  simPortfolioHistory = null;
  simMNAV = null;
  simZScore = null;

  // 4. Clear flag
  isSimulationMode = false;

  // 5. Update UI
  const container = document.querySelector(".dashboard-container");
  const banner = document.getElementById("sim-mode-banner");
  const toggleBtn = document.getElementById("sim-mode-toggle");
  const statusText = document.getElementById("sys-status-text");
  const fridayIndicator = document.getElementById("friday-indicator");

  if (container) container.classList.remove("sim-mode");
  if (banner) banner.classList.add("hidden");
  if (toggleBtn) {
    toggleBtn.title = "Enter Simulation Mode";
    const label = toggleBtn.querySelector(".label");
    if (label) label.textContent = "SANDBOX";
  }
  if (statusText) statusText.textContent = "SYSTEM ONLINE";

  // Restore live mode indicators
  if (fridayIndicator) fridayIndicator.style.display = "";

  // 6. Re-initialize Lucide icons
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  // 7. Set restoration flag to prevent applyWeekendFreezeMode from overwriting
  window._restoringFromSimulation = true;

  // 8. Refresh dashboard with real data
  await updateDashboard();

  // 9. Restore previous freeze state AFTER updateDashboard
  if (prevFreezeState) {
    console.log("📦 Restoring freeze state:", prevFreezeState);
    if (prevFreezeState.hasWeekendFreeze) {
      document.body.classList.add("weekend-freeze");
      if (prevFreezeState.isPositive) {
        document.body.classList.add("positive");
      } else if (prevFreezeState.isNegative) {
        document.body.classList.add("negative");
      }
    }
    prevFreezeState = null;
  }

  // 10. Clear restoration flag
  window._restoringFromSimulation = false;

  // 11. Show toast notification
  UI.showToast('<i data-lucide="check-circle" style="width:14px;height:14px;display:inline;vertical-align:middle;margin-right:4px;"></i> 현실 세계로 돌아왔습니다');

  console.log("✅ Returned to reality. All simulation data discarded.");
}

/**
 * Show simulation entry modal
 */
function showSimEntryModal() {
  const modal = document.getElementById("sim-entry-modal");
  if (modal) {
    modal.classList.remove("hidden");
    // Re-init icons for the modal
    if (typeof lucide !== "undefined") {
      lucide.createIcons();
    }
  }
}

/**
 * Hide simulation entry modal
 */
function hideSimEntryModal() {
  const modal = document.getElementById("sim-entry-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

/**
 * Get the active portfolio (real or simulated)
 */
function getActivePortfolio() {
  return isSimulationMode ? simPortfolio : portfolio;
}

/**
 * Get the active history (real or simulated)
 */
function getActiveHistory() {
  return isSimulationMode ? simPortfolioHistory : portfolioHistory;
}

/**
 * Check if we're in simulation mode
 */
function isInSimulationMode() {
  return isSimulationMode;
}

/**
 * Save portfolio changes (respects simulation mode)
 */
function savePortfolioChanges(newPortfolio) {
  if (isSimulationMode) {
    simPortfolio = newPortfolio;
    console.log("✨ [Sim] Portfolio changes saved to simulation state");
  } else {
    portfolio = newPortfolio;
    DataService.savePortfolio(portfolio);
  }
}

/**
 * Save history changes (respects simulation mode)
 */
function saveHistoryChanges(newHistory) {
  if (isSimulationMode) {
    simPortfolioHistory = newHistory;
    console.log("✨ [Sim] History changes saved to simulation state");
  } else {
    portfolioHistory = newHistory;
    DataService.saveHistory(portfolioHistory);
  }
}

/**
 * Setup Tooltip Click Toggle for Pulse Cards
 * Click to show/hide, click outside to close
 * Also handles expandable cards with data-expanded attribute
 */
function setupTooltipClickToggle() {
  const tooltipCards = document.querySelectorAll(
    ".pulse-card.has-tooltip, .vital-card.has-tooltip"
  );
  const expandableCards = document.querySelectorAll(".pulse-card.expandable");

  // Handle traditional tooltip cards
  tooltipCards.forEach((card) => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();

      // Close all other tooltips first
      tooltipCards.forEach((otherCard) => {
        if (otherCard !== card) {
          otherCard.classList.remove("active");
        }
      });

      // Toggle this card's tooltip
      card.classList.toggle("active");
    });
  });

  // Handle expandable cards (new click-to-expand system)
  expandableCards.forEach((card) => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();

      // Close all other expandable cards first
      expandableCards.forEach((otherCard) => {
        if (otherCard !== card) {
          otherCard.setAttribute("data-expanded", "false");
        }
      });

      // Toggle this card's expanded state
      const isExpanded = card.getAttribute("data-expanded") === "true";
      card.setAttribute("data-expanded", isExpanded ? "false" : "true");
    });
  });

  // Close all cards when clicking outside
  document.addEventListener("click", (e) => {
    // Close tooltip cards
    if (!e.target.closest(".has-tooltip")) {
      tooltipCards.forEach((card) => {
        card.classList.remove("active");
      });
    }

    // Close expandable cards
    if (!e.target.closest(".expandable")) {
      expandableCards.forEach((card) => {
        card.setAttribute("data-expanded", "false");
      });
    }
  });

  // Close all cards on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      tooltipCards.forEach((card) => {
        card.classList.remove("active");
      });
      expandableCards.forEach((card) => {
        card.setAttribute("data-expanded", "false");
      });
    }
  });
}

/**
 * Update Rebalancing Countdown Timer
 * Counts down to next Friday 23:00 KST
 */
function updateRebalancingTimer() {
  const timerEl = document.getElementById('rebalancing-timer');
  const displayEl = document.getElementById('timer-display');
  const iconEl = timerEl?.querySelector('.timer-icon');
  
  if (!timerEl || !displayEl) return;
  
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 5=Fri, 6=Sat
  const hours = now.getHours();
  
  // Check if trading window is open (Friday 23:00 - Sunday 23:59)
  const isFridayNight = dayOfWeek === 5 && hours >= 23;
  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;
  const isWindowOpen = isFridayNight || isSaturday || isSunday;
  
  if (isWindowOpen) {
    // Trading Window Open
    timerEl.classList.add('active');
    displayEl.textContent = 'TRADING WINDOW OPEN';
    if (iconEl) {
      iconEl.setAttribute('data-lucide', 'unlock');
    }
  } else {
    // Calculate time to next Friday 23:00 KST
    timerEl.classList.remove('active');
    
    // Days until Friday
    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0 && hours < 23) {
      daysUntilFriday = 0; // Today is Friday but before 23:00
    } else if (daysUntilFriday === 0) {
      daysUntilFriday = 7; // Today is Friday after 23:00, next Friday
    }
    
    // Target time: Friday 23:00
    const target = new Date(now);
    target.setDate(target.getDate() + daysUntilFriday);
    target.setHours(23, 0, 0, 0);
    
    const diffMs = target - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    displayEl.textContent = `NEXT OP: ${diffDays}D ${diffHours}H ${diffMins}M`;
    if (iconEl) {
      iconEl.setAttribute('data-lucide', 'lock');
    }
  }
  
  // Re-render Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HYPOTHETICAL TRAJECTORY SIMULATOR
// Show static backtest from 2020-08-11 to compare with actual performance
// ═══════════════════════════════════════════════════════════════════════════

window._hypotheticalData = null;
window._hypotheticalTrajectory = null;
window._showHypothetical = false;
window._showSlope = false;

/**
 * Fetch hypothetical data from backend API
 */
async function fetchHypotheticalData() {
  try {
    console.log("📊 Fetching hypothetical data...");
    const response = await fetch('/api/hypothetical-data');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    window._hypotheticalData = data;
    console.log("✅ Hypothetical data loaded:", Object.keys(data.assets).length, "assets");
    return data;
  } catch (error) {
    console.error("❌ Failed to fetch hypothetical data:", error);
    return null;
  }
}

/**
 * Calculate and display hypothetical trajectory on chart
 */
async function updateHypotheticalChart(showHypothetical, showSlope = false) {
  const alphaBadge = document.getElementById('execution-alpha-badge');
  const alphaValue = document.getElementById('alpha-value');
  const slopeWrapper = document.getElementById('slope-toggle-wrapper');
  
  // If turning off, remove hypothetical from chart
  if (!showHypothetical) {
    window._showHypothetical = false;
    window._showSlope = false;
    if (alphaBadge) alphaBadge.classList.add('hidden');
    if (slopeWrapper) {
      slopeWrapper.style.opacity = '0.5';
      slopeWrapper.style.pointerEvents = 'none';
    }
    
    // Restore original chart
    if (typeof updatePerformanceChartWithHypothetical === 'function') {
      updatePerformanceChartWithHypothetical(null, null, null);
    }
    return;
  }
  
  window._showHypothetical = true;
  
  // Enable slope toggle
  if (slopeWrapper) {
    slopeWrapper.style.opacity = '1';
    slopeWrapper.style.pointerEvents = 'auto';
    slopeWrapper.classList.add('enabled');
  }
  
  // Fetch data if not already loaded
  if (!window._hypotheticalData) {
    await fetchHypotheticalData();
  }
  
  if (!window._hypotheticalData) {
    console.warn("No hypothetical data available");
    return;
  }
  
  // Calculate trajectory
  const trajectory = Finance.calculateHypotheticalTrajectory(
    window._hypotheticalData,
    100 // Normalized to 100
  );
  
  if (!trajectory) {
    console.warn("Failed to calculate hypothetical trajectory");
    return;
  }
  
  window._hypotheticalTrajectory = trajectory;
  console.log("📈 Hypothetical trajectory:", trajectory.stats);
  
  // Get actual portfolio data for comparison
  const actualData = getActualPortfolioData();
  
  // Calculate Execution Alpha if slope comparison enabled
  let ghostBenchmark = null;
  let executionAlpha = null;
  
  if (showSlope && actualData) {
    window._showSlope = true;
    
    executionAlpha = Finance.calculateExecutionAlpha(trajectory, actualData);
    
    if (executionAlpha) {
      console.log("⚡ Execution Alpha:", executionAlpha);
      
      // Update alpha badge
      if (alphaBadge && alphaValue) {
        alphaValue.textContent = (parseFloat(executionAlpha.alpha) >= 0 ? '+' : '') + executionAlpha.alpha;
        alphaBadge.classList.remove('hidden', 'positive', 'negative');
        alphaBadge.classList.add(parseFloat(executionAlpha.alpha) >= 0 ? 'positive' : 'negative');
      }
      
      // Create ghost benchmark
      ghostBenchmark = Finance.createGhostBenchmark(
        trajectory,
        actualData.dates[0],
        actualData.values[0]
      );
    }
  } else {
    window._showSlope = false;
    if (alphaBadge) alphaBadge.classList.add('hidden');
  }
  
  // Update chart with hypothetical overlay
  if (typeof updatePerformanceChartWithHypothetical === 'function') {
    updatePerformanceChartWithHypothetical(trajectory, ghostBenchmark, actualData);
  }
}

/**
 * Get actual portfolio data in the format needed for comparison
 * @returns {Object} { dates: [], values: [] }
 */
function getActualPortfolioData() {
  if (!portfolioHistory || portfolioHistory.length < 2) {
    console.warn("No portfolio history available");
    return null;
  }
  
  // Sort by date and extract values
  const sorted = [...portfolioHistory].sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });
  
  const dates = sorted.map(h => {
    const d = new Date(h.date);
    return d.toISOString().split('T')[0];
  });
  
  const values = sorted.map(h => h.value);
  
  return { dates, values };
}

/**
 * Setup event listeners for hypothetical trajectory toggles
 */
function setupHypotheticalTrajectoryListeners() {
  const hypoToggle = document.getElementById('hypo-history-toggle');
  const slopeToggle = document.getElementById('hypo-slope-toggle');
  
  if (hypoToggle) {
    hypoToggle.addEventListener('change', async (e) => {
      const showHypothetical = e.target.checked;
      const showSlope = document.getElementById('hypo-slope-toggle')?.checked || false;
      
      console.log("🔄 Hypothetical toggle:", showHypothetical ? 'ON' : 'OFF');
      
      // If turning off hypothetical, also turn off slope
      if (!showHypothetical && slopeToggle) {
        slopeToggle.checked = false;
      }
      
      await updateHypotheticalChart(showHypothetical, showSlope);
    });
  }
  
  if (slopeToggle) {
    slopeToggle.addEventListener('change', async (e) => {
      const showSlope = e.target.checked;
      const showHypothetical = document.getElementById('hypo-history-toggle')?.checked || false;
      
      console.log("🔄 Slope comparison toggle:", showSlope ? 'ON' : 'OFF');
      
      // Slope requires hypothetical to be on
      if (!showHypothetical && showSlope) {
        console.log("⚠️ Hypothetical must be enabled first");
        e.target.checked = false;
        return;
      }
      
      await updateHypotheticalChart(showHypothetical, showSlope);
    });
  }
  
  // Hover on alpha badge to show/toggle ghost benchmark
  const alphaBadge = document.getElementById('execution-alpha-badge');
  if (alphaBadge) {
    alphaBadge.addEventListener('click', () => {
      const slopeToggle = document.getElementById('hypo-slope-toggle');
      if (slopeToggle && window._showHypothetical) {
        slopeToggle.checked = !slopeToggle.checked;
        slopeToggle.dispatchEvent(new Event('change'));
      }
    });
  }
}

// Initialize hypothetical listeners after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setupHypotheticalTrajectoryListeners();
});

// Start
initApp();
