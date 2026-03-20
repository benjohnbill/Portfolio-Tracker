---
description: Chart Toggle System Refactoring - 차트 토글 시스템 대규모 리팩토링
---

# 📊 Chart Toggle System Refactoring Plan

> **작성일**: 2024-12-14  
> **목표**: 각 토글을 완벽하게 독립적으로 만들고, 명확한 상호작용 정의

---

## 🎯 Overview

### 현재 문제점
- 토글들이 서로 완전히 독립적이지 않아 충돌 발생
- `updatePerformanceChartWithHypothetical()`, `updatePerformanceChartCompareSlope()`, `updatePerformanceChartProjection()` 함수들이 혼합된 상태
- 토글 조합에 따른 예측 불가능한 동작

### 목표 아키텍처
```
┌─────────────────────────────────────────────────────────────┐
│                    CHART STATE MANAGER                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 시계열 모드 (상호 배타적)                           │
│    ○ Default (2024.03.12~현재)                              │
│    ○ Hypothetical Full (2020.08.11~현재)                    │
│    ○ Projection (현재~목표연도)                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 오버레이 (독립적, 조합 가능)                        │
│    [□] SPY     [□] Static                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Phase 1: 상태 관리 시스템 구축

### Task 1.1: ChartStateManager 클래스 생성
**파일**: `js/charts.js` (상단에 추가)

```javascript
/**
 * Chart State Manager
 * 모든 차트 토글 상태를 중앙에서 관리
 */
const ChartState = {
    // Layer 1: 시계열 모드 (상호 배타적)
    timelineMode: 'default',  // 'default' | 'hypothetical' | 'projection'
    
    // Layer 2: 오버레이 (독립적)
    overlays: {
        spy: true,      // SPY 벤치마크
        static: false   // Static 리밸런싱
    },
    
    // Projection 모드 전용
    projectionTarget: null,  // 목표 금액
    
    // 캐시된 데이터
    cache: {
        default: null,       // 2024.03.12~ 데이터
        hypothetical: null,  // 2020.08.11~ 데이터
        static: null         // Static 계산 데이터
    },
    
    // 시계열 범위 반환
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
    
    // localStorage 저장
    save() {
        const state = {
            timelineMode: this.timelineMode,
            overlays: this.overlays,
            projectionTarget: this.projectionTarget
        };
        localStorage.setItem('chartState', JSON.stringify(state));
    },
    
    // localStorage 로드
    load() {
        const saved = localStorage.getItem('chartState');
        if (saved) {
            const state = JSON.parse(saved);
            this.timelineMode = state.timelineMode || 'default';
            this.overlays = state.overlays || { spy: true, static: false };
            this.projectionTarget = state.projectionTarget || null;
        }
    }
};
```

### Task 1.2: 토글 상태 변경 핸들러
**파일**: `js/app.js` (setupCompoundVisionListeners 내부 또는 별도)

```javascript
/**
 * 시계열 모드 변경 핸들러
 * @param {string} mode - 'default' | 'hypothetical' | 'projection'
 */
function handleTimelineModeChange(mode) {
    const prevMode = ChartState.timelineMode;
    ChartState.timelineMode = mode;
    ChartState.save();
    
    // 모드 변경 시 차트 완전 재생성 필요
    rebuildAllCharts();
    
    console.log(`📊 Timeline Mode: ${prevMode} → ${mode}`);
}

/**
 * 오버레이 토글 핸들러
 * @param {string} overlay - 'spy' | 'static'
 * @param {boolean} visible
 */
function handleOverlayToggle(overlay, visible) {
    ChartState.overlays[overlay] = visible;
    ChartState.save();
    
    // 오버레이 변경은 dataset visibility만 조정 (효율적)
    updateChartOverlays();
    
    console.log(`📊 Overlay ${overlay}: ${visible ? 'ON' : 'OFF'}`);
}
```

---

## 📋 Phase 2: HTML 토글 UI 리팩토링

### Task 2.1: 토글 그룹 계층화
**파일**: `index.html` (Compound Vision 영역 수정)

**현재 구조:**
```html
<div class="cv-line-toggles">
    <div class="cv-toggle">SPY</div>
    <div class="cv-toggle">Projection</div>
