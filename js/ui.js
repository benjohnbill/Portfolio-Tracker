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
    renderAllocation: (portfolio, chartInstance, assetReturns = {}, viewMode = '1w') => {
        const tbody = document.getElementById('allocation-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        // Update column headers based on viewMode
        const col4Header = document.getElementById('alloc-col4-header');
        const col5Header = document.getElementById('alloc-col5-header');
        if (col4Header && col5Header) {
            if (viewMode === 'total') {
                col4Header.textContent = 'INCEP Δ';  // Since Inception Return
                col5Header.textContent = 'Contrib.'; // Total Contribution
            } else if (viewMode === 'ytd') {
                col4Header.textContent = 'YTD Δ';    // Year-to-Date Return
                col5Header.textContent = 'Contrib.'; // YTD Contribution
            } else {
                col4Header.textContent = 'WTD Δ';
                col5Header.textContent = 'CONTRIB.';
            }
        }

        let totalValue = 0;
        portfolio.forEach(asset => {
            totalValue += asset.value || 0;
        });

        // Helper to format large numbers with K/M suffix
        const formatLargeNumber = (num, currency = '₩') => {
            if (num >= 1000000) {
                return currency + (num / 1000000).toFixed(2) + 'M';
            } else if (num >= 1000) {
                return currency + (num / 1000).toFixed(2) + 'K';
            }
            return currency + Math.round(num).toLocaleString();
        };

        // Update Total AUM Display
        const totalEl = document.getElementById('total-value');
        if (totalEl) {
            totalEl.innerText = formatLargeNumber(totalValue, '₩');
        }

        const labels = [];
        const data = [];
        const backgroundColors = [];

        // Find max contribution for bar scaling
        // In Total view, use cumulative attribution; in YTD view, use YTD attribution; in 1W view, use weight × return
        let maxContrib = 0;
        
        if (viewMode === 'total') {
            Object.values(assetReturns).forEach(ret => {
                const contrib = ret.contribution || 0;
                maxContrib = Math.max(maxContrib, Math.abs(contrib * 100));
            });
        } else if (viewMode === 'ytd') {
            Object.values(assetReturns).forEach(ret => {
                const contrib = ret.ytdContrib || 0;
                maxContrib = Math.max(maxContrib, Math.abs(contrib * 100));
            });
        } else {
            portfolio.forEach(asset => {
                const actualWeight = totalValue > 0 ? (asset.value / totalValue) : 0;
                const returns = assetReturns[asset.ticker] || { wtd: 0 };
                const contrib = actualWeight * returns.wtd * 100;
                maxContrib = Math.max(maxContrib, Math.abs(contrib));
            });
        }
        if (maxContrib < 0.1) maxContrib = 0.5;

        // Collect ghost assets for Total view (past holdings)
        const ghostAssets = [];
        if (viewMode === 'total') {
            Object.keys(assetReturns).forEach(ticker => {
                const ret = assetReturns[ticker];
                if (ret.isGhost && ret.contribution !== 0) {
                    ghostAssets.push(ticker);
                }
            });
        }

        // Render current portfolio assets
        portfolio.forEach(asset => {
            const actualWeight = totalValue > 0 ? (asset.value / totalValue) : 0;

            // Skip if no value and not showing in total view
            if (actualWeight === 0 && (asset.value || 0) === 0) {
                return;
            }

            const valueDisplay = formatLargeNumber(asset.value || 0, '₩');

            // Get return data
            const returns = assetReturns[asset.ticker] || { wtd: 0, ytd: 0, total: 0, contribution: 0, ytdContrib: 0 };
            
            // In 1W view: show WTD return and WTD contribution (weight × return)
            // In YTD view: show YTD market return and YTD attribution
            // In Total view: show Since Inception market return and cumulative attribution
            let returnVal, contribVal;
            
            if (viewMode === 'total') {
                returnVal = returns.total;
                contribVal = (returns.contribution || 0) * 100; // Cumulative attribution in %
            } else if (viewMode === 'ytd') {
                returnVal = returns.ytd;
                contribVal = (returns.ytdContrib || 0) * 100; // YTD attribution in %
            } else {
                returnVal = returns.wtd;
                contribVal = actualWeight * returns.wtd * 100; // WTD contribution
            }
            
            const returnClass = returnVal > 0.001 ? 'positive' : (returnVal < -0.001 ? 'negative' : 'neutral');
            const returnDisplay = returnVal !== 0 
                ? (returnVal > 0 ? '+' : '') + (returnVal * 100).toFixed(2) + '%'
                : '--';

            const contribClass = contribVal > 0.001 ? 'positive' : (contribVal < -0.001 ? 'negative' : '');
            const contribDisplay = contribVal !== 0
                ? (contribVal > 0 ? '+' : '') + contribVal.toFixed(3) + '%'
                : '0';
            
            const barWidth = Math.min(50, (Math.abs(contribVal) / maxContrib) * 50);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="asset-cell"><strong>${asset.ticker}</strong></td>
                <td class="num-cell">${(asset.targetWeight * 100).toFixed(0)}%</td>
                <td class="num-cell">${valueDisplay}</td>
                <td class="num-cell wtd-cell ${returnClass}">${returnDisplay}</td>
                <td class="contrib-cell">
                    <div class="contrib-bar-wrapper">
                        <div class="contrib-bar ${contribClass}" style="width: ${barWidth}%;"></div>
                        <span class="contrib-value">${contribDisplay}</span>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);

            labels.push(asset.ticker);
            data.push((actualWeight * 100).toFixed(2));

            const colors = {
                'QQQ': '#3b82f6', 'DBMF': '#8b5cf6', 'CSI300': '#ef4444',
                'TLT': '#10b981', 'GLDM': '#eab308', 'MSTR': '#f97316',
                'NIFTY': '#06b6d4', 'BIL': '#a855f7', 'PFIX': '#ec4899', 'VBIL': '#84cc16'
            };
            backgroundColors.push(colors[asset.ticker] || '#64748b');
        });

        // Render ghost assets (past holdings) - Only in Total view
        if (viewMode === 'total' && ghostAssets.length > 0) {
            // Add separator row
            const separatorRow = document.createElement('tr');
            separatorRow.className = 'ghost-separator';
            separatorRow.innerHTML = `
                <td colspan="5" class="ghost-separator-cell">
                    <span class="ghost-separator-text">⏱️ PAST HOLDINGS (Realized)</span>
                </td>
            `;
            tbody.appendChild(separatorRow);

            // Render each ghost asset
            ghostAssets.forEach(ticker => {
                const returns = assetReturns[ticker];
                const returnVal = returns.total;
                const contribVal = (returns.contribution || 0) * 100;

                const returnClass = returnVal > 0.001 ? 'positive' : (returnVal < -0.001 ? 'negative' : 'neutral');
                const returnDisplay = returnVal !== 0 
                    ? (returnVal > 0 ? '+' : '') + (returnVal * 100).toFixed(2) + '%'
                    : '--';

                const contribClass = contribVal > 0.001 ? 'positive' : (contribVal < -0.001 ? 'negative' : '');
                const contribDisplay = contribVal !== 0
                    ? (contribVal > 0 ? '+' : '') + contribVal.toFixed(3) + '%'
                    : '0';
                
                const barWidth = Math.min(50, (Math.abs(contribVal) / maxContrib) * 50);

                const tr = document.createElement('tr');
                tr.className = 'ghost-row';
                tr.innerHTML = `
                    <td class="asset-cell ghost"><strong>${ticker}</strong></td>
                    <td class="num-cell ghost">--</td>
                    <td class="num-cell ghost">--</td>
                    <td class="num-cell wtd-cell ghost ${returnClass}">${returnDisplay}</td>
                    <td class="contrib-cell ghost">
                        <div class="contrib-bar-wrapper">
                            <div class="contrib-bar ${contribClass}" style="width: ${barWidth}%;"></div>
                            <span class="contrib-value">${contribDisplay}</span>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Update Chart (only current holdings)
        if (chartInstance) {
            chartInstance.data.labels = labels;
            chartInstance.data.datasets[0].data = data;
            chartInstance.data.datasets[0].backgroundColor = backgroundColors;
            chartInstance.update();
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
     * Render Trading Signals
     */
    renderSignals: (sellSignals, buySignals, rebalanceActions) => {
        const sellList = document.getElementById('sell-signals-list');
        const buyList = document.getElementById('buy-signals-list');
        const badge = document.getElementById('signal-status-badge');
        const adviceBox = document.getElementById('rebalance-advice');

        if (!sellList || !buyList) return;

        sellList.innerHTML = '';
        buyList.innerHTML = '';

        let actionCount = 0;

        // Render Sell Signals
        if (sellSignals.length > 0) {
            sellSignals.forEach(s => {
                const li = document.createElement('li');
                li.className = 'sell-signal';
                li.innerHTML = `<i data-lucide="trending-down"></i> ${s.msg}`;
                sellList.appendChild(li);
                actionCount++;
            });
        } else {
            sellList.innerHTML = '<li class="no-signal"><i data-lucide="minus"></i> No Sell Actions</li>';
        }

        // Render Buy Signals
        if (buySignals.length > 0) {
            buySignals.forEach(s => {
                const li = document.createElement('li');
                li.className = 'buy-signal';
                li.innerHTML = `<i data-lucide="trending-up"></i> ${s.msg}`;
                buyList.appendChild(li);
                actionCount++;
            });
        } else {
            buyList.innerHTML = '<li class="no-signal"><i data-lucide="minus"></i> No Buy Actions</li>';
        }

        // Rebalancing Advice
        if (rebalanceActions.length > 0) {
            adviceBox.innerHTML = rebalanceActions.map(a => `<div><i data-lucide="scale"></i> ${a.msg}</div>`).join('');
            adviceBox.style.borderColor = '#ffd60a';
            adviceBox.style.color = '#ffd60a';
            actionCount += rebalanceActions.length;
        } else {
            adviceBox.innerHTML = '<i data-lucide="check-circle"></i> Portfolio Balanced. No rebalancing needed.';
            adviceBox.style.borderColor = '#10b981';
            adviceBox.style.color = '#10b981';
        }

        if (badge) {
            badge.innerText = actionCount > 0 ? `${actionCount} Actions Needed` : 'System Stable';
            badge.style.color = actionCount > 0 ? 'var(--neon-yellow)' : 'var(--neon-cyan)';
            badge.style.borderColor = actionCount > 0 ? 'var(--neon-yellow)' : 'var(--neon-cyan)';
        }

        // Re-render Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * Render Market Conditions Monitor (Final Graphics with MSTR hints)
     */
    renderConditions: (marketData, derivedStats) => {
        const grid = document.getElementById('condition-grid');
        if (!grid) return;

        grid.innerHTML = '';

        // 1. Common Asset Card Renderer
        const renderAssetCard = (ticker, name, data, currency = 'USD') => {
            if (!data || !data.price) return '';

            const price = data.price;
            const ma50 = data.ma50;
            const ma250 = data.ma250;
            const rsi = data.rsi;

            // RSI State-based Styling: <35 or >65 is EXTREME → highlight
            const isRsiExtreme = rsi < 35 || rsi > 65;
            // RSI: Neutral gray when normal, Red when extreme
            const rsiColor = isRsiExtreme ? '#ff0a4e' : '#64748b';
            const rsiBarColor = isRsiExtreme ? '#ff0a4e' : '#10b981';
            const rsiFontWeight = isRsiExtreme ? 'font-weight:700;' : '';
            const rsiHighlight = isRsiExtreme ? 'border: 1px solid rgba(255, 10, 78, 0.3); padding: 2px 6px; border-radius: 4px;' : '';

            // Price display: Neutral (muted) - not prominent
            const priceDisplay = currency === 'KRW' 
                ? '₩' + Math.round(price).toLocaleString()
                : '$' + price.toFixed(2);

            // Trend Sorting Logic - Logic Formula stays bright (High Contrast)
            const sortItems = [
                { label: 'MP', val: price },
                { label: '50MA', val: ma50 },
                { label: '250MA', val: ma250 }
            ].sort((a, b) => a.val - b.val);

            // MP is bright white, others are light gray (readable but not muted)
            const trendStr = sortItems.map(i => `<span style="${i.label === 'MP' ? 'color:#fff;font-weight:bold' : 'color:#cbd5e1'}">${i.label}</span>`).join(' < ');

            return `
            <div class="diag-item-graphic">
                <div class="diag-header">
                    <span class="diag-title">${ticker}</span>
                    <span class="diag-price" style="color:#64748b;">${priceDisplay}</span>
                </div>
                <div class="diag-visuals">
                    <div class="rsi-container">
                        <span>RSI</span>
                        <div class="rsi-bar-bg">
                            <div class="rsi-bar-fill" style="width: ${rsi}%; background-color: ${rsiBarColor}"></div>
                        </div>
                        <span class="rsi-val" style="color:${rsiColor};${rsiFontWeight}${rsiHighlight}">${rsi.toFixed(2)}</span>
                    </div>
                    <div class="trend-row" style="margin-top:8px; justify-content:center;">
                        <div style="font-size:0.8rem;">${trendStr}</div>
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

        // 2. Gauge Widgets for MNAV and Z-Score
        const renderGaugeWidget = (id, title, url, minVal, maxVal, buyThreshold, sellThreshold) => {
            // Calculate zone percentages for gradient
            const range = maxVal - minVal;
            const buyPercent = ((buyThreshold - minVal) / range * 100).toFixed(1);
            const sellPercent = ((sellThreshold - minVal) / range * 100).toFixed(1);
            
            // 3-zone gradient: Green (Buy) -> Yellow (Hold) -> Red (Sell)
            // Using full opacity colors to match RSI bar brightness
            const gradientStyle = `linear-gradient(to right, 
                #10b981 0%, 
                #10b981 ${buyPercent}%, 
                #eab308 ${buyPercent}%, 
                #eab308 ${sellPercent}%, 
                #ef4444 ${sellPercent}%, 
                #ef4444 100%)`;
            
            return `
            <div class="gauge-widget" id="${id}-widget">
                <div class="gauge-header">
                    <span class="gauge-title">${title}</span>
                    <a href="${url}" target="_blank" style="color: var(--neon-cyan); font-size: 0.7rem;">
                        <i data-lucide="external-link" style="width:12px; height:12px;"></i>
                    </a>
                </div>
                <div class="gauge-input-row">
                    <input type="number" 
                           id="${id}-input" 
                           class="gauge-input" 
                           placeholder="Enter value" 
                           step="0.01"
                           data-min="${minVal}"
                           data-max="${maxVal}"
                           data-buy="${buyThreshold}"
                           data-sell="${sellThreshold}">
                    <span class="gauge-value" id="${id}-value">--</span>
                </div>
                <div class="gauge-track" id="${id}-track" style="background: ${gradientStyle};">
                    <div class="gauge-marker" id="${id}-marker" style="left: 50%;"></div>
                </div>
                <div class="gauge-labels">
                    <span class="gauge-zone-label buy">BUY < ${buyThreshold}</span>
                    <span class="gauge-zone-label hold">HOLD</span>
                    <span class="gauge-zone-label sell">SELL > ${sellThreshold}</span>
                </div>
            </div>`;
        };

        // MNAV: Buy < 1.3, Sell > 2.8 (Range: 1.3-0.5 to 2.8+0.5 = 0.8 to 3.3)
        grid.innerHTML += renderGaugeWidget('mnav', 'MSTR MNAV', 'https://www.strategy.com/', 0.8, 3.3, 1.3, 2.8);
        
        // Z-Score: Buy < 0.5, Sell > 4.5 (Range: 0.5-0.5 to 4.5+0.5 = 0.0 to 5.0)
        grid.innerHTML += renderGaugeWidget('zscore', 'BTC MVRV Z-Score', 'https://coinank.com/ko/chart/indicator/mvrv-z-score', 0.0, 5.0, 0.5, 4.5);

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
                    input.addEventListener('input', () => updateGauge(id, true));
                }
            });
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
            const returnStr = (stats.weeklyReturn > 0 ? '+' : '') + stats.weeklyReturn.toFixed(2) + '%';
            
            // Check if in weekend freeze period
            if (stats.wtdStatus && stats.wtdStatus.isFrozen) {
                // Weekend freeze - show with snowflake icon
                weeklyPnlEl.innerHTML = `<span style="opacity: 0.7">❄️</span> ${returnStr}`;
                weeklyPnlEl.title = `Week Closed (Base: ${stats.wtdStatus.baseDate})`;
            } else {
                weeklyPnlEl.innerText = returnStr;
                weeklyPnlEl.title = stats.wtdStatus ? `Base: ${stats.wtdStatus.baseDate}` : '';
            }
            
            weeklyPnlEl.style.color = stats.weeklyReturn >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
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
        if (!fundMetrics || !bmMetrics) return;

        const safe = (val) => (val !== undefined && val !== null && !isNaN(val));

        // Delta Threshold: Hide styling if absolute change is less than 0.01% (0.0001 in decimal)
        // This prevents displaying meaningless micro-changes in long-term metrics
        const DELTA_THRESHOLD = 0.0001; // 0.01%
        
        const formatDelta = (delta, isPercent, invert = false) => {
            if (!safe(delta)) return { text: '--', className: '' };
            
            // Hide delta if below threshold (0.01%)
            if (Math.abs(delta) < DELTA_THRESHOLD) {
                return { text: '--', className: '' };
            }
            
            const arrow = delta > 0 ? '▲' : (delta < 0 ? '▼' : '');
            let text;
            if (isPercent) {
                text = arrow + (delta > 0 ? '+' : '') + (delta * 100).toFixed(1) + '%';
            } else {
                text = arrow + (delta > 0 ? '+' : '') + delta.toFixed(2);
            }

            // Determine class: for most metrics higher is better (alpha)
            // For StdDev/MDD: lower fund value means less risk = alpha (inverted)
            let isAlpha = delta > 0;
            if (invert) isAlpha = !isAlpha;

            return {
                text: text,
                className: isAlpha ? 'alpha' : 'underperform'
            };
        };

        // Calculate Calmar ratios
        const fundCalmar = Finance.calculateCalmarRatio(fundMetrics.cagr, fundMetrics.mdd);
        const bmCalmar = Finance.calculateCalmarRatio(bmMetrics.cagr, bmMetrics.mdd);

        // === 2x3 GRID METRICS ===
        
        // Row 1: CAGR (higher is better) | MDD (lower is better)
        const cagrEl = document.getElementById('sc-cagr');
        const cagrDeltaEl = document.getElementById('sc-delta-cagr');
        if (cagrEl && safe(fundMetrics.cagr)) {
            cagrEl.textContent = (fundMetrics.cagr * 100).toFixed(1) + '%';
        }
        if (cagrDeltaEl && safe(fundMetrics.cagr) && safe(bmMetrics.cagr)) {
            const delta = fundMetrics.cagr - bmMetrics.cagr;
            const { text, className } = formatDelta(delta, true, false);
            cagrDeltaEl.textContent = text;
            cagrDeltaEl.className = `cell-delta ${className}`;
        }

        const mddEl = document.getElementById('sc-mdd');
        const mddDeltaEl = document.getElementById('sc-delta-mdd');
        if (mddEl && safe(fundMetrics.mdd)) {
            mddEl.textContent = '-' + (fundMetrics.mdd * 100).toFixed(1) + '%';
        }
        if (mddDeltaEl && safe(fundMetrics.mdd) && safe(bmMetrics.mdd)) {
            const delta = fundMetrics.mdd - bmMetrics.mdd;
            const { text, className } = formatDelta(delta, true, true); // Inverted: lower MDD is better
            mddDeltaEl.textContent = text;
            mddDeltaEl.className = `cell-delta ${className}`;
        }

        // Row 2: SHARPE (higher is better) | STDDEV (lower is better)
        const sharpeEl = document.getElementById('sc-sharpe');
        const sharpeDeltaEl = document.getElementById('sc-delta-sharpe');
        if (sharpeEl && safe(fundMetrics.sharpe)) {
            sharpeEl.textContent = fundMetrics.sharpe.toFixed(2);
        }
        if (sharpeDeltaEl && safe(fundMetrics.sharpe) && safe(bmMetrics.sharpe)) {
            const delta = fundMetrics.sharpe - bmMetrics.sharpe;
            const { text, className } = formatDelta(delta, false, false);
            sharpeDeltaEl.textContent = text;
            sharpeDeltaEl.className = `cell-delta ${className}`;
        }

        const stdEl = document.getElementById('sc-std');
        const stdDeltaEl = document.getElementById('sc-delta-std');
        if (stdEl && safe(fundMetrics.stdDev)) {
            stdEl.textContent = (fundMetrics.stdDev * 100).toFixed(1) + '%';
        }
        if (stdDeltaEl && safe(fundMetrics.stdDev) && safe(bmMetrics.stdDev)) {
            const delta = fundMetrics.stdDev - bmMetrics.stdDev;
            const { text, className } = formatDelta(delta, true, true); // Inverted: lower StdDev is better
            stdDeltaEl.textContent = text;
            stdDeltaEl.className = `cell-delta ${className}`;
        }

        // Row 3: SORTINO (higher is better) | CALMAR (higher is better)
        const sortinoEl = document.getElementById('sc-sortino');
        const sortinoDeltaEl = document.getElementById('sc-delta-sortino');
        if (sortinoEl && safe(fundMetrics.sortino)) {
            sortinoEl.textContent = fundMetrics.sortino.toFixed(2);
        }
        if (sortinoDeltaEl && safe(fundMetrics.sortino) && safe(bmMetrics.sortino)) {
            const delta = fundMetrics.sortino - bmMetrics.sortino;
            const { text, className } = formatDelta(delta, false, false);
            sortinoDeltaEl.textContent = text;
            sortinoDeltaEl.className = `cell-delta ${className}`;
        }

        const calmarEl = document.getElementById('sc-calmar');
        const calmarDeltaEl = document.getElementById('sc-delta-calmar');
        if (calmarEl && safe(fundCalmar)) {
            calmarEl.textContent = fundCalmar.toFixed(2);
        }
        if (calmarDeltaEl && safe(fundCalmar) && safe(bmCalmar)) {
            const delta = fundCalmar - bmCalmar;
            const { text, className } = formatDelta(delta, false, false);
            calmarDeltaEl.textContent = text;
            calmarDeltaEl.className = `cell-delta ${className}`;
        }

        // === FOOTER METRICS ===
        
        // Beta
        const betaEl = document.getElementById('sc-beta');
        if (betaEl && safe(fundMetrics.beta)) {
            betaEl.textContent = fundMetrics.beta.toFixed(2);
        }

        // Correlation
        const corrEl = document.getElementById('sc-correlation');
        if (corrEl && safe(fundMetrics.correlation)) {
            corrEl.textContent = fundMetrics.correlation.toFixed(2);
        }
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
        if (!result) {
            container.innerHTML = `
                <div class="stress-test-error">
                    <i data-lucide="alert-triangle"></i>
                    <span>Failed to load stress test data</span>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Format MDD values
        const portfolioMDD = (result.portfolioMDD * 100).toFixed(1);
        const spyMDD = (result.spyMDD * 100).toFixed(1);
        
        // Calculate relative performance (better = less drawdown)
        const delta = result.spyMDD - result.portfolioMDD;
        const deltaPercent = (delta * 100).toFixed(1);
        const isOutperform = delta > 0;

        // Scenario info
        const scenarioLabels = {
            '2020': { name: '2020 Pandemic', type: 'Deflationary Shock', icon: '🦠' },
            '2022': { name: '2022 Inflation', type: 'Inflationary Shock', icon: '📈' }
        };
        const scenario = scenarioLabels[activeScenario];

        // Calculate bar widths (scale to max 100%)
        const maxMDD = Math.max(result.portfolioMDD, result.spyMDD);
        const spyWidth = (result.spyMDD / maxMDD) * 100;
        const portfolioWidth = (result.portfolioMDD / maxMDD) * 100;

        container.innerHTML = `
            <!-- Scenario Toggle Buttons -->
            <div class="stress-scenario-toggle">
                <button class="scenario-btn ${activeScenario === '2020' ? 'active' : ''}" data-scenario="2020">
                    🦠 2020 Pandemic
                </button>
                <button class="scenario-btn ${activeScenario === '2022' ? 'active' : ''}" data-scenario="2022">
                    📈 2022 Inflation
                </button>
            </div>

            <!-- Scenario Info Header -->
            <div class="stress-scenario-info">
                <span class="scenario-name">${scenario.icon} ${scenario.name}</span>
                <span class="scenario-type">${scenario.type}</span>
                <span class="scenario-period">${result.periodStart} → ${result.periodEnd}</span>
            </div>

            <!-- MDD Comparison Chart -->
            <div class="stress-mdd-chart">
                <!-- SPY (Benchmark) Row -->
                <div class="mdd-row">
                    <div class="mdd-label">SPY</div>
                    <div class="mdd-bar-wrapper">
                        <div class="mdd-bar benchmark" style="width: ${spyWidth}%"></div>
                        <span class="mdd-value">-${spyMDD}%</span>
                    </div>
                </div>
                
                <!-- Portfolio Row -->
                <div class="mdd-row">
                    <div class="mdd-label">Base 6</div>
                    <div class="mdd-bar-wrapper">
                        <div class="mdd-bar portfolio ${isOutperform ? 'outperform' : 'underperform'}" style="width: ${portfolioWidth}%"></div>
                        <span class="mdd-value">-${portfolioMDD}%</span>
                    </div>
                </div>
            </div>

            <!-- Delta Summary -->
            <div class="stress-delta-summary ${isOutperform ? 'positive' : 'negative'}">
                <span class="delta-label">vs Benchmark:</span>
                <span class="delta-value">${isOutperform ? '+' : ''}${deltaPercent}%</span>
                <span class="delta-verdict">${isOutperform ? 'Better Protection' : 'More Drawdown'}</span>
            </div>

            <!-- Footnote / Disclaimer -->
            <div class="stress-disclaimer">
                <i data-lucide="info" class="disclaimer-icon"></i>
                <p>This simulation tests the fund's 'Base Asset Structure' (Core 6) without tactical hedges or switching rules, to provide a <strong>Worst-Case MDD</strong> scenario. Historical stress tests use DBMF (CTA), CSI 300 Index, and Bitcoin spot prices (MSTR in 2020) as proxies to ensure data availability and strategic validity.</p>
            </div>
        `;

        // Add event listeners to scenario buttons
        container.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newScenario = btn.dataset.scenario;
                if (newScenario !== activeScenario) {
                    UI.renderStressTest(stressTestResults, newScenario);
                }
            });
        });

        // Re-render Lucide icons
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
    renderSleepScore: (sleepData, activePeriod = 'total', onPeriodChange = null) => {
        const container = document.getElementById('sleep-score-container');
        if (!container) return;

        // Loading state
        if (!sleepData) {
            container.innerHTML = `
                <div class="sleep-score-loading">
                    <i data-lucide="moon" class="sleep-icon"></i>
                    <span>Calculating sleep quality...</span>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Extract data
        const { portfolio, spy, tqqq, period, dataPoints } = sleepData;

        // Calculate bar widths (normalize to max 100)
        const maxScore = 100;
        const portfolioWidth = (portfolio.score / maxScore) * 100;
        const spyWidth = (spy.score / maxScore) * 100;
        const tqqqWidth = (tqqq.score / maxScore) * 100;

        // Period labels
        const periodLabels = {
            'total': 'Since Inception',
            '1y': '1 Year'
        };

        // Generate insight text
        const generateInsight = () => {
            const periodText = periodLabels[period] || 'the selected period';
            const portfolioGrade = portfolio.grade.label;
            const tqqqGrade = tqqq.grade?.label || 'Insomnia';
            
            if (portfolio.score >= 70) {
                return `Over ${periodText}, TQQQ investors suffered from '<strong>${tqqqGrade}</strong>' (Score: ${tqqq.score?.toFixed(0) || 'N/A'}). You maintained a '<strong>${portfolioGrade}</strong>' status (Score: ${portfolio.score.toFixed(0)}), proving that your system generates wealth efficiently without the emotional tax.`;
            } else {
                return `Your system achieved a score of ${portfolio.score.toFixed(0)} over ${periodText}. While this beats leveraged products like TQQQ (${tqqq.score?.toFixed(0) || 'N/A'}), there's room for improvement in reducing drawdown volatility.`;
            }
        };

        container.innerHTML = `
            <!-- Period Toggle -->
            <div class="sleep-period-toggle">
                <button class="period-btn ${activePeriod === 'total' ? 'active' : ''}" data-period="total">Total</button>
                <button class="period-btn ${activePeriod === '1y' ? 'active' : ''}" data-period="1y">1Y</button>
            </div>

            <!-- Score Display -->
            <div class="sleep-score-display">
                <div class="sleep-main-score">
                    <span class="score-icon">${portfolio.grade.icon}</span>
                    <span class="score-value" style="color: ${portfolio.grade.color}">${portfolio.score.toFixed(0)}</span>
                    <span class="score-label">${portfolio.grade.label}</span>
                </div>
            </div>

            <!-- Comparison Chart -->
            <div class="sleep-comparison-chart">
                <!-- Portfolio Row -->
                <div class="sleep-bar-row">
                    <div class="sleep-bar-label">Portfolio</div>
                    <div class="sleep-bar-wrapper">
                        <div class="sleep-bar portfolio" style="width: ${portfolioWidth}%; background: ${portfolio.grade.color}"></div>
                        <span class="sleep-bar-value">${portfolio.score.toFixed(0)}</span>
                    </div>
                </div>

                <!-- SPY Row -->
                <div class="sleep-bar-row">
                    <div class="sleep-bar-label">SPY</div>
                    <div class="sleep-bar-wrapper">
                        <div class="sleep-bar spy" style="width: ${spyWidth}%"></div>
                        <span class="sleep-bar-value">${spy.score?.toFixed(0) || 'N/A'}</span>
                    </div>
                </div>

                <!-- TQQQ Row -->
                <div class="sleep-bar-row">
                    <div class="sleep-bar-label">TQQQ</div>
                    <div class="sleep-bar-wrapper">
                        <div class="sleep-bar tqqq" style="width: ${tqqqWidth}%"></div>
                        <span class="sleep-bar-value">${tqqq.score?.toFixed(0) || 'N/A'}</span>
                    </div>
                </div>
            </div>

            <!-- Insight Text -->
            <div class="sleep-insight">
                <p>${generateInsight()}</p>
            </div>

            <!-- Data Points Info -->
            <div class="sleep-meta">
                <span>${periodLabels[period]} • ${dataPoints} trading days</span>
            </div>
        `;

        // Add period toggle event listeners
        container.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newPeriod = btn.dataset.period;
                if (newPeriod !== activePeriod && onPeriodChange) {
                    onPeriodChange(newPeriod);
                }
            });
        });

        // Re-render Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
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
        const container = document.getElementById('roti-badge-container');
        if (!container) return;

        // Loading or error state
        if (!rotiData) {
            container.innerHTML = `
                <div class="roti-badge roti-loading">
                    <span class="roti-icon">💰</span>
                    <span class="roti-label">Calculating...</span>
                </div>
            `;
            return;
        }

        // Convert values based on currency
        const hourlyAlpha = Finance.convertROTICurrency(rotiData.hourlyAlpha, currency, fxRate);
        const netProfit = Finance.convertROTICurrency(rotiData.netProfit, currency, fxRate);
        
        // Format values
        const currencySymbol = currency === 'USD' ? '$' : '₩';
        const formatValue = (val) => {
            if (currency === 'USD') {
                return val >= 1000 ? `${(val / 1000).toFixed(1)}K` : val.toFixed(0);
            } else {
                return val >= 10000 ? `${(val / 10000).toFixed(0)}만` : val.toLocaleString();
            }
        };

        const formattedHourly = formatValue(hourlyAlpha);
        const formattedProfit = formatValue(netProfit);

        // Determine display color based on profit
        const isPositive = rotiData.netProfit > 0;
        const badgeClass = isPositive ? 'positive' : 'negative';

        container.innerHTML = `
            <div class="roti-badge ${badgeClass}">
                <div class="roti-main">
                    <span class="roti-icon">💰</span>
                    <div class="roti-content">
                        <span class="roti-label">Hourly Alpha</span>
                        <span class="roti-value">${currencySymbol}${formattedHourly}/hr</span>
                    </div>
                    <button class="roti-currency-toggle" data-currency="${currency}">
                        ${currency}
                    </button>
                </div>
                
                <!-- Hover Tooltip -->
                <div class="roti-tooltip">
                    <div class="tooltip-header">Return On Time Invested</div>
                    <div class="tooltip-row">
                        <span>Operation Period:</span>
                        <strong>${rotiData.weeksOperating} weeks</strong>
                    </div>
                    <div class="tooltip-row">
                        <span>Your Active Time:</span>
                        <strong>${rotiData.totalHours.toFixed(1)} hrs</strong>
                    </div>
                    <div class="tooltip-row highlight">
                        <span>vs Day Trader:</span>
                        <strong>~${rotiData.dayTraderHours.toLocaleString()} hrs</strong>
                    </div>
                    <div class="tooltip-divider"></div>
                    <div class="tooltip-row">
                        <span>Net Profit:</span>
                        <strong class="${isPositive ? 'profit' : 'loss'}">${currencySymbol}${formattedProfit}</strong>
                    </div>
                    <div class="tooltip-row">
                        <span>Time Saved:</span>
                        <strong>${rotiData.timeSaved.toFixed(1)} hrs</strong>
                    </div>
                    <div class="tooltip-footer">
                        10 min/week × ${rotiData.weeksOperating} weeks operation
                    </div>
                </div>
            </div>
        `;

        // Add currency toggle event listener
        const toggleBtn = container.querySelector('.roti-currency-toggle');
        if (toggleBtn && onCurrencyToggle) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newCurrency = currency === 'KRW' ? 'USD' : 'KRW';
                onCurrencyToggle(newCurrency);
            });
        }
    }
};

