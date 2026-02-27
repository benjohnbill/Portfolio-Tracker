/**
 * Chart Management Module
 * Handles all Chart.js visualizations (Performance, Allocation, etc.)
 */

// Global Chart Instances
let allocationChart = null;
let performanceChart = null;
let histogramChart = null;
let alphaCurveChart = null;
let underwaterChart = null;
let ctrChart = null;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHART STATE MANAGER
 * Central state management for all chart toggles and modes
 * ═══════════════════════════════════════════════════════════════════════════
 */
const ChartState = {
    // Layer 1: Timeline Mode (mutually exclusive)
    // 'default' = 2024.03.12~today, 'hypothetical' = 2020.08.11~today, 'projection' = today~target
    timelineMode: 'default',
    
    // Layer 2: Overlays (independent, can be combined)
    // Default: both OFF for clean initial view
    overlays: {
        spy: false,     // SPY benchmark (OFF by default)
        static: false,  // Static rebalancing strategy (OFF by default)
        trend: false    // Adaptive Trend Line (60MA/200MA) (OFF by default)
    },
    
    // Projection mode settings
    projectionTarget: null,  // Target amount for projection
    
    // Cached data for efficient updates
    cache: {
        defaultData: null,      // 2024.03.12~ data
        hypotheticalData: null, // 2020.08.11~ data
        staticData: null        // Static calculation data
    },
    
    /**
     * Get date range based on current timeline mode
     * @returns {Object} { start: string, end: string }
     */
    getDateRange() {
        switch (this.timelineMode) {
            case 'hypothetical':
                return { start: '2020-08-11', end: 'today' };
            case 'projection':
                return { start: 'today', end: 'target' };
            default:
                return { start: '2024-03-12', end: 'today' };
        }
    },
    
    /**
     * Save state to localStorage
     */
    save() {
        const state = {
            timelineMode: this.timelineMode,
            overlays: this.overlays,
            projectionTarget: this.projectionTarget
        };
        try {
            localStorage.setItem('chartState', JSON.stringify(state));
            console.log('💾 ChartState saved:', state);
        } catch (e) {
            console.warn('Failed to save ChartState:', e);
        }
    },
    
    /**
     * Load state from localStorage
     */
    load() {
        // DESIGN DECISION: Always start with clean state (Default timeline, overlays OFF)
        // Only restore projectionTarget for user convenience
        try {
            const saved = localStorage.getItem('chartState');
            if (saved) {
                const state = JSON.parse(saved);
                // Keep projectionTarget only
                this.projectionTarget = state.projectionTarget || null;
                console.log('📂 ChartState: Using default view (projectionTarget restored)');
            }
        } catch (e) {
            console.warn('Failed to load ChartState:', e);
        }
        // Timeline and overlays always start at default
        this.timelineMode = 'default';
        this.overlays = { spy: false, static: false };
    },
    
    /**
     * Reset to default state
     */
    reset() {
        this.timelineMode = 'default';
        this.overlays = { spy: false, static: false };
        this.projectionTarget = null;
        this.cache = { defaultData: null, hypotheticalData: null, staticData: null };
        this.save();
        console.log('🔄 ChartState reset to default');
    },
    
    /**
     * Set timeline mode (triggers chart rebuild)
     * @param {string} mode - 'default' | 'hypothetical' | 'projection'
     */
    setTimelineMode(mode) {
        if (['default', 'hypothetical', 'projection'].includes(mode)) {
            const prevMode = this.timelineMode;
            this.timelineMode = mode;
            this.save();
            console.log(`📊 Timeline Mode: ${prevMode} → ${mode}`);
            return true;
        }
        return false;
    },
    
    /**
     * Toggle overlay visibility
     * @param {string} overlay - 'spy' | 'static'
     * @param {boolean} visible
     */
    setOverlay(overlay, visible) {
        if (this.overlays.hasOwnProperty(overlay)) {
            this.overlays[overlay] = visible;
            this.save();
            console.log(`📊 Overlay ${overlay}: ${visible ? 'ON' : 'OFF'}`);
            return true;
        }
        return false;
    }
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INFO HEADER MODE MANAGEMENT
 * Switches between mode-specific info headers based on timeline mode
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Switch Info Header based on current mode
 * @param {string} mode - 'default' | 'hypothetical' | 'projection'
 */
function switchInfoHeaderMode(mode) {
    const headers = {
        default: document.getElementById('info-header-default'),
        hypothetical: document.getElementById('info-header-history'),
        projection: document.getElementById('info-header-projection')
    };
    
    // Hide all headers
    Object.values(headers).forEach(h => {
        if (h) h.classList.add('hidden');
    });
    
    // Show the appropriate header
    const activeHeader = headers[mode];
    if (activeHeader) {
        activeHeader.classList.remove('hidden');
        console.log(`📊 Info Header switched to: ${mode}`);
    }
}

/**
 * Update Projection Info Header with Idle state data
 * @param {Object} cvData - Compound Vision data
 */
function updateProjectionInfoHeaderIdle(cvData) {
    if (!cvData) return;
    
    const header = document.getElementById('info-header-projection');
    if (!header) return;
    
    // Remove hover state
    header.classList.remove('hover-state');
    
    // Helper: Format currency in Western style (M for millions)
    const formatCurrencyWestern = (value) => {
        if (value >= 1000000000) {
            return '₩' + (value / 1000000000).toFixed(1) + 'B';
        } else if (value >= 1000000) {
            return '₩' + (value / 1000000).toFixed(0) + 'M';
        } else if (value >= 1000) {
            return '₩' + (value / 1000).toFixed(0) + 'K';
        }
        return '₩' + value.toLocaleString();
    };
    
    // Goal
    const goalEl = document.getElementById('info-proj-goal');
    if (goalEl) {
        goalEl.textContent = formatCurrencyWestern(cvData.targetValue);
    }
    
    // Arrival Date
    const arrivalEl = document.getElementById('info-proj-arrival');
    if (arrivalEl) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const d = cvData.portfolioFinishDate;
        arrivalEl.textContent = months[d.getMonth()] + ' ' + d.getFullYear();
    }
    
    // Time Alpha
    const timegapEl = document.getElementById('info-proj-timegap');
    if (timegapEl) {
        const portDate = cvData.portfolioFinishDate;
        const spyDate = cvData.benchmarkFinishDate;
        const diffMonths = Math.round((spyDate - portDate) / (1000 * 60 * 60 * 24 * 30));
        
        timegapEl.classList.remove('win', 'lag');
        
        if (diffMonths > 0) {
            timegapEl.textContent = '+' + diffMonths + ' months';
            timegapEl.classList.add('win');
        } else if (diffMonths < 0) {
            timegapEl.textContent = diffMonths + ' months';
            timegapEl.classList.add('lag');
        } else {
            timegapEl.textContent = 'Same time';
            timegapEl.classList.add('win');
        }
    }
    
    // Update labels for Idle state
    const labels = header.querySelectorAll('.info-label');
    if (labels.length >= 3) {
        labels[0].innerHTML = '<i data-lucide="crosshair" style="width:14px;height:14px;margin-right:6px;"></i>Goal';
        labels[1].innerHTML = '<i data-lucide="rocket" style="width:14px;height:14px;margin-right:6px;"></i>Arrival';
        labels[2].innerHTML = '<i data-lucide="zap" style="width:14px;height:14px;margin-right:6px;"></i>Time Alpha';
        
        // Render icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({
                root: header
            });
        }
    }
}

/**
 * Update Projection Info Header with Hover state data
 * @param {number} year - Hovered year
 * @param {number} portfolioValue - Projected portfolio value
 * @param {number} spyValue - Projected SPY value
 */
function updateProjectionInfoHeaderHover(year, portfolioValue, spyValue) {
    const header = document.getElementById('info-header-projection');
    if (!header) return;
    
    // Add hover state styling
    header.classList.add('hover-state');
    
    // Update labels for Hover state
    const labels = header.querySelectorAll('.info-label');
    if (labels.length >= 3) {
        labels[0].innerHTML = '<i data-lucide="calendar" style="width:14px;height:14px;margin-right:6px;"></i>Year';
        labels[1].innerHTML = '<i data-lucide="trending-up" style="width:14px;height:14px;margin-right:6px;"></i>Projected';
        labels[2].innerHTML = '<i data-lucide="coins" style="width:14px;height:14px;margin-right:6px;"></i>vs SPY';
        
        // Render icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons({
                root: header
            });
        }
    }
    
    // Year
    const goalEl = document.getElementById('info-proj-goal');
    if (goalEl) {
        goalEl.textContent = year;
    }
    
    // Projected AUM
    const arrivalEl = document.getElementById('info-proj-arrival');
    if (arrivalEl) {
        arrivalEl.textContent = '₩' + (portfolioValue / 1000000).toFixed(1) + 'M'; // Use Western format (M) for consistency
    }
    
    // Wealth Gap vs SPY
    const timegapEl = document.getElementById('info-proj-timegap');
    if (timegapEl) {
        const gap = portfolioValue - spyValue;
        timegapEl.classList.remove('win', 'lag');
        
        if (gap > 0) {
            timegapEl.textContent = '+₩' + (gap / 1000000).toFixed(1) + 'M';
            timegapEl.classList.add('win');
        } else if (gap < 0) {
            timegapEl.textContent = '-₩' + (Math.abs(gap) / 1000000).toFixed(1) + 'M';
            timegapEl.classList.add('lag');
        } else {
            timegapEl.textContent = '₩0';
        }
    }
}

/**
 * Toggle SPY benchmark visibility on performance and underwater charts
 * Uses Chart.js dataset visibility (no chart recreation needed)
 * @param {boolean} visible - Whether to show SPY
 */
function toggleSPYVisibility(visible) {
    // Performance Chart: SPY is at index 2
    if (performanceChart && performanceChart.data.datasets.length > 2) {
        const spyDatasetIndex = performanceChart.data.datasets.findIndex(
            ds => ds.label && ds.label.includes('SPY')
        );
        if (spyDatasetIndex !== -1) {
            performanceChart.setDatasetVisibility(spyDatasetIndex, visible);
            performanceChart.update('none'); // Update without animation
        }
    }
    
    // Underwater Chart: SPY MDD is at index 1
    if (underwaterChart && underwaterChart.data.datasets.length > 1) {
        const spyDatasetIndex = underwaterChart.data.datasets.findIndex(
            ds => ds.label && ds.label.includes('SPY')
        );
        if (spyDatasetIndex !== -1) {
            underwaterChart.setDatasetVisibility(spyDatasetIndex, visible);
            underwaterChart.update('none');
        }
    }
    
    // Toggle Info Bar SPY item visibility
    const mainInfoSpy = document.querySelector('#main-chart-info .info-item[data-field="spy"]');
    const underwaterInfoSpy = document.querySelector('#underwater-chart-info .info-item[data-field="spy"]');
    if (mainInfoSpy) mainInfoSpy.style.display = visible ? '' : 'none';
    if (underwaterInfoSpy) underwaterInfoSpy.style.display = visible ? '' : 'none';
    
    console.log("📊 SPY visibility:", visible ? 'ON' : 'OFF');
}

/**
 * Toggle Static Strategy visibility on performance and underwater charts
 * Uses Chart.js dataset visibility (no chart recreation needed)
 * @param {boolean} visible - Whether to show Static
 */