</div>
<div class="cv-hypo-selector">
    Hypothetical: Off | Full | Slope
</div>
```

**새 구조:**
```html
<!-- 시계열 모드 선택 (상호 배타적) -->
<div class="cv-timeline-selector">
    <span class="cv-section-label">Timeline</span>
    <div class="cv-radio-group">
        <label class="cv-radio">
            <input type="radio" name="timeline-mode" value="default" checked>
            <span class="cv-radio-text">Default</span>
        </label>
        <label class="cv-radio">
            <input type="radio" name="timeline-mode" value="hypothetical">
            <span class="cv-radio-text">Hypothetical Full</span>
        </label>
        <label class="cv-radio">
            <input type="radio" name="timeline-mode" value="projection">
            <span class="cv-radio-text">Projection</span>
        </label>
    </div>
</div>

<!-- 오버레이 토글 (독립적) -->
<div class="cv-overlay-toggles">
    <span class="cv-section-label">Overlay</span>
    <div class="cv-toggle-group">
        <div class="cv-toggle">
            <label class="toggle-switch">
                <input type="checkbox" id="cv-spy-toggle" checked>
                <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">SPY</span>
        </div>
        <div class="cv-toggle">
            <label class="toggle-switch">
                <input type="checkbox" id="cv-static-toggle">
                <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Static</span>
        </div>
    </div>
</div>
```

### Task 2.2: CSS 스타일링
**파일**: `css/style.css` (추가)

```css
/* Timeline Mode Selector */
.cv-timeline-selector {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    margin-bottom: 8px;
}

.cv-section-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
    min-width: 60px;
}

/* Overlay Toggles */
.cv-overlay-toggles {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
}

.cv-toggle-group {
    display: flex;
    gap: 16px;
}
```

---

## 📋 Phase 3: 차트 렌더링 통합

### Task 3.1: 통합 차트 렌더링 함수
**파일**: `js/charts.js`

```javascript
/**
 * 통합 차트 렌더링 함수
 * ChartState를 기반으로 모든 차트를 렌더링
 */
function renderCharts() {
    const { timelineMode, overlays, projectionTarget } = ChartState;
    const dateRange = ChartState.getDateRange();
    
    console.log(`📊 Rendering charts: mode=${timelineMode}, spy=${overlays.spy}, static=${overlays.static}`);
    
    // 1. 데이터 준비
    const chartData = prepareChartData(timelineMode, dateRange);
    
    // 2. Main Performance Chart 렌더링
    renderMainChart(chartData, overlays, timelineMode, projectionTarget);
    
    // 3. Underwater Chart 렌더링
    renderUnderwaterChart(chartData, overlays, timelineMode);
    
    // 4. Info Bar 업데이트
    updateInfoBars(overlays);
    
    // 5. Execution Alpha 표시 (Static ON 시)
    if (overlays.static) {
        updateExecutionAlphaBadge(chartData);
    }
}

/**
 * 차트 데이터 준비
 */
function prepareChartData(mode, dateRange) {
    switch (mode) {
        case 'hypothetical':
            return {
                labels: /* 2020.08.11~ dates */,
                portfolio: /* actual portfolio (null before 2024.03.12) */,
                spy: /* SPY from 2020.08.11 */,
                static: /* Static from 2020.08.11 */,
                ma60: /* 60MA */
            };
        case 'projection':
            return {
                labels: /* current ~ target year */,
                portfolio: /* projected portfolio */,
                spy: /* projected SPY */,
                static: /* projected Static */
            };
        default:
            return {
                labels: /* 2024.03.12~ dates */,
                portfolio: /* actual portfolio */,
                spy: /* SPY normalized */,
                static: /* Static from 2024.03.12 */,
                ma60: /* 60MA */
            };
    }
}
```

### Task 3.2: 데이터셋 동적 구성
**파일**: `js/charts.js`

```javascript
/**
 * 토글 상태에 따라 데이터셋 배열 구성
 */
