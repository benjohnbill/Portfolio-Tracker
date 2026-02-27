"""
2024년 11월 30일 기준 리밸런싱 계산 스크립트
"""
import datetime
import yfinance as yf
import FinanceDataReader as fdr
import pandas as pd

# 자산 매핑 정보
ASSET_MAP = {
    'QQQ':    {'symbol': '379810', 'source': 'KR', 'name': 'KODEX Nasdaq100 TR'},
    'CSI300': {'symbol': '463300', 'source': 'KR', 'name': 'RISE China CSI300'},
    'TLT':    {'symbol': '476760', 'source': 'KR', 'name': 'ACE US 30Y Treasury Active'},
    'DBMF':   {'symbol': 'DBMF', 'source': 'US', 'name': 'iMGP DBi Managed Futures'},
    'GLDM':   {'symbol': 'GLDM', 'source': 'US', 'name': 'SPDR Gold MiniShares'},
    'MSTR':   {'symbol': 'MSTR', 'source': 'US', 'name': 'MicroStrategy'},
}

# 현재 보유 Shares
current_shares = {
    'QQQ': 217,
    'DBMF': 117,
    'CSI300': 137,
    'TLT': 178,
    'GLDM': 15,
    'MSTR': 6.963358
}

# 목표 비중 (제시된 값)
target_weights = {
    'QQQ': 0.2914,
    'DBMF': 0.30,
    'CSI300': 0.0917,
    'MSTR': 0.1461,
    'GLDM': 0.0893,
    'TLT': 0.0940,
}

# 날짜 설정
start_date = '2024-11-20'
end_date = '2024-12-05'
FX_RATE = 1410

prices = {}

print('=' * 60)
print('2024년 11월 말 가격 데이터 수집')
print('=' * 60)

for ticker, info in ASSET_MAP.items():
    try:
        if info['source'] == 'KR':
            df = fdr.DataReader(info['symbol'], start_date, end_date)
        else:
            df = yf.download(info['symbol'], start=start_date, end=end_date, progress=False, auto_adjust=True)
        
        if df.empty:
            print(f'{ticker}: 데이터 없음')
            continue
            
        # 11월 29일(금) 또는 가장 가까운 거래일
        df = df[df.index <= '2024-11-29']
        if df.empty:
            print(f'{ticker}: 11/29 이전 데이터 없음')
            continue
            
        close_price = df['Close'].iloc[-1]
        trade_date = df.index[-1].strftime('%Y-%m-%d')
        
        if hasattr(close_price, 'item'):
            close_price = close_price.item()
        close_price = float(close_price)
        
        if info['source'] == 'US':
            price_krw = close_price * FX_RATE
            prices[ticker] = {'usd': close_price, 'krw': price_krw, 'date': trade_date}
            print(f'{ticker}: ${close_price:.2f} (KRW {price_krw:,.0f}) @ {trade_date}')
        else:
            prices[ticker] = {'krw': close_price, 'date': trade_date}
            print(f'{ticker}: KRW {close_price:,.0f} @ {trade_date}')
    except Exception as e:
        print(f'{ticker}: 오류 - {e}')

print()
print('=' * 60)
print('현재 포트폴리오 가치 계산')
print('=' * 60)

total_value = 0
values = {}
for ticker, shares in current_shares.items():
    if ticker in prices:
        value = shares * prices[ticker]['krw']
        values[ticker] = value
        total_value += value
        price_str = f"KRW {prices[ticker]['krw']:,.0f}"
        print(f'{ticker}: {shares} shares x {price_str} = KRW {value:,.0f}')

print(f'\n총 AUM: KRW {total_value:,.0f}')

print()
print('=' * 60)
print('현재 비중 vs 목표 비중')
print('=' * 60)

current_weights = {}
for ticker in current_shares:
    if ticker in values:
        weight = values[ticker] / total_value
        current_weights[ticker] = weight
        target = target_weights.get(ticker, 0)
        diff = (weight - target) * 100
        sign = '+' if diff >= 0 else ''
        print(f'{ticker}: 현재 {weight*100:.2f}% / 목표 {target*100:.2f}% ({sign}{diff:.2f}%p)')

print()
print('=' * 60)
print('리밸런싱 계산 (목표 비중 기준)')
print('=' * 60)

rebalance_actions = []
for ticker, target_weight in target_weights.items():
    if ticker in prices:
        target_value = total_value * target_weight
        target_shares = target_value / prices[ticker]['krw']
        current = current_shares.get(ticker, 0)
        diff = target_shares - current
        sign = '+' if diff >= 0 else ''
        action = '매수' if diff > 0.01 else '매도' if diff < -0.01 else '유지'
        
        rebalance_actions.append({
            'ticker': ticker,
            'target_shares': target_shares,
            'current_shares': current,
            'diff': diff,
            'action': action
        })
        
        print(f'{ticker}: 목표 {target_shares:.4f}주 / 현재 {current:.4f}주 -> {sign}{diff:.4f}주 ({action})')

print()
print('=' * 60)
print('리밸런싱 요약')
print('=' * 60)

buy_list = [a for a in rebalance_actions if a['action'] == '매수']
sell_list = [a for a in rebalance_actions if a['action'] == '매도']

if sell_list:
    print('\n[매도]')
    for item in sell_list:
        ticker = item['ticker']
        diff = abs(item['diff'])
        value = diff * prices[ticker]['krw']
        print(f"  {ticker}: {diff:.4f}주 (약 KRW {value:,.0f})")

if buy_list:
    print('\n[매수]')
    for item in buy_list:
        ticker = item['ticker']
        diff = item['diff']
        value = diff * prices[ticker]['krw']
        print(f"  {ticker}: {diff:.4f}주 (약 KRW {value:,.0f})")
