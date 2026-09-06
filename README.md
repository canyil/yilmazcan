# Base Wallet Tracker 🔵

A read-only Base wallet intelligence dashboard for public EVM addresses.

![Base](https://img.shields.io/badge/Network-Base-0052FF)
![Mode](https://img.shields.io/badge/Mode-Read--Only-success)
![Version](https://img.shields.io/badge/MVP-v0.3-0052FF)
![License](https://img.shields.io/badge/License-MIT-blue)

## Overview

Base Wallet Tracker helps inspect and monitor public wallet activity on Base without connecting a wallet or requesting signatures. Enter any public EVM address to inspect balances, token holdings, recent transactions and heuristic trade signals.

## Current Features

- Public Base wallet lookup
- ETH balance overview
- ERC-20 token holdings
- Estimated current token value when Blockscout exposes a price
- Transaction-level token-flow grouping
- Heuristic BUY detection
- Heuristic SELL detection
- Transfer-in / transfer-out fallback classification
- USDC, USDbC and WETH quote-asset matching
- Native ETH spend detection for likely buys
- Estimated quote amount paid / received
- Current market-cap metadata when available
- Estimated current position value
- Approximate value delta for quote-priced buys
- Direct transaction and token links
- Local browser watchlist
- Responsive dashboard UI
- No wallet connection required

## BUY / SELL Classification

Version 0.3 groups ERC-20 transfers by transaction hash and compares the tracked wallet's asset flows.

A transaction is classified as a likely **BUY** when the wallet receives a non-quote ERC-20 token while sending USDC, USDbC or WETH in the same transaction. Native ETH sent by the tracked wallet can also be used as a buy signal when a token is received in that transaction.

A transaction is classified as a likely **SELL** when the wallet sends a non-quote ERC-20 token and receives a supported quote token in the same transaction.

Transactions that do not satisfy those patterns remain **TRANSFER IN** or **TRANSFER OUT**.

These classifications are intentionally described as heuristic. Routers, aggregators, internal transfers, multi-hop swaps, fee-on-transfer tokens and complex smart-contract calls can produce edge cases. Important trades should always be verified from the linked transaction.

## Value Estimates

For supported quote tokens, the dashboard displays the amount paid or received. Stablecoin quotes use a $1 reference, while WETH-based estimates depend on the current exchange-rate metadata exposed by the indexer.

The displayed value delta is an analytical estimate, not an accounting-grade historical P/L calculation. Exact historical entry pricing and realized/unrealized P/L remain roadmap items.

## Privacy & Security

This project is intentionally read-only. It does **not** require or request private keys, seed phrases, wallet signatures, token approvals or transaction permissions.

The watchlist is stored only in the user's browser with `localStorage`.

## Data Source

Public Base blockchain data is queried through Base Blockscout API v2, including address information, balances, transactions and address token transfers.

## Run Locally

Because the MVP is a static web application, no framework installation is required.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` in a browser.

## Project Structure

```text
.
├── index.html
├── src/
│   ├── main.js
│   └── style.css
├── LICENSE
├── .gitignore
└── README.md
```

## Roadmap

- [x] Public Base address analysis
- [x] ETH balance and token holdings
- [x] Recent transaction feed
- [x] Local wallet watchlist
- [x] Transaction-level asset-flow grouping
- [x] Heuristic BUY / SELL classification
- [x] Quote amount estimation for common Base quote assets
- [x] Current value and market-cap metadata when available
- [ ] DEX/router-specific decoding
- [ ] Historical entry price and entry market cap
- [ ] Liquidity and pool data
- [ ] Realized / unrealized wallet P/L
- [ ] New-token purchase alerts
- [ ] Telegram / Discord notifications
- [ ] Multi-wallet monitoring service
- [ ] Risk filters and suspicious-token warnings

## Long-Term Direction

The goal is to evolve this project into a Base-native wallet intelligence and monitoring dashboard that helps users understand what tracked wallets are doing onchain without exposing private wallet credentials.

## Disclaimer

Public onchain analytics can be incomplete or delayed depending on indexer availability. Market data may be unavailable for newly created or illiquid assets. BUY/SELL labels and value estimates are heuristic and may be wrong in complex transactions. This project is for educational and analytical use and is not financial advice.

---

Maintained by [@canyil](https://github.com/canyil).