function toggleStaticVisibility(visible) {
    // Performance Chart
    if (performanceChart && performanceChart.data.datasets.length > 0) {
        const staticDatasetIndex = performanceChart.data.datasets.findIndex(
            ds => ds.label && ds.label.includes('Static')
        );
        if (staticDatasetIndex !== -1) {
            performanceChart.setDatasetVisibility(staticDatasetIndex, visible);
            performanceChart.update('none');
        }
    }
    
    // Underwater Chart
    if (underwaterChart && underwaterChart.data.datasets.length > 0) {
        const staticDatasetIndex = underwaterChart.data.datasets.findIndex(
            ds => ds.label && ds.label.includes('Static')
        );
        if (staticDatasetIndex !== -1) {
            underwaterChart.setDatasetVisibility(staticDatasetIndex, visible);
            underwaterChart.update('none');
        }
    }
    
    // Toggle Info Bar Static item visibility
    const mainInfoStatic = document.querySelector('#main-chart-info .info-item[data-field="static"]');
    const underwaterInfoStatic = document.querySelector('#underwater-chart-info .info-item[data-field="static"]');
    if (mainInfoStatic) mainInfoStatic.style.display = visible ? '' : 'none';
    if (underwaterInfoStatic) underwaterInfoStatic.style.display = visible ? '' : 'none';
    
    console.log("📊 Static visibility:", visible ? 'ON' : 'OFF');
}

/**
 * Refresh Static data in chart (called when Static toggle is turned ON)
 * Updates the Static dataset with current hypothetical cache data
 * ONLY for Default mode - Full History/Projection already have correct data
 */
function refreshStaticDataInChart() {
    if (!performanceChart || !performanceChart.data.datasets) {
        console.warn('📊 Static refresh: No chart available');
        return;
    }
    
    // Only refresh data in Default mode
    // Full History and Projection modes already have correct Static data built-in
    const currentMode = typeof ChartState !== 'undefined' ? ChartState.timelineMode : 'default';
    if (currentMode !== 'default') {
        console.log(`📊 Static refresh: Skipped (mode=${currentMode})`);
        return;  // Don't overwrite data in other modes
    }
    
    // Find Static dataset
    const staticDatasetIndex = performanceChart.data.datasets.findIndex(
        ds => ds.label && ds.label.includes('Static')
    );
    
    if (staticDatasetIndex === -1) {
        console.warn('📊 Static refresh: No Static dataset in chart');
        return;
    }
    
    // Get current aumHistory from global
    const aumHistory = window._globalAumHistory;
    if (!aumHistory) {
        console.warn('📊 Static refresh: No AUM history available');
        return;
    }
    
    // Calculate Static data (Default mode only)
    const staticData = getStaticDataForDefault(aumHistory);
    
    // Update dataset
    performanceChart.data.datasets[staticDatasetIndex].data = staticData;
    performanceChart.data.datasets[staticDatasetIndex].hidden = false;
    performanceChart.update('none');
    
    console.log('📊 Static data refreshed in chart (Default mode)');
}

/**
 * Initialize the basic Allocation Chart (Doughnut)
 * Called at app startup
 */
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
                legend: { 
                    position: 'right', 
                    labels: { 
                        color: '#ffffff', // White text for legend
                        padding: 16,
                        font: { 
                            size: 12,
                            weight: '500',
                            family: 'Inter, sans-serif'
                        },
                        boxWidth: 14,
                        boxHeight: 14,
                        usePointStyle: false,
                        // Asset names only (no percentages in legend)
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const backgroundColor = data.datasets[0].backgroundColor[i];
                                    const value = parseFloat(data.datasets[0].data[i]) || 0;
                                    return {
                                        text: `${label} (${value.toFixed(1)}%)`, // Show asset name with percentage
                                        fillStyle: backgroundColor,
                                        strokeStyle: backgroundColor,
                                        fontColor: '#ffffff',
                                        lineWidth: 0,
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                // Tooltips still show percentage on hover
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 20, 32, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#94a3b8',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${parseFloat(context.raw).toFixed(1)}%`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Get Static Strategy data for Default mode (2024.03.12 ~ present)
 * Extracts from Hypothetical cache and normalizes to portfolio inception value
 * @param {Array} aumHistory - Portfolio AUM history
 * @returns {Array} - Static values aligned with aumHistory dates
 */
function getStaticDataForDefault(aumHistory) {
    const hypothetical = window._hypotheticalCache;
    if (!hypothetical || !hypothetical.dates || !hypothetical.values) {
        // Silent return - cache may not be loaded yet, which is normal when Static is OFF
        return new Array(aumHistory.length).fill(null);
    }
    
    const INCEPTION_DATE = '2024-03-12';
    const inceptionIdx = hypothetical.dates.findIndex(d => d >= INCEPTION_DATE);
    
    if (inceptionIdx === -1) {
        console.warn('📊 Static: Inception date not found in hypothetical data');
        return new Array(aumHistory.length).fill(null);
    }
    
    // Get portfolio inception value for normalization
    const portfolioInceptionValue = aumHistory[0]?.totalValue || 17400000;
    const hypoValueAtInception = hypothetical.values[inceptionIdx];
    const scaleFactor = portfolioInceptionValue / hypoValueAtInception;
    
    // Build date -> scaled value map
    const staticMap = {};
    for (let i = inceptionIdx; i < hypothetical.dates.length; i++) {
        staticMap[hypothetical.dates[i]] = hypothetical.values[i] * scaleFactor;
    }
    
    // Map to aumHistory dates
    const staticValues = aumHistory.map(item => {
        return staticMap[item.date] || null;
    });
    
    console.log(`📊 Static: ${staticValues.filter(v => v !== null).length} data points mapped`);
    return staticValues;
}

/**
 * Update ONLY the Main Performance Chart and Underwater Chart
 * ULTRA-FAST: Reuses existing chart instance, only updates data
 * @param {Array} aumHistory - Portfolio AUM history
 * @param {Array} spyNormalized - Normalized SPY benchmark
 * @param {Array} ma60Data - 60-day moving average data
 */
function updateMainChartOnly(aumHistory, spyNormalized, ma60Data) {
    const perfCtx = document.getElementById('perfChart');
    if (!perfCtx) {
        console.warn("Performance chart canvas not found");
        return;
    }
    
    const startTime = performance.now();
    
    // Prepare labels with month markers
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let lastMonth = -1;
    const labels = aumHistory.map((item) => {
        const date = new Date(item.date);
        const month = date.getMonth();
        if (month !== lastMonth) {
            lastMonth = month;
            return monthNames[month];
        }
        return '';
    });

    const aumValues = aumHistory.map(item => item.totalValue);
    const ma60Values = ma60Data.map(item => item.ma);
    
    // Check if chart exists and can be reused
    if (performanceChart && performanceChart.canvas && performanceChart.data.datasets.length >= 4) {
        // FAST PATH: Reuse existing chart, just update data
        performanceChart.data.labels = labels;
        performanceChart.data.datasets[0].data = aumValues;
        performanceChart.data.datasets[1].data = ma60Values;
        performanceChart.data.datasets[1].hidden = !ChartState.overlays.trend;
        performanceChart.data.datasets[2].data = spyNormalized;
        performanceChart.data.datasets[2].hidden = !ChartState.overlays.spy;
        // Update Static dataset
        performanceChart.data.datasets[3].data = getStaticDataForDefault(aumHistory);
        performanceChart.data.datasets[3].hidden = !ChartState.overlays.static;
        performanceChart.update('none'); // No animation for speed
        
        console.log(`📊 Fast update (reuse): ${(performance.now() - startTime).toFixed(0)}ms`);
    } else {
        // SLOW PATH: Create new chart (first time only)
        createMainPerformanceChart(perfCtx, labels, aumValues, ma60Values, spyNormalized, aumHistory);
        console.log(`📊 Full chart creation: ${(performance.now() - startTime).toFixed(0)}ms`);
    }
    
    // Also update Underwater chart
    updateUnderwaterChartFast(aumHistory, spyNormalized, labels);
}

/**
 * Create Main Performance Chart (only called on first load)
 */
function createMainPerformanceChart(perfCtx, labels, aumValues, ma60Values, spyNormalized, aumHistory) {
    // Track month boundaries for grid
    const monthBoundaryIndices = [];
    let lastMonth = -1;
    aumHistory.forEach((item, index) => {
        const date = new Date(item.date);
        const month = date.getMonth();
        if (month !== lastMonth) {
            monthBoundaryIndices.push(index);
            lastMonth = month;
        }
    });

    if (performanceChart) {
        performanceChart.destroy();
        performanceChart = null;
    }

    performanceChart = new Chart(perfCtx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                // Tier 1: Hero - Actual Portfolio
                {
                    label: 'Portfolio AUM',
                    data: aumValues,
                    borderColor: '#10b981', // Institutional Emerald
                    fill: false,
                    tension: 0.1, // Sharper
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2,  // Thinner professional line
                    order: 1
                },
                // Reference: 60-Day MA
                {
                    label: '60-Day MA',
                    data: ma60Values,
                    borderColor: 'rgba(113, 113, 122, 0.5)', // Zinc-500 muted
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0,
                    borderWidth: 1,
                    hidden: typeof ChartState !== 'undefined' ? !ChartState.overlays.trend : true,
                    order: 4
                },
                // Tier 2: Benchmark - SPY
                {
                    label: 'SPY (Benchmark)',
                    data: spyNormalized,
                    borderColor: '#71717a',  // Zinc-500 neutral
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0,
                    borderWidth: 1.5,
                    hidden: typeof ChartState !== 'undefined' ? !ChartState.overlays.spy : false,
                    order: 3
                },
                // Tier 2: Benchmark - Static
                {
                    label: 'Static Strategy',
                    data: getStaticDataForDefault(aumHistory),
                    borderColor: '#a1a1aa',  // Zinc-400 lighter
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0,
                    borderWidth: 1.5,
                    hidden: typeof ChartState !== 'undefined' ? !ChartState.overlays.static : true,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, 
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            onHover: createMainChartHoverHandler(aumHistory, aumValues, ma60Values, spyNormalized, null),
            scales: {
                x: {
                    grid: {
                        display: false, // No vertical grid
                        drawBorder: false
                    },
                    ticks: {
                        color: '#52525b', // Zinc-600
                        font: { size: 10, family: 'Roboto Mono' },
                        maxRotation: 0,
                        autoSkip: false,
                        callback: (value, index) => labels[index] || ''
                    }
                },
                y: {
                    grid: { 
                        color: '#27272a', // Zinc-900 very subtle
                        drawBorder: false
                    },
                    ticks: {
                        color: '#52525b', // Zinc-600
                        callback: (value) => {
                            if (value >= 1000000000) return '₩' + (value / 1000000000).toFixed(2) + 'B';
                            if (value >= 1000000) return '₩' + (value / 1000000).toFixed(2) + 'M';
                            if (value >= 1000) return '₩' + (value / 1000).toFixed(0) + 'K';
                            return '₩' + value.toLocaleString();
                        },
                        font: { size: 10, family: 'Roboto Mono' }
                    }
                }
            }
        }
    });
    
    // Switch to Default Info Header
    switchInfoHeaderMode('default');
}

/**
 * Create hover handler for main chart (closure to capture data)
 * For Default Timeline mode - shows AUM, Daily Return, Alpha vs SPY
 */
function createMainChartHoverHandler(aumHistory, aumValues, ma60Values, spyNormalized, staticData) {
    return function(event, elements, chart) {
        const infoBar = document.getElementById('info-header-default');
        if (!infoBar || elements.length === 0) return;
        
        const idx = elements[0].index;
        const item = aumHistory[idx];
        if (!item) return;
        
        const date = new Date(item.date);
        const dateStr = date.toLocaleDateString('en-US', { 
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
        });
        const dateEl = infoBar.querySelector('.info-date');
        if (dateEl) dateEl.textContent = dateStr;
        
        // AUM
        const aumEl = document.getElementById('info-default-aum');
        if (aumEl) aumEl.textContent = '₩' + Math.round(aumValues[idx]).toLocaleString();
        
        // Daily Return
        const dailyEl = document.getElementById('info-default-daily');
        if (dailyEl) {
            if (idx > 0 && aumValues[idx - 1]) {
                const dailyReturn = ((aumValues[idx] - aumValues[idx - 1]) / aumValues[idx - 1] * 100).toFixed(2);
                dailyEl.textContent = (dailyReturn > 0 ? '+' : '') + dailyReturn + '%';
                dailyEl.className = 'info-value ' + (dailyReturn >= 0 ? 'positive' : 'negative');
            } else {
                dailyEl.textContent = '--';
                dailyEl.className = 'info-value';
            }
        }
        
        // Alpha vs SPY
        const alphaEl = document.getElementById('info-default-alpha');
        if (alphaEl) {
            if (spyNormalized[idx] && aumValues[idx]) {
                const alpha = ((aumValues[idx] - spyNormalized[idx]) / spyNormalized[idx] * 100).toFixed(2);
                alphaEl.textContent = (alpha > 0 ? '+' : '') + alpha + '%';
                alphaEl.className = 'info-value ' + (alpha >= 0 ? 'positive' : 'negative');
            } else {
                alphaEl.textContent = '--';
                alphaEl.className = 'info-value';
            }
        }
    };
}

/**
 * Update Underwater Chart - Fast path with instance reuse
 */
function updateUnderwaterChartFast(aumHistory, spyNormalized, labels) {
    const underwaterCtx = document.getElementById('underwaterChart');
    if (!underwaterCtx) return;

    // Calculate drawdowns
    const portfolioDrawdowns = [];
    const spyDrawdowns = [];
    let portfolioHWM = 0;
    let spyHWM = 0;

    aumHistory.forEach((item, index) => {
        const portfolioValue = item.totalValue || 0;
        if (portfolioValue > portfolioHWM) portfolioHWM = portfolioValue;
        portfolioDrawdowns.push(portfolioHWM > 0 ? ((portfolioValue - portfolioHWM) / portfolioHWM) * 100 : 0);

        const spyValue = spyNormalized[index] || 100;
        if (spyValue > spyHWM) spyHWM = spyValue;
        spyDrawdowns.push(spyHWM > 0 ? ((spyValue - spyHWM) / spyHWM) * 100 : 0);
    });

    // Check if chart exists and can be reused
    if (underwaterChart && underwaterChart.canvas) {
        // FAST PATH: Reuse existing chart
        underwaterChart.data.labels = labels;
        underwaterChart.data.datasets[0].data = portfolioDrawdowns;
        if (underwaterChart.data.datasets[1]) {
            underwaterChart.data.datasets[1].data = spyDrawdowns;
            underwaterChart.data.datasets[1].hidden = typeof ChartState !== 'undefined' ? !ChartState.overlays.spy : false;
        }
        underwaterChart.update('none');
    } else {
        // SLOW PATH: Create new chart
        rebuildUnderwaterChart(aumHistory, spyNormalized, labels);
    }
}

/**
 * Rebuild only the Underwater Chart
 */
function rebuildUnderwaterChart(aumHistory, spyNormalized, labels) {
    const underwaterCtx = document.getElementById('underwaterChart');
    if (!underwaterCtx) return;
    
    if (underwaterChart) {
        underwaterChart.destroy();
        underwaterChart = null;
    }

    // Calculate drawdowns
    const portfolioDrawdowns = [];
    const spyDrawdowns = [];
    let portfolioHWM = 0;
    let spyHWM = 0;

    aumHistory.forEach((item, index) => {
        const portfolioValue = item.totalValue || 0;
        if (portfolioValue > portfolioHWM) portfolioHWM = portfolioValue;
        portfolioDrawdowns.push(portfolioHWM > 0 ? ((portfolioValue - portfolioHWM) / portfolioHWM) * 100 : 0);

        const spyValue = spyNormalized[index] || 100;
        if (spyValue > spyHWM) spyHWM = spyValue;
        spyDrawdowns.push(spyHWM > 0 ? ((spyValue - spyHWM) / spyHWM) * 100 : 0);
    });

    underwaterChart = new Chart(underwaterCtx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Portfolio DD',
                    data: portfolioDrawdowns,
                    borderColor: '#06d6a0',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 2
                },
                {
                    label: 'SPY DD',
                    data: spyDrawdowns,
                    borderColor: 'rgba(239, 71, 111, 0.7)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 1.5
                    // Always visible - not tied to ChartState.overlays.spy
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 12, padding: 8, color: '#94a3b8', font: { size: 9 } } },
                tooltip: { enabled: false }
            },
            scales: {
                x: { display: true, grid: { display: false }, ticks: { display: false } },
                y: {
                    position: 'right',
                    suggestedMax: 0.5,
                    grid: {
                        color: (ctx) => ctx.tick.value === 0 ? '#06b6d4' : 'rgba(255, 255, 255, 0.08)',
                        lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 0.5
                    },
                    // Psychological Anchor: Correction Threshold (-10%)
                    afterBuildTicks: function(scale) {
                        // Ensure -10 is in range if feasible, but auto-scale usually handles it
                    }
                }
            }
        },
        plugins: [
            {
                id: 'psychologicalAnchor',
                beforeDraw: (chart) => {
                    const ctx = chart.ctx;
                    const yAxis = chart.scales.y;
                    const yValue = -10; // -10%
                    
                    if (yValue < yAxis.min || yValue > yAxis.max) return;
                    
                    const yPixel = yAxis.getPixelForValue(yValue);
                    const xStart = chart.scales.x.left;
                    const xEnd = chart.scales.x.right;
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(xStart, yPixel);
                    ctx.lineTo(xEnd, yPixel);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.setLineDash([4, 4]);
                    ctx.stroke();
                    
                    // Label
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.font = '9px Inter';
                    ctx.textAlign = 'right';
                    ctx.fillText('Correction Threshold (-10%)', xEnd - 6, yPixel - 6);
                    ctx.restore();
                }
            }
        ]
    });
}

