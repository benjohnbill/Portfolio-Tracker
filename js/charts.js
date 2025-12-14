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
    
    console.log("📊 SPY visibility:", visible ? 'ON' : 'OFF');
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
                {
                    label: 'Portfolio AUM',
                    data: aumValues,
                    borderColor: '#06d6a0',
                    fill: false,  // No fill
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2
                },
                {
                    label: '60-Day MA',
                    data: ma60Values,
                    borderColor: 'rgba(161, 161, 170, 0.9)',  // Cool gray, solid and visible
                    // Removed borderDash for solid line
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 0.8  // Half of SPY (1.5) approx
                },
                {
                    label: 'SPY (Benchmark)',
                    data: spyNormalized,
                    borderColor: '#ef476f',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    borderWidth: 1.5
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
                const infoBar = document.getElementById('main-chart-info');
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
                        infoBar.querySelector('.info-date').textContent = dateStr;
                        
                        // AUM
                        const aumEl = document.getElementById('info-aum');
                        aumEl.textContent = '₩' + Math.round(aumValues[idx]).toLocaleString();
                        
                        // 60MA
                        const maEl = document.getElementById('info-ma');
                        const maVal = ma60Values[idx];
                        maEl.textContent = maVal ? '₩' + Math.round(maVal).toLocaleString() : '--';
                        
                        // SPY normalized value
                        const spyEl = document.getElementById('info-spy');
                        const spyVal = spyNormalized[idx];
                        spyEl.textContent = spyVal ? '₩' + Math.round(spyVal).toLocaleString() : '--';
                        
                        // Alpha (vs SPY)
                        const alphaEl = document.getElementById('info-alpha');
                        if (spyVal && aumValues[idx]) {
                            const alpha = ((aumValues[idx] - spyVal) / spyVal * 100).toFixed(2);
                            alphaEl.textContent = (alpha > 0 ? '+' : '') + alpha + '%';
                            alphaEl.className = 'info-value ' + (alpha >= 0 ? 'positive' : 'negative');
                        } else {
                            alphaEl.textContent = '--';
                            alphaEl.className = 'info-value';
                        }
                        
                        // Daily return
                        const dailyEl = document.getElementById('info-daily');
                        if (idx > 0 && aumValues[idx - 1]) {
                            const dailyReturn = ((aumValues[idx] - aumValues[idx - 1]) / aumValues[idx - 1] * 100).toFixed(2);
                            dailyEl.textContent = (dailyReturn > 0 ? '+' : '') + dailyReturn + '%';
                            dailyEl.className = 'info-value ' + (dailyReturn >= 0 ? 'positive' : 'negative');
                        } else {
                            dailyEl.textContent = '--';
                            dailyEl.className = 'info-value';
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
                    
                    infoBar.querySelector('.info-date').textContent = label + '%';
                    const valEl = document.getElementById('info-histogram');
                    valEl.textContent = count + ' days';
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
                        infoBar.querySelector('.info-date').textContent = item.date || '--';
                        const valEl = document.getElementById('info-cum-alpha');
                        const val = item.cumulativeAlpha.toFixed(2);
                        valEl.textContent = (val > 0 ? '+' : '') + val + '%';
                        valEl.className = 'info-value ' + (item.cumulativeAlpha >= 0 ? 'positive' : 'negative');
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

        underwaterChart = new Chart(underwaterCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Delta (P-SPY)',
                        data: deltaDrawdowns,
                        borderColor: 'rgba(6, 182, 212, 0.0)',  // Invisible border
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const { ctx, chartArea } = chart;
                            if (!chartArea) return null;
                            
                            // Conditional fill based on value
                            const value = context.raw;
                            if (value >= 0) {
                                return 'rgba(20, 184, 166, 0.25)'; // Teal for outperforming
                            } else {
                                return 'rgba(239, 71, 111, 0.15)'; // Light red for underperforming
                            }
                        },
                        fill: 'origin',
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        borderWidth: 0,
                        order: 3  // Draw at background
                    },
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
                        infoBar.querySelector('.info-date').textContent = item.date || '--';
                        
                        // Portfolio Drawdown
                        const portEl = document.getElementById('info-drawdown');
                        const portDD = portfolioDrawdowns[idx];
                        if (portDD !== undefined) {
                            portEl.textContent = portDD.toFixed(2) + '%';
                            portEl.className = 'info-value ' + (portDD >= 0 ? '' : 'negative');
                        }
                        
                        // SPY Drawdown
                        const spyEl = document.getElementById('info-spy-dd');
                        const spyDD = spyDrawdowns[idx];
                        if (spyDD !== undefined) {
                            spyEl.textContent = spyDD.toFixed(2) + '%';
                            spyEl.className = 'info-value ' + (spyDD >= 0 ? '' : 'negative');
                        }
                        
                        // Delta (Portfolio DD - SPY DD, positive means less loss = better)
                        const deltaEl = document.getElementById('info-dd-delta');
                        if (portDD !== undefined && spyDD !== undefined) {
                            const delta = portDD - spyDD;
                            const isPositive = delta >= 0;
                            deltaEl.textContent = (isPositive ? '↑ +' : '↓ ') + Math.abs(delta).toFixed(2) + '%';
                            deltaEl.className = 'info-value ' + (isPositive ? 'positive' : 'negative');
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
                        max: 0,
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

    // Build datasets - SPY is conditional based on toggle state
    const projectionDatasets = [
        {
            label: 'Portfolio',
            data: portfolioData,
            borderColor: '#06d6a0',
            backgroundColor: 'rgba(6, 214, 160, 0.1)',
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            borderWidth: 2,
            segment: {
                borderDash: ctx => ctx.p0DataIndex >= projectionStartIndex ? [6, 4] : [],
                borderColor: ctx => ctx.p0DataIndex >= projectionStartIndex ? 'rgba(20, 184, 166, 0.8)' : '#06d6a0'
            }
        }
    ];
    
    // Add SPY only if toggle is ON
    if (window._showSPY !== false) {
        projectionDatasets.push({
            label: 'SPY Benchmark',
            data: spyData,
            borderColor: '#ef476f',
            fill: false,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 1.5,
            segment: {
                borderDash: ctx => ctx.p0DataIndex >= projectionStartIndex ? [6, 4] : [],
                borderColor: ctx => ctx.p0DataIndex >= projectionStartIndex ? 'rgba(239, 71, 111, 0.7)' : '#ef476f'
            }
        });
    }
    
    // Add Target Goal line
    projectionDatasets.push({
        label: 'Target Goal',
        data: targetLineData,
        borderColor: 'rgba(250, 204, 21, 0.7)',
        borderWidth: 2,
        borderDash: [8, 4],
        fill: false,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0
    });

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
                    enabled: true,
                    backgroundColor: 'rgba(15, 20, 32, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#94a3b8',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            if (value == null) return '';
                            return context.dataset.label + ': ₩' + Math.round(value).toLocaleString();
                        }
                    }
                },
                // Add annotation for "Now" marker
                annotation: {
                    annotations: {
                        nowLine: {
                            type: 'line',
                            xMin: projectionStartIndex,
                            xMax: projectionStartIndex,
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 2,
                            borderDash: [4, 4],
                            label: {
                                display: true,
                                content: 'Now',
                                position: 'start'
                            }
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
                            if (value >= 100000000) {
                                return '₩' + (value / 100000000).toFixed(1) + '억';
                            } else if (value >= 10000000) {
                                return '₩' + (value / 10000000).toFixed(0) + '천만';
                            } else if (value >= 1000000) {
                                return '₩' + (value / 1000000).toFixed(0) + 'M';
                            }
                            return '₩' + value.toLocaleString();
                        },
                        font: { size: 10 }
                    }
                }
            }
        }
    });

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
 * @param {Object} ghostBenchmark - Ghost benchmark { dates: [], values: [] } for slope comparison
 * @param {Object} actualData - Actual portfolio data { dates: [], values: [] }
 */