function buildDatasets(chartData, overlays, mode) {
    const datasets = [];
    
    // 1. Portfolio (항상 표시)
    datasets.push({
        label: 'Portfolio',
        data: chartData.portfolio,
        borderColor: '#06d6a0',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0
    });
    
    // 2. 60MA (Projection 모드 제외)
    if (mode !== 'projection' && chartData.ma60) {
        datasets.push({
            label: '60-Day MA',
            data: chartData.ma60,
            borderColor: '#ffd166',
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0
        });
    }
    
    // 3. SPY (토글 ON 시)
    if (overlays.spy) {
        datasets.push({
            label: 'SPY Benchmark',
            data: chartData.spy,
            borderColor: '#ef476f',
            borderWidth: 1.5,
            fill: false,
            pointRadius: 0
        });
    }
    
    // 4. Static (토글 ON 시)
    if (overlays.static) {
        datasets.push({
            label: 'Static Strategy',
            data: chartData.static,
            borderColor: '#8338ec',  // 보라색
            borderWidth: 1.5,
            borderDash: [3, 3],
            fill: false,
            pointRadius: 0
        });
    }
    
    return datasets;
}
```

### Task 3.3: 효율적 오버레이 업데이트
**파일**: `js/charts.js`

```javascript
/**
 * 오버레이만 변경 시 효율적 업데이트
 * 차트 재생성 없이 visibility만 조정
 */
function updateChartOverlays() {
    const { overlays } = ChartState;
    
    // Performance Chart
    if (performanceChart) {
        const spyIdx = performanceChart.data.datasets.findIndex(ds => ds.label?.includes('SPY'));
        const staticIdx = performanceChart.data.datasets.findIndex(ds => ds.label?.includes('Static'));
        
        if (spyIdx !== -1) {
            performanceChart.setDatasetVisibility(spyIdx, overlays.spy);
        }
        if (staticIdx !== -1) {
            performanceChart.setDatasetVisibility(staticIdx, overlays.static);
        }
        performanceChart.update('none');
    }
    
    // Underwater Chart
    if (underwaterChart) {
        const spyIdx = underwaterChart.data.datasets.findIndex(ds => ds.label?.includes('SPY'));
        const staticIdx = underwaterChart.data.datasets.findIndex(ds => ds.label?.includes('Static'));
        
        if (spyIdx !== -1) {
            underwaterChart.setDatasetVisibility(spyIdx, overlays.spy);
        }
        if (staticIdx !== -1) {
            underwaterChart.setDatasetVisibility(staticIdx, overlays.static);
        }
        underwaterChart.update('none');
    }
    
    // Info Bar 필드 표시/숨김
    updateInfoBars(overlays);
}
```

---

## 📋 Phase 4: Info Bar 동적 업데이트

### Task 4.1: Info Bar 조건부 필드 표시
**파일**: `js/charts.js`

```javascript
/**
 * 토글 상태에 따라 Info Bar 필드 표시/숨김
 */