/**
 * Update Performance Chart with reconstructed AUM history
 * Also handles Histogram, Alpha Curve, and Underwater charts
 */
function updatePerformanceChart(aumHistory, spyNormalized, ma60Data, dailyReturns, metrics, benchmarkReturns) {
    const perfCtx = document.getElementById('perfChart');
    const histogramCtx = document.getElementById('histogramChart');
    const alphaCurveCtx = document.getElementById('alphaCurveChart');

    if (!perfCtx) {
        console.warn("Performance chart canvas not found");
        return;
    }

    // Update Performance Vitals (Top Banner) - 4 Column Grid
    // Note: CAGR and Calmar moved to Identity Grid (Section 1)
    const identityCalmar = document.getElementById('identity-calmar');
    const vitalGainLoss = document.getElementById('vital-gainloss');
    const vitalGainLossBadge = document.getElementById('vital-gainloss-badge');
    const vitalWinRate = document.getElementById('vital-winrate');
    const vitalWinRateBadge = document.getElementById('vital-winrate-badge');
    const vitalExpectancy = document.getElementById('vital-expectancy');

    // 1. Identity Section: Calmar Ratio (CAGR / MDD) - Plain white, no color coding
    if (identityCalmar) {
        const calmarRatio = Finance.calculateCalmarRatio(metrics.cagr, metrics.mdd);
        if (calmarRatio !== null && !isNaN(calmarRatio)) {
            identityCalmar.innerText = calmarRatio.toFixed(2);
            identityCalmar.style.color = '#ffffff'; // Always white for neutral look
        } else {
            identityCalmar.innerText = 'N/A';
            identityCalmar.style.color = 'var(--text-muted)';
        }
    }

    // 2. Weekly Pulse: Gain/Loss Ratio & Win Rate & Expectancy
    const weeklyReturns = Finance.calculateWeeklyReturns(aumHistory);
    const glResult = Finance.calculateGainLossRatio(weeklyReturns);
    const wrResult = Finance.calculateWeeklyWinRate(weeklyReturns);
    
    // Gain/Loss Ratio - Red Alert Rule: White by default, Red only on danger
    if (vitalGainLoss && vitalGainLossBadge) {
        if (glResult.ratio !== null && !isNaN(glResult.ratio)) {
            vitalGainLoss.innerText = glResult.ratio.toFixed(2);
            
            // Status Badge & Color
            if (glResult.ratio > 1.2) {
                vitalGainLoss.style.color = '#ffffff'; // White for good
                vitalGainLossBadge.innerText = 'Anti-fragile';
                vitalGainLossBadge.style.color = '#4ade80';
            } else if (glResult.ratio >= 0.8) {
                vitalGainLoss.style.color = '#ffffff'; // White for warning
                vitalGainLossBadge.innerText = 'Warning';
                vitalGainLossBadge.style.color = '#facc15';
            } else {
                vitalGainLoss.style.color = '#f87171'; // RED ALERT for danger
                vitalGainLossBadge.innerText = 'Fragile';
                vitalGainLossBadge.style.color = '#f87171';
            }
        } else {
            vitalGainLoss.innerText = 'N/A';
            vitalGainLoss.style.color = 'var(--text-muted)';
            vitalGainLossBadge.innerText = '';
        }
    }

    // Win Rate (Weekly) - Red Alert Rule
    if (vitalWinRate && vitalWinRateBadge) {
        if (wrResult.winRate !== null && !isNaN(wrResult.winRate)) {
            vitalWinRate.innerText = wrResult.winRate.toFixed(1) + '%';
            
            // Status Badge & Color
            if (wrResult.winRate > 55) {
                vitalWinRate.style.color = '#ffffff'; // White for good
                vitalWinRateBadge.innerText = 'Comfort Zone';
                vitalWinRateBadge.style.color = '#4ade80';
            } else if (wrResult.winRate >= 45) {
                vitalWinRate.style.color = '#ffffff'; // White for warning
                vitalWinRateBadge.innerText = 'Normal Trend';
                vitalWinRateBadge.style.color = '#facc15';
            } else {
                vitalWinRate.style.color = '#f87171'; // RED ALERT for danger
                vitalWinRateBadge.innerText = 'Stress Zone';
                vitalWinRateBadge.style.color = '#f87171';
            }
        } else {
            vitalWinRate.innerText = 'N/A';
            vitalWinRate.style.color = 'var(--text-muted)';
            vitalWinRateBadge.innerText = '';
        }
    }

    // Expectancy - White by default, Red only when negative
    if (vitalExpectancy) {
        const expResult = Finance.calculateExpectancy(glResult, wrResult);
        if (expResult.expectancy !== null && !isNaN(expResult.expectancy)) {
            const expStr = (expResult.expectancy >= 0 ? '+' : '') + expResult.expectancy.toFixed(2) + '%';
            vitalExpectancy.innerText = expStr;
            // White for positive/zero, Red for negative
            vitalExpectancy.style.color = expResult.expectancy >= 0 ? '#ffffff' : '#f87171';
        } else {
            vitalExpectancy.innerText = 'N/A';
            vitalExpectancy.style.color = 'var(--text-muted)';
        }
    }

    // Update Bottom Performance Metrics Display with Delta
    const sharpeEl = document.getElementById('perf-sharpe');
    const sharpeDeltaEl = document.getElementById('perf-sharpe-delta');
    const sortinoEl = document.getElementById('perf-sortino');
    const sortinoDeltaEl = document.getElementById('perf-sortino-delta');
    const mddEl2 = document.getElementById('perf-mdd2');
    const mddDeltaEl = document.getElementById('perf-mdd-delta');
    const alphaEl = document.getElementById('perf-alpha');
    const alphaDeltaEl = document.getElementById('perf-alpha-delta');
    const betaEl = document.getElementById('perf-beta');
    const correlationEl = document.getElementById('perf-correlation');

    // Helper to set delta display with new CSS classes
    const setDelta = (el, delta, isPercentage = false, invertSign = false) => {
        if (!el) return;
        if (delta == null || isNaN(delta)) {
            el.textContent = '';
            el.className = 'metric-delta';
            return;
        }
        const displayDelta = invertSign ? -delta : delta;
        const sign = displayDelta > 0 ? '+' : '';
        if (isPercentage) {
            el.textContent = `△${sign}${(displayDelta * 100).toFixed(1)}%`;
        } else {
            el.textContent = `△${sign}${displayDelta.toFixed(2)}`;
        }
        el.className = 'metric-delta ' + (displayDelta > 0 ? 'positive' : displayDelta < 0 ? 'negative' : 'neutral');
    };

    if (sharpeEl) {
        sharpeEl.textContent = metrics.sharpe != null ? metrics.sharpe.toFixed(2) : '--';
    }
    if (sharpeDeltaEl && metrics.sharpe != null && metrics.spySharpe != null) {
        setDelta(sharpeDeltaEl, metrics.sharpe - metrics.spySharpe);
    }
    
    if (sortinoEl) {
        sortinoEl.textContent = metrics.sortino != null ? metrics.sortino.toFixed(2) : '--';
    }
    if (sortinoDeltaEl && metrics.sortino != null && metrics.spySortino != null) {
        setDelta(sortinoDeltaEl, metrics.sortino - metrics.spySortino);
    }
    
    if (mddEl2) {
        mddEl2.textContent = metrics.mdd != null ? (-metrics.mdd * 100).toFixed(1) + '%' : '--%';
    }
    if (mddDeltaEl && metrics.mdd != null && metrics.spyMdd != null) {
        // Delta = SPY_MDD - Portfolio_MDD (positive means better)
        setDelta(mddDeltaEl, metrics.spyMdd - metrics.mdd, true, false);
    }
    
    if (alphaEl) {
        if (metrics.alpha != null) {
            const alphaVal = (metrics.alpha * 100).toFixed(2);
            alphaEl.textContent = alphaVal + '%';
            // alphaEl.className = 'metric-value ' + (metrics.alpha >= 0 ? 'delta-positive' : 'delta-negative'); 
            // Use standard styling or just text
        } else {
            alphaEl.textContent = '--%';
        }
    }
    if (alphaDeltaEl && metrics.alpha != null) {
        setDelta(alphaDeltaEl, metrics.alpha, true);
    }
    
    if (betaEl) {
        betaEl.textContent = metrics.beta != null ? metrics.beta.toFixed(2) : '--';
    }
    
    if (correlationEl) {
        correlationEl.textContent = metrics.correlation != null ? metrics.correlation.toFixed(2) : '--';
    }

    // Also update System Overview stats (if they still exist on page)
    const riskCagrEl = document.getElementById('risk-cagr');
    const riskStdEl = document.getElementById('risk-std');
    if (riskCagrEl && metrics.cagr != null) {
        riskCagrEl.textContent = (metrics.cagr * 100).toFixed(2) + '%';
    }
    if (riskStdEl && metrics.stdDev != null) {
        riskStdEl.textContent = (metrics.stdDev * 100).toFixed(2) + '%';
    }

    // Prepare chart data - Create labels with month markers
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let lastMonth = -1;
    const labels = aumHistory.map((item, index) => {
        const date = new Date(item.date);
        const month = date.getMonth();
        
        // Show month name only at first trading day of each month
        if (month !== lastMonth) {
            lastMonth = month;
            return monthNames[month];
        }
        return '';  // Empty label for non-first days
    });

    // Track which indices are month boundaries for grid lines
    const monthBoundaryIndices = [];
    lastMonth = -1;
    aumHistory.forEach((item, index) => {
        const date = new Date(item.date);
        const month = date.getMonth();
        if (month !== lastMonth) {
            monthBoundaryIndices.push(index);
            lastMonth = month;
        }
    });

    const aumValues = aumHistory.map(item => item.totalValue);
    const ma60Values = ma60Data.map(item => item.ma);

    // Destroy existing charts if they exist
    if (performanceChart) {
        performanceChart.destroy();
    }
    if (histogramChart) {
        histogramChart.destroy();
    }
    if (alphaCurveChart) {
        alphaCurveChart.destroy();
    }

    // Create Main Performance Chart (Line) - Modern Dashboard Style
    performanceChart = new Chart(perfCtx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                // Tier 1: Hero - Actual Portfolio
                {
                    label: 'Portfolio AUM',
                    data: aumValues,
                    borderColor: '#06d6a0',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 3,  // Thick for Hero
                    order: 1  // Draw on top
                },
                // Reference: 60-Day MA
                {
                    label: '60-Day MA',
                    data: ma60Values,
                    borderColor: 'rgba(161, 161, 170, 0.6)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 0.8,
                    order: 4
                },
                // Tier 2: Benchmark - SPY (70% opacity)
                {
                    label: 'SPY (Benchmark)',
                    data: spyNormalized,
                    borderColor: 'rgba(239, 71, 111, 0.7)',  // 70% opacity
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 1.5,
                    hidden: typeof ChartState !== 'undefined' ? !ChartState.overlays.spy : false,
                    order: 3
                },
                // Tier 2: Benchmark - Static (80% opacity, SOLID line)
                {
                    label: 'Static Strategy',
                    data: getStaticDataForDefault(aumHistory),
                    borderColor: 'rgba(139, 92, 246, 0.8)',  // 80% opacity
                    // REMOVED borderDash - Solid line for historical data
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 1.5,
                    hidden: typeof ChartState !== 'undefined' ? !ChartState.overlays.static : true,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false // Disable default tooltip, use external info bar
                },
                // External info bar - update on hover
            },
            onHover: function(event, elements, chart) {
                const infoBar = document.getElementById('info-header-default');
                if (!infoBar) return;
                
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const item = aumHistory[idx];
                    
                    if (item) {
                        // Date
                        const date = new Date(item.date);
                        const dateStr = date.toLocaleDateString('en-US', { 
                            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                        });
                        const dateEl = infoBar.querySelector('.info-date');
                        if (dateEl) dateEl.textContent = dateStr;
                        
                        // AUM
                        const aumEl = document.getElementById('info-default-aum');
                        if (aumEl) aumEl.textContent = '₩' + Math.round(aumValues[idx]).toLocaleString();
                        
                        // Daily Return
                        const dailyEl = document.getElementById('info-default-daily');
                        if (dailyEl) {
                            if (idx > 0 && aumValues[idx - 1]) {
                                const dailyReturn = ((aumValues[idx] - aumValues[idx - 1]) / aumValues[idx - 1] * 100).toFixed(2);
                                dailyEl.textContent = (dailyReturn > 0 ? '+' : '') + dailyReturn + '%';
                                dailyEl.className = 'info-value ' + (dailyReturn >= 0 ? 'positive' : 'negative');
                            } else {
                                dailyEl.textContent = '--';
                                dailyEl.className = 'info-value';
                            }
                        }
                        
                        // Alpha (vs SPY)
                        const alphaEl = document.getElementById('info-default-alpha');
                        const spyVal = spyNormalized[idx];
                        if (alphaEl) {
                            if (spyVal && aumValues[idx]) {
                                const alpha = ((aumValues[idx] - spyVal) / spyVal * 100).toFixed(2);
                                alphaEl.textContent = (alpha > 0 ? '+' : '') + alpha + '%';
                                alphaEl.className = 'info-value ' + (alpha >= 0 ? 'positive' : 'negative');
                            } else {
                                alphaEl.textContent = '--';
                                alphaEl.className = 'info-value';
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: function(context) {
                            // Month boundaries visible at 10% opacity, others nearly invisible
                            if (monthBoundaryIndices.includes(context.index)) {
                                return 'rgba(255, 255, 255, 0.1)';
                            }
                            return 'rgba(255, 255, 255, 0.01)';
                        },
                        lineWidth: function(context) {
                            if (monthBoundaryIndices.includes(context.index)) {
                                return 0.5;
                            }
                            return 0;
                        },
                        // Use scriptable borderDash for safer application
                        borderDash: function(context) {
                            if (monthBoundaryIndices.includes(context.index)) {
                                return [4, 4]; // Subtle dashed line
                            }
                            return [];
                        }
                    },
                    ticks: {
                        color: '#64748b',
                        font: { size: 10, weight: 'bold' },
                        maxRotation: 0,
                        autoSkip: false,
                        callback: function(value, index) {
                            return labels[index] || '';
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.02)'  // Nearly invisible grid
                    },
                    ticks: {
                        color: '#64748b',
                        callback: function(value) {
                            if (value >= 1000000) {
                                return '₩' + (value / 1000000).toFixed(2) + 'M';
                            } else if (value >= 1000) {
                                return '₩' + (value / 1000).toFixed(0) + 'K';
                            }
                            return '₩' + value;
                        },
                        font: { size: 10 }
                    }
                }
            }
        }
    });

    // =====================================================
    // Histogram and Alpha Curve Charts
    // =====================================================
    
    if (histogramCtx && alphaCurveCtx && benchmarkReturns && benchmarkReturns.length > 0) {
        // Calculate excess returns
        const excessReturns = Finance.calculateExcessReturns(dailyReturns, benchmarkReturns);
        
        // Create histogram bins (0.5% interval)
        const histogramData = Finance.createHistogramBins(excessReturns, 0.5);
        
        // Calculate cumulative alpha
        const cumulativeAlpha = Finance.calculateCumulativeAlpha(excessReturns);

        // Find the index of 0% bin for the red line annotation
        const zeroIndex = histogramData.labels.findIndex(l => parseFloat(l) === 0);

        // Create Histogram Chart
        histogramChart = new Chart(histogramCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: histogramData.labels,
                datasets: [{
                    label: 'Days',
                    data: histogramData.counts,
                    backgroundColor: histogramData.colors,
                    borderWidth: 0,
                    barPercentage: 1.0,
                    categoryPercentage: 1.0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false // Use external info bar
                    }
                },
            onHover: function(event, elements, chart) {
                const infoBar = document.getElementById('histogram-chart-info');
                if (!infoBar) return;
                
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const label = histogramData.labels[idx];
                    const count = histogramData.counts[idx];
                    
                    const binEl = document.getElementById('info-histogram-bin');
                    const daysEl = document.getElementById('info-histogram-days');
                    if (binEl) binEl.textContent = label + '%';
                    if (daysEl) daysEl.textContent = count + ' days';
                }
            },
                scales: {
                    x: {
                        grid: {
                            color: function(context) {
                                // Red line at 0%
                                if (context.index === zeroIndex) {
                                    return 'rgba(255, 10, 78, 1)';
                                }
                                return 'rgba(255, 255, 255, 0.03)';
                            },
                            lineWidth: function(context) {
                                if (context.index === zeroIndex) {
                                    return 2;
                                }
                                return 0.5;
                            }
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 9 },
                            maxRotation: 45,
                            callback: function(value, index) {
                                const label = histogramData.labels[index];
                                const val = parseFloat(label);
                                if (val % 1 === 0) return label;
                                return '';
                            }
                        }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: '#64748b',
                            font: { size: 9 },
                            stepSize: 5
                        },
                        title: {
                            display: true,
                            text: 'Days',
                            color: '#64748b',
                            font: { size: 10 }
                        }
                    }
                }
            }
        });

        // Create Alpha Curve Chart
        const alphaLabels = cumulativeAlpha.map((item, i) => {
            const date = new Date(item.date);
            const month = date.getMonth();
            if (i === 0 || new Date(cumulativeAlpha[i-1].date).getMonth() !== month) {
                return monthNames[month];
            }
            return '';
        });
        const alphaValues = cumulativeAlpha.map(item => item.cumulativeAlpha);

        alphaCurveChart = new Chart(alphaCurveCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: alphaLabels,
                datasets: [{
                    label: 'Cumulative Alpha',
                    data: alphaValues,
                    borderColor: '#06d6a0',
                    backgroundColor: 'rgba(6, 214, 160, 0.1)',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    borderWidth: 2,
                    // Segment styling: red when below 0%
                    segment: {
                        borderColor: ctx => {
                            const yVal = ctx.p1.parsed.y;
                            return yVal < 0 ? '#ff0a4e' : '#06d6a0';
                        },
                        backgroundColor: ctx => {
                            const yVal = ctx.p1.parsed.y;
                            return yVal < 0 ? 'rgba(255, 10, 78, 0.1)' : 'rgba(6, 214, 160, 0.1)';
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false // Use external info bar
                    }
                },
            onHover: function(event, elements, chart) {
                const infoBar = document.getElementById('alpha-chart-info');
                if (!infoBar) return;
                
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const item = cumulativeAlpha[idx];
                    
                    if (item) {
                        const dateEl = infoBar.querySelector('.info-date');
                        if (dateEl) dateEl.textContent = item.date || '--';
                        const valEl = document.getElementById('info-cum-alpha');
                        if (valEl) {
                            const val = item.cumulativeAlpha.toFixed(2);
                            valEl.textContent = (val > 0 ? '+' : '') + val + '%';
                            valEl.className = 'info-value ' + (item.cumulativeAlpha >= 0 ? 'positive' : 'negative');
                        }
                    }
                }
            },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: {
                            color: '#64748b',
                            font: { size: 9 },
                            maxRotation: 0,
                            callback: function(value, index) {
                                return alphaLabels[index] || '';
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: function(context) {
                                // Bright cyan dashed line at 0%
                                if (context.tick.value === 0) {
                                    return '#06b6d4';
                                }
                                return 'rgba(255, 255, 255, 0.05)';
                            },
                            lineWidth: function(context) {
                                if (context.tick.value === 0) {
                                    return 2;
                                }
                                return 0.5;
                            },
                            borderDash: function(context) {
                                if (context.tick.value === 0) {
                                    return [6, 4];  // Dashed line
                                }
                                return [];
                            }
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 9 },
                            callback: function(value) {
                                return value.toFixed(1) + '%';
                            }
                        },
                        title: {
                            display: true,
                            text: 'Cum. Alpha (%)',
                            color: '#64748b',
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }

    // ========================================
    // UNDERWATER PLOT (Drawdown Visualization)
    // ========================================
    const underwaterCtx = document.getElementById('underwaterChart');
    if (underwaterCtx) {
        if (underwaterChart) {
            underwaterChart.destroy();
        }

        // Calculate drawdown series for portfolio and SPY using cummax (High Water Mark)
        const portfolioDrawdowns = [];
        const spyDrawdowns = [];
        let portfolioHWM = 0;  // High Water Mark (cummax)
        let spyHWM = 0;

        aumHistory.forEach((item, index) => {
            // Portfolio drawdown using totalValue property
            const portfolioValue = item.totalValue || 0;
            
            // Update HWM (cummax logic)
            if (portfolioValue > portfolioHWM) {
                portfolioHWM = portfolioValue;
            }
            
            // Calculate drawdown: (current - HWM) / HWM
            const portfolioDD = portfolioHWM > 0 ? ((portfolioValue - portfolioHWM) / portfolioHWM) * 100 : 0;
            portfolioDrawdowns.push(portfolioDD);

            // SPY drawdown using spyNormalized array passed to function
            const spyValue = spyNormalized[index] || 100;
            
            if (spyValue > spyHWM) {
                spyHWM = spyValue;
            }
            
            const spyDD = spyHWM > 0 ? ((spyValue - spyHWM) / spyHWM) * 100 : 0;
            spyDrawdowns.push(spyDD);
        });

        // Calculate Delta (Portfolio DD - SPY DD): positive = outperforming (less loss)
        const deltaDrawdowns = portfolioDrawdowns.map((portDD, idx) => portDD - spyDrawdowns[idx]);

        // Build underwater datasets - SPY always visible for comparison
        const underwaterDatasets = [
            {
                label: 'Portfolio DD',
                data: portfolioDrawdowns,
                borderColor: '#06d6a0',
                backgroundColor: 'rgba(6, 214, 160, 0.08)',
                fill: false,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                borderWidth: 2,
                order: 1  // Draw on top
            },
            {
                label: 'SPY DD',
                data: spyDrawdowns,
                borderColor: 'rgba(239, 71, 111, 0.7)',
                backgroundColor: 'rgba(239, 71, 111, 0.0)',
                fill: false,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                borderWidth: 1.5,
                order: 2  // Draw below
            }
        ];

        underwaterChart = new Chart(underwaterCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: underwaterDatasets
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            boxWidth: 12,
                            padding: 8,
                            color: '#94a3b8',
                            font: { size: 9 }
                        }
                    },
                    tooltip: {
                        enabled: false // Use external info bar
                    }
                },
            onHover: function(event, elements, chart) {
                const infoBar = document.getElementById('underwater-chart-info');
                if (!infoBar) return;
                
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const item = aumHistory[idx];
                    
                    if (item) {
                        const dateEl = infoBar.querySelector('.info-date');
                        if (dateEl) dateEl.textContent = item.date || '--';
                        
                        // Portfolio Drawdown
                        const portEl = document.getElementById('info-drawdown');
                        const portDD = portfolioDrawdowns[idx];
                        if (portEl && portDD !== undefined) {
                            portEl.textContent = portDD.toFixed(2) + '%';
                            portEl.className = 'info-value ' + (portDD >= 0 ? '' : 'negative');
                        }
                        
                        // SPY Drawdown (Always visible for comparison)
                        const spyEl = document.getElementById('info-spy-dd');
                        const spyDD = spyDrawdowns[idx];
                        if (spyEl && spyDD !== undefined) {
                            spyEl.textContent = spyDD.toFixed(2) + '%';
                            spyEl.className = 'info-value ' + (spyDD >= 0 ? '' : 'negative');
                        }
                        
                        // Delta (Portfolio DD - SPY DD): Positive = Portfolio outperforming
                        const deltaEl = document.getElementById('info-dd-delta');
                        if (deltaEl && portDD !== undefined && spyDD !== undefined) {
                            const delta = portDD - spyDD; // Less negative = better
                            const deltaSign = delta > 0 ? '+' : '';
                            deltaEl.textContent = deltaSign + delta.toFixed(2) + '%';
                            // Green if portfolio DD is less severe (delta > 0)
                            deltaEl.className = 'info-value ' + (delta >= 0 ? 'positive' : 'negative');
                        }
                        
                        // Calmar Ratio at this point (Cumulative CAGR / MDD at this date)
                        const calmarEl = document.getElementById('info-calmar');
                        if (calmarEl && idx >= 10) { // Need at least 10 data points
                            // Calculate CAGR from start to this point
                            const startValue = aumHistory[0].totalValue;
                            const endValue = aumHistory[idx].totalValue;
                            const startDate = new Date(aumHistory[0].date);
                            const endDate = new Date(aumHistory[idx].date);
                            const years = (endDate - startDate) / (365.25 * 24 * 60 * 60 * 1000);
                            
                            // MDD up to this point
                            let maxDD = 0;
                            for (let i = 0; i <= idx; i++) {
                                maxDD = Math.min(maxDD, portfolioDrawdowns[i]);
                            }
                            
                            if (years > 0.1 && startValue > 0 && Math.abs(maxDD) > 0.1) {
                                const cagr = (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
                                const calmar = cagr / Math.abs(maxDD);
                                calmarEl.textContent = calmar.toFixed(2);
                                calmarEl.className = 'info-value ' + (calmar >= 1 ? 'positive' : calmar >= 0.5 ? '' : 'negative');
                            } else {
                                calmarEl.textContent = '--';
                                calmarEl.className = 'info-value';
                            }
                        } else if (calmarEl) {
                            calmarEl.textContent = '--';
                            calmarEl.className = 'info-value';
                        }
                    }
                }
            },
                scales: {
                    x: {
                        display: true,
                        grid: { display: false },
                        ticks: { display: false }
                    },
                    y: {
                        position: 'right',
                        suggestedMax: 0.5,  // Ensure 0% baseline is visible with some padding
                        grace: '5%',
                        grid: {
                            color: function(context) {
                                if (context.tick.value === 0) {
                                    return '#06b6d4';  // 수면선 (0%) 강조
                                }
                                return 'rgba(255, 255, 255, 0.08)';
                            },
                            lineWidth: function(context) {
                                if (context.tick.value === 0) {
                                    return 2;
                                }
                                return 0.5;
                            }
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 9 },
                            callback: function(value) {
                                return value.toFixed(0) + '%';
                            }
                        }
                    }
                }

            }
        });
    }
    
    // Switch to Default Info Header
    switchInfoHeaderMode('default');
}

