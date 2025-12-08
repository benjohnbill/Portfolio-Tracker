# How to Run the Portfolio Tracker Server

To enable real-time 1-year historical data fetching and advanced calculations, you need to run the accompanying Python server.

## 1. Prerequisites
-   Ensure you have **Python** installed.
-   Open a terminal/command prompt.

## 2. Install Dependencies
Run the following command to install the required libraries (Flask, FinanceDataReader, yfinance, etc.):
```bash
pip install -r requirements.txt
```

## 3. Start the Server
Double-click `run_server.bat` OR run:
```bash
python server.py
```
The server will start on `http://localhost:8000`.

## 4. Launch the App
Open `index.html` in your browser. The application will automatically try to connect to the local server to fetch data.
-   If the server is **Reference**, the app will use **Real Data** (1-Year History).
-   If the server is **OFF**, the app will gracefully fallback to **Mock Data**.

## Features Restored
-   **Asset Allocation**: Based on real prices.
-   **Technical Indicators**: 50MA, 250MA, RSI calculated from 1-year real history.
-   **Risk Metrics**: Beta, Sharpe, CAGR calculated from real historical variance.
