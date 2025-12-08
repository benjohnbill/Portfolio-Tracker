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

        // Friday Indicator
        const fridayIndicator = document.getElementById('friday-indicator');
        const sysStatusText = document.getElementById('sys-status-text');
        const sysStatusDot = document.getElementById('sys-status-dot');

        if (fridayIndicator) {
            if (isFriday) {
                fridayIndicator.classList.remove('not-friday');
                fridayIndicator.classList.add('is-friday');
                fridayIndicator.innerHTML = '<i data-lucide="calendar-check"></i><span>Today is Friday! 🎉</span>';
            } else {
                fridayIndicator.classList.remove('is-friday');
                fridayIndicator.classList.add('not-friday');
                fridayIndicator.innerHTML = '<i data-lucide="calendar-x"></i><span>Not Friday</span>';
            }
        }

        // System Status Colors
        if (sysStatusText && sysStatusDot) {
            if (isFriday) {
                sysStatusText.style.color = 'var(--neon-green)';
                sysStatusDot.style.background = 'var(--neon-green)';
            } else {
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
     * Columns: Asset | Actual% | Target% | Value | Price
     */
    renderAllocation: (portfolio, chartInstance) => {
        const tbody = document.getElementById('allocation-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        let totalValue = 0;
        portfolio.forEach(asset => {
            totalValue += asset.value || 0;
        });

        // Update Total AUM Display
        const totalEl = document.getElementById('total-value');
        if (totalEl) {
            totalEl.innerText = '₩' + Math.round(totalValue).toLocaleString();
        }

        const labels = [];
        const data = [];
        const backgroundColors = [];

        portfolio.forEach(asset => {
            const actualWeight = totalValue > 0 ? (asset.value / totalValue) : 0;

            // Skip 0% weight assets from display
            if (actualWeight === 0 && (asset.value || 0) === 0) {
                return;
            }

            // Format price based on currency
            const priceDisplay = asset.currency === 'USD'
                ? '$' + (asset.price || 0).toFixed(2)
                : '₩' + Math.round(asset.price || 0).toLocaleString();

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="asset-cell"><strong>${asset.ticker}</strong></td>
                <td class="num-cell group-weight ${(actualWeight > asset.targetWeight ? 'positive' : 'neutral')}">${(actualWeight * 100).toFixed(1)}%</td>
                <td class="num-cell group-weight">${(asset.targetWeight * 100).toFixed(0)}%</td>
                <td class="num-cell group-value">₩${Math.round(asset.value || 0).toLocaleString()}</td>
                <td class="num-cell group-value">${priceDisplay}</td>
            `;
            tbody.appendChild(tr);

            labels.push(asset.ticker);
            data.push((actualWeight * 100).toFixed(1));

            const colors = {
                'QQQ': '#3b82f6', 'CTA': '#8b5cf6', 'CSI300': '#ef4444',
                'TLT': '#10b981', 'GLDM': '#eab308', 'MSTR': '#f97316',
                'NIFTY': '#06b6d4', 'BIL': '#a855f7', 'PFIX': '#ec4899', 'VBIL': '#84cc16'
            };
            backgroundColors.push(colors[asset.ticker] || '#64748b');
        });

        // Update Chart
        if (chartInstance) {
            chartInstance.data.labels = labels;
            chartInstance.data.datasets[0].data = data;
            chartInstance.data.datasets[0].backgroundColor = backgroundColors;
            chartInstance.update();
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
        const renderAssetCard = (ticker, name, data) => {
            if (!data || !data.price) return '';

            const price = data.price;
            const ma50 = data.ma50;
            const ma250 = data.ma250;
            const rsi = data.rsi;

            // RSI Color Logic: <35 or >65 is RED, else GREEN
            const isRsiExtreme = rsi < 35 || rsi > 65;
            const rsiColor = isRsiExtreme ? '#ff0a4e' : '#10b981';

            // Trend Sorting Logic
            const sortItems = [
                { label: 'MP', val: price },
                { label: '50MA', val: ma50 },
                { label: '250MA', val: ma250 }
            ].sort((a, b) => a.val - b.val);

            const trendStr = sortItems.map(i => `<span style="${i.label === 'MP' ? 'color:#fff;font-weight:bold' : 'color:#64748b'}">${i.label}</span>`).join(' < ');

            return `
            <div class="diag-item-graphic">
                <div class="diag-header">
                    <span class="diag-title">${ticker}</span>
                    <span class="diag-price">$${Math.round(price).toLocaleString()}</span>
                </div>
                <div class="diag-visuals">
                    <div class="rsi-container">
                        <span>RSI</span>
                        <div class="rsi-bar-bg">
                            <div class="rsi-bar-fill" style="width: ${rsi}%; background-color: ${rsiColor}"></div>
                        </div>
                        <span class="rsi-val" style="color:${rsiColor}">${rsi.toFixed(0)}</span>
                    </div>
                    <div class="trend-row" style="margin-top:8px; justify-content:center;">
                        <div style="font-size:0.8rem;">${trendStr}</div>
                    </div>
                </div>
            </div>`;
        };

        // Render 4 Main Assets
        grid.innerHTML += renderAssetCard('TLT', 'Bonds', marketData?.TLT);
        grid.innerHTML += renderAssetCard('GLDM', 'Gold', marketData?.GLDM);
        grid.innerHTML += renderAssetCard('CSI300', 'China', marketData?.CSI300);
        grid.innerHTML += renderAssetCard('MSTR', 'Crypto', marketData?.MSTR);

        // 2. Link Cards with MSTR signal hints below
        const renderLinkCardWithHint = (title, url, iconName, hint) => `
            <a href="${url}" target="_blank" style="text-decoration:none;">
                <div class="diag-item-graphic link-card">
                    <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                        <i data-lucide="${iconName}"></i>
                        <span class="diag-title" style="color:var(--neon-cyan); font-weight:700;">${title}</span>
                        <i data-lucide="external-link" style="width:14px; height:14px;"></i>
                    </div>
                    <div class="signal-hint">${hint}</div>
                </div>
            </a>
        `;

        grid.innerHTML += renderLinkCardWithHint(
            'MSTR MNAV',
            'https://www.strategy.com/',
            'bar-chart-3',
            'MNAV > 3.0 → Consider SELL | MNAV < 1.5 → Consider BUY'
        );
        grid.innerHTML += renderLinkCardWithHint(
            'BTC MVRV Z-Score',
            'https://coinank.com/ko/chart/indicator/mvrv-z-score',
            'activity',
            'Z > 6 → Consider SELL | Z < 0 → Consider BUY'
        );

        // Re-render Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    /**
     * Render Risk Metrics
     */
    renderRisk: (stats) => {
        if (!stats) return;

        const weeklyPnlEl = document.getElementById('weekly-pnl');
        if (weeklyPnlEl && stats.weeklyReturn !== undefined) {
            weeklyPnlEl.innerText = (stats.weeklyReturn > 0 ? '+' : '') + stats.weeklyReturn.toFixed(2) + '%';
            weeklyPnlEl.style.color = stats.weeklyReturn >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
        }

        const safe = (val) => (val !== undefined && val !== null && !isNaN(val)) ? val.toFixed(2) : '--';

        const cagrEl = document.getElementById('risk-cagr');
        const stdEl = document.getElementById('risk-std');

        if (cagrEl) cagrEl.innerText = safe(stats.cagr * 100) + '%';
        if (stdEl) stdEl.innerText = safe(stats.stdDev * 100) + '%';
    },

    /**
     * Show Toast/Loading Message
     */
    showToast: (message) => {
        console.log(`[TOAST]: ${message}`);
        const badge = document.getElementById('signal-status-badge');
        if (badge) badge.innerText = message;
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
            const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
            sorted.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'history-item glass';
                row.innerHTML = `
                    <div class="history-main">
                        <div class="history-date">${item.date}</div>
                        <div class="history-type">${item.type}</div>
                        <div class="history-details">${item.details || ''}</div>
                        ${item.memo ? `<div class="history-memo">${item.memo}</div>` : ''}
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
                <div class="event-type-grid">
                    <div class="type-select-btn" data-type="Rebalancing"><i data-lucide="scale"></i><br>Rebalancing</div>
                    <div class="type-select-btn" data-type="Switch"><i data-lucide="repeat"></i><br>Asset Switch</div>
                    <div class="type-select-btn" data-type="Withdraw"><i data-lucide="arrow-up-from-line"></i><br>Withdraw</div>
                    <div class="type-select-btn" data-type="Deposit"><i data-lucide="arrow-down-to-line"></i><br>Deposit</div>
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

            let eventData = {
                id: editData?.id || `log_${Date.now()}`,
                date: formData.get('date'),
                type: type,
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

                // cashFlow is conceptual for TWR - not actual amount until we get prices
                eventData.hasExternalFlow = true;
                eventData.flowType = type;
            }

            onSave(eventData, isEdit);
        });
    }
};