/**
 * Update Performance Chart with Compound Vision Projection Lines
 * Uses year-based X-axis for cleaner visualization
 * @param {Object|null} cvData - Compound Vision data from calculateCompoundVision(), or null to clear
 */
function updatePerformanceChartProjection(cvData) {
    if (!performanceChart) {
        console.warn("Performance chart not initialized");
        return;
    }

    // If no cvData, restore original chart and return
    if (!cvData) {
        // Switch back to Default Info Header
        switchInfoHeaderMode('default');
        
        // Reload the original chart (trigger a dashboard refresh would be ideal)
        // For now, just hide projection-related elements
        console.log("🔮 Projection mode disabled - chart will reset on next data update");
        return;
    }

    const inceptionYear = 2024;
    const currentYear = new Date().getFullYear();
    const currentAUM = cvData.currentAUM;
    const targetValue = cvData.targetValue;
    const portfolioCAGR = cvData.portfolioCAGR;
    const benchmarkCAGR = cvData.benchmarkCAGR;

    // Calculate target years
    const portfolioYearsToTarget = cvData.timePortfolio;
    const benchmarkYearsToTarget = cvData.timeBenchmark;
    const maxYearsToTarget = Math.max(portfolioYearsToTarget, benchmarkYearsToTarget);
    const targetYear = currentYear + Math.ceil(maxYearsToTarget);

    // Generate year labels: 2024, 2025, 2026, ... targetYear
    const yearLabels = [];
    for (let year = inceptionYear; year <= targetYear; year++) {
        yearLabels.push("'" + String(year).slice(-2)); // '24, '25, '26...
    }

    // Sample historical data by year-end (or latest available in each year)
    // We need to get aumHistory from window
    const aumHistory = window._globalAumHistory || [];
    const historicalByYear = {};
    
    aumHistory.forEach(item => {
        const year = new Date(item.date).getFullYear();
        // Keep the last (most recent) data point for each year
        historicalByYear[year] = item.totalValue;
    });

    // Build portfolio historical + projection data
    const portfolioData = [];
    const spyData = [];
    
    for (let i = 0; i < yearLabels.length; i++) {
        const year = inceptionYear + i;
        
        if (year <= currentYear) {
            // Historical data
            if (historicalByYear[year]) {
                portfolioData.push(historicalByYear[year]);
                // SPY: estimate based on same starting point
                // For simplicity, use the same value (actual SPY tracking would need separate data)
                spyData.push(historicalByYear[year]);
            } else if (year === inceptionYear && aumHistory.length > 0) {
                // Use first available data point for inception year
                portfolioData.push(aumHistory[0].totalValue);
                spyData.push(aumHistory[0].totalValue);
            } else {
                portfolioData.push(null);
                spyData.push(null);
            }
        } else {
            // Future projection - calculate based on CAGR from current AUM
            const yearsFromNow = year - currentYear;
            const portfolioProjected = currentAUM * Math.pow(1 + portfolioCAGR, yearsFromNow);
            const spyProjected = currentAUM * Math.pow(1 + benchmarkCAGR, yearsFromNow);
            portfolioData.push(portfolioProjected);
            spyData.push(spyProjected);
        }
    }

    // Find the index where projection starts (current year)
    const projectionStartIndex = currentYear - inceptionYear;

    // Create target line data
    const targetLineData = new Array(yearLabels.length).fill(targetValue);

    // Destroy and recreate chart with new configuration
    const perfCtx = document.getElementById('perfChart');
    if (!perfCtx) return;

    if (performanceChart) {
        performanceChart.destroy();
    }

    // Build datasets - SPY and Static ALWAYS included, visibility controlled by hidden property
    const showSPY = typeof ChartState !== 'undefined' ? ChartState.overlays.spy : true;
    const showStatic = typeof ChartState !== 'undefined' ? ChartState.overlays.static : false;
    const hypotheticalCache = window._hypotheticalCache;
    
    // Build Static projection data (use hypo CAGR if available, else portfolio CAGR)
    const staticCAGR = (hypotheticalCache?.stats?.cagr) 
        ? parseFloat(hypotheticalCache.stats.cagr) / 100  // Convert from percentage
        : portfolioCAGR;
    
    // Calculate Static reach date for annotations
    const staticYearsToTarget = Math.log(targetValue / currentAUM) / Math.log(1 + staticCAGR);
    const staticFinishDate = new Date();
    staticFinishDate.setMonth(staticFinishDate.getMonth() + Math.round(staticYearsToTarget * 12));
    
    // Helper: Format date as "May '28"
    const formatMonthYear = (date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[date.getMonth()] + " '" + String(date.getFullYear()).slice(-2);
    };
    
    const staticData = [];
    for (let i = 0; i < yearLabels.length; i++) {
        const year = inceptionYear + i;
        
        if (year <= currentYear) {
            staticData.push(portfolioData[i]);
        } else {
            const yearsFromNow = year - currentYear;
            const staticProjected = currentAUM * Math.pow(1 + staticCAGR, yearsFromNow);
            staticData.push(staticProjected);
        }
    }
    
    const projectionDatasets = [
        // Tier 1: Hero - Portfolio (solid for history, dashed for future)
        {
            label: 'Portfolio',
            data: portfolioData,
            borderColor: '#06d6a0',
            backgroundColor: 'rgba(6, 214, 160, 0.1)',
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 3,  // Thick for Hero
            order: 1,
            segment: {
                borderDash: ctx => ctx.p0DataIndex >= projectionStartIndex ? [6, 4] : [],  // Solid history, dashed future
                borderColor: ctx => ctx.p0DataIndex >= projectionStartIndex ? 'rgba(20, 184, 166, 0.8)' : '#06d6a0'
            }
        },
        // Tier 2: Benchmark - SPY (70% opacity, solid history, dashed future)
        {
            label: 'SPY Benchmark',
            data: spyData,
            borderColor: 'rgba(239, 71, 111, 0.7)',  // 70% opacity
            fill: false,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 1.5,
            hidden: !showSPY,
            order: 3,
            segment: {
                borderDash: ctx => ctx.p0DataIndex >= projectionStartIndex ? [6, 4] : [],  // Solid history, dashed future
                borderColor: ctx => ctx.p0DataIndex >= projectionStartIndex ? 'rgba(239, 71, 111, 0.5)' : 'rgba(239, 71, 111, 0.7)'
            }
        },
        // Tier 2: Benchmark - Static (80% opacity, SOLID history, dashed future)
        {
            label: 'Static Strategy',
            data: staticData,
            borderColor: 'rgba(139, 92, 246, 0.8)',  // 80% opacity
            fill: false,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 1.5,
            // REMOVED global borderDash - handled by segment
            hidden: !showStatic,
            order: 2,
            segment: {
                borderDash: ctx => ctx.p0DataIndex >= projectionStartIndex ? [4, 2] : [],  // Solid history, dashed future
                borderColor: ctx => ctx.p0DataIndex >= projectionStartIndex ? 'rgba(139, 92, 246, 0.6)' : 'rgba(139, 92, 246, 0.8)'
            }
        },
        // 3: Target Goal (always visible)
        {
            label: 'Target Goal',
            data: targetLineData,
            borderColor: 'rgba(250, 204, 21, 0.7)',
            borderWidth: 2,
            borderDash: [8, 4],
            fill: false,
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 0
        }
    ];
    
    console.log(`📊 Projection datasets: SPY=${showSPY}, Static=${showStatic}, StaticCAGR=${(staticCAGR * 100).toFixed(2)}%`);
    
    // Calculate Y-axis range based on all datasets
    const projAllValues = [];
    projectionDatasets.forEach(ds => {
        ds.data.forEach(v => {
            if (v !== null && v !== undefined && !isNaN(v)) {
                projAllValues.push(v);
            }
        });
    });
    const projYMin = projAllValues.length > 0 ? Math.min(...projAllValues) * 0.95 : 0;
    const projYMax = projAllValues.length > 0 ? Math.max(...projAllValues) * 1.05 : 100;

    // Create new chart with year-based X-axis
    performanceChart = new Chart(perfCtx.getContext('2d'), {
        type: 'line',
        data: {
            labels: yearLabels,
            datasets: projectionDatasets
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false  // Removed tooltip - use on-chart annotations instead
                },

                // Smart Axis Labels - show reach dates on X-axis with vertical guide lines
                annotation: {
                    annotations: {
                        // ═══════════════════════════════════════════════════
                        // "Now" vertical line
                        // ═══════════════════════════════════════════════════
                        nowLine: {
                            type: 'line',
                            xMin: projectionStartIndex,
                            xMax: projectionStartIndex,
                            borderColor: 'rgba(255, 255, 255, 0.4)',
                            borderWidth: 1.5,
                            borderDash: [4, 4],
                            label: {
                                display: true,
                                content: 'Now',
                                position: 'start',
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                color: 'rgba(255, 255, 255, 0.7)',
                                font: { size: 9 }
                            }
                        },
                        
                        // ═══════════════════════════════════════════════════
                        // PORTFOLIO REACH - Vertical Line + X-Axis Badge
                        // ═══════════════════════════════════════════════════
                        portfolioReachLine: {
                            type: 'line',
                            xMin: Math.min(cvData.timePortfolio + projectionStartIndex, yearLabels.length - 1),
                            xMax: Math.min(cvData.timePortfolio + projectionStartIndex, yearLabels.length - 1),
                            yMin: 0,
                            yMax: targetValue,
                            borderColor: 'rgba(6, 214, 160, 0.5)',
                            borderWidth: 1.5,
                            borderDash: [4, 4]
                        },
                        portfolioReachBadge: {
                            type: 'label',
                            xValue: Math.min(cvData.timePortfolio + projectionStartIndex, yearLabels.length - 1),
                            yValue: projYMin,  // At bottom (X-axis)
                            backgroundColor: 'rgba(6, 214, 160, 0.95)',
                            color: '#ffffff',
                            font: { size: 10, weight: 'bold' },
                            padding: { top: 4, bottom: 4, left: 8, right: 8 },
                            borderRadius: 12,
                            content: formatMonthYear(cvData.portfolioFinishDate),
                            yAdjust: 15  // Push down to X-axis
                        },
                        
                        // ═══════════════════════════════════════════════════
                        // SPY REACH - Vertical Line + X-Axis Badge
                        // ═══════════════════════════════════════════════════
                        spyReachLine: {
                            type: 'line',
                            xMin: Math.min(cvData.timeBenchmark + projectionStartIndex, yearLabels.length - 1),
                            xMax: Math.min(cvData.timeBenchmark + projectionStartIndex, yearLabels.length - 1),
                            yMin: 0,
                            yMax: targetValue,
                            borderColor: 'rgba(239, 71, 111, 0.4)',
                            borderWidth: 1.5,
                            borderDash: [4, 4]
                        },
                        spyReachBadge: {
                            type: 'label',
                            xValue: Math.min(cvData.timeBenchmark + projectionStartIndex, yearLabels.length - 1),
                            yValue: projYMin,  // At bottom (X-axis)
                            backgroundColor: 'rgba(100, 116, 139, 0.9)',  // Grey for SPY
                            color: '#ffffff',
                            font: { size: 10, weight: 'bold' },
                            padding: { top: 4, bottom: 4, left: 8, right: 8 },
                            borderRadius: 12,
                            content: formatMonthYear(cvData.benchmarkFinishDate),
                            yAdjust: 15  // Push down to X-axis
                        },
                        
                        // ═══════════════════════════════════════════════════
                        // TARGET LINE LABEL
                        // ═══════════════════════════════════════════════════
                        targetLabel: {
                            type: 'label',
                            xValue: 0,
                            yValue: targetValue,
                            backgroundColor: 'rgba(250, 204, 21, 0.15)',
                            color: '#fbbf24',
                            font: { size: 9, weight: 'bold' },
                            padding: { top: 3, bottom: 3, left: 6, right: 6 },
                            borderRadius: 4,
                            content: 'Goal: ₩' + (targetValue >= 1000000000 ? (targetValue/1000000000).toFixed(1) + 'B' : (targetValue/1000000).toFixed(0) + 'M'),
                            position: 'start',
                            xAdjust: 10,
                            yAdjust: 0
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        lineWidth: 1
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 11, weight: 'bold' }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#64748b',
                        callback: function(value) {
                            if (value >= 1000000000) return '₩' + (value / 1000000000).toFixed(2) + 'B';
                            if (value >= 1000000) return '₩' + (value / 1000000).toFixed(2) + 'M';
                            if (value >= 1000) return '₩' + (value / 1000).toFixed(0) + 'K';
                            return '₩' + value.toLocaleString();
                        },
                        font: { size: 10 }
                    },
                    min: projYMin,
                    max: projYMax
                }
            },
            onHover: function(event, elements, chart) {
                if (elements.length > 0) {
                    const idx = elements[0].index;
                    const year = inceptionYear + idx;
                    const portfolioValue = portfolioData[idx] || 0;
                    const spyValue = spyData[idx] || 0;
                    
                    // Update header to hover state
                    updateProjectionInfoHeaderHover(year, portfolioValue, spyValue);
                } else {
                    // Reset to idle state
                    updateProjectionInfoHeaderIdle(cvData);
                }
            }
        }
    });
    
    // Switch to Projection Info Header and initialize Idle state
    switchInfoHeaderMode('projection');
    updateProjectionInfoHeaderIdle(cvData);

    console.log("🔮 Projection chart created:", {
        inceptionYear,
        currentYear,
        targetYear,
        portfolioYearsToTarget: portfolioYearsToTarget.toFixed(1),
        benchmarkYearsToTarget: benchmarkYearsToTarget.toFixed(1),
        yearLabels
    });
}