function updatePerformanceChartWithHypothetical(hypothetical, ghostBenchmark, actualData) {
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
    
    // Ghost Benchmark: null before inception, rebased hypothetical after
    let ghostData = new Array(totalPoints).fill(null);
    
    if (ghostBenchmark && ghostBenchmark.values && ghostBenchmark.values.length > 0) {
        // Build date -> value map for ghost
        const ghostMap = {};
        ghostBenchmark.dates.forEach((date, i) => {
            ghostMap[date] = ghostBenchmark.values[i];
        });
        
        // Fill in ghost values where dates match
        allDates.forEach((date, i) => {
            if (ghostMap[date] !== undefined) {
                ghostData[i] = ghostMap[date];
            }
        });
        
        console.log(`📊 Ghost benchmark: ${ghostBenchmark.dates.length} data points mapped`);
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
    // STEP 5: Build datasets
    // ═══════════════════════════════════════════════════════════════════
    
    const datasets = [
        {
            label: 'Hypothetical Strategy',
            data: hypotheticalData,
            borderColor: 'rgba(20, 184, 166, 0.7)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [6, 3],
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 3,
            order: 2
        },
        {
            label: 'Actual Portfolio',
            data: actualPortfolioData,
            borderColor: '#06d6a0',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 1
        }
    ];
    
    // Add Ghost Benchmark if available
    if (ghostData.some(v => v !== null)) {
        datasets.push({
            label: 'Ghost Benchmark',
            data: ghostData,
            borderColor: 'rgba(251, 191, 36, 0.5)',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [4, 2],
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 0,
            order: 3
        });
    }
    
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
                    enabled: true,
                    backgroundColor: 'rgba(15, 20, 32, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#94a3b8',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: function(context) {
                            const idx = context[0].dataIndex;
                            return allDates[idx] || '';
                        },
                        label: function(context) {
                            const value = context.raw;
                            if (value == null) return '';
                            return context.dataset.label + ': ₩' + Math.round(value).toLocaleString();
                        }
                    }
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
                            if (value >= 100000000) {
                                return '₩' + (value / 100000000).toFixed(1) + '억';
                            } else if (value >= 10000000) {
                                return '₩' + (value / 10000000).toFixed(0) + '천만';
                            } else if (value >= 1000000) {
                                return '₩' + (value / 1000000).toFixed(1) + 'M';
                            }
                            return '₩' + value.toLocaleString();
                        },
                        font: { size: 10 }
                    }
                }
            }
        }
    });
    
    console.log("📊 Hypothetical chart created:", {
        totalPoints,
        inceptionIdx,
        actualPointsMapped: actualPortfolioData.filter(v => v !== null).length,
        ghostPointsMapped: ghostData.filter(v => v !== null).length,
        hypoStats: hypothetical.stats
    });
}