function updateInfoBars(overlays) {
    // Main Chart Info Bar
    const mainInfoBar = document.getElementById('main-chart-info');
    if (mainInfoBar) {
        // SPY 필드
        const spyField = mainInfoBar.querySelector('[data-field="spy"]');
        if (spyField) {
            spyField.style.display = overlays.spy ? '' : 'none';
        }
        
        // Static 필드 (새로 추가 필요)
        const staticField = mainInfoBar.querySelector('[data-field="static"]');
        if (staticField) {
            staticField.style.display = overlays.static ? '' : 'none';
        }
    }
    
    // Underwater Chart Info Bar
    const uwInfoBar = document.getElementById('underwater-chart-info');
    if (uwInfoBar) {
        const spyDdField = uwInfoBar.querySelector('[data-field="spy-dd"]');
        if (spyDdField) {
            spyDdField.style.display = overlays.spy ? '' : 'none';
        }
        
        const staticDdField = uwInfoBar.querySelector('[data-field="static-dd"]');
        if (staticDdField) {
            staticDdField.style.display = overlays.static ? '' : 'none';
        }
    }
}
```

### Task 4.2: HTML에 data-field 속성 추가
**파일**: `index.html`

```html
<!-- Main Chart Info Bar -->
<div class="chart-info-bar" id="main-chart-info">
    <span class="info-date">--</span>
    <span class="info-item" data-field="aum">
        <span class="info-label">AUM</span>
        <span class="info-value" id="info-aum">--</span>
    </span>
    <span class="info-item" data-field="ma60">
        <span class="info-label">60MA</span>
        <span class="info-value" id="info-ma">--</span>
    </span>
    <span class="info-item" data-field="spy">
        <span class="info-label">SPY</span>
        <span class="info-value" id="info-spy">--</span>
    </span>
    <span class="info-item" data-field="static">
        <span class="info-label">Static</span>
        <span class="info-value" id="info-static">--</span>
    </span>
    <span class="info-item" data-field="alpha">
        <span class="info-label">Alpha</span>
        <span class="info-value" id="info-alpha">--</span>
    </span>
    <span class="info-item" data-field="daily">
        <span class="info-label">Daily</span>
        <span class="info-value" id="info-daily">--</span>
    </span>
</div>
```

---

## 📋 Phase 5: Execution Alpha 상시 표시

### Task 5.1: Static ON 시 Execution Alpha 자동 계산
**파일**: `js/charts.js`

```javascript
/**
 * Static 토글 ON 시 Execution Alpha 배지 업데이트
 */
function updateExecutionAlphaBadge(chartData) {
    const badge = document.getElementById('execution-alpha-badge');
    if (!badge) return;
    
    // Static 토글 OFF면 숨김
    if (!ChartState.overlays.static) {
        badge.classList.add('hidden');
        return;
    }
    
    // Execution Alpha 계산 (Finance.js 활용)
    const alphaData = Finance.calculateExecutionAlpha(
        { dates: chartData.labels, values: chartData.static },
        { dates: chartData.labels, values: chartData.portfolio }
    );
    
    if (alphaData) {
        const alphaValue = document.getElementById('alpha-value');
        if (alphaValue) {
            alphaValue.textContent = alphaData.alpha.toFixed(2);
        }
        badge.classList.remove('hidden');
        badge.classList.toggle('positive', alphaData.alpha > 0);
        badge.classList.toggle('negative', alphaData.alpha < 0);
    }
}
```

---

## 📋 Phase 6: 이벤트 리스너 연결

### Task 6.1: 토글 이벤트 바인딩
**파일**: `js/app.js`

```javascript
function setupChartToggleListeners() {
    // 시계열 모드 라디오 버튼
    document.querySelectorAll('input[name="timeline-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            handleTimelineModeChange(e.target.value);
        });
    });
    
    // SPY 오버레이 토글
    const spyToggle = document.getElementById('cv-spy-toggle');
    if (spyToggle) {
        spyToggle.addEventListener('change', (e) => {
            handleOverlayToggle('spy', e.target.checked);
        });
    }
    
    // Static 오버레이 토글
    const staticToggle = document.getElementById('cv-static-toggle');
    if (staticToggle) {
        staticToggle.addEventListener('change', (e) => {
            handleOverlayToggle('static', e.target.checked);
        });
    }
    
    // Projection 목표 금액 입력
    const targetInput = document.getElementById('cv-target-input');
    if (targetInput) {
        targetInput.addEventListener('input', debounce((e) => {
            const value = parseFloat(e.target.value.replace(/,/g, ''));
            if (value > 0) {
                ChartState.projectionTarget = value;
                if (ChartState.timelineMode === 'projection') {
                    renderCharts();
                }
            }
        }, 500));
    }
}