/**
 * Update Performance Chart with Hypothetical Trajectory overlay
 * Shows static backtest from 2020-08-11 alongside actual portfolio
 * Uses DAILY data points with sparse year-based X-axis labels
 * 
 * @param {Object} hypothetical - Hypothetical trajectory { dates: [], values: [], stats: {} }
 * @param {Object} actualData - Actual portfolio data { dates: [], values: [] }
 */
function updatePerformanceChartWithHypothetical(hypothetical, actualData) {
    const perfCtx = document.getElementById('perfChart');
    if (!perfCtx) {
        console.warn("Performance chart canvas not found");
        return;
    }
    
    // If no hypothetical data, restore original chart
    if (!hypothetical) {
        console.log("📊 Removing hypothetical overlay, restoring original chart...");
        if (typeof window._refreshPerformanceChart === 'function') {
            window._refreshPerformanceChart();
        }
        return;
    }
    
    // Destroy existing chart
    if (performanceChart) {
        performanceChart.destroy();
        performanceChart = null;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Prepare unified date array (all trading days from 2020-08-11)
    // ═══════════════════════════════════════════════════════════════════
    
    const allDates = hypothetical.dates; // Already sorted, from 2020-08-11 to today
    const totalPoints = allDates.length;
    
    console.log(`📊 Hypothetical chart: ${totalPoints} trading days`);
    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Get actual portfolio start value for normalization
    // ═══════════════════════════════════════════════════════════════════
    
    // Find inception date in hypothetical timeline
    const INCEPTION_DATE = '2024-03-12';
    let inceptionIdx = allDates.indexOf(INCEPTION_DATE);
    
    // If exact date not found, find closest
    if (inceptionIdx === -1) {
        inceptionIdx = allDates.findIndex(d => d >= INCEPTION_DATE);
        if (inceptionIdx === -1) {
            console.warn("Cannot find inception date in hypothetical data");
            return;
        }
    }
    
    // Get actual start value
    const actualStartValue = actualData?.values?.[0] || 17400000;
    
    // Get hypothetical value at inception for scaling
    const hypoValueAtInception = hypothetical.values[inceptionIdx];
    const scaleFactor = actualStartValue / hypoValueAtInception;
    
    console.log(`📊 Scale factor: ${scaleFactor.toFixed(4)} (Actual: ₩${actualStartValue.toLocaleString()}, Hypo at inception: ${hypoValueAtInception.toFixed(2)})`);
    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Build data arrays
    // ═══════════════════════════════════════════════════════════════════
    
    // Hypothetical: Scale all values to match actual portfolio's scale
    const hypotheticalData = hypothetical.values.map(v => v * scaleFactor);
    
    // Actual Portfolio: null before inception, real values after
    const actualPortfolioData = new Array(totalPoints).fill(null);
    
    if (actualData && actualData.dates && actualData.values) {
        // Build date -> value map for actual data
        const actualMap = {};
        actualData.dates.forEach((date, i) => {
            actualMap[date] = actualData.values[i];
        });
        
        // Fill in actual values where dates match
        allDates.forEach((date, i) => {
            if (actualMap[date] !== undefined) {
                actualPortfolioData[i] = actualMap[date];
            }
        });
        
        console.log(`📊 Actual portfolio: ${actualData.dates.length} data points mapped`);
    }
    

    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Create sparse X-axis labels (show year markers only)
    // ═══════════════════════════════════════════════════════════════════
    
    const yearBoundaryIndices = [];
    let lastYear = null;
    
    const labels = allDates.map((date, index) => {
        const year = new Date(date).getFullYear();
        
        // Mark year boundaries
        if (year !== lastYear) {
            yearBoundaryIndices.push(index);
            lastYear = year;
            
            // Show year label at first trading day of each year
            return "'" + String(year).slice(-2); // '20, '21, '22, '23, '24, '25
        }
        return ''; // Empty for non-boundary days
    });
    
    console.log(`📊 Year boundaries at indices:`, yearBoundaryIndices);
    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Build datasets - ALL overlays always included, hidden controls visibility
    // ═══════════════════════════════════════════════════════════════════
    
    const showSPY = typeof ChartState !== 'undefined' ? ChartState.overlays.spy : true;
    const showStatic = typeof ChartState !== 'undefined' ? ChartState.overlays.static : true;
    
    // ═══════════════════════════════════════════════════════════════════
    // Build SPY data for full history - normalized to Actual inception AUM
    // ═══════════════════════════════════════════════════════════════════
    
    let spyFullHistoryData = new Array(totalPoints).fill(null);
    
    // Get SPY data from hypothetical cache (if available)
    const hypoCache = window._hypotheticalCache;
    const hypoRawData = window._hypotheticalRawData; // Raw asset data from API
    
    if (hypoRawData && hypoRawData.assets && hypoRawData.assets.SPY) {
        const spyAsset = hypoRawData.assets.SPY;
        
        // Build date -> price map
        const spyPriceMap = {};
        spyAsset.dates.forEach((date, i) => {
            spyPriceMap[date] = spyAsset.prices[i];
        });
        
        // Find SPY price at inception date
        const spyPriceAtInception = spyPriceMap[INCEPTION_DATE];
        
        if (spyPriceAtInception && actualStartValue) {
            // Scale factor: Actual inception AUM / SPY price at inception
            const spyScaleFactor = actualStartValue / spyPriceAtInception;
            
            // Map SPY prices to allDates array
            allDates.forEach((date, i) => {
                if (spyPriceMap[date]) {
                    spyFullHistoryData[i] = spyPriceMap[date] * spyScaleFactor;
                }
            });
            
            console.log(`📊 SPY normalized: scaleFactor=${spyScaleFactor.toFixed(2)}, inception price=${spyPriceAtInception.toFixed(2)}`);
        }
    } else {
        console.warn('📊 SPY data not available in hypothetical cache');
    }

    // ═══════════════════════════════════════════════════════════════════
    // Build Composite 200MA (Adaptive Trend)
    // ═══════════════════════════════════════════════════════════════════
    // Stitch Static (Pre-Inception) + Actual (Post-Inception)
    const compositeData = allDates.map((date, i) => {
        return actualPortfolioData[i] !== null ? actualPortfolioData[i] : (hypotheticalData[i] || 0);
    });
    
    // Implement local helper (Finance util only provides single-point MA)
    const calculateMASeries = (values, period) => {
        const ma = [];
        for (let i = 0; i < values.length; i++) {
            if (i < period - 1) {
                ma.push(null);
                continue;
            }
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += values[i - j];
            }
            ma.push(sum / period);
        }
        return ma;
    };
    
    const ma250Data = calculateMASeries(compositeData, 250);
    
    const datasets = [
        // Tier 1: Hero - Actual Portfolio
        {
            label: 'Actual Portfolio',
            data: actualPortfolioData,
            borderColor: '#06d6a0',
            backgroundColor: 'transparent',
            borderWidth: 3,  // Thick for Hero
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 1  // Draw on top
        },
        // Tier 2: Benchmark - SPY (70% opacity)
        {
            label: 'SPY Benchmark',
            data: spyFullHistoryData,
            borderColor: 'rgba(239, 71, 111, 0.7)',  // 70% opacity
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 3,
            order: 3,
            hidden: !showSPY
        },
        // Tier 2: Benchmark - Static (80% opacity, SOLID line)
        {
            label: 'Static Strategy',
            data: hypotheticalData,
            borderColor: 'rgba(139, 92, 246, 0.8)',  // 80% opacity
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            // REMOVED borderDash - Solid line for historical data
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 3,
            order: 2,
            hidden: !showStatic
        },
        // Tier 1.5: Adaptive Trend Line - 200MA (Gold)
        // Calculated on Composite Data (Static 2020-2024 + Actual 2024-Present)
        {
            label: '250-Day Trend (Adaptive)',
            data: ma250Data,
            borderColor: '#fbbf24', // Amber/Gold
            borderWidth: 2,         // Thicker for Strategic View
            pointRadius: 0,
            fill: false,
            tension: 0.2,
            order: 0, // Top priority
            hidden: !ChartState.overlays.trend 
        }
    ];
    
    console.log(`📊 Full History datasets: SPY=${showSPY}, Static=${showStatic}`);
    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 5.5: Calculate Y-axis range based on ALL visible datasets
    // ═══════════════════════════════════════════════════════════════════
    
    // Collect all non-null values from all datasets
    const allValues = [];
    datasets.forEach(ds => {
        if (!ds.hidden) {
            ds.data.forEach(v => {
                if (v !== null && v !== undefined && !isNaN(v)) {
                    allValues.push(v);
                }
            });
        }
    });
    
    // Always include hypotheticalData even if Static is hidden (for scale reference)
    hypotheticalData.forEach(v => {
        if (v !== null && v !== undefined && !isNaN(v)) {
            allValues.push(v);
        }
    });
    
    const yMin = allValues.length > 0 ? Math.min(...allValues) * 0.95 : 0;  // 5% padding
    const yMax = allValues.length > 0 ? Math.max(...allValues) * 1.05 : 100;  // 5% padding
    
    console.log(`📊 Y-axis range: min=${yMin.toLocaleString()}, max=${yMax.toLocaleString()}`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 6: Create chart
    // ═══════════════════════════════════════════════════════════════════
    
    performanceChart = new Chart(perfCtx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 11 },
                        filter: function(legendItem) {
                            // Only show items with data
                            return legendItem.text !== '';
                        }
                    }
                },
                tooltip: {
                    enabled: false  // Use Info Header instead
                },
                annotation: {
                    annotations: {
                        inceptionLine: {
                            type: 'line',
                            xMin: inceptionIdx,
                            xMax: inceptionIdx,
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                            borderWidth: 1.5,
                            borderDash: [4, 4],
                            label: {
                                display: true,
                                content: 'Inception',
                                position: 'start',
                                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                color: '#94a3b8',
                                font: { size: 9 }
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: function(context) {
                            // Year boundaries more visible
                            if (yearBoundaryIndices.includes(context.index)) {
                                return 'rgba(255, 255, 255, 0.15)';
                            }
                            return 'rgba(255, 255, 255, 0.02)';
                        },
                        lineWidth: function(context) {
                            if (yearBoundaryIndices.includes(context.index)) {
                                return 1;
                            }
                            return 0;
                        }
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 11, weight: 'bold' },
                        maxRotation: 0,
                        autoSkip: false,
                        callback: function(value, index) {
                            // Only show year labels
                            return labels[index] || '';
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#64748b',
                        callback: function(value) {
                            if (value >= 1000000000) return '₩' + (value / 1000000000).toFixed(2) + 'B';
                            if (value >= 1000000) return '₩' + (value / 1000000).toFixed(2) + 'M';
                            if (value >= 1000) return '₩' + (value / 1000).toFixed(0) + 'K';
                            return '₩' + value.toLocaleString();
                        },
                        font: { size: 10 }
                    },
                    min: yMin,
                    max: yMax
                }
            },
            onHover: function(event, elements, chart) {
                const infoBar = document.getElementById('info-header-history');
                if (!infoBar || elements.length === 0) return;
                
                const idx = elements[0].index;
                const date = allDates[idx];
                if (!date) return;
                
                // Date display
                const dateEl = infoBar.querySelector('.info-date');
                if (dateEl) {
                    const d = new Date(date);
                    dateEl.textContent = d.toLocaleDateString('en-US', { 
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                    });
                }
                
                const isAfterInception = idx >= inceptionIdx;
                
                // Toggle header style based on date
                infoBar.classList.toggle('actual-state', isAfterInception && actualPortfolioData[idx] !== null);
                
                // AUM Label + Value
                const labelEl = document.getElementById('info-history-label');
                const aumEl = document.getElementById('info-history-aum');
                
                // Alpha calculation
                const alphaEl = document.getElementById('info-history-alpha');
                
                if (isAfterInception && actualPortfolioData[idx] !== null) {
                    // === AFTER INCEPTION: Actual AUM vs SPY ===
                    if (labelEl) labelEl.textContent = 'Actual AUM';
                    if (aumEl) aumEl.textContent = '₩' + Math.round(actualPortfolioData[idx]).toLocaleString();
                    
                    // Alpha: Actual vs SPY (normalized to inception)
                    if (alphaEl && spyFullHistoryData[idx] && actualPortfolioData[idx]) {
                        const alpha = ((actualPortfolioData[idx] - spyFullHistoryData[idx]) / spyFullHistoryData[idx] * 100).toFixed(2);
                        alphaEl.textContent = (alpha > 0 ? '+' : '') + alpha + '%';
                        alphaEl.className = 'info-value ' + (alpha >= 0 ? 'positive' : 'negative');
                    } else if (alphaEl) {
                        alphaEl.textContent = '--';
                        alphaEl.className = 'info-value';
                    }
                    
                } else {
                    // === BEFORE INCEPTION: Simulated vs SPY (normalized to Static start) ===
                    if (labelEl) labelEl.textContent = 'Simulated';
                    if (aumEl) {
                        aumEl.textContent = hypotheticalData[idx] 
                            ? '₩' + Math.round(hypotheticalData[idx]).toLocaleString() 
                            : '--';
                    }
                    
                    // Alpha: Static vs SPY, normalized to Static's start point
                    if (alphaEl && hypotheticalData[idx] && hypotheticalData[0] && spyFullHistoryData[idx] && spyFullHistoryData[0]) {
                        // Normalize SPY to Static's starting point
                        const normalizedSPY = spyFullHistoryData[idx] / spyFullHistoryData[0] * hypotheticalData[0];
                        const alpha = ((hypotheticalData[idx] - normalizedSPY) / normalizedSPY * 100).toFixed(2);
                        alphaEl.textContent = (alpha > 0 ? '+' : '') + alpha + '%';
                        alphaEl.className = 'info-value ' + (alpha >= 0 ? 'positive' : 'negative');
                    } else if (alphaEl) {
                        alphaEl.textContent = '--';
                        alphaEl.className = 'info-value';
                    }
                }
            }
        }
    });
    
    // Switch to History Info Header
    switchInfoHeaderMode('hypothetical');
    
    console.log("📊 Hypothetical chart created:", {
        totalPoints,
        inceptionIdx,
        actualPointsMapped: actualPortfolioData.filter(v => v !== null).length,
        hypoStats: hypothetical.stats
    });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CTR (CONTRIBUTION TO RETURN) CHART
 * Horizontal bar chart showing each asset's contribution to portfolio returns
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Create/Update CTR (Contribution to Return) Chart
 * Horizontal bar chart showing asset contribution breakdown
 * @param {Object} assetReturns - { ticker: { wtd, ytd, total, contribution, ytdContrib } }
 * @param {Array} portfolio - Current portfolio with weights
 * @param {string} viewMode - '1w', 'ytd', or 'total'
 */
