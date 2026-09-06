# Base Wallet Tracker 🔵

A read-only Base wallet intelligence dashboard for public EVM addresses.

![Base](https://img.shields.io/badge/Network-Base-0052FF)
![Mode](https://img.shields.io/badge/Mode-Read--Only-success)
![Version](https://img.shields.io/badge/MVP-v0.2-0052FF)
![License](https://img.shields.io/badge/License-MIT-blue)

## Overview

Base Wallet Tracker helps inspect and monitor public wallet activity on Base without connecting a wallet or requesting signatures. Enter any public EVM address to view its Base ETH balance, token holdings, incoming ERC-20 activity and recent transactions.

## Current Features

- Public Base wallet lookup
- ETH balance overview
- ERC-20 token holdings
- Estimated current token value when Blockscout exposes a price
- Recent incoming ERC-20 acquisition candidates
- Current market-cap metadata when available
- Transfer source, timestamp, transaction and token links
- Recent Base transactions
- Incoming / outgoing transaction direction
- Local browser watchlist
- Responsive dashboard UI
- No wallet connection required

## Acquisition Classification

An incoming token transfer is **not automatically considered a buy**. It may be a DEX swap output, transfer, airdrop, claim, distribution or another type of onchain activity.

Version 0.2 therefore labels incoming ERC-20 transfers as acquisition candidates. Reliable BUY / SELL classification requires transaction-level swap analysis and asset-flow matching, which is planned for a later version.

## Privacy & Security

This project is intentionally read-only.

It does **not** require or request:

- private keys,
- seed phrases,
- wallet signatures,
- token approvals,
- transaction permissions.

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
- [x] Incoming ERC-20 acquisition feed
- [x] Current value and market-cap metadata when available
- [ ] DEX swap detection
- [ ] Reliable BUY / SELL classification
- [ ] Historical entry price estimation
- [ ] Liquidity data
- [ ] Wallet P/L estimates
- [ ] New-token purchase alerts
- [ ] Telegram / Discord notifications
- [ ] Multi-wallet background monitoring
- [ ] Risk filters and suspicious-token warnings

## Long-Term Direction

The goal is to evolve this project into a Base-native wallet intelligence and monitoring dashboard that can help users understand what tracked wallets are doing onchain without exposing private wallet credentials.

## Disclaimer

Public onchain analytics can be incomplete or delayed depending on indexer availability. Market data may be unavailable for newly created or illiquid assets. This project is for educational and analytical use and is not financial advice.

---

Maintained by [@canyil](https://github.com/canyil).
