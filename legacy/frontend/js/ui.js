const UI = {
    /**
     * Render Header (Time & Date) and Friday Indicator
     */
    renderHeader: (isFriday) => {
        const dateEl = document.getElementById('current-date');
        const now = new Date();
        if (dateEl) {
            const dateStr = now.getFullYear() + '.' +
                String(now.getMonth() + 1).padStart(2, '0') + '.' +
                String(now.getDate()).padStart(2, '0');
            dateEl.innerText = dateStr;
        }

        // Friday Indicator - Status Badge
        const fridayIndicator = document.getElementById('friday-indicator');
        const sysStatusText = document.getElementById('sys-status-text');
        const sysStatusDot = document.getElementById('sys-status-dot');

        if (fridayIndicator) {
            if (isFriday) {
                fridayIndicator.classList.remove('not-friday');
                fridayIndicator.classList.add('is-friday');
                fridayIndicator.innerHTML = '<i data-lucide="calendar-check"></i><span>REBALANCING DAY</span>';
            } else {
                fridayIndicator.classList.remove('is-friday');
                fridayIndicator.classList.add('not-friday');
                // Check if weekend (Sat = 6, Sun = 0)
                const dayOfWeek = now.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const statusText = isWeekend ? 'MARKET CLOSED' : 'HOLDING PERIOD';
                fridayIndicator.innerHTML = `<i data-lucide="pause-circle"></i><span>${statusText}</span>`;
            }
        }

        // System Status Colors and Text
        if (sysStatusText && sysStatusDot) {
            if (isFriday) {
                sysStatusText.textContent = 'SYSTEM ONLINE';
                sysStatusText.style.color = 'var(--neon-green)';
                sysStatusDot.style.background = 'var(--neon-green)';
            } else {
                sysStatusText.textContent = 'SYSTEM OFFLINE';
                sysStatusText.style.color = 'var(--neon-red)';
                sysStatusDot.style.background = 'var(--neon-red)';
            }
        }

        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * Render Asset Allocation Table and Chart
     * Columns: Asset | Target% | Value | Return | Contrib.
     * Supports toggle between 1W and Total view
     * In Total view: Shows Cumulative Attribution and Ghost rows for past holdings
     * @param {Array} portfolio - Portfolio with asset data
     * @param {Object} chartInstance - Chart.js instance
     * @param {Object} assetReturns - { ticker: { wtd, total, contribution, isGhost } }
     * @param {string} viewMode - '1w' or 'total'
     */
    /**
     * Render Asset Allocation Table and Chart
     * Columns: Asset | Target% | Value | Return | Contrib.
     * Supports toggle between 1W and Total view
     * In Total view: Shows Cumulative Attribution and Ghost rows for past holdings
     * @param {Array} portfolio - Portfolio with asset data
     * @param {Object} chartInstance - Chart.js instance
     * @param {Object} assetReturns - { ticker: { wtd, total, contribution, isGhost } }
     * @param {string} viewMode - '1w' or 'total'
     */
    renderAllocation: (portfolio, chartInstance, assetReturns = {}, viewMode = '1w') => {
        const tbody = document.getElementById('allocation-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        // Update column headers based on viewMode
        const col4Header = document.getElementById('alloc-col4-header');
        const col5Header = document.getElementById('alloc-col5-header');

        if (col4Header && col5Header) {
            if (viewMode === 'total') {
                col4Header.textContent = 'INCEP Δ';
                col5Header.textContent = 'Contrib.';
            } else if (viewMode === 'ytd') {
                col4Header.textContent = 'YTD Δ';
                col5Header.textContent = 'Contrib.';
            } else {
                col4Header.textContent = 'WTD Δ';
                col5Header.textContent = 'CONTRIB.';
            }
        }

        let totalValue = 0;
        portfolio.forEach(asset => {
            totalValue += asset.value || 0;
        });

        // Helper to format large numbers
        const formatLargeNumber = (num, currency = '₩') => {
            if (num >= 1000000) {
                return currency + (num / 1000000).toFixed(2) + 'M';
            } else if (num >= 1000) {
                return currency + (num / 1000).toFixed(2) + 'K';
            }
            return currency + Math.round(num).toLocaleString();
        };

        // Update Total AUM Display (Ticker Tape)
        const totalEl = document.getElementById('total-value');
        if (totalEl) {
            totalEl.innerText = formatLargeNumber(totalValue, '₩');
        }

        const labels = [];
        const data = [];
        const backgroundColors = [];

        // Predefine colors for consistency
        const colorPalette = [
            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
            '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'
        ];

        // Find max contribution AND max return for bar scaling (normalization)
        let maxContrib = 0;
        let maxReturn = 0;
        if (viewMode === 'total') {
             Object.values(assetReturns).forEach(ret => {
                const contrib = ret.contribution || 0;
                maxContrib = Math.max(maxContrib, Math.abs(contrib * 100));
                maxReturn = Math.max(maxReturn, Math.abs((ret.total || 0) * 100));
            });
        } else if (viewMode === 'ytd') {
            // YTD mode: Use YTD returns and YTD contribution
            portfolio.forEach(asset => {
                const returns = assetReturns[asset.ticker] || { ytd: 0, ytdContrib: 0 };
                const contrib = (returns.ytdContrib || 0) * 100;
                maxContrib = Math.max(maxContrib, Math.abs(contrib));
                maxReturn = Math.max(maxReturn, Math.abs((returns.ytd || 0) * 100));
            });
        } else {
            // WTD (1w) mode: Use WTD returns and weight-based contribution
             portfolio.forEach(asset => {
                const actualWeight = totalValue > 0 ? (asset.value / totalValue) : 0;
                const returns = assetReturns[asset.ticker] || { wtd: 0 };
                const contrib = actualWeight * returns.wtd * 100;
                maxContrib = Math.max(maxContrib, Math.abs(contrib));
                maxReturn = Math.max(maxReturn, Math.abs((returns.wtd || 0) * 100));
            });
        }
        if (maxContrib < 0.1) maxContrib = 0.5; // Avoid div by zero or huge bars for tiny movements
        if (maxReturn < 0.5) maxReturn = 2; // Min 2% scale for return bars

        // Render Rows
        portfolio.forEach((asset, index) => {
            const actualWeight = totalValue > 0 ? (asset.value / totalValue) : 0;
            
            // Skip empty
            if (actualWeight === 0 && (asset.value || 0) === 0) return;

            const valueDisplay = formatLargeNumber(asset.value || 0, '₩');
            const weightDisplay = (actualWeight * 100).toFixed(1) + '%';

            // Get return data
            const returns = assetReturns[asset.ticker] || { wtd: 0, ytd: 0, total: 0, contribution: 0 };
            let returnVal, contribVal;

            if (viewMode === 'total') {
                returnVal = returns.total;
                contribVal = (returns.contribution || 0) * 100;
            } else if (viewMode === 'ytd') {
                returnVal = returns.ytd;
                contribVal = (returns.ytdContrib || 0) * 100;
            } else {
                returnVal = returns.wtd;
                // WTD Contribution = Weight * WTD Return
                contribVal = actualWeight * returns.wtd * 100;
            }

            const returnClass = returnVal > 0.001 ? 'positive' : (returnVal < -0.001 ? 'negative' : 'neutral');
            const returnDisplay = returnVal !== 0 
                ? (returnVal > 0 ? '+' : '') + (returnVal * 100).toFixed(2) + '%'
                : '-';
            
            // Return bar width
            const returnBarWidth = Math.min(100, (Math.abs(returnVal * 100) / maxReturn) * 100);

            const contribClass = contribVal > 0.0001 ? 'positive' : (contribVal < -0.0001 ? 'negative' : 'neutral');
            const contribDisplay = contribVal !== 0
                ? (contribVal > 0 ? '+' : '') + contribVal.toFixed(2) + '%'
                : '-';
            
            // Contrib bar width relative to max impact
            const contribBarWidth = Math.min(100, (Math.abs(contribVal) / maxContrib) * 100);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="asset-cell">
                        <span class="asset-icon" style="background-color: ${colorPalette[index % colorPalette.length]}"></span>
                        <span class="asset-ticker">${asset.ticker}</span>
                    </div>
                </td>
                <td class="text-center"><span class="table-sub-val">${weightDisplay}</span></td>
                <td class="text-right">${valueDisplay}</td>
                <td class="text-right">
                    <div class="return-cell-wrapper">
                         <span class="${returnClass}" style="font-size:0.8rem;">${returnDisplay}</span>
                         <div class="mini-bar-container">
                             <div class="mini-bar ${returnClass}" style="width:${returnBarWidth}%"></div>
                         </div>
                    </div>
                </td>
                <td class="text-center">
                    <div class="contrib-cell-wrapper">
                         <span class="${contribClass}" style="font-size:0.8rem;">${contribDisplay}</span>
                         <div class="mini-bar-container">
                             <div class="mini-bar ${contribClass}" style="width:${contribBarWidth}%"></div>
                         </div>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);

            // Chart Data
            labels.push(asset.ticker);
            data.push((actualWeight * 100).toFixed(2));
            backgroundColors.push(colorPalette[index % colorPalette.length]);
        });

        // Update Chart
        if (chartInstance) {
            chartInstance.data.labels = labels;
            chartInstance.data.datasets[0].data = data;
            chartInstance.data.datasets[0].backgroundColor = backgroundColors;
            chartInstance.data.datasets[0].borderWidth = 0;
            chartInstance.options.cutout = '70%'; // Thinner donut
            chartInstance.update();
        }
    },
    /**
     * Render Macro Environment (Net Liquidity & Real Yield)
     * Renamed from renderMacroVitals to avoid caching issues.
     */
    renderMacroEnvironment: (data) => {
        const liqEl = document.getElementById('macro-liquidity');
        const liqTrendEl = document.getElementById('macro-liquidity-trend');
        const yieldEl = document.getElementById('macro-yield');
        const yieldTrendEl = document.getElementById('macro-yield-trend');

        // Check core elements only (trend elements may not exist in new layout)
        if (!liqEl || !yieldEl) return;

        // 1. Check if data is null/undefined
        if (!data || !data.net_liquidity || !data.real_yield) {
             liqEl.textContent = "ERR"; 
             yieldEl.textContent = "ERR";
             return;
        }

        // Helper: Get Color
        const getStateColor = (state) => {
            switch(state) {
                case 'safe': return '#00E3CC';   
                case 'danger': return '#FF453A'; 
                default: return '#FFD700';       
            }
        };

        // --- Custom Tooltip Logic ---
        let tooltipEl = document.getElementById('macro-tooltip-custom');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'macro-tooltip-custom';
            tooltipEl.className = 'macro-tooltip';
            document.body.appendChild(tooltipEl);
        }

        const showTooltip = (e, metricName, thresholds, state, val, unit, trend) => {
            const rangeDesc = state === 'danger' ? '⚠️ DANGER ZONE' : state === 'safe' ? '✅ SAFE ZONE' : '⚖️ NEUTRAL ZONE';
            const trendIcon = trend === 'up' ? '▲' : '▼';
            const trendDesc = trend === 'up' ? (metricName === 'Liquidity' ? 'Fueling' : 'Tightening') : (metricName === 'Liquidity' ? 'Draining' : 'Easing');
            
            // Build HTML
            tooltipEl.innerHTML = `
                <div class="mt-header">
                    <span class="mt-title">${metricName}</span>
                    <span class="mt-status ${state}">${rangeDesc}</span>
                </div>
                <div class="mt-body">
                    <div class="mt-row">
                        <span class="mt-label">Current Value</span>
                        <span class="mt-value" style="color:${getStateColor(state)}">${val}${unit}</span>
                    </div>
                    <div class="mt-row">
                        <span class="mt-label">Momentum (MA20)</span>
                        <span class="mt-value">${trendIcon} ${trendDesc}</span>
                    </div>
                     <div class="mt-bar-container">
                        <!-- Simplified Visualization (Conceptual) -->
                        <div class="mt-bar-fill" style="width: 50%; background: linear-gradient(90deg, #FF453A, #FFD700, #00E3CC); opacity: 0.3;"></div>
                    </div>
                    <div class="mt-context">
                        Auto-calibrated on 5Y cycle (2020-2025).<br>
                        <span style="color:#FF453A">Red Zone:</span> ${unit === 'T' ? '<' : '>'} ${thresholds.red}${unit}<br>
                        <span style="color:#00E3CC">Green Zone:</span> ${unit === 'T' ? '>' : '<'} ${thresholds.green}${unit}
                    </div>
                </div>
            `;
            
            tooltipEl.classList.add('visible');
            moveTooltip(e);
        };

        const hideTooltip = () => {
            tooltipEl.classList.remove('visible');
        };

        const moveTooltip = (e) => {
            const x = e.pageX + 15;
            const y = e.pageY + 15;
            // Prevent going off screen
            const rect = tooltipEl.getBoundingClientRect();
            const finalX = (x + rect.width > window.innerWidth) ? x - rect.width - 15 : x;
            
            tooltipEl.style.left = `${finalX}px`;
            tooltipEl.style.top = `${y}px`;
        };

        // Attach Events Wrapper
        const attachTooltipEvents = (element, metricName, thresholds, state, val, unit, trend) => {
            // Find parent container
            const container = element.closest('.macro-vital-item');
            if (!container) return;
            
            container.removeAttribute('title'); // Remove native tooltip
            
            // Clear old listeners (naive approach: clone node to wipe events, or just overwrite onmouseover)
            // Ideally we use addEventListener but need cleanup. For simplicity here:
            container.onmouseenter = (e) => showTooltip(e, metricName, thresholds, state, val, unit, trend);
            container.onmouseleave = hideTooltip;
            container.onmousemove = moveTooltip;
        };

        // 2. Net Liquidity Rendering
        const nl = data.net_liquidity;
        liqEl.textContent = `$${nl.value}${nl.unit}`;
        const nlColor = getStateColor(nl.state);
        liqEl.style.color = nlColor;
        if (liqTrendEl) {
            liqTrendEl.style.color = nlColor;
            liqTrendEl.textContent = nl.trend === 'up' ? '▲' : '▼';
        }
        
        // Attach Tooltip to container
        if (nl.thresholds) {
            attachTooltipEvents(liqEl, "NET LIQUIDITY", nl.thresholds, nl.state, nl.value, nl.trend);
        }

        // 3. Real Yield Rendering
        const ry = data.real_yield;
        yieldEl.textContent = `${ry.value}${ry.unit}`;
        const ryColor = getStateColor(ry.state);
        yieldEl.style.color = ryColor;
        if (yieldTrendEl) {
            yieldTrendEl.style.color = ryColor;
            yieldTrendEl.textContent = ry.trend === 'up' ? '▲' : '▼';
        }

        // Attach Tooltip to container
        if (ry.thresholds) {
             attachTooltipEvents(yieldEl, "10Y REAL YIELD", ry.thresholds, ry.state, ry.value, ry.unit, ry.trend);
        }

        // --- NEW: Update Global Ticker ---
        const tickerLiq = document.getElementById('ticker-liquidity');
        const tickerYield = document.getElementById('ticker-yield');
        
        if (tickerLiq) {
            tickerLiq.textContent = `${nl.value}${nl.unit}`;
            tickerLiq.style.color = nlColor;
        }
        if (tickerYield) {
            tickerYield.textContent = `${ry.value}${ry.unit}`;
            tickerYield.style.color = ryColor;
        }
    },

    /**
     * Render Correlation Matrix Heatmap
     * Risk-based semantic coloring: Red=Risk, Teal=Safety
     * @param {Object} corrData - { matrix: [[...], ...], tickers: [...] }
     */
    renderCorrelationMatrix: (corrData) => {
        const container = document.getElementById('correlation-matrix');
        if (!container || !corrData || !corrData.matrix) return;

        const { matrix, tickers } = corrData;
        container.innerHTML = '';

        // Get correlation color class based on value
        // 5-Level Risk-Dispersion System:
        // Optimal Hedge: r < -0.6 (Deep Teal)
        // Strong Safe: -0.6 <= r < -0.3 (Standard Teal)
        // Neutral: -0.3 <= r < 0.5 (Dark Grey)
        // Warning: 0.5 <= r < 0.7 (Orange/Amber)
        // Risk: r >= 0.7 (Red)
        const getColorClass = (corr, isDiagonal) => {
            if (isDiagonal) return 'diagonal';
            if (corr >= 0.7) return 'risk-high';
            if (corr >= 0.5) return 'warning';
            if (corr < -0.6) return 'optimal-hedge';
            if (corr < -0.3) return 'safe-high';
            return 'neutral';
        };

        // Header row (empty corner + ticker labels)
        const cornerCell = document.createElement('div');
        cornerCell.className = 'corr-header';
        container.appendChild(cornerCell);

        tickers.forEach(ticker => {
            const header = document.createElement('div');
            header.className = 'corr-header';
            header.textContent = ticker;
            container.appendChild(header);
        });

        // Data rows
        for (let i = 0; i < tickers.length; i++) {
            // Row label
            const rowLabel = document.createElement('div');
            rowLabel.className = 'corr-row-label';
            rowLabel.textContent = tickers[i];
            container.appendChild(rowLabel);

            // Cells
            for (let j = 0; j < tickers.length; j++) {
                const corr = matrix[i][j];
                const isDiagonal = i === j;
                const colorClass = getColorClass(corr, isDiagonal);

                const cell = document.createElement('div');
                cell.className = `corr-cell ${colorClass}`;
                cell.textContent = isDiagonal ? '—' : corr.toFixed(2);
                cell.title = `${tickers[i]} × ${tickers[j]}: ${corr.toFixed(3)}`;
                container.appendChild(cell);
            }
        }
    },

    /**
 * Render ACTION REQUIRED Panel (To-Do Style Checklist)
 * Replaces System Logs with actionable checkbox items
 * Features: localStorage persistence, Friday auto-reset, manual reset
 */
renderActionRequired: (sellSignals, buySignals, rebalanceActions) => {
    const container = document.getElementById('action-required-list');
    const statusEl = document.getElementById('action-status');
    const resetBtn = document.getElementById('action-reset-btn');
    
    if (!container) return;

    // Storage Key
    const STORAGE_KEY = 'actionRequiredChecked';
    const LAST_RESET_KEY = 'actionRequiredLastReset';
    
    // Load checked state from localStorage
    const loadCheckedState = () => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch {
            return {};
        }
    };
    
    // Save checked state
    const saveCheckedState = (state) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    };
    
    // Check if Friday auto-reset is needed
    const checkFridayReset = () => {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday
        const lastReset = localStorage.getItem(LAST_RESET_KEY);
        const today = now.toISOString().split('T')[0];
        
        // If it's Friday and we haven't reset today
        if (dayOfWeek === 5 && lastReset !== today) {
            localStorage.setItem(LAST_RESET_KEY, today);
            localStorage.removeItem(STORAGE_KEY);
            return true;
        }
        return false;
    };
    
    // Perform Friday reset check
    checkFridayReset();
    
    // Build action items
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    const actions = [];
    
    // Add rebalancing signals (highest priority)
    rebalanceActions.forEach((a, i) => {
        actions.push({
            id: `rebal_${i}_${a.msg.substring(0, 10)}`,
            type: 'rebal',
            tag: 'REBAL',
            text: a.msg,
            time: timeStr
        });
    });
    
    // Add sell signals
    sellSignals.forEach((s, i) => {
        actions.push({
            id: `sell_${i}_${s.msg.substring(0, 10)}`,
            type: 'signal',
            tag: 'SELL',
            text: s.msg,
            time: timeStr
        });
    });
    
    // Add buy signals
    buySignals.forEach((s, i) => {
        actions.push({
            id: `buy_${i}_${s.msg.substring(0, 10)}`,
            type: 'signal',
            tag: 'BUY',
            text: s.msg,
            time: timeStr
        });
    });
    
    // If no actions, show "all clear" message
    if (actions.length === 0) {
        actions.push({
            id: 'status_ok',
            type: 'info',
            tag: 'INFO',
            text: 'System stable. No actionable signals.',
            time: timeStr
        });
    }
    
    // Load current checked state
    let checkedState = loadCheckedState();
    
    // Render items
    const renderItems = () => {
        // Count pending (unchecked non-info items)
        const pendingCount = actions.filter(a => a.type !== 'info' && !checkedState[a.id]).length;
        
        // Update status badge
        if (statusEl) {
            if (pendingCount === 0) {
                statusEl.textContent = 'ALL CLEAR ✓';
                statusEl.className = 'action-required-status all-clear';
            } else {
                statusEl.textContent = `${pendingCount} PENDING`;
                statusEl.className = 'action-required-status pending';
            }
        }
        
        // Sort: unchecked first, then checked
        const sortedActions = [...actions].sort((a, b) => {
            const aChecked = checkedState[a.id] || false;
            const bChecked = checkedState[b.id] || false;
            if (aChecked === bChecked) return 0;
            return aChecked ? 1 : -1;
        });
        
        container.innerHTML = sortedActions.map(action => {
            const isChecked = checkedState[action.id] || false;
            const isInfoItem = action.type === 'info';
            
            return `
                <div class="action-item ${isChecked ? 'checked' : ''}" data-id="${action.id}" ${isInfoItem ? 'style="cursor:default; opacity:0.7;"' : ''}>
                    ${!isInfoItem ? `
                        <div class="action-checkbox">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    ` : '<span style="width:16px;"></span>'}
                    <span class="action-tag ${action.type}">${action.tag}</span>
                    <span class="action-text">${action.text}</span>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        container.querySelectorAll('.action-item:not([data-id="status_ok"])').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                if (id === 'status_ok') return; // Don't toggle info items
                
                checkedState[id] = !checkedState[id];
                saveCheckedState(checkedState);
                renderItems();
            });
        });
    };
    
    // Reset button handler
    if (resetBtn) {
        resetBtn.onclick = () => {
            checkedState = {};
            saveCheckedState(checkedState);
            renderItems();
        };
    }
    
    // Initial render
    renderItems();
    
    // Re-render Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
},

/**
 * Legacy alias for backward compatibility
 */
renderSignals: function(sellSignals, buySignals, rebalanceActions) {
    this.renderActionRequired(sellSignals, buySignals, rebalanceActions);
},

/**
 * Render Sleep Score in Ticker Tape
 * Compact display of sleep score in the global header
 * @param {Object} sleepData - From Finance.calculateSleepScoreComparison()
 */
renderTickerSleepScore: (sleepData) => {
    const valueEl = document.getElementById('ticker-sleep-value');
    if (!valueEl) return;
    
    if (!sleepData || !sleepData.portfolio) {
        valueEl.textContent = '--';
        valueEl.className = 'ticker-sleep-value';
        return;
    }
    
    const score = sleepData.portfolio.score;
    valueEl.textContent = Math.round(score);
    
    // Apply color class based on score
    if (score >= 80) {
        valueEl.className = 'ticker-sleep-value good';
    } else if (score >= 60) {
        valueEl.className = 'ticker-sleep-value warning';
    } else {
        valueEl.className = 'ticker-sleep-value danger';
    }
},

    /**
     * Render Market Conditions Monitor (Final Graphics with MSTR hints)
     */
    renderConditions: (marketData, derivedStats) => {
        const grid = document.getElementById('condition-grid');
        if (!grid) return;

        grid.innerHTML = '';

        // 1. Common Asset Card Renderer (Minimal) - Updated with MA Chain Display
        const renderAssetCard = (ticker, name, data, currency = 'USD') => {
            if (!data || !data.price) return '';

            const price = data.price;
            const ma20 = data.ma20 || null;
            const ma50 = data.ma50;
            const ma250 = data.ma250;
            const rsi = data.rsi;

            // Get MA Status using Finance utility
            const maStatus = typeof Finance !== 'undefined' && Finance.getMAStatus 
                ? Finance.getMAStatus(price, ma50, ma250, ma20)
                : { status: '--', trend: 'neutral' };

            // Trend State Logic
            const isBullish = price > ma250;
            const isAccelerating = price > ma50;
            const trendState = isBullish && isAccelerating ? 'BULL' : (isBullish ? 'WEAK' : 'BEAR');
            const trendColor = trendState === 'BULL' ? '#10b981' : (trendState === 'WEAK' ? '#eab308' : '#ef4444');

            // MA Chain Color
            const maChainColor = maStatus.trend === 'bullish' ? '#10b981' : 
                                 (maStatus.trend === 'bearish' ? '#ef4444' : '#71717a');

            // RSI Color Logic
            const rsiColor = rsi > 70 ? '#ef4444' : (rsi < 30 ? '#10b981' : '#71717a'); // Zinc-500
            
            // RSI Background Color for No-Trade Zones (user preference: < 35 or > 65)
            const rsiBgColor = rsi > 65 ? 'rgba(239, 68, 68, 0.15)' : (rsi < 35 ? 'rgba(59, 130, 246, 0.15)' : 'transparent');
            const rsiZoneLabel = rsi > 65 ? 'OVERBOUGHT' : (rsi < 35 ? 'OVERSOLD' : '');
            
            // Price display
            const priceDisplay = currency === 'KRW' 
                ? '₩' + Math.round(price).toLocaleString()
                : '$' + price.toFixed(2);

            return `
            <div class="diag-item-graphic minimal-style" 
                 style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px; padding:16px;">
                 
                <div class="diag-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-family:var(--font-head); font-size:0.8rem; color:var(--text-secondary); font-weight:500;">${name}</span>
                        <span style="font-family:var(--font-mono); font-size:1.1rem; color:var(--text-primary); font-weight:600;">${ticker}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-family:var(--font-mono); font-size:1.1rem; color:var(--text-primary);">${priceDisplay}</span>
                        <div style="font-family:var(--font-head); font-size:0.7rem; color:${trendColor}; font-weight:600; margin-top:2px;">${trendState}</div>
                    </div>
                </div>
                
                <!-- MA Chain Status - NEW -->
                <div class="ma-chain-status" style="background:rgba(0,0,0,0.2); padding:6px 8px; border-radius:4px; margin-bottom:8px;">
                    <span style="font-family:var(--font-mono); font-size:0.7rem; color:${maChainColor}; letter-spacing:0.5px;">
                        ${maStatus.status}
                    </span>
                </div>
                
                <div class="diag-visuals" style="background:${rsiBgColor}; padding:6px; border-radius:4px; margin:-4px; margin-top:0;">
                    <!-- RSI Minimal Bar -->
                    <div class="rsi-container" style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.7rem; color:var(--text-secondary); font-family:var(--font-mono);">RSI ${rsi.toFixed(0)}${rsiZoneLabel ? ' <span style=\"color:' + (rsi > 65 ? '#ef4444' : '#3b82f6') + '; font-weight:600;\">' + rsiZoneLabel + '</span>' : ''}</span>
                        <div style="flex:1; height:4px; background:#27272a; border-radius:2px; overflow:hidden;">
                            <div style="width: ${rsi}%; background-color: ${rsiColor}; height:100%;"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        };

        // Render 4 Main Assets
        // TLT uses TLT_US (real US TLT) for accurate diagnostics signals
        grid.innerHTML += renderAssetCard('TLT', 'Bonds', marketData?.TLT_US, 'USD');
        grid.innerHTML += renderAssetCard('GLDM', 'Gold', marketData?.GLDM, 'USD');
        grid.innerHTML += renderAssetCard('CSI300', 'China', marketData?.CSI300, 'KRW');
        grid.innerHTML += renderAssetCard('MSTR', 'Crypto', marketData?.MSTR, 'USD');

        // 2. Gauge Widgets for MNAV and Z-Score with Static Color Zones
        
        // Z-Score Gauge: 5 zones (-0.5 to 4.0)
        // Blue(-0.5~0) | Green(0~1.5) | Yellow(1.5~2.0) | Orange(2.0~3.5) | Red(3.5~4.0)
        const renderZScoreGauge = () => {
            const minVal = -0.5;
            const maxVal = 4.0;
            const range = maxVal - minVal; // 4.5
            
            // Calculate zone widths as percentages
            const blueEnd = (0 - minVal) / range * 100;        // 11.1%
            const greenEnd = (1.5 - minVal) / range * 100;     // 44.4%
            const yellowEnd = (2.0 - minVal) / range * 100;    // 55.6%
            const orangeEnd = (3.5 - minVal) / range * 100;    // 88.9%
            
            const gradientStyle = `linear-gradient(to right, 
                #3b82f6 0%, #3b82f6 ${blueEnd}%, 
                #10b981 ${blueEnd}%, #10b981 ${greenEnd}%, 
                #eab308 ${greenEnd}%, #eab308 ${yellowEnd}%, 
                #f59e0b ${yellowEnd}%, #f59e0b ${orangeEnd}%, 
                #ef4444 ${orangeEnd}%, #ef4444 100%)`;
            
            return `
            <div class="gauge-widget zscore-gauge" id="zscore-widget" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:12px;">
                <div class="gauge-header" style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span class="gauge-title" style="font-family:var(--font-head); font-size:0.8rem; color:var(--text-secondary);">BTC MVRV Z-Score</span>
                    <a href="https://coinank.com/ko/chart/indicator/mvrv-z-score" target="_blank" style="color:var(--text-secondary);"><i data-lucide="external-link" style="width:12px;"></i></a>
                </div>
                
                <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:8px;">
                     <span class="gauge-value" id="zscore-value" style="font-family:var(--font-mono); font-size:1.5rem; font-weight:600; color:var(--text-primary);">--</span>
                     <input type="number" id="zscore-input" class="minimal-input" placeholder="Set" step="0.01" style="background:transparent; border:none; border-bottom:1px solid var(--border-color); color:var(--text-secondary); font-family:var(--font-mono); width:60px; font-size:0.8rem;" 
                           data-min="${minVal}" data-max="${maxVal}">
                </div>

                <div class="gauge-track" id="zscore-track" style="height:8px; border-radius:4px; position:relative; overflow:hidden; background:${gradientStyle};">
                    <div class="gauge-marker" id="zscore-marker" style="position:absolute; width:4px; height:100%; background:#fff; left:50%; box-shadow:0 0 6px white; border-radius:2px; transition:left 0.3s;"></div>
                </div>
                
                <div class="gauge-labels" style="display:flex; justify-content:space-between; font-size:0.6rem; color:var(--text-secondary); margin-top:4px; font-family:var(--font-mono);">
                    <span style="color:#3b82f6;">🔵 Z<0</span>
                    <span style="color:#10b981;">🟢 0~1.5</span>
                    <span style="color:#eab308;">🟡 ~2.0</span>
                    <span style="color:#f59e0b;">🟠 ~3.5</span>
                    <span style="color:#ef4444;">🔴 >3.5</span>
                </div>
            </div>`;
        };
        
        // MNAV Gauge: 3 zones (0.5 to 3.0)
        // Green(0.5~1.0) | Yellow(1.0~2.5) | Red(2.5~3.0)
        const renderMNAVGauge = () => {
            const minVal = 0.5;
            const maxVal = 3.0;
            const range = maxVal - minVal; // 2.5
            
            // Calculate zone widths as percentages
            const greenEnd = (1.0 - minVal) / range * 100;     // 20%
            const yellowEnd = (2.5 - minVal) / range * 100;    // 80%
            
            const gradientStyle = `linear-gradient(to right, 
                #10b981 0%, #10b981 ${greenEnd}%, 
                #eab308 ${greenEnd}%, #eab308 ${yellowEnd}%, 
                #ef4444 ${yellowEnd}%, #ef4444 100%)`;
            
            return `
            <div class="gauge-widget mnav-gauge" id="mnav-widget" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-bottom:12px;">
                <div class="gauge-header" style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span class="gauge-title" style="font-family:var(--font-head); font-size:0.8rem; color:var(--text-secondary);">MSTR MNAV</span>
                    <a href="https://www.strategy.com/" target="_blank" style="color:var(--text-secondary);"><i data-lucide="external-link" style="width:12px;"></i></a>
                </div>
                
                <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:8px;">
                     <span class="gauge-value" id="mnav-value" style="font-family:var(--font-mono); font-size:1.5rem; font-weight:600; color:var(--text-primary);">--</span>
                     <input type="number" id="mnav-input" class="minimal-input" placeholder="Set" step="0.01" style="background:transparent; border:none; border-bottom:1px solid var(--border-color); color:var(--text-secondary); font-family:var(--font-mono); width:60px; font-size:0.8rem;" 
                           data-min="${minVal}" data-max="${maxVal}">
                </div>

                <div class="gauge-track" id="mnav-track" style="height:8px; border-radius:4px; position:relative; overflow:hidden; background:${gradientStyle};">
                    <div class="gauge-marker" id="mnav-marker" style="position:absolute; width:4px; height:100%; background:#fff; left:50%; box-shadow:0 0 6px white; border-radius:2px; transition:left 0.3s;"></div>
                </div>
                
                <div class="gauge-labels" style="display:flex; justify-content:space-between; font-size:0.6rem; color:var(--text-secondary); margin-top:4px; font-family:var(--font-mono);">
                    <span style="color:#10b981;">🟢 <1.0</span>
                    <span style="color:#eab308;">🟡 1.0~2.5</span>
                    <span style="color:#ef4444;">🔴 >2.5</span>
                </div>
            </div>`;
        };

        // Render both gauges
        grid.innerHTML += renderMNAVGauge();
        grid.innerHTML += renderZScoreGauge();

        // 3. Signal Badge - Shows current MSTR algo signal status
        const renderSignalBadge = () => {
            return `
            <div id="signal-badge-container" class="signal-badge-widget" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:8px; padding:16px; margin-top:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="font-family:var(--font-head); font-size:0.8rem; color:var(--text-secondary);">ALGO SIGNAL</span>
                    <span id="signal-badge" style="font-family:var(--font-mono); font-size:0.75rem; padding:4px 10px; border-radius:12px; background:#27272a; color:#a1a1aa;">
                        ⚪ IDLE
                    </span>
                </div>
                <div id="signal-detail" style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-secondary); min-height:20px;">
                    Enter MNAV/Z-Score to evaluate signals
                </div>
            </div>`;
        };
        
        grid.innerHTML += renderSignalBadge();

        // Re-render Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Add event listeners for gauge inputs
        setTimeout(() => {
            const updateGauge = (inputId, shouldSave = true) => {
                const input = document.getElementById(inputId);
                if (!input) return;
                
                const value = parseFloat(input.value);
                const min = parseFloat(input.dataset.min);
                const max = parseFloat(input.dataset.max);
                const buyThreshold = parseFloat(input.dataset.buy);
                const sellThreshold = parseFloat(input.dataset.sell);
                
                const baseId = inputId.replace('-input', '');
                const valueEl = document.getElementById(`${baseId}-value`);
                const markerEl = document.getElementById(`${baseId}-marker`);
                
                if (isNaN(value)) {
                    if (valueEl) valueEl.textContent = '--';
                    if (markerEl) markerEl.style.left = '50%';
                    // Clear saved value (only if not in simulation mode)
                    if (shouldSave && typeof isInSimulationMode === 'function' && !isInSimulationMode()) {
                        localStorage.removeItem(`jg_gauge_${baseId}`);
                    }
                    return;
                }
                
                // Save to localStorage (skip in simulation mode)
                if (shouldSave) {
                    // Only save to localStorage if NOT in simulation mode
                    if (typeof isInSimulationMode === 'function' && isInSimulationMode()) {
                        console.log(`✨ [Sim] Gauge ${baseId} = ${value} (not saved)`);
                    } else {
                        localStorage.setItem(`jg_gauge_${baseId}`, value.toString());
                    }
                }
                
                // Update value display with color
                if (valueEl) {
                    valueEl.textContent = value.toFixed(2);
                    if (value < buyThreshold) {
                        valueEl.style.color = 'var(--neon-green)';
                    } else if (value > sellThreshold) {
                        valueEl.style.color = 'var(--neon-red)';
                    } else {
                        valueEl.style.color = '#fbbf24';
                    }
                }
                
                // Update marker position (clamped to 0-100%)
                if (markerEl) {
                    const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
                    markerEl.style.left = `${percentage}%`;
                }
            };
            
            ['mnav-input', 'zscore-input'].forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    // Restore saved value from localStorage
                    const baseId = id.replace('-input', '');
                    const markerEl = document.getElementById(`${baseId}-marker`);
                    const savedValue = localStorage.getItem(`jg_gauge_${baseId}`);
                    
                    if (savedValue !== null) {
                        input.value = savedValue;
                        
                        // Animate marker from 0 to target position
                        if (markerEl) {
                            markerEl.style.left = '0%'; // Start at 0
                            setTimeout(() => {
                                updateGauge(id, false); // Animate to saved value
                            }, 50);
                        } else {
                            updateGauge(id, false);
                        }
                    }
                    
                    // Add input listener
                    input.addEventListener('input', () => {
                        updateGauge(id, true);
                        updateSignalBadge(); // Update signal badge on input change
                    });
                }
            });
            
            // Signal Badge Update Function
            const updateSignalBadge = () => {
                const badge = document.getElementById('signal-badge');
                const detail = document.getElementById('signal-detail');
                if (!badge || !detail) return;
                
                const mnavInput = document.getElementById('mnav-input');
                const zscoreInput = document.getElementById('zscore-input');
                
                const mnav = mnavInput ? parseFloat(mnavInput.value) : NaN;
                const zscore = zscoreInput ? parseFloat(zscoreInput.value) : NaN;
                
                // Helper to reset gauge state (for IDLE mode)
                const resetGaugeState = () => {
                    const mnavMarker = document.getElementById('mnav-marker');
                    const zscoreMarker = document.getElementById('zscore-marker');
                    const mnavTrack = document.getElementById('mnav-track');
                    const zscoreTrack = document.getElementById('zscore-track');
                    
                    // Reset markers to center
                    if (mnavMarker) mnavMarker.style.left = '50%';
                    if (zscoreMarker) zscoreMarker.style.left = '50%';
                    
                    // Remove any pulsing animation
                    if (mnavTrack) mnavTrack.style.animation = 'none';
                    if (zscoreTrack) zscoreTrack.style.animation = 'none';
                };
                
                // Check if inputs are valid
                if (isNaN(mnav) || isNaN(zscore)) {
                    badge.textContent = '⚪ IDLE';
                    badge.style.background = '#27272a';
                    badge.style.color = '#a1a1aa';
                    detail.textContent = 'Enter MNAV/Z-Score to evaluate signals';
                    resetGaugeState();
                    return;
                }
                
                // Load MSTR state if available
                const mstrState = typeof MSTRState !== 'undefined' ? MSTRState : { boughtAtLow: false, soldAtHigh: false };
                const mstrInTactical = typeof tacticalTargets !== 'undefined' && tacticalTargets['MSTR'];
                
                // ═══════════════════════════════════════════════════════════════
                // STEP 1: Update gauge markers and apply pulsing for extreme zones
                // ═══════════════════════════════════════════════════════════════
                const updateGaugeMarkers = () => {
                    // Z-Score marker (range: -0.5 to 4.0)
                    const zscoreMarker = document.getElementById('zscore-marker');
                    const zscoreTrack = document.getElementById('zscore-track');
                    if (zscoreMarker && !isNaN(zscore)) {
                        const zMin = -0.5, zMax = 4.0;
                        const zClamped = Math.max(zMin, Math.min(zMax, zscore));
                        const zPercent = ((zClamped - zMin) / (zMax - zMin)) * 100;
                        zscoreMarker.style.left = `${zPercent}%`;
                        
                        // Pulsing animation for extreme zones
                        if (zscore < 0) {
                            zscoreTrack.style.animation = 'pulse-blue 1.5s infinite';
                        } else if (zscore > 3.5) {
                            zscoreTrack.style.animation = 'pulse-red 1.5s infinite';
                        } else {
                            zscoreTrack.style.animation = 'none';
                        }
                    }
                    
                    // MNAV marker (range: 0.5 to 3.0)
                    const mnavMarker = document.getElementById('mnav-marker');
                    const mnavTrack = document.getElementById('mnav-track');
                    if (mnavMarker && !isNaN(mnav)) {
                        const mMin = 0.5, mMax = 3.0;
                        const mClamped = Math.max(mMin, Math.min(mMax, mnav));
                        const mPercent = ((mClamped - mMin) / (mMax - mMin)) * 100;
                        mnavMarker.style.left = `${mPercent}%`;
                        
                        // Pulsing animation for extreme zone
                        if (mnav > 2.5) {
                            mnavTrack.style.animation = 'pulse-red 1.5s infinite';
                        } else {
                            mnavTrack.style.animation = 'none';
                        }
                    }
                };
                
                updateGaugeMarkers();
                
                // ═══════════════════════════════════════════════════════════════
                // STEP 2: Display SIGNAL based on tactical state (actual trading signals)
                // Only actionable signals are displayed; requires tactical conditions
                // ═══════════════════════════════════════════════════════════════
                
                // SELL signals (priority order)
                if (zscore > 3.5 || mnav > 2.5) {
                    badge.textContent = '🔴 HARD EXIT';
                    badge.style.background = 'rgba(239, 68, 68, 0.2)';
                    badge.style.color = '#ef4444';
                    detail.textContent = `Z=${zscore.toFixed(2)}, MNAV=${mnav.toFixed(2)} → MSTR(100%) → DBMF`;
                    return;
                }
                
                if (zscore > 2.0 && mstrInTactical) {
                    badge.textContent = '🟠 PROFIT LOCK';
                    badge.style.background = 'rgba(245, 158, 11, 0.2)';
                    badge.style.color = '#f59e0b';
                    detail.textContent = `Z=${zscore.toFixed(2)} (tactical) → MSTR(50%) → DBMF`;
                    return;
                }
                
                // [DEPRECATED] SOFT ROTATE (Z > 1.0) - Removed per new algo spec
                
                // BUY signals
                if (zscore < 0) {
                    badge.textContent = '🟢 OPPORTUNITY';
                    badge.style.background = 'rgba(16, 185, 129, 0.2)';
                    badge.style.color = '#10b981';
                    detail.textContent = `Z=${zscore.toFixed(2)} < 0 → DBMF(10%) → MSTR`;
                    return;
                }
                
                if (zscore < 1.5 && mstrState.soldAtHigh) {
                    badge.textContent = '🔵 TREND RE-ENTRY';
                    badge.style.background = 'rgba(59, 130, 246, 0.2)';
                    badge.style.color = '#3b82f6';
                    detail.textContent = `Z=${zscore.toFixed(2)} (sold high, check 20MA) → BIL → MSTR`;
                    return;
                }
                
                // No signal - HOLD (but color already applied above)
                badge.textContent = '⚪ HOLD';
                badge.style.background = '#27272a';
                badge.style.color = '#a1a1aa';
                detail.textContent = `Z=${zscore.toFixed(2)}, MNAV=${mnav.toFixed(2)} - No action needed`;
            };
            
            // Initial badge update
            setTimeout(updateSignalBadge, 200);
        }, 100);
    },

    /**
     * Render Risk Metrics
     * @param {Object} stats - Stats object with weeklyReturn, wtdStatus, cagr, stdDev, etc.
     */
    renderRisk: (stats) => {
        if (!stats) return;

        const weeklyPnlEl = document.getElementById('weekly-pnl');
        if (weeklyPnlEl && stats.weeklyReturn !== undefined) {
            const val = stats.weeklyReturn;
            const returnStr = (val > 0 ? '+' : '') + val.toFixed(2) + '%';
            
            // 1. Update Text
            if (stats.wtdStatus && stats.wtdStatus.isFrozen) {
                 weeklyPnlEl.innerHTML = `<span style="opacity: 0.7">❄️</span> ${returnStr}`;
            } else {
                 weeklyPnlEl.innerText = returnStr;
            }
            weeklyPnlEl.style.color = val >= 0 ? '#00E3CC' : '#FF453A'; // Quant colors

            // 2. Apply Glow Effects to Card
            const card = weeklyPnlEl.closest('.pulse-card');
            if (card) {
                card.classList.add('quant-style');
                card.classList.remove('glow-green', 'glow-red', 'glow-neutral');
                
                if (val > 0) card.classList.add('glow-green');
                else if (val < 0) card.classList.add('glow-red');
                else card.classList.add('glow-neutral');

                // 3. Attach Insight Tooltip (Simplified Inline Logic)
                // Use a generic tooltip handler if available, or just custom here
                // Reuse the 'macro-tooltip-custom' if it exists, or create separate
                
                // We'll quickly define the tooltip show/hide for this specific element
                // to avoid huge code duplication, we assume simple text for now or 
                // re-implement the 'attachTooltipEvents' pattern if we want high consistency.
                
                // Let's implement a 'Weekly Pulse Insight' specific tooltip
                card.onmouseenter = (e) => {
                    let tt = document.getElementById('macro-tooltip-custom');
                    if (!tt) return; // Should be created by renderMacroEnvironment already
                    
                    const state = val > 0 ? 'safe' : (val < 0 ? 'danger' : 'neutral');
                    const stateColor = val > 0 ? '#00E3CC' : (val < 0 ? '#FF453A' : '#FFD700');
                    const label = val > 0 ? 'PROFITABLE' : (val < 0 ? 'DRAWDOWN' : 'FLAT');
                    
                    tt.innerHTML = `
                        <div class="mt-header">
                            <span class="mt-title">WEEKLY PULSE</span>
                            <span class="mt-status ${state}">${label}</span>
                        </div>
                        <div class="mt-body">
                            <div class="mt-row">
                                <span class="mt-label">WTD Return</span>
                                <span class="mt-value" style="color:${stateColor}">${returnStr}</span>
                            </div>
                            <div class="mt-context">
                                Performance since Monday Open.<br>
                                Measured against base capital.
                            </div>
                        </div>
                    `;
                    tt.classList.add('visible');
                    
                    // Simple move logic
                    const move = (ev) => {
                        const x = ev.pageX + 15;
                        const y = ev.pageY + 15;
                        const rect = tt.getBoundingClientRect();
                         const finalX = (x + rect.width > window.innerWidth) ? x - rect.width - 15 : x;
                        tt.style.left = `${finalX}px`;
                        tt.style.top = `${y}px`;
                    };
                    card.onmousemove = move;
                    move(e);
                };
                card.onmouseleave = () => {
                     const tt = document.getElementById('macro-tooltip-custom');
                     if(tt) tt.classList.remove('visible');
                     card.onmousemove = null;
                };
            }
        }

        // ===== SIGMA GAUGE RENDERING =====
        if (stats.sigmaStats && stats.weeklyReturn !== undefined) {
            const gaugeFill = document.getElementById('gauge-fill');
            const ghostMarker = document.getElementById('ghost-marker');
            const tooltipWtd = document.getElementById('tooltip-wtd');
            const tooltipAvg = document.getElementById('tooltip-avg');
            const tooltipSigma = document.getElementById('tooltip-sigma');
            
            const { mean, twoSigma } = stats.sigmaStats;
            const wtd = stats.weeklyReturn / 100; // Convert to decimal
            
            if (gaugeFill) {
                // Calculate fill percentage (0% at center, ±50% at ±2σ)
                // wtd / twoSigma gives us position relative to 2σ
                // Clamp to -1 to 1 (representing -2σ to +2σ)
                const normalizedPosition = twoSigma > 0 ? Math.max(-1, Math.min(1, wtd / twoSigma)) : 0;
                const fillWidth = Math.abs(normalizedPosition) * 50; // Max 50% width (half the gauge)
                
                // Reset classes
                gaugeFill.classList.remove('positive', 'negative', 'outlier');
                
                if (wtd >= 0) {
                    gaugeFill.classList.add('positive');
                    gaugeFill.style.left = '50%';
                    gaugeFill.style.right = 'auto';
                } else {
                    gaugeFill.classList.add('negative');
                    gaugeFill.style.right = '50%';
                    gaugeFill.style.left = 'auto';
                }
                
                gaugeFill.style.width = fillWidth + '%';
                
                // Add outlier animation if beyond ±2σ
                if (Math.abs(wtd) > twoSigma && twoSigma > 0) {
                    gaugeFill.classList.add('outlier');
                }
            }
            
            // Position ghost marker at Expectancy (mean)
            if (ghostMarker && twoSigma > 0) {
                // Mean position: 50% + (mean / twoSigma) * 50
                const meanPosition = 50 + (mean / twoSigma) * 50;
                const clampedPosition = Math.max(0, Math.min(100, meanPosition));
                ghostMarker.style.left = clampedPosition + '%';
                ghostMarker.title = `Expectancy: ${(mean * 100).toFixed(2)}%`;
            }
            
            // Update tooltip values
            if (tooltipWtd) {
                tooltipWtd.innerText = (wtd >= 0 ? '+' : '') + (wtd * 100).toFixed(2) + '%';
                // Color matches bar gradient direction (green positive, red negative)
                tooltipWtd.style.color = wtd >= 0 ? '#4ade80' : '#f87171';
            }
            if (tooltipAvg) {
                tooltipAvg.innerText = (mean >= 0 ? '+' : '') + (mean * 100).toFixed(2) + '%';
            }
            if (tooltipSigma) {
                tooltipSigma.innerText = '±' + (twoSigma * 100).toFixed(2) + '%';
            }
        }
        // ===== END SIGMA GAUGE =====

        const safe = (val) => (val !== undefined && val !== null && !isNaN(val)) ? val.toFixed(2) : '--';

        const cagrEl = document.getElementById('risk-cagr');
        const stdEl = document.getElementById('risk-std');

        if (cagrEl) cagrEl.innerText = safe(stats.cagr * 100) + '%';
        if (stdEl) stdEl.innerText = safe(stats.stdDev * 100) + '%';
    },

    /**
     * Render Week-over-Week (WoW) Delta for Identity metrics
     * @param {Object} wowData - { aumDelta, cagrDelta, stdDevDelta, calmarDelta }
     */
    renderWoWDelta: (wowData) => {
        if (!wowData) return;

        // Delta Threshold: Hide if absolute change is less than 0.01% (0.0001 in decimal)
        // This prevents displaying meaningless micro-changes in long-term metrics like CAGR
        const DELTA_THRESHOLD = 0.0001; // 0.01%
        
        const formatDelta = (value, isPercent = true, invert = false) => {
            if (value === null || value === undefined || isNaN(value)) {
                return { text: '', className: 'neutral' };
            }
            
            // Hide delta if below threshold (0.01%)
            if (Math.abs(value) < DELTA_THRESHOLD) {
                return { text: '', className: 'neutral' };
            }
            
            const arrow = value > 0 ? '▲' : (value < 0 ? '▼' : '');
            let text;
            if (isPercent) {
                text = arrow + Math.abs(value * 100).toFixed(2) + '%';
            } else {
                text = arrow + Math.abs(value).toFixed(2);
            }
            
            // Determine class: positive delta is good (except for Risk where it's inverted)
            let isGood = value > 0;
            if (invert) isGood = !isGood;
            
            return {
                text: text,
                className: isGood ? 'positive' : 'negative'
            };
        };

        // AUM Delta (higher is better)
        const aumEl = document.getElementById('aum-wow-delta');
        if (aumEl) {
            const { text, className } = formatDelta(wowData.aumDelta, true, false);
            aumEl.textContent = text;
            aumEl.className = `wow-delta ${className}`;
        }

        // CAGR Delta (higher is better)
        const cagrEl = document.getElementById('cagr-wow-delta');
        if (cagrEl) {
            const { text, className } = formatDelta(wowData.cagrDelta, true, false);
            cagrEl.textContent = text;
            cagrEl.className = `wow-delta ${className}`;
        }

        // Risk (StdDev) Delta (LOWER is better - inverted)
        const riskEl = document.getElementById('risk-wow-delta');
        if (riskEl) {
            const { text, className } = formatDelta(wowData.stdDevDelta, true, true);
            riskEl.textContent = text;
            riskEl.className = `wow-delta ${className}`;
        }

        // Calmar Delta (higher is better)
        const calmarEl = document.getElementById('calmar-wow-delta');
        if (calmarEl) {
            const { text, className } = formatDelta(wowData.calmarDelta, false, false);
            calmarEl.textContent = text;
            calmarEl.className = `wow-delta ${className}`;
        }
    },

    /**
     * Render Performance Scorecard (Unified Metrics View)
     * Combines Efficiency Profile + BM Alpha Vitals into one clean scorecard
     * @param {Object} fundMetrics - { cagr, stdDev, sharpe, sortino, mdd, beta, correlation }
     * @param {Object} bmMetrics - { cagr, stdDev, sharpe, mdd } (SPY)
     */
    renderPerformanceScorecard: (fundMetrics, bmMetrics) => {
        const container = document.getElementById('performance-scorecard');
        if (!container || !fundMetrics || !bmMetrics) return;

        const safe = (val) => (val !== undefined && val !== null && !isNaN(val));
        const DELTA_THRESHOLD = 0.0001;
        
        // Helper: Format Delta
        const getDelta = (fund, bench, invert = false) => {
            if (!safe(fund) || !safe(bench)) return { text: '--', cls: '' };
            const diff = fund - bench;
            if (Math.abs(diff) < DELTA_THRESHOLD) return { text: '--', cls: '' };
            
            const isBetter = invert ? diff < 0 : diff > 0; // Lower MDD/StdDev is better
            const cls = isBetter ? 'positive' : 'negative';
            const arrow = diff > 0 ? '▲' : '▼';
            const text = arrow + Math.abs(diff * (Math.abs(fund) > 1 ? 1 : 100)).toFixed(1) + ((Math.abs(fund) <= 1) ? '%' : '');
            
            return { text, cls };
        };

        // Helper: Create Tile HTML
        const createTile = (label, value, deltaObj, format = 'pct', rank = '', desc = '') => {
            let valStr = '--';
            if (safe(value)) {
                valStr = format === 'pct' ? (value * 100).toFixed(1) + '%' : value.toFixed(2);
            }
            // Tooltip handler logic (Minified for inline)
            // Using a data attribute based approach might be cleaner but inline works for immediate "Quant" feel
            const tooltipTitle = label.toUpperCase();
            const rankLabel = rank ? `RANK: ${rank}` : '';
            
            return `
            <div class="sc-tile"
                 onmouseenter="const tt=document.getElementById('macro-tooltip-custom'); if(tt){ 
                    tt.innerHTML='<div class=\\'mt-header\\'><span class=\\'mt-title\\'>${tooltipTitle}</span><span class=\\'mt-status neutral\\'>${rankLabel}</span></div><div class=\\'mt-body\\'><div class=\\'mt-context\\'>${desc}</div><div class=\\'mt-row\\' style=\\'margin-top:8px;\\'><span class=\\'mt-label\\'>vs Benchmark</span><span class=\\'mt-value\\' style=\\'color:${deltaObj.cls==='positive'?'#00E3CC':'#FF453A'}\\'>${deltaObj.text}</span></div></div>';
                    tt.classList.add('visible');
                    const move=(e)=>{const x=e.pageX+15;const y=e.pageY+15;const rect=tt.getBoundingClientRect();tt.style.left=(x+rect.width>window.innerWidth?x-rect.width-15:x)+'px';tt.style.top=y+'px'};
                    this.onmousemove=move; move(event);
                 }"
                 onmouseleave="document.getElementById('macro-tooltip-custom')?.classList.remove('visible'); this.onmousemove=null;"
            >
                <div class="sc-header">
                    <span class="sc-label">${label}</span>
                    <span class="sc-rank" style="color:${rank==='S'?'#00E3CC':(rank==='A'?'#FFD700':'#64748b')}">${rank || '-'}</span>
                </div>
                <div class="sc-value-row">
                    <span class="sc-value">${valStr}</span>
                    ${deltaObj.text !== '--' ? `<span class="sc-delta ${deltaObj.cls}">${deltaObj.text}</span>` : ''}
                </div>
            </div>`;
        };

        // Calculate Derived Stats
        const fundCalmar = Finance.calculateCalmarRatio(fundMetrics.cagr, fundMetrics.mdd);
        const bmCalmar = Finance.calculateCalmarRatio(bmMetrics.cagr, bmMetrics.mdd);

        // Define Metrics Config
        const tiles = [
            {
                label: 'CAGR', 
                val: fundMetrics.cagr, 
                delta: getDelta(fundMetrics.cagr, bmMetrics.cagr),
                fmt: 'pct',
                rank: fundMetrics.cagr > 0.25 ? 'S' : (fundMetrics.cagr > 0.15 ? 'A' : 'B'),
                desc: 'Compound Annual Growth Rate. Measures the geometric progression ratio that provides a constant rate of return.'
            },
            {
                label: 'MDD', 
                val: fundMetrics.mdd, 
                delta: getDelta(fundMetrics.mdd, bmMetrics.mdd, true), // Inverted
                fmt: 'pct',
                rank: fundMetrics.mdd < 0.1 ? 'S' : (fundMetrics.mdd < 0.2 ? 'A' : 'C'),
                desc: 'Max Drawdown. The maximum observed loss from a peak to a trough of a portfolio.'
            },
            {
                label: 'Sharpe', 
                val: fundMetrics.sharpe, 
                delta: getDelta(fundMetrics.sharpe, bmMetrics.sharpe),
                fmt: 'num',
                rank: fundMetrics.sharpe > 2.0 ? 'S' : (fundMetrics.sharpe > 1.0 ? 'A' : 'B'),
                desc: 'Sharpe Ratio. Measures risk-adjusted return (using StdDev). > 1.0 is considered good.'
            },
            {
                label: 'Sortino', 
                val: fundMetrics.sortino, 
                delta: getDelta(fundMetrics.sortino, bmMetrics.sortino),
                fmt: 'num',
                rank: fundMetrics.sortino > 3.0 ? 'S' : (fundMetrics.sortino > 1.5 ? 'A' : 'B'),
                desc: 'Sortino Ratio. Similar to Sharpe but only penalizes downside volatility. Best for asymmetric return strategies.'
            },
            {
                label: 'StdDev', 
                val: fundMetrics.stdDev, 
                delta: getDelta(fundMetrics.stdDev, bmMetrics.stdDev, true), // Inverted
                fmt: 'pct',
                rank: fundMetrics.stdDev < 0.1 ? 'S' : (fundMetrics.stdDev < 0.15 ? 'A' : 'B'),
                desc: 'Standard Deviation (Volatility). A statistical measure of the dispersion of returns.'
            },
            {
                label: 'Calmar', 
                val: fundCalmar, 
                delta: getDelta(fundCalmar, bmCalmar),
                fmt: 'num',
                rank: fundCalmar > 2.0 ? 'S' : (fundCalmar > 1.0 ? 'A' : 'B'),
                desc: 'Calmar Ratio. CAGR / Max Drawdown. Measures return relative to downside risk (drawdown).'
            }
        ];

        // Generate HTML with Smart Grid Structure
        let html = `<div class="scorecard-container quant-style">`;
        
        // 1. Core Metrics Grid (Smart Auto-Fit)
        html += `<div class="scorecard-grid">`;
        tiles.forEach(t => {
            html += createTile(t.label, t.val, t.delta, t.fmt, t.rank, t.desc);
        });
        html += `</div>`;

        // 2. Meta Stats Footer (Beta & Correlation)
        html += `
            <div class="scorecard-footer">
                <div class="sc-mini-stat" title="Sensitivity to Market Movements">
                    <span style="color:#00E3CC">BETA:</span> <span style="font-family:'Roboto Mono'; color:white;">${(fundMetrics.beta || 0).toFixed(2)}</span>
                </div>
                <div class="sc-mini-stat" title="Correlation to Market (SPY)">
                    <span style="color:#00E3CC">CORR:</span> <span style="font-family:'Roboto Mono'; color:white;">${(fundMetrics.correlation || 0).toFixed(2)}</span>
                </div>
            </div>
        </div>`;

        container.innerHTML = html;
    },

    /**
     * Render Risk Insights Panel
     * Analyzes correlation matrix and displays alerts for high-risk pairs
     * @param {Object} corrData - { matrix: [[...], ...], tickers: [...] }
     * @param {string} period - '3M', '1Y', or 'Total'
     */
    renderRiskInsights: (corrData, period = '1Y') => {
        const container = document.getElementById('risk-insights-content');
        if (!container || !corrData || !corrData.matrix) return;

        const { matrix, tickers } = corrData;
        const alerts = [];

        // Scan for warning (>=0.5) and risk (>=0.7) correlations
        for (let i = 0; i < tickers.length; i++) {
            for (let j = i + 1; j < tickers.length; j++) {
                const corr = matrix[i][j];
                if (corr >= 0.7) {
                    alerts.push({
                        pair: `${tickers[i]} × ${tickers[j]}`,
                        value: corr,
                        level: 'risk'
                    });
                } else if (corr >= 0.5) {
                    alerts.push({
                        pair: `${tickers[i]} × ${tickers[j]}`,
                        value: corr,
                        level: 'warning'
                    });
                }
            }
        }

        // Sort by correlation value (highest first)
        alerts.sort((a, b) => b.value - a.value);

        // Render alerts
        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="safe-status">
                    <span class="safe-status-icon">✓</span>
                    <span class="safe-status-text">No concentration risks detected.<br/>Portfolio diversification is healthy.</span>
                </div>
            `;
        } else {
            container.innerHTML = alerts.slice(0, 4).map(alert => `
                <div class="risk-alert-item ${alert.level}">
                    <div class="risk-alert-pair">${alert.pair}</div>
                    <div class="risk-alert-value">${period} correlation: <strong>${alert.value.toFixed(2)}</strong></div>
                </div>
            `).join('');
        }

        // Re-render Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * Show Toast/Loading Message
     * Supports HTML content with Lucide icons
     */
    showToast: (message) => {
        console.log(`[TOAST]: ${message}`);
        const badge = document.getElementById('signal-status-badge');
        if (badge) {
            badge.innerHTML = message;
            // Re-render Lucide icons if HTML contains icon elements
            if (typeof lucide !== 'undefined' && message.includes('data-lucide')) {
                lucide.createIcons();
            }
        }
    },

    /**
     * History Tab UI with Edit/Delete
     */
    renderHistoryTab: (history, onAddClick, onEditClick, onDeleteClick) => {
        const listEl = document.getElementById('history-log-list');
        const controlsEl = document.getElementById('history-controls');
        const creationEl = document.getElementById('event-creation-container');

        if (!listEl || !controlsEl || !creationEl) return;

        listEl.style.display = 'block';
        controlsEl.classList.remove('hidden');
        creationEl.classList.add('hidden');
        creationEl.innerHTML = '';

        // Add Button
        const oldBtn = document.getElementById('add-event-btn');
        if (oldBtn) {
            oldBtn.className = 'big-add-btn';
            oldBtn.innerHTML = '<i data-lucide="plus"></i> LOG NEW EVENT';
            const newBtn = oldBtn.cloneNode(true);
            oldBtn.parentNode.replaceChild(newBtn, oldBtn);
            newBtn.addEventListener('click', () => {
                listEl.style.display = 'none';
                controlsEl.classList.add('hidden');
                creationEl.classList.remove('hidden');
                onAddClick();
            });
        }

        listEl.innerHTML = '';
        if (!history || history.length === 0) {
            listEl.innerHTML = '<div class="empty-state"><i data-lucide="inbox"></i> No system logs recorded.</div>';
        } else {
            // Use history directly - already sorted by caller (refreshHistoryView)
            history.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'history-item glass';
                row.innerHTML = `
                    <div class="history-main">
                        <div class="history-header">
                            <div class="history-date">${item.date}</div>
                            <div class="history-type">${item.type}</div>
                        </div>
                        <div class="history-details">${item.details || ''}</div>
                        ${item.memo ? `
                            <div class="history-memo">
                                <i data-lucide="message-square" class="memo-icon"></i>
                                <span class="memo-text">${item.memo}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="history-actions">
                        <button class="btn-edit" data-index="${index}"><i data-lucide="pencil"></i></button>
                        <button class="btn-delete" data-index="${index}"><i data-lucide="trash-2"></i></button>
                    </div>
                `;
                listEl.appendChild(row);

                // Edit button
                row.querySelector('.btn-edit').addEventListener('click', () => {
                    listEl.style.display = 'none';
                    controlsEl.classList.add('hidden');
                    creationEl.classList.remove('hidden');
                    onEditClick(item, index);
                });

                // Delete button
                row.querySelector('.btn-delete').addEventListener('click', () => {
                    if (confirm('이 로그를 삭제하시겠습니까?')) {
                        onDeleteClick(index);
                    }
                });
            });
        }

        // Re-render Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    renderEventTypeSelection: (onSelect) => {
        const container = document.getElementById('event-creation-container');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <h4 style="margin-bottom: 24px; color:#94a3b8">SELECT EVENT TYPE</h4>
                <div class="event-type-grid-header">
                    <span class="grid-header-label">MANUAL</span>
                    <span class="grid-header-label highlight">AUTO</span>
                </div>
                <div class="event-type-grid two-column">
                    <div class="type-select-btn" data-type="Rebalancing"><i data-lucide="scale"></i><br>Rebalancing</div>
                    <div class="type-select-btn highlight-btn" data-type="RebalancingAuto"><i data-lucide="sparkles"></i><br>Rebalancing (Auto)</div>
                    
                    <div class="type-select-btn" data-type="Switch"><i data-lucide="repeat"></i><br>Asset Switch</div>
                    <div class="type-select-btn highlight-btn" data-type="SwitchAuto"><i data-lucide="zap"></i><br>Asset Switch (Auto)</div>
                    
                    <div class="type-select-btn" data-type="Deposit"><i data-lucide="arrow-down-to-line"></i><br>Deposit</div>
                    <div class="type-select-btn highlight-btn" data-type="DepositAuto"><i data-lucide="sparkles"></i><br>Deposit (Auto)</div>
                    
                    <div class="type-select-btn" data-type="Withdraw"><i data-lucide="arrow-up-from-line"></i><br>Withdraw</div>
                    <div class="type-select-btn highlight-btn" data-type="WithdrawAuto"><i data-lucide="sparkles"></i><br>Withdraw (Auto)</div>
                </div>
                <button id="cancel-event-btn" class="btn-xs">Cancel</button>
            </div>
        `;

        container.querySelectorAll('.type-select-btn').forEach(btn => {
            btn.addEventListener('click', () => onSelect(btn.dataset.type));
        });

        document.getElementById('cancel-event-btn').addEventListener('click', () => {
            document.querySelector('.tab-btn[data-tab="history"]').click();
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * Render Event Input Form - Shares Based
     * @param {string} type - Event type
     * @param {Array} portfolio - Portfolio array
     * @param {Function} onSave - Save callback
     * @param {Object|null} editData - Existing data for editing
     */
    renderEventInputForm: (type, portfolio, onSave, editData = null) => {
        const container = document.getElementById('event-creation-container');
        if (!container) return;

        const dateToday = editData?.date || new Date().toISOString().split('T')[0];
        const isEdit = editData !== null;

        // Generate asset options for dropdowns
        const assetOptions = portfolio.map(a =>
            `<option value="${a.ticker}">${a.ticker}</option>`
        ).join('');

        const memoHint = '<div class="memo-hint">발동 트리거(Reason)와 변화한 Shares 수를 기록해주세요</div>';

        let formHTML = '';

        if (type === 'Rebalancing') {
            const existingTrans = editData?.transactions || [{ fromAsset: '', fromShares: '', toAsset: '', toShares: '' }];
            const transRows = existingTrans.map((t, i) => `
                <div class="transaction-row">
                    <select name="fromAsset-${i}" class="stylish-select" required>${assetOptions.replace(`value="${t.fromAsset}"`, `value="${t.fromAsset}" selected`)}</select>
                    <input type="number" name="fromShares-${i}" placeholder="Shares" value="${t.fromShares || ''}" class="stylish-input shares-input" required step="any">
                    <span class="arrow-icon">→</span>
                    <select name="toAsset-${i}" class="stylish-select" required>${assetOptions.replace(`value="${t.toAsset}"`, `value="${t.toAsset}" selected`)}</select>
                    <input type="number" name="toShares-${i}" placeholder="Shares" value="${t.toShares || ''}" class="stylish-input shares-input" required step="any">
                    ${i > 0 ? '<button type="button" class="btn-remove-row">×</button>' : ''}
                </div>
            `).join('');

            formHTML = `
                <div class="event-form-container">
                    <h4 class="event-form-title"><i data-lucide="scale"></i> ${isEdit ? 'EDIT' : 'NEW'} REBALANCING</h4>
                    <form id="new-event-form">
                        <div class="input-card">
                            <label class="input-label">DATE</label>
                            <input type="date" name="date" value="${dateToday}" required class="stylish-input">
                        </div>
                        <div class="transaction-list" id="transaction-list">${transRows}</div>
                        <button type="button" id="add-transaction-btn" class="btn-add-row">+ Add Transaction</button>
                        <div class="input-card">
                            <label class="input-label">MEMO (Optional)</label>
                            <input type="text" name="memo" placeholder="Reason and notes..." value="${editData?.memo || ''}" class="stylish-input">
                            ${memoHint}
                        </div>
                        <div class="form-actions">
                            <button type="button" id="cancel-form-btn" class="btn-xs">Cancel</button>
                            <button type="submit" class="btn primary">${isEdit ? 'UPDATE' : 'SAVE'} LOG</button>
                        </div>
                    </form>
                </div>
            `;
        } else if (type === 'Switch') {
            const existingTrans = editData?.transactions || [{ fromAsset: '', fromShares: '', toAsset: '', toShares: '' }];
            const transRows = existingTrans.map((t, i) => `
                <div class="transaction-row switch-transaction">
                    <div class="switch-field">
                        <label class="mini-label">FROM</label>
                        <select name="fromAsset-${i}" class="stylish-select" required>${assetOptions.replace(`value="${t.fromAsset}"`, `value="${t.fromAsset}" selected`)}</select>
                        <input type="number" name="fromShares-${i}" placeholder="Shares 수" value="${t.fromShares || ''}" class="stylish-input shares-input" required step="any">
                    </div>
                    <span class="arrow-icon-lg">→</span>
                    <div class="switch-field">
                        <label class="mini-label">TO</label>
                        <select name="toAsset-${i}" class="stylish-select" required>${assetOptions.replace(`value="${t.toAsset}"`, `value="${t.toAsset}" selected`)}</select>
                        <input type="number" name="toShares-${i}" placeholder="Shares 수" value="${t.toShares || ''}" class="stylish-input shares-input" required step="any">
                    </div>
                    ${i > 0 ? '<button type="button" class="btn-remove-row">×</button>' : ''}
                </div>
            `).join('');

            formHTML = `
                <div class="event-form-container">
                    <h4 class="event-form-title"><i data-lucide="repeat"></i> ${isEdit ? 'EDIT' : 'NEW'} ASSET SWITCH</h4>
                    <form id="new-event-form">
                        <div class="input-card">
                            <label class="input-label">DATE</label>
                            <input type="date" name="date" value="${dateToday}" required class="stylish-input">
                        </div>
                        <div class="transaction-list" id="transaction-list">${transRows}</div>
                        <button type="button" id="add-transaction-btn" class="btn-add-row">+ Add Transaction</button>
                        <div class="input-card">
                            <label class="input-label">MEMO (Optional)</label>
                            <input type="text" name="memo" placeholder="Reason and notes..." value="${editData?.memo || ''}" class="stylish-input">
                            ${memoHint}
                        </div>
                        <div class="form-actions">
                            <button type="button" id="cancel-form-btn" class="btn-xs">Cancel</button>
                            <button type="submit" class="btn primary">${isEdit ? 'UPDATE' : 'SAVE'} LOG</button>
                        </div>
                    </form>
                </div>
            `;
        } else if (type === 'Deposit') {
            const existingTrans = editData?.transactions || [{ asset: '', shares: '' }];
            const transRows = existingTrans.map((t, i) => `
                <div class="transaction-row simple-transaction">
                    <select name="asset-${i}" class="stylish-select" required>${assetOptions.replace(`value="${t.asset}"`, `value="${t.asset}" selected`)}</select>
                    <input type="number" name="shares-${i}" placeholder="Shares 수 (+)" value="${t.shares || ''}" class="stylish-input shares-input" required step="any">
                    ${i > 0 ? '<button type="button" class="btn-remove-row">×</button>' : ''}
                </div>
            `).join('');

            formHTML = `
                <div class="event-form-container">
                    <h4 class="event-form-title"><i data-lucide="arrow-down-to-line"></i> ${isEdit ? 'EDIT' : 'NEW'} DEPOSIT</h4>
                    <form id="new-event-form">
                        <div class="input-card">
                            <label class="input-label">DATE</label>
                            <input type="date" name="date" value="${dateToday}" required class="stylish-input">
                        </div>
                        <div class="transaction-list" id="transaction-list">${transRows}</div>
                        <button type="button" id="add-transaction-btn" class="btn-add-row">+ Add Deposit</button>
                        <div class="input-card">
                            <label class="input-label">MEMO (Optional)</label>
                            <input type="text" name="memo" placeholder="Reason and notes..." value="${editData?.memo || ''}" class="stylish-input">
                            ${memoHint}
                        </div>
                        <div class="form-actions">
                            <button type="button" id="cancel-form-btn" class="btn-xs">Cancel</button>
                            <button type="submit" class="btn primary">${isEdit ? 'UPDATE' : 'SAVE'} LOG</button>
                        </div>
                    </form>
                </div>
            `;
        } else if (type === 'Withdraw') {
            const existingTrans = editData?.transactions || [{ asset: '', shares: '' }];
            const transRows = existingTrans.map((t, i) => `
                <div class="transaction-row simple-transaction">
                    <select name="asset-${i}" class="stylish-select" required>${assetOptions.replace(`value="${t.asset}"`, `value="${t.asset}" selected`)}</select>
                    <input type="number" name="shares-${i}" placeholder="Shares 수 (-)" value="${t.shares || ''}" class="stylish-input shares-input" required step="any">
                    ${i > 0 ? '<button type="button" class="btn-remove-row">×</button>' : ''}
                </div>
            `).join('');

            formHTML = `
                <div class="event-form-container">
                    <h4 class="event-form-title"><i data-lucide="arrow-up-from-line"></i> ${isEdit ? 'EDIT' : 'NEW'} WITHDRAW</h4>
                    <form id="new-event-form">
                        <div class="input-card">
                            <label class="input-label">DATE</label>
                            <input type="date" name="date" value="${dateToday}" required class="stylish-input">
                        </div>
                        <div class="transaction-list" id="transaction-list">${transRows}</div>
                        <button type="button" id="add-transaction-btn" class="btn-add-row">+ Add Withdraw</button>
                        <div class="input-card">
                            <label class="input-label">MEMO (Optional)</label>
                            <input type="text" name="memo" placeholder="Reason and notes..." value="${editData?.memo || ''}" class="stylish-input">
                            ${memoHint}
                        </div>
                        <div class="form-actions">
                            <button type="button" id="cancel-form-btn" class="btn-xs">Cancel</button>
                            <button type="submit" class="btn primary">${isEdit ? 'UPDATE' : 'SAVE'} LOG</button>
                        </div>
                    </form>
                </div>
            `;
        } else if (type === 'SwitchAuto') {
            // Asset Switch (Auto) - auto-calculate based on current holdings and prices
            formHTML = `
                <div class="event-form-container">
                    <h4 class="event-form-title"><i data-lucide="zap"></i> ASSET SWITCH (AUTO)</h4>
                    <p class="form-hint">현재 보유량과 최신 가격을 기준으로 자동 계산됩니다.</p>
                    <form id="new-event-form">
                        <div class="input-card">
                            <label class="input-label">DATE</label>
                            <input type="date" name="date" value="${dateToday}" required class="stylish-input">
                        </div>
                        <div class="switch-today-row">
                            <div class="switch-field">
                                <label class="mini-label">FROM ASSET</label>
                                <select name="fromAsset" id="switch-from-asset" class="stylish-select" required>${assetOptions}</select>
                                <input type="number" name="fromShares" id="switch-from-shares" placeholder="Shares" class="stylish-input shares-input" readonly>
                            </div>
                            <span class="arrow-icon-lg">→</span>
                            <div class="switch-field">
                                <label class="mini-label">TO ASSET</label>
                                <select name="toAsset" id="switch-to-asset" class="stylish-select" required>${assetOptions}</select>
                                <input type="number" name="toShares" id="switch-to-shares" placeholder="Shares" class="stylish-input shares-input" readonly>
                            </div>
                        </div>
                        
                        <!-- MSTR Signal Verification Panel (hidden by default) -->
                        <div class="mstr-signal-panel hidden" id="mstr-signal-panel">
                            <h5 class="signal-panel-title">⚠️ MSTR 시그널 검증 필요</h5>
                            <p class="signal-panel-desc">strategy.com과 coinank.com에서 현재 값을 확인 후 입력하세요.</p>
                            <div class="signal-inputs">
                                <div class="signal-input-group">
                                    <label class="signal-input-label">
                                        <span class="label-icon">📊</span>
                                        <span class="label-text">MSTR MNAV</span>
                                    </label>
                                    <input type="number" id="mstr-mnav-input" step="0.01" placeholder="현재 MNAV 값 입력" class="stylish-input signal-input">
                                    <span class="input-hint">Sell > 2.8 | Buy < 1.3</span>
                                </div>
                                <div class="signal-input-group">
                                    <label class="signal-input-label">
                                        <span class="label-icon">📈</span>
                                        <span class="label-text">MVRV Z-Score</span>
                                    </label>
                                    <input type="number" id="mstr-zscore-input" step="0.01" placeholder="현재 Z-Score 값 입력" class="stylish-input signal-input">
                                    <span class="input-hint">Sell > 4.5 | Buy < 0.5</span>
                                </div>
                            </div>
                            <div class="signal-result" id="mstr-signal-result">
                                <div class="signal-check">MNAV/Z-Score를 입력하세요</div>
                            </div>
                            <button type="button" id="verify-signal-btn" class="btn-verify" disabled>🔍 시그널 검증</button>
                        </div>
                        
                        <div class="input-card">
                            <label class="input-label">MEMO (Optional)</label>
                            <input type="text" name="memo" placeholder="Reason and notes..." class="stylish-input">
                        </div>
                        <div class="form-actions">
                            <button type="button" id="cancel-form-btn" class="btn-xs">Cancel</button>
                            <button type="submit" id="save-log-btn" class="btn primary">SAVE LOG</button>
                        </div>
                    </form>
                </div>
            `;
        } else if (type === 'RebalancingAuto') {
            // Rebalancing (Auto) - Full implementation
            formHTML = `
                <div class="event-form-container">
                    <h4 class="event-form-title"><i data-lucide="sparkles"></i> REBALANCING (AUTO)</h4>
                    <p class="form-hint">30% 상대밴드 초과 자산을 자동 감지하고 리밸런싱합니다.</p>
                    <form id="new-event-form">
                        <div class="input-card">
                            <label class="input-label">DATE</label>
                            <input type="date" name="date" value="${dateToday}" required class="stylish-input">
                        </div>
                        
                        <div class="input-card">
                            <label class="input-label">ACCOUNT MODE</label>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="radio" name="accountMode" value="identical" checked>
                                    <span>Identical Accounts (동일 계좌 그룹)</span>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="accountMode" value="total">
                                    <span>Total Rebalancing (전체 자산)</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="rebalancing-detection" id="rebalancing-detection">
                            <div class="detection-title">📊 30% 밴드 초과 자산 감지</div>
                            <div class="detection-list" id="detection-list">
                                <div class="preview-hint">분석 중...</div>
                            </div>
                        </div>
                        
                        <div class="rebalancing-trades" id="rebalancing-trades">
                            <div class="trades-title">💱 계산된 거래 내역</div>
                            <div class="trades-list" id="trades-list">
                                <div class="preview-hint">감지된 자산이 없거나 계산 중입니다</div>
                            </div>
                        </div>
                        
                        <div class="input-card">
                            <label class="input-label">MEMO (Optional)</label>
                            <input type="text" name="memo" placeholder="Reason and notes..." class="stylish-input">
                        </div>
                        <div class="form-actions">
                            <button type="button" id="cancel-form-btn" class="btn-xs">Cancel</button>
                            <button type="submit" id="save-rebalancing-btn" class="btn primary" disabled>SAVE LOG</button>
                        </div>
                    </form>
                </div>
            `;
        } else if (type === 'DepositAuto' || type === 'WithdrawAuto') {
            // Auto-distribute deposit/withdraw based on Actual Weight
            const actionLabel = type === 'DepositAuto' ? 'DEPOSIT' : 'WITHDRAW';
            const icon = type === 'DepositAuto' ? 'arrow-down-to-line' : 'arrow-up-from-line';
            formHTML = `
                <div class="event-form-container">
                    <h4 class="event-form-title"><i data-lucide="${icon}"></i> AUTO ${actionLabel}</h4>
                    <p class="form-hint">총 금액을 입력하면 Actual Weight 기준으로 자동 분배됩니다.</p>
                    <form id="new-event-form">
                        <div class="input-card">
                            <label class="input-label">DATE</label>
                            <input type="date" name="date" value="${dateToday}" required class="stylish-input">
                        </div>
                        <div class="input-card">
                            <label class="input-label">TOTAL AMOUNT (₩)</label>
                            <input type="number" name="totalAmount" id="auto-total-amount" placeholder="예: 100000" class="stylish-input" required step="1">
                        </div>
                        <div class="auto-distribution-preview" id="auto-distribution-preview">
                            <div class="preview-hint">금액을 입력하면 분배 결과가 표시됩니다</div>
                        </div>
                        <div class="input-card">
                            <label class="input-label">MEMO (Optional)</label>
                            <input type="text" name="memo" placeholder="Reason and notes..." class="stylish-input">
                        </div>
                        <div class="form-actions">
                            <button type="button" id="cancel-form-btn" class="btn-xs">Cancel</button>
                            <button type="submit" class="btn primary">SAVE LOG</button>
                        </div>
                    </form>
                </div>
            `;
        }

        container.innerHTML = formHTML;

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Cancel button
        document.getElementById('cancel-form-btn').addEventListener('click', () => {
            document.querySelector('.tab-btn[data-tab="history"]').click();
        });

        // Remove row buttons
        document.querySelectorAll('.btn-remove-row').forEach(btn => {
            btn.addEventListener('click', () => btn.closest('.transaction-row').remove());
        });

        // Add transaction button
        const addBtn = document.getElementById('add-transaction-btn');
        if (addBtn) {
            let transactionCount = (editData?.transactions?.length || 1);
            addBtn.addEventListener('click', () => {
                const list = document.getElementById('transaction-list');
                const row = document.createElement('div');

                if (type === 'Rebalancing') {
                    row.className = 'transaction-row';
                    row.innerHTML = `
                        <select name="fromAsset-${transactionCount}" class="stylish-select" required>${assetOptions}</select>
                        <input type="number" name="fromShares-${transactionCount}" placeholder="Shares" class="stylish-input shares-input" required step="any">
                        <span class="arrow-icon">→</span>
                        <select name="toAsset-${transactionCount}" class="stylish-select" required>${assetOptions}</select>
                        <input type="number" name="toShares-${transactionCount}" placeholder="Shares" class="stylish-input shares-input" required step="any">
                        <button type="button" class="btn-remove-row">×</button>
                    `;
                } else if (type === 'Switch') {
                    row.className = 'transaction-row switch-transaction';
                    row.innerHTML = `
                        <div class="switch-field">
                            <label class="mini-label">FROM</label>
                            <select name="fromAsset-${transactionCount}" class="stylish-select" required>${assetOptions}</select>
                            <input type="number" name="fromShares-${transactionCount}" placeholder="Shares 수" class="stylish-input shares-input" required step="any">
                        </div>
                        <span class="arrow-icon-lg">→</span>
                        <div class="switch-field">
                            <label class="mini-label">TO</label>
                            <select name="toAsset-${transactionCount}" class="stylish-select" required>${assetOptions}</select>
                            <input type="number" name="toShares-${transactionCount}" placeholder="Shares 수" class="stylish-input shares-input" required step="any">
                        </div>
                        <button type="button" class="btn-remove-row">×</button>
                    `;
                } else {
                    row.className = 'transaction-row simple-transaction';
                    row.innerHTML = `
                        <select name="asset-${transactionCount}" class="stylish-select" required>${assetOptions}</select>
                        <input type="number" name="shares-${transactionCount}" placeholder="Shares 수" class="stylish-input shares-input" required step="any">
                        <button type="button" class="btn-remove-row">×</button>
                    `;
                }

                list.appendChild(row);
                row.querySelector('.btn-remove-row').addEventListener('click', () => row.remove());
                transactionCount++;
            });
        }

        // Form submission
        document.getElementById('new-event-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            // Normalize type for storage (SwitchAuto -> Switch, DepositAuto -> Deposit, etc.)
            let storageType = type;
            if (type === 'SwitchAuto') storageType = 'Switch';
            if (type === 'DepositAuto') storageType = 'Deposit';
            if (type === 'WithdrawAuto') storageType = 'Withdraw';
            if (type === 'RebalancingAuto') storageType = 'Rebalancing';

            let eventData = {
                id: editData?.id || `log_${Date.now()}`,
                date: formData.get('date'),
                type: storageType,
                memo: formData.get('memo') || ''
            };

            if (type === 'Rebalancing' || type === 'Switch') {
                const transactions = [];
                let i = 0;
                while (formData.get(`fromAsset-${i}`)) {
                    transactions.push({
                        fromAsset: formData.get(`fromAsset-${i}`),
                        fromShares: parseFloat(formData.get(`fromShares-${i}`)) || 0,
                        toAsset: formData.get(`toAsset-${i}`),
                        toShares: parseFloat(formData.get(`toShares-${i}`)) || 0
                    });
                    i++;
                }
                eventData.transactions = transactions;
                eventData.details = transactions.map(t =>
                    `${t.fromAsset} ${t.fromShares}주 → ${t.toAsset} ${t.toShares}주`
                ).join(', ');
            } else if (type === 'SwitchAuto') {
                // Single transaction from SwitchAuto form
                const fromAsset = formData.get('fromAsset');
                const fromShares = parseFloat(formData.get('fromShares')) || 0;
                const toAsset = formData.get('toAsset');
                const toShares = parseFloat(formData.get('toShares')) || 0;
                
                eventData.transactions = [{
                    fromAsset, fromShares, toAsset, toShares
                }];
                eventData.details = `${fromAsset} ${fromShares}주 → ${toAsset} ${toShares}주`;
                
                // NEW: Capture Z-Score and MNAV for MSTR trades
                const mnavInput = document.getElementById('mstr-mnav-input');
                const zscoreInput = document.getElementById('mstr-zscore-input');
                if (mnavInput && mnavInput.value) {
                    eventData.mnav = parseFloat(mnavInput.value);
                }
                if (zscoreInput && zscoreInput.value) {
                    eventData.zScore = parseFloat(zscoreInput.value);
                }
                
                // NEW: Mark as Algo Switch (WATCHING state)
                // All switches from this form are Algo-driven
                eventData.status = typeof SignalStates !== 'undefined' ? SignalStates.WATCHING : 'WATCHING';
                
                // NEW: Set Tactical Target (call global function if available)
                // Calculate amount as the from asset's target weight (full switch)
                if (typeof setTacticalTarget === 'function') {
                    const fromAssetData = typeof portfolio !== 'undefined' 
                        ? portfolio.find(a => a.ticker === fromAsset) 
                        : null;
                    const amount = fromAssetData?.targetWeight || 0.10;
                    
                    // Check if this is a RETURN Switch (reversing a Tactical position)
                    // If toAsset is in Tactical state (has a tactical target), this is a return
                    const isReturnSwitch = typeof tacticalTargets !== 'undefined' && tacticalTargets[toAsset];
                    
                    if (isReturnSwitch) {
                        // This is a RETURN Switch - clear Tactical targets
                        console.log(`🔄 Return Switch detected: ${fromAsset} → ${toAsset}`);
                        
                        if (typeof clearTacticalTarget === 'function') {
                            clearTacticalTarget(toAsset);  // Restore toAsset's original Target
                            clearTacticalTarget(fromAsset); // Clear fromAsset's Tactical state
                        }
                        
                        // Mark signal as complete
                        if (typeof activeSignals !== 'undefined') {
                            const signal = activeSignals.find(s => 
                                s.status === 'RETURN_PENDING' && 
                                (s.returnAction?.to === toAsset || s.to === fromAsset)
                            );
                            if (signal && typeof removeSignal === 'function') {
                                removeSignal(signal.id);
                            }
                        }
                        
                        eventData.triggeredBy = 'RETURN_SWITCH';
                        eventData.status = 'COMPLETE';
                    } else {
                        // Normal forward Switch - set Tactical targets
                        // Get rule ID from signal badge if available
                        const signalBadge = document.getElementById('signal-badge');
                        const ruleId = signalBadge?.textContent?.includes('HARD EXIT') ? 'SELL_HARD_EXIT' :
                                      signalBadge?.textContent?.includes('PROFIT LOCK') ? 'SELL_PROFIT_LOCK' :
                                      signalBadge?.textContent?.includes('SOFT ROTATE') ? 'SELL_SOFT_ROTATE' :
                                      signalBadge?.textContent?.includes('OPPORTUNITY') ? 'BUY_OPPORTUNITY' :
                                      'MANUAL_SWITCH';
                        
                        eventData.triggeredBy = ruleId;
                        eventData.amount = amount;
                        
                        if (typeof setTacticalTarget === 'function') {
                            setTacticalTarget(fromAsset, toAsset, amount, ruleId, '');
                        }
                    }
                }
            } else if (type === 'Deposit' || type === 'Withdraw') {
                const transactions = [];
                let i = 0;
                while (formData.get(`asset-${i}`)) {
                    transactions.push({
                        asset: formData.get(`asset-${i}`),
                        shares: parseFloat(formData.get(`shares-${i}`)) || 0
                    });
                    i++;
                }
                eventData.transactions = transactions;
                const prefix = type === 'Deposit' ? '+' : '-';
                eventData.details = transactions.map(t =>
                    `${t.asset} ${prefix}${t.shares}주`
                ).join(', ');

                eventData.hasExternalFlow = true;
                eventData.flowType = type;
            } else if (type === 'DepositAuto' || type === 'WithdrawAuto') {
                // Get auto-calculated transactions from hidden data
                const previewEl = document.getElementById('auto-distribution-preview');
                const calculatedData = previewEl?.dataset?.transactions;
                
                if (calculatedData) {
                    eventData.transactions = JSON.parse(calculatedData);
                    const prefix = type === 'DepositAuto' ? '+' : '-';
                    eventData.details = eventData.transactions.map(t =>
                        `${t.asset} ${prefix}${t.shares}주`
                    ).join(', ');
                    eventData.hasExternalFlow = true;
                    eventData.flowType = type === 'DepositAuto' ? 'Deposit' : 'Withdraw';
                } else {
                    alert('먼저 금액을 입력하여 분배를 계산하세요.');
                    return;
                }
            } else if (type === 'RebalancingAuto') {
                // Get auto-calculated trades from trades list
                const tradesList = document.getElementById('trades-list');
                const calculatedData = tradesList?.dataset?.trades;
                
                if (calculatedData) {
                    eventData.transactions = JSON.parse(calculatedData);
                    eventData.details = eventData.transactions.map(t =>
                        `${t.fromAsset} ${t.fromShares}주 → ${t.toAsset} ${t.toShares}주`
                    ).join(', ');
                } else {
                    alert('계산된 거래 내역이 없습니다.');
                    return;
                }
            }

            onSave(eventData, isEdit);
        });
    },

    // =====================================================
    // STRESS TEST SIMULATOR UI
    // Psychological Forensics - Historical Crisis Backtest
    // =====================================================

    /**
     * Render Stress Test Simulator
     * Displays bar chart comparing Portfolio MDD vs SPY MDD for crisis scenarios
     * @param {Object} stressTestResults - { '2020': { portfolioMDD, spyMDD, ... }, '2022': { ... } }
     * @param {string} activeScenario - Currently selected scenario ('2020' or '2022')
     */
    renderStressTest: (stressTestResults, activeScenario = '2020') => {
        const container = document.getElementById('stress-test-container');
        if (!container) return;

        // Check if data is available
        if (!stressTestResults) {
            container.innerHTML = `
                <div class="stress-test-loading">
                    <i data-lucide="loader" class="spin"></i>
                    <span>Loading stress test data...</span>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const result = stressTestResults[activeScenario];
        if (!result) return;

        // Calculate bar widths (scale to max 100%)
        const maxMDD = Math.max(result.portfolioMDD, result.spyMDD);
        const safeMax = maxMDD > 0 ? maxMDD : 0.01;
        
        const spyWidth = (result.spyMDD / safeMax) * 100;
        const portfolioWidth = (result.portfolioMDD / safeMax) * 100;

        // Visual Class & Colors
        let damageClass = 'safe';
        let damageColor = '#00E3CC';
        if (result.portfolioMDD > 0.20) { damageClass = 'danger'; damageColor = '#FF453A'; }
        else if (result.portfolioMDD > 0.10) { damageClass = 'warning'; damageColor = '#FFD700'; }

        // Comparison Logic
        const delta = result.spyMDD - result.portfolioMDD;
        const isOutperform = delta > 0;
        const deltaColor = isOutperform ? '#00E3CC' : '#FF453A';

        // Scenario Metadata
        const scenarios = {
            '2020': { label: 'COVID-19 CRASH', sub: 'Deflationary Shock' },
            '2022': { label: 'INFLATION SHOCK', sub: 'Rate Hike Cycle' }
        };
        const currentMeta = scenarios[activeScenario] || { label: 'SCENARIO', sub: 'Unknown' };

        // Tooltip Handler
        const showStressTooltip = (e, title, mdd, type) => {
            let tt = document.getElementById('macro-tooltip-custom');
            if (!tt) return;
            
            const pct = (mdd * 100).toFixed(1) + '%';
            const state = mdd < 0.15 ? 'safe' : (mdd < 0.25 ? 'neutral' : 'danger');
            const color = mdd < 0.15 ? '#00E3CC' : (mdd < 0.25 ? '#FFD700' : '#FF453A');
            
            tt.innerHTML = `
                <div class="mt-header">
                    <span class="mt-title">DAMAGE REPORT: ${title}</span>
                    <span class="mt-status ${state}">${type}</span>
                </div>
                <div class="mt-body">
                    <div class="mt-row">
                        <span class="mt-label">Max Drawdown</span>
                        <span class="mt-value" style="color:${color};">-${pct}</span>
                    </div>
                     <div class="mt-bar-container">
                        <div class="mt-bar-fill" style="width: ${Math.min(100, (mdd/0.5)*100)}%; background: ${color}; opacity: 0.5;"></div>
                    </div>
                </div>
            `;
            tt.classList.add('visible');
            const move = (ev) => {
                 const x = ev.pageX + 15;
                 const y = ev.pageY + 15;
                 const rect = tt.getBoundingClientRect();
                 const finalX = (x + rect.width > window.innerWidth) ? x - rect.width - 15 : x;
                 tt.style.left = `${finalX}px`;
                 tt.style.top = `${y}px`;
            };
            container.onmousemove = move;
            move(e);
        };

        // Render HTML (Quant Panel Style)
        container.innerHTML = `
            <div class="quant-panel" style="padding:16px; min-height:220px; display:flex; flex-direction:column; justify-content:space-between;">
                
                <!-- Header / Controls -->
                <div class="stress-header-row">
                    <div>
                        <div style="font-family:'Oswald'; color:var(--text-muted); font-size:0.65rem; letter-spacing:2px; margin-bottom:2px;">SIMULATION</div>
                        <div class="scenario-name" style="font-family:'Oswald'; font-size:1.0rem; color:white;">${currentMeta.label}</div>
                    </div>
                     <div class="stress-scenario-toggle" style="background:rgba(255,255,255,0.05); padding:2px; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">
                        <button class="scenario-btn ${activeScenario === '2020' ? 'active' : ''}" 
                                onclick="UI.renderStressTest(window._globalStressResults, '2020')"
                                style="padding:4px 8px; font-size:0.7rem; ${activeScenario==='2020'?'background:rgba(255,255,255,0.1); color:white;':''}">2020</button>
                        <button class="scenario-btn ${activeScenario === '2022' ? 'active' : ''}" 
                                onclick="UI.renderStressTest(window._globalStressResults, '2022')"
                                style="padding:4px 8px; font-size:0.7rem; ${activeScenario==='2022'?'background:rgba(255,255,255,0.1); color:white;':''}">2022</button>
                    </div>
                </div>

                <!-- Comparison Bars (VS) - Minimal Info -->
                <div class="stress-vs-section">
                    
                    <!-- SPY -->
                    <div class="stress-vs-pill" style="border-bottom:1px solid #333;"
                         onmouseenter="(showStressTooltip)(event, 'SPY', ${result.spyMDD}, 'BENCHMARK')"
                         onmouseleave="document.getElementById('macro-tooltip-custom')?.classList.remove('visible'); this.parentElement.parentElement.onmousemove=null;">
                         
                        <div style="width:50px; font-family:'Inter'; font-size:0.75rem; color:#71717a;">SPY</div>
                        <div style="flex:1; margin:0 12px;">
                            <div class="stress-bar-segmented" style="background:#27272a; height:6px; border-radius:3px;">
                                <div class="stress-bar-fill-striped benchmark" style="width: ${spyWidth}%; background:#52525b; height:100%; border-radius:3px;"></div>
                            </div>
                        </div>
                        <div style="width:60px; text-align:right; font-family:'Roboto Mono'; font-weight:600; color:#a1a1aa;">-${(result.spyMDD * 100).toFixed(1)}%</div>
                    </div>

                    <!-- Portfolio -->
                    <div class="stress-vs-pill" style="border-bottom:1px solid transparent;"
                         onmouseenter="(showStressTooltip)(event, 'BASE 6', ${result.portfolioMDD}, 'SYSTEM')"
                         onmouseleave="document.getElementById('macro-tooltip-custom')?.classList.remove('visible'); this.parentElement.parentElement.onmousemove=null;">
                         
                        <div style="width:50px; font-family:'Inter'; font-size:0.75rem; color:${damageColor}; font-weight:600;">BASE 6</div>
                        <div style="flex:1; margin:0 12px;">
                            <div class="stress-bar-segmented" style="background:#27272a; height:6px; border-radius:3px;">
                                <div class="stress-bar-fill-striped ${damageClass}" style="width: ${portfolioWidth}%; background:${damageColor}; height:100%; border-radius:3px;"></div>
                            </div>
                        </div>
                        <div style="width:60px; text-align:right; font-family:'Roboto Mono'; font-weight:600; color:${damageColor};">-${(result.portfolioMDD * 100).toFixed(1)}%</div>
                    </div>

                </div>

                <!-- Summary Footer -->
                <div style="margin-top:auto; padding-top:16px; border-top:1px solid #27272a; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.7rem; color:#71717a; letter-spacing:0.02em; font-family:'Inter';">RESILIENCE RATING</span>
                    <div style="display:flex; gap:12px; align-items:center;">
                         <span style="font-family:'Roboto Mono'; font-size:0.75rem; color:${deltaColor};">
                            ${isOutperform ? '+' : ''}${(delta*100).toFixed(1)}% vs SPY
                         </span>
                         <span class="badge" style="background:transparent; color:${damageClass==='safe'?'#10b981':(damageClass==='warning'?'#f59e0b':'#f43f5e')}; border:1px solid ${damageClass==='safe'?'#10b981':(damageClass==='warning'?'#f59e0b':'#f43f5e')}; font-family:'Roboto Mono';">
                            ${damageClass==='safe' ? 'HIGH' : (damageClass==='warning'?'MODERATE':'CRITICAL')}
                         </span>
                    </div>
                </div>

            </div>
        `;

        // Store global results
        window._globalStressResults = stressTestResults;
        
        // Re-render Lucide
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    // =====================================================
    // SLEEP WELL SCORE UI
    // Ulcer Index based psychological cost visualization
    // =====================================================

    /**
     * Render Sleep Well Score Panel
     * Displays horizontal bar chart comparing Portfolio vs SPY vs TQQQ
     * @param {Object} sleepData - From Finance.calculateSleepScoreComparison()
     * @param {string} activePeriod - 'total' or '1y'
     * @param {Function} onPeriodChange - Callback when period toggle is clicked
     */
        // Minimal Sleep Score UI (Simple Ring)
    renderSleepScore: (sleepData, activePeriod = 'total', onPeriodChange = null) => {
            const container = document.getElementById('sleep-score-container');
            if (!container) return;

            // Loading state
            if (!sleepData) {
                container.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#71717a; gap:12px;">
                        <i data-lucide="loader-2" class="spin-slow" style="width:20px;"></i>
                        <span style="font-size:0.75rem; font-family:'Inter';">ANALYZING VOLATILITY...</span>
                    </div>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                return;
            }

            const { portfolio, period, dataPoints } = sleepData;
            
            // Score Color: Green / Yellow / Red
            const getScoreColor = (score) => {
                if (score >= 80) return '#10b981';
                if (score >= 60) return '#eab308';
                return '#f43f5e';
            };
            const scoreColor = getScoreColor(portfolio.score);

            container.innerHTML = `
                <!-- Period Toggle -->
                <div style="position:absolute; top:20px; right:20px;">
                    <div style="display:flex; background:#27272a; border-radius:4px; padding:2px;">
                        <button class="period-btn ${activePeriod === 'total' ? 'active' : ''}" data-period="total" style="font-size:0.65rem; padding:4px 8px; border:none; background:${activePeriod === 'total' ? '#3f3f46' : 'transparent'}; color:${activePeriod === 'total' ? 'white' : '#a1a1aa'}; border-radius:2px; cursor:pointer;">ALL</button>
                        <button class="period-btn ${activePeriod === '1y' ? 'active' : ''}" data-period="1y" style="font-size:0.65rem; padding:4px 8px; border:none; background:${activePeriod === '1y' ? '#3f3f46' : 'transparent'}; color:${activePeriod === '1y' ? 'white' : '#a1a1aa'}; border-radius:2px; cursor:pointer;">1Y</button>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;">
                    
                    <!-- Thin Ring Canvas -->
                    <div style="position:relative; width:140px; height:140px; display:flex; align-items:center; justify-content:center;">
                        <!-- SVG Ring -->
                        <svg width="140" height="140" viewBox="0 0 100 100" style="transform: rotate(-90deg);">
                            <circle cx="50" cy="50" r="45" stroke="#27272a" stroke-width="4" fill="none" />
                            <circle cx="50" cy="50" r="45" stroke="${scoreColor}" stroke-width="4" fill="none" 
                                    stroke-dasharray="283" stroke-dashoffset="${283 - (283 * portfolio.score / 100)}" 
                                    style="transition: stroke-dashoffset 1s ease;" />
                        </svg>
                        
                        <!-- Center Data -->
                        <div style="position:absolute; text-align:center;">
                            <div style="font-family:'Roboto Mono'; font-size:2.2rem; font-weight:700; color:white; line-height:1;">
                                ${portfolio.score.toFixed(0)}
                            </div>
                            <div style="font-family:'Inter'; font-size:0.7rem; color:${scoreColor}; margin-top:4px; font-weight:600; letter-spacing:0.05em;">
                                ${portfolio.grade.label.toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <div style="margin-top:20px; text-align:center;">
                        <div style="font-size:0.7rem; color:#71717a; font-family:'Inter';">PSYCHOLOGICAL COST (ULCER INDEX)</div>
                        <div style="font-size:0.65rem; color:#52525b; margin-top:4px;">Based on ${dataPoints} daily samples</div>
                    </div>

                </div>
            `;

            // Event Listeners
            container.querySelectorAll('.period-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (onPeriodChange) onPeriodChange(btn.dataset.period);
                });
            });

            if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    // =====================================================
    // ROTI BADGE UI
    // Return On Time Invested - Hourly Alpha Display
    // =====================================================

    /**
     * Render ROTI Badge
     * Displays Hourly Alpha with currency toggle and hover details
     * @param {Object} rotiData - From Finance.calculateROTI()
     * @param {string} currency - 'KRW' or 'USD'
     * @param {number} fxRate - USD/KRW exchange rate
     * @param {Function} onCurrencyToggle - Callback when currency is toggled
     */
    renderROTIBadge: (rotiData, currency = 'KRW', fxRate = 1410, onCurrencyToggle = null) => {
        const display = document.getElementById('roti-value-display');
        const badge = document.getElementById('roti-global-badge');
        
        // If elements don't exist (e.g., in other pages), exit
        if (!display) return;

        // Loading or error state
        if (!rotiData) {
            display.textContent = 'Calculating...';
            return;
        }

        // Use hourlyRate if available, otherwise hourlyAlpha
        const hourlyRate = rotiData.hourlyRate || rotiData.hourlyAlpha || 0;
        
        let displayVal;
        if (currency === 'KRW') {
            displayVal = '₩' + Math.round(hourlyRate).toLocaleString();
        } else {
            const usdVal = hourlyRate / fxRate;
            displayVal = '$' + usdVal.toFixed(2);
        }

        display.textContent = `${displayVal}/hr`;
        
        // Add currency toggle capability
        if (badge && onCurrencyToggle) {
             badge.onclick = onCurrencyToggle;
             badge.style.cursor = 'pointer';
             badge.title = 'Click to toggle currency (KRW/USD)';
        }
    },

    /**
     * Render Macro Vitals (Net Liquidity, Real Yield)
     * Currently uses hardcoded values as placeholder for API data
     */
    renderMacroVitals: () => {
        const liquidityEl = document.getElementById('macro-liquidity');
        const liquidityTrendEl = document.getElementById('macro-liquidity-trend');
        const yieldEl = document.getElementById('macro-yield');
        const yieldTrendEl = document.getElementById('macro-yield-trend');

        // Hardcoded Data (Mockup Phase)
        // Net Liquidity: $6.2T (Fueling)
        if (liquidityEl) liquidityEl.textContent = '$6.2T';
        if (liquidityTrendEl) {
            liquidityTrendEl.innerHTML = '<i data-lucide="trending-up" style="width:12px;height:12px;margin-right:4px"></i>Fueling';
            liquidityTrendEl.className = 'macro-trend fueling';
        }

        // Real Yield: 2.1% (Heavy)
        if (yieldEl) yieldEl.textContent = '2.10%';
        if (yieldTrendEl) {
            yieldTrendEl.innerHTML = '<i data-lucide="anchor" style="width:12px;height:12px;margin-right:4px"></i>Heavy';
            yieldTrendEl.className = 'macro-trend heavy';
        }
        
        // Re-render Lucide icons if needed
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * Render Weekly Pulse Stats (Win Rate, Expectancy, etc.)
     * @param {Object} stats - { winRate, gainLossRatio, expectancy }
     */
    renderPulse: (stats) => {
        const els = {
            winRate: document.getElementById('vital-winrate'),
            gainLoss: document.getElementById('vital-gainloss'),
            expectancy: document.getElementById('vital-expectancy')
        };

        if (stats.winRate !== undefined && els.winRate) {
            els.winRate.textContent = (stats.winRate * 100).toFixed(1) + '%';
            els.winRate.style.color = stats.winRate >= 0.5 ? '#00E3CC' : '#FF453A';
        }
        
        if (stats.gainLossRatio !== undefined && els.gainLoss) {
            els.gainLoss.textContent = stats.gainLossRatio.toFixed(2);
            els.gainLoss.style.color = stats.gainLossRatio >= 1.5 ? '#00E3CC' : (stats.gainLossRatio >= 1.0 ? '#FFD700' : '#FF453A');
        }

        if (stats.expectancy !== undefined && els.expectancy) {
             els.expectancy.textContent = (stats.expectancy > 0 ? '+' : '') + stats.expectancy.toFixed(2) + 'R';
             els.expectancy.style.color = stats.expectancy > 0.5 ? '#00E3CC' : (stats.expectancy > 0 ? '#FFD700' : '#FF453A');
        }
        
        // Render Sigma Zone if sigmaStats available
        if (stats.sigmaStats && stats.weeklyReturn !== undefined) {
            UI.renderSigmaZone(stats.sigmaStats, stats.weeklyReturn, stats.expectancy);
        }
    },

    /**
     * Render Sigma Zone Gauge (Weekly Pulse)
     * Shows WTD Return position within -2σ to +2σ range
     * @param {Object} sigmaStats - { mean, stdDev, twoSigma }
     * @param {number} currentReturn - Current WTD return (decimal, e.g., -0.0217 for -2.17%)
     * @param {number} expectancy - Weekly expectancy for arrow marker
     */
    renderSigmaZone: (sigmaStats, currentReturn, expectancy = 0) => {
        // Find container (pre-defined in HTML)
        const container = document.getElementById('sigma-zone');
        if (!container) return;
        
        // Show the container
        container.style.display = 'block';
        
        const { mean, stdDev, twoSigma } = sigmaStats;
        
        // Convert values to percentages
        const meanPct = mean * 100;
        const stdDevPct = stdDev * 100;
        const currentPct = currentReturn * 100;
        const expectancyPct = (expectancy || 0) * stdDevPct; // expectancy in R units = stdDev multiples
        
        // Calculate positions (0% = -2σ, 50% = mean, 100% = +2σ)
        // Range: mean - 2*stdDev to mean + 2*stdDev
        const rangeMin = meanPct - 2 * stdDevPct;
        const rangeMax = meanPct + 2 * stdDevPct;
        const rangeSize = rangeMax - rangeMin;
        
        // Clamp WTD position to 0-100%
        let wtdPosition = ((currentPct - rangeMin) / rangeSize) * 100;
        wtdPosition = Math.max(0, Math.min(100, wtdPosition));
        
        // Expectation position (mean + expectancy offset)
        let expectationPosition = 50; // At mean by default
        if (expectancy) {
            // Expectation is relative to mean, in R-units (std dev multiples)
            const expectationValue = meanPct + (expectancy * stdDevPct * 0.5); // Scale down for visibility
            expectationPosition = ((expectationValue - rangeMin) / rangeSize) * 100;
            expectationPosition = Math.max(5, Math.min(95, expectationPosition));
        }
        
        // Calculate deviation from mean in sigma units
        const deviationSigma = (currentPct - meanPct) / stdDevPct;
        
        // Determine status
        let statusClass = 'safe';
        let statusText = 'Within normal range';
        if (Math.abs(deviationSigma) > 2) {
            statusClass = 'danger';
            statusText = '⚠️ Extreme move (>2σ)';
        } else if (Math.abs(deviationSigma) > 1) {
            statusClass = 'warning';
            statusText = 'Notable deviation';
        }
        
        const isNegative = currentReturn < 0;
        const isExtreme = Math.abs(deviationSigma) > 2;
        
        container.innerHTML = `
            <div class="sigma-zone-label">Sigma Zone (-2σ ~ +2σ)</div>
            <div class="sigma-bar-container">
                <div class="sigma-bar-track"></div>
                <div class="sigma-bar-ticks">
                    <div class="sigma-tick-mark"><span class="sigma-tick-label">-2σ</span></div>
                    <div class="sigma-tick-mark"><span class="sigma-tick-label">-1σ</span></div>
                    <div class="sigma-tick-mark center"><span class="sigma-tick-label">μ</span></div>
                    <div class="sigma-tick-mark"><span class="sigma-tick-label">+1σ</span></div>
                    <div class="sigma-tick-mark"><span class="sigma-tick-label">+2σ</span></div>
                </div>
                <div class="sigma-expectation-marker" style="left: ${expectationPosition}%" title="Expectation"></div>
                <div class="sigma-wtd-marker ${isNegative ? 'negative' : ''} ${isExtreme ? 'extreme' : ''}" 
                     style="left: ${wtdPosition}%" 
                     title="WTD: ${currentPct.toFixed(2)}%"></div>
            </div>
            <div class="sigma-legend">
                <div class="sigma-legend-item">
                    <span class="sigma-legend-dot wtd"></span>
                    <span>WTD Return</span>
                </div>
                <div class="sigma-legend-item">
                    <span class="sigma-legend-arrow">▼</span>
                    <span>Expectation</span>
                </div>
            </div>
            <div class="sigma-deviation-text">
                ${statusText} · Deviation: <span class="value ${statusClass}">${deviationSigma >= 0 ? '+' : ''}${deviationSigma.toFixed(2)}σ</span>
            </div>
        `;
    },

    /**
     * Initialize Sidebar Navigation
     */
    initSidebar: () => {
        const navItems = document.querySelectorAll('.nav-item[data-target]');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.getAttribute('data-target');
                const targetSection = document.getElementById(targetId);
                
                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                if (targetSection) {
                    // Smooth scroll to section
                    targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // Intersection Observer to update active state on scroll
        const observerOptions = {
            root: null,
            rootMargin: '-50% 0px -50% 0px', // Activate when section is 50% visible
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    navItems.forEach(item => {
                        if (item.getAttribute('data-target') === id) {
                           item.classList.add('active');
                        } else {
                           item.classList.remove('active');
                        }
                    });
                }
            });
        }, observerOptions);

        document.querySelectorAll('.dashboard-section').forEach(section => {
            observer.observe(section);
        });
        
        // Initialize scroll fade detection
        UI.initScrollFadeDetection();
    },
    
    /**
     * Initialize Scroll Fade Detection
     * Monitors terminal sections for scrollability and shows fade gradient when scrollable
     */
    initScrollFadeDetection: () => {
        const checkScrollable = () => {
            document.querySelectorAll('.terminal-section').forEach(section => {
                // Check if content exceeds viewport height
                const isScrollable = section.scrollHeight > section.clientHeight;
                section.classList.toggle('has-scroll', isScrollable);
            });
        };
        
        // Initial check
        checkScrollable();
        
        // Re-check on resize (debounced)
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(checkScrollable, 150);
        });
        
        // Re-check after charts render (delayed)
        setTimeout(checkScrollable, 1000);
        setTimeout(checkScrollable, 3000);
    }
};