function createCTRChart(assetReturns, portfolio, viewMode = 'total') {
    const ctx = document.getElementById('ctrChart');
    if (!ctx) return;
    
    // Build contribution data
    const contributions = [];
    const totalValue = portfolio.reduce((sum, a) => sum + (a.value || 0), 0);
    
    portfolio.forEach(asset => {
        const returns = assetReturns[asset.ticker] || { wtd: 0, ytd: 0, total: 0, contribution: 0, ytdContrib: 0 };
        const actualWeight = totalValue > 0 ? (asset.value / totalValue) : 0;
        
        let returnVal, contribVal, avgWeight;
        
        if (viewMode === 'total') {
            returnVal = returns.total || 0;
            contribVal = (returns.contribution || 0) * 100; // Convert to percentage
            avgWeight = actualWeight; // Current weight as proxy
        } else if (viewMode === 'ytd') {
            returnVal = returns.ytd || 0;
            contribVal = (returns.ytdContrib || 0) * 100;
            avgWeight = actualWeight;
        } else {
            // WTD (1w)
            returnVal = returns.wtd || 0;
            contribVal = actualWeight * returns.wtd * 100; // Weight × Return
            avgWeight = actualWeight;
        }
        
        // Only include assets with meaningful contribution or weight
        if (Math.abs(contribVal) > 0.001 || actualWeight > 0.01) {
            contributions.push({
                ticker: asset.ticker,
                contribution: contribVal,
                returnVal: returnVal * 100, // Convert to percentage
                weight: avgWeight * 100 // Convert to percentage
            });
        }
    });
    
    // Sort by contribution (highest positive at top, biggest loser at bottom)
    contributions.sort((a, b) => b.contribution - a.contribution);
    
    // Prepare chart data
    const labels = contributions.map(c => c.ticker);
    const data = contributions.map(c => c.contribution);
    const colors = contributions.map(c => {
        if (c.contribution > 0.01) return 'rgba(0, 227, 204, 0.8)';     // Teal/Green
        if (c.contribution < -0.01) return 'rgba(255, 69, 58, 0.8)';   // Red/Orange
        return 'rgba(100, 116, 139, 0.5)';                               // Grey
    });
    const borderColors = contributions.map(c => {
        if (c.contribution > 0.01) return '#00E3CC';
        if (c.contribution < -0.01) return '#FF453A';
        return '#64748b';
    });
    
    // Update total contribution display
    const totalContrib = contributions.reduce((sum, c) => sum + c.contribution, 0);
    const totalEl = document.getElementById('info-ctr-value');
    if (totalEl) {
        totalEl.textContent = (totalContrib >= 0 ? '+' : '') + totalContrib.toFixed(2) + '%';
        totalEl.style.color = totalContrib >= 0 ? '#00E3CC' : '#FF453A';
    }
    
    // Update label text
    const labelEl = document.getElementById('info-ctr-label');
    if (labelEl) {
        const modeLabel = viewMode === 'ytd' ? 'YTD' : (viewMode === 'total' ? 'TOTAL' : '1W');
        labelEl.textContent = `${modeLabel} IMPACT`;
    }
    
    // Store contribution data for tooltips
    const contributionData = contributions;
    
    if (ctrChart) {
        // Update existing chart
        ctrChart.data.labels = labels;
        ctrChart.data.datasets[0].data = data;
        ctrChart.data.datasets[0].backgroundColor = colors;
        ctrChart.data.datasets[0].borderColor = borderColors;
        ctrChart.options.plugins.tooltip.callbacks.label = function(context) {
            const idx = context.dataIndex;
            const c = contributionData[idx];
            if (!c) return '';
            return [
                `Return: ${c.returnVal >= 0 ? '+' : ''}${c.returnVal.toFixed(2)}%`,
                `Weight: ${c.weight.toFixed(1)}%`,
                `Impact: ${c.contribution >= 0 ? '+' : ''}${c.contribution.toFixed(2)}%p`
            ];
        };
        ctrChart.update('none');
    } else {
        // Create new chart
        ctrChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Contribution',
                    data: data,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 4,
                    barThickness: 'flex',
                    maxBarThickness: 24
                }]
            },
            options: {
                indexAxis: 'y',  // Horizontal bar
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#94a3b8',
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(tooltipItems) {
                                return tooltipItems[0].label;
                            },
                            label: function(context) {
                                const idx = context.dataIndex;
                                const c = contributionData[idx];
                                if (!c) return '';
                                return [
                                    `Return: ${c.returnVal >= 0 ? '+' : ''}${c.returnVal.toFixed(2)}%`,
                                    `Weight: ${c.weight.toFixed(1)}%`,
                                    `Impact: ${c.contribution >= 0 ? '+' : ''}${c.contribution.toFixed(2)}%p`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: (ctx) => ctx.tick.value === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)',
                            lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 0.5
                        },
                        ticks: {
                            color: '#64748b',
                            font: { size: 9 },
                            callback: (value) => value.toFixed(1) + '%'
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 10, weight: '500' },
                            padding: 8
                        }
                    }
                }
            }
        });
    }
    
    console.log(`📊 CTR Chart updated: ${contributions.length} assets, total contrib: ${totalContrib.toFixed(2)}%`);
}