/**
 * Store reference to refresh function for restoring original chart
 */
function setPerformanceChartRefreshCallback(callback) {
    window._refreshPerformanceChart = callback;
}


/**
 * Update Performance Chart with Hypothetical overlay for Slope Comparison
 * Uses ORIGINAL chart range (Inception~Present) with hypothetical added
 * 
 * @param {Object} hypothetical - Hypothetical trajectory { dates: [], values: [], stats: {} }
 * @param {Object} actualData - Actual portfolio data { dates: [], values: [] }
 */
function updatePerformanceChartCompareSlope(hypothetical, actualData) {
    const perfCtx = document.getElementById('perfChart');
    if (!perfCtx) {
        console.warn("Performance chart canvas not found");
        return;
    }
    
    // Destroy existing chart
    if (performanceChart) {
        performanceChart.destroy();
        performanceChart = null;
    }
    
    // Get original chart data from global storage
    const aumHistory = window._globalAumHistory;
    const spyNormalized = window._globalSpyNormalized;
    const ma60Data = window._globalMa60Data;
    
    if (!aumHistory || aumHistory.length < 2) {
        console.warn("No AUM history for compare slope chart");
        return;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Build hypothetical data aligned with actual dates
    // ═══════════════════════════════════════════════════════════════════
    
    // Build date -> hypothetical value map
    const hypoMap = {};
    if (hypothetical && hypothetical.dates) {
        const actualStartValue = actualData?.values?.[0] || aumHistory[0]?.totalValue || 17400000;
        
        // Find inception index in hypothetical
        const INCEPTION_DATE = '2024-03-12';
        let inceptionIdx = hypothetical.dates.indexOf(INCEPTION_DATE);
        if (inceptionIdx === -1) {
            inceptionIdx = hypothetical.dates.findIndex(d => d >= INCEPTION_DATE);
        }
        
        // Scale factor to match actual portfolio at inception
        const hypoValueAtInception = inceptionIdx >= 0 ? hypothetical.values[inceptionIdx] : hypothetical.values[0];
        const scaleFactor = actualStartValue / hypoValueAtInception;
        
        hypothetical.dates.forEach((date, i) => {
            hypoMap[date] = hypothetical.values[i] * scaleFactor;
        });
        
        console.log(`📊 Compare Slope: Scale factor ${scaleFactor.toFixed(4)}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Create labels and data arrays
    // ═══════════════════════════════════════════════════════════════════
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let lastMonth = -1;
    
    const labels = aumHistory.map((item, index) => {
        const date = new Date(item.date);
        const month = date.getMonth();
        
        if (month !== lastMonth) {
            lastMonth = month;
            return monthNames[month];
        }
        return '';
    });
    
    // Track month boundaries
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
    const ma60Values = ma60Data ? ma60Data.map(item => item.ma) : [];
    
    // Build hypothetical values aligned with aumHistory dates
    const hypotheticalValues = aumHistory.map(item => {
        const d = new Date(item.date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        return hypoMap[dateStr] || null;
    });
    
    console.log(`📊 Compare Slope: ${hypotheticalValues.filter(v => v !== null).length} hypothetical points mapped`);
    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Build datasets (same as original + hypothetical)
    // SPY dataset is conditional based on toggle state
    // ═══════════════════════════════════════════════════════════════════
    
    const datasets = [
        {
            label: 'Portfolio AUM',
            data: aumValues,
            borderColor: '#06d6a0',
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2.5,
            order: 1
        },
        {
            label: '60-Day MA',
            data: ma60Values,
            borderColor: 'rgba(161, 161, 170, 0.9)',
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 0.8,
            order: 3
        }
    ];
    
    // Add SPY only if toggle is ON
    if (window._showSPY !== false) {
        datasets.push({
            label: 'SPY (Benchmark)',
            data: spyNormalized,
            borderColor: '#ef476f',
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 1.5,
            order: 4
        });
    }
    
    // Add Hypothetical Strategy
    datasets.push({
        label: 'Hypothetical Strategy',
        data: hypotheticalValues,
        borderColor: 'rgba(251, 191, 36, 0.8)',  // Amber/Gold color
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 3],
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 3,
        order: 2
    });

    
    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Create chart (same structure as original performance chart)
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
                        padding: 12,
                        font: { size: 10 }
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(15, 20, 32, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#94a3b8',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        title: function(context) {
                            const idx = context[0].dataIndex;
                            const item = aumHistory[idx];
                            if (item) {
                                const date = new Date(item.date);
                                return date.toLocaleDateString('en-US', { 
                                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                                });
                            }
                            return '';
                        },
                        label: function(context) {
                            const value = context.raw;
                            if (value == null) return '';
                            return context.dataset.label + ': ₩' + Math.round(value).toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: function(context) {
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
                        color: 'rgba(255, 255, 255, 0.02)'
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
    
    console.log("📊 Compare Slope chart created:", {
        totalPoints: aumValues.length,
        hypotheticalMapped: hypotheticalValues.filter(v => v !== null).length,
        spyPoints: spyNormalized?.length || 0
    });
}