// 앱 초기화 시 호출
function initApp() {
    // ... 기존 코드 ...
    
    // 차트 상태 로드
    ChartState.load();
    
    // 토글 UI 상태 복원
    restoreToggleUIState();
    
    // 이벤트 리스너 설정
    setupChartToggleListeners();
}

/**
 * 저장된 상태에 맞게 UI 복원
 */
function restoreToggleUIState() {
    // 시계열 모드
    const modeRadio = document.querySelector(`input[name="timeline-mode"][value="${ChartState.timelineMode}"]`);
    if (modeRadio) modeRadio.checked = true;
    
    // 오버레이
    const spyToggle = document.getElementById('cv-spy-toggle');
    if (spyToggle) spyToggle.checked = ChartState.overlays.spy;
    
    const staticToggle = document.getElementById('cv-static-toggle');
    if (staticToggle) staticToggle.checked = ChartState.overlays.static;
    
    // 목표 금액
    const targetInput = document.getElementById('cv-target-input');
    if (targetInput && ChartState.projectionTarget) {
        targetInput.value = ChartState.projectionTarget.toLocaleString();
    }
}
```

---

## 📋 Phase 7: 기존 함수 정리

### Task 7.1: Deprecated 함수 처리
**파일**: `js/charts.js`

다음 함수들은 `renderCharts()`로 통합되므로 deprecated 처리:

```javascript
// DEPRECATED: renderCharts()로 대체됨
// function updatePerformanceChartWithHypothetical() { ... }
// function updatePerformanceChartCompareSlope() { ... }
// function updatePerformanceChartProjection() { ... }

// 호환성을 위한 래퍼 (추후 제거)
function updatePerformanceChartWithHypothetical(hypothetical, ghostBenchmark, actualData) {
    console.warn('DEPRECATED: Use handleTimelineModeChange("hypothetical") instead');
    handleTimelineModeChange('hypothetical');
}
```

---

## 📋 구현 순서 체크리스트

### Phase 1: 상태 관리 ⏱️ 예상 30분
- [ ] ChartState 객체 생성
- [ ] localStorage 저장/로드 함수
- [ ] getDateRange() 헬퍼 함수

### Phase 2: HTML/CSS UI ⏱️ 예상 20분
- [ ] 토글 그룹 HTML 재구성
- [ ] CSS 스타일 추가
- [ ] data-field 속성 추가

### Phase 3: 차트 렌더링 ⏱️ 예상 60분
- [ ] renderCharts() 통합 함수
- [ ] prepareChartData() 데이터 준비
- [ ] buildDatasets() 동적 데이터셋
- [ ] updateChartOverlays() 효율적 업데이트

### Phase 4: Info Bar ⏱️ 예상 20분
- [ ] updateInfoBars() 조건부 표시
- [ ] HTML 필드 추가

### Phase 5: Execution Alpha ⏱️ 예상 15분
- [ ] updateExecutionAlphaBadge() 상시 표시

### Phase 6: 이벤트 리스너 ⏱️ 예상 20분
- [ ] setupChartToggleListeners() 바인딩
- [ ] restoreToggleUIState() UI 복원

### Phase 7: 정리 ⏱️ 예상 15분
- [ ] 기존 함수 deprecated 처리
- [ ] 테스트 및 버그 수정

---

## ⚠️ 주의사항

1. **모드 변경 시에만 차트 재생성**: `timelineMode` 변경 시에만 `destroy → rebuild`
2. **오버레이 변경은 visibility만**: SPY/Static 토글은 `setDatasetVisibility()` 사용
3. **캐시 활용**: Hypothetical 데이터는 한 번 로드 후 캐시
4. **Projection + Hypothetical 조합 불가**: 상호 배타적 유지
5. **Underwater 차트 동기화**: Main 차트와 동일한 상태로 연동

---

## 📊 예상 총 소요시간: 약 3시간

// turbo-all