/**
 * Toggle Adaptive Trend Line visibility (60MA / 200MA)
 * @param {boolean} visible
 */
function toggleTrendLine(visible) {
    if (typeof ChartState !== 'undefined') {
        ChartState.setOverlay('trend', visible);
        
        // Update Main Chart (60MA / 200MA) - Update visibility without rebuild
        if (performanceChart) {
             // 60MA (Default Mode)
             const dsIndex1 = performanceChart.data.datasets.findIndex(ds => ds.label && ds.label.includes('60-Day'));
             if (dsIndex1 !== -1) {
                 performanceChart.setDatasetVisibility(dsIndex1, visible);
             }
             
             // 250MA (History Mode)
             const dsIndex2 = performanceChart.data.datasets.findIndex(ds => ds.label && ds.label.includes('250-Day'));
             if (dsIndex2 !== -1) {
                 performanceChart.setDatasetVisibility(dsIndex2, visible);
             }
             
             performanceChart.update('none');
        }
        
        console.log(`📊 Trend Line visibility: ${visible ? 'ON' : 'OFF'}`);
    }
}

// Initialize Trend Line Control
// Wait for DOM and ChartState
window.addEventListener('load', () => {
    setTimeout(() => {
        const toggle = document.getElementById('toggle-trend-line');
        if (toggle) {
            // Sync with state
            if (typeof ChartState !== 'undefined') {
                toggle.checked = ChartState.overlays.trend;
            }
            
            // Listen
            toggle.addEventListener('change', (e) => {
                toggleTrendLine(e.target.checked);
            });
            console.log("✅ Trend Line toggle initialized");
        } else {
            console.warn("⚠️ Trend Line toggle not found");
        }
    }, 1000); // Slight delay to ensure DOM is ready
});