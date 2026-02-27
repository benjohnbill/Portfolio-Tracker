# Jingeun Index Fund Strategy Definition

---
created: 2026-01-27
tags: [ #Investment/Portfolio, #SystemTrading/Algorithm, #MacroEconomics/AssetAllocation ]
aliases: [ Jingeun Index Fund V2, Global Macro Multi-Strategy ]
status: Finished
---

# [[Jingeun Index Fund Strategy Definition]]

## 1. Executive Summary
* **User Context:** 20대 대학생 시스템 트레이더. 장기 자산 증식(CAGR)과 반취약성([[Antifragility]])을 동시에 추구. 기존의 정적 자산 배분을 넘어선 동적 대응 전략(Dynamic Asset Allocation)을 수립 중.
* **Core Intent:** [[QQQ]], [[DBMF]], [[MSTR]] 등을 포함한 포트폴리오의 논리적 정합성 검증. 특히 [[Fiscal Dominance]](재정 우위) 및 중국 리스크([[CSI 300]]) 시나리오 하에서 [[TLT]](미국 장기채)의 유효성을 재평가하고, 시스템적 매매 원칙([[250MA]], [[Z-Score]])을 확정하기 위함.

## 2. Key Intelligence
* **Critical Insights:**
	2.1. Strategic Identity: Algorithmic Global Macro Multi-Strategy
	
	본 포트폴리오는 단순한 자산 배분([[Asset Allocation]]) 모델이 아니다. 개인 투자자가 구현 가능한 4가지 헤지펀드 전략을 통합한 [[Algorithmic Global Macro Multi-Strategy]] 시스템으로 정의된다.

	Equity Long/Short Desk ([[ISA]]): [QLD]와 [QQQ]를 오가는 시변 레버리지(Time-Varying Leverage) 전략. 상승장에서는 베타(Beta)를 1.6배 이상으로 확장하고, 하락장([[250MA]] 이탈)에서는 1.0배로 축소하여 레버리지 ETF의 치명적 약점인 '변동성 잠식(Volatility Drag)'을 구조적으로 차단한다.

	Crypto Quant Desk (Direct): [[MSTR]]을 단순 보유하지 않고, [[MVRV Z-Score]] 온체인 데이터를 기반으로 한 **순환적 매매(Cyclical Trading)**를 수행한다. 이는 [[Trend Following]]보다 선행하는 펀더멘털 지표를 활용하여 '공포 매수(Z<0)'와 '탐욕 매도(Z>3.5)'를 기계적으로 실행한다.

	Crisis Alpha Desk (Direct): [[DBMF]]를 통해 시장의 비이성적 추세를 수익화하고, [[TLT]]/[[GLDM]]에 [[250MA]] 필터를 적용하여 하락 추세를 회피한다.

	Carry Trade Desk (Tax-Free): [[BRL]](브라질 국채)을 통해 연 14% 수준의 고정 현금 흐름(Cash Flow)을 확보, 시스템 전체의 유동성 연료(Liquidity Fuel) 역할을 담당한다.

	2.2. Architectural Edge: Core vs. Satellite Paradox
	
	포트폴리오의 강력함은 'Core(고정)'와 'Satellite(가변)'라는 상반된 두 원칙의 변증법적 결합에서 나온다.

	The "No Exit" Core ([[QQQ]], [[DBMF]]):
	
	Role: 변동성 수용(Volatility Acceptance). [[QQQ]]의 -50% 하락을 온몸으로 받아낸다.

	Mechanism: Core에 Exit이 없어야만, Satellite가 대피시킨 현금을 사용하여 폭락한 우량 자산을 헐값에 매수하는 **리밸런싱(Rebalancing)**이 성립한다. 즉, Core는 현금을 빨아들이는 **'저점 매수(Buy Low)의 그릇'**이다.

	Synergy: [QQQ]와 [[DBMF]](위기 방어)의 결합은 전형적인 **스마일 커브(Smile Curve)**를 그리며, 어떤 극단적 상황에서도 Core 전체의 붕괴를 막는다.

	The "Systematic Exit" Satellite ([[TLT]], [[MSTR]], [[GLDM]]):

	Role: 생존(Survival). 추세가 꺾이면 즉시 전장에서 이탈한다.

	Mechanism: [[250MA]] 하향 돌파 시 전량 매도하여 [[BIL]] 또는 **[[BOXX]]**로 전환한다. 이는 하락장에서 계좌의 MDD를 방어함과 동시에, Core 자산을 매수할 수 있는 **구매력(Buying Power/Dry Powder)**을 보존하는 기능을 한다.

	2.3. Risk Management Regime: Fiscal Dominance & Correlation
	
	기존의 '주식-채권 60/40' 논리를 폐기하고, [[Fiscal Dominance]](재정 우위) 시대에 맞는 새로운 상관관계 대응책을 수립했다.

	The TLT Pivot: 과거와 달리 '인플레이션/재정 적자' 위기 시 주식과 채권이 동반 하락(상관계수 +1)할 위험을 식별했다. 따라서 [[TLT]]를 무조건적 안전자산으로 보유하지 않고, **[[250MA]]**를 적용하여 '가격이 증명할 때만' 보유한다. 추세 이탈 시에는 채권이 아닌 **'현금([[Cash]])'**으로 도피하여 자산 상관관계를 '0'으로 만든다.

	Via Negativa (CSI 300): 중국 주식([[CSI 300]])은 밸류에이션 매력에도 불구하고, '공산당 리스크'와 '부채 위기'라는 구조적 취약점(Fragility)으로 인해 시스템에서 영구 배제한다. 이는 **"망할 확률이 있는 게임에는 참여하지 않는다"**는 [[Nassim Taleb]]의 원칙을 따른다.

	2.4. Mathematical Advantage: Tax Alpha & Compounding
	
	단순 수익률을 넘어, **세후 복리 수익률(CAGR)**을 극대화하기 위한 구조적 장치를 마련했다.

	Tax Efficiency: [[QQQ]]/[[TLT]]/[[QLD]]를 [[ISA]] 및 비과세 계좌에 배치함으로써, 리밸런싱 과정에서 발생하는 매매차익에 대한 세금(15.4%~22%)을 이연 및 면제받는다. 이는 장기적으로 연 1~2%p 이상의 Tax Alpha를 창출한다.

	Shannon's Demon: 변동성이 큰 자산([[MSTR]], [[QLD]])과 안정적 자산([[DBMF]], 현금) 간의 30% 상대 밴드 리밸런싱은, 자산 가격이 제자리로 돌아오더라도 수량을 늘려 수익을 창출하는 '변동성 수확(Volatility Harvesting)' 효과를 극대화한다.

	2.5. The "Calculated Gamble": BRL Strategy
	
	[[BRL]](브라질 국채) 10% 할당은 이 시스템의 유일한 '논리적 예외'이자 '전략적 베팅'이다.

	Rationale: 환율 리스크(FX Risk)가 존재하지만, 연 14%의 이자 수익(Carry)이 환차손을 상회할 것이라는 확률적 우위에 베팅한다.

	Function: 시세 차익을 포기하는 대신, 매 반기마다 확정적으로 들어오는 막대한 현금 흐름이 하락장에서는 저가 매수의 총알이 되고, 횡보장에서는 계좌를 지탱하는 **기초체력(Base Income)**이 된다. 이는 시스템이 외부 자금 수혈 없이 스스로 작동하게 만드는 **영구 기관(Perpetual Motion Machine)**의 연료다.

* **Decision Points:**
	* **Asset Allocation:** [[QQQ]](30, [[QLD]] 스위칭), [[DBMF]](30), [[MSTR]](10, [[Z-Score]]), [[GLDM]](10), [[BRL]](10, Hold), [[TLT]](10, [[250MA]]).
	* **Account Strategy:** [[QQQ]]/[[TLT]]/[[QLD]]는 [[ISA]]/비과세 계좌 활용, [[MSTR]]/[[GLDM]]은 직투.
	* **Execution Rule:** 주 1회(금요일) 확인. [[250MA]] 이탈 시 즉시 현금화([[BIL]]/[[BOXX]]). 리밸런싱 밴드 30%.

## 3. Actionable Next Steps
* [ ] **MSTR Monitoring:** [[MVRV Z-Score]] 지표 세팅 (0 미만 진입, 3.5 초과 청산).
* [ ] **Leverage Logic:** [[ISA]] 계좌 내 [[QLD]] 대체 상품(국내 상장 나스닥 2배) 선정 및 [[250MA]] 이탈 시 1배([[QQQ]]) 전환 로직 구현.
* [ ] **Cash Management:** Satellite 자산 이탈 시 [[BIL]] 또는 [[BOXX]] 매수 프로세스 확립.
* [ ] **Weekly Routine:** 매주 금요일 종가 기준 Satellite 자산 추세 이탈 여부 점검.

## 4. Unresolved & Connections
* **Open Questions:** [[BRL]](브라질 국채)의 환리스크(헤알화 폭락)가 이자 수익(14%)을 상회할 경우의 장기적 대처 방안(현재는 믿음의 영역으로 남겨둠).
* **Potential Links:** [[Nassim Taleb]], [[Ray Dalio]], [[Shannon's Demon]], [[Modern Portfolio Theory]], [[Occam's Razor]].

## 5. Raw Prompts (High Value Only)
> "QQQ와 DBMF를 제외하곤, 모든 자산들이 250MA이하로 떨어지면, 같은 포지션의 자산이나, 현금으로 도피하도록 설계가 되어있어. 그리고 휩소를 막기 위해, 금요일만 매매하는 원칙, 배당금 및 이자는 포트의 비율을 조정하는 방식으로 사용. 이를 고려하면, 포트폴리오의 성격은 어떻게 바뀔까?"

> "사실, 남들 눈치를 안 보는 편이라, 시스템 트레이딩이 취향인 것 같아. 그렇다면, 지금까지의 논의를 기반으로 할 때, 내 포트폴리오는 시스템 트레이딩을 가미한 올웨더 포트폴리오인가? 너가 보기엔 어때? 사실, 레이 달리오의 그것과는 많이 다르고, 나심 탈레브의 바벨 모형과는 완전히 다르잖아?"

---
Created: 2026-01-27 14:24

### AI Keywords
[[Antifragility]] [[Algorithmic Global Macro Multi-Strategy]] [[Fiscal Dominance]] [[Shannon's Demon]] [[Volatility Harvesting]] [[MVRV Z-Score]] [[Smile Curve Strategy]]