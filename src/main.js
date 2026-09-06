const API = 'https://base.blockscout.com/api/v2';

const $ = (id) => document.getElementById(id);
const walletInput = $('wallet');
const analyzeBtn = $('analyze');
const saveBtn = $('save');
const message = $('message');

const QUOTE_TOKENS = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', stable: true },
  '0xd9aa3217726e01b0951e4c252c845fdd2f17b039': { symbol: 'USDbC', stable: true },
  '0x4200000000000000000000000000000000000006': { symbol: 'WETH', stable: false },
};

const $id = (id) => document.getElementById(id);
const isAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value.trim());
const short = (value, left = 6, right = 4) => value ? `${value.slice(0, left)}…${value.slice(-right)}` : '—';
const formatNumber = (value, max = 6) => new Intl.NumberFormat('en-US', { maximumFractionDigits: max }).format(value);
const formatUsd = (value) => Number.isFinite(value) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 4 : 2 }).format(value) : '—';
const formatCompactUsd = (value) => Number.isFinite(value) ? `$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)}` : '—';

function setMessage(text, tone = '') {
  message.textContent = text;
  message.dataset.tone = tone;
}

async function api(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error(`Blockscout request failed (${response.status})`);
  return response.json();
}

function decimalAmount(rawValue, decimals = 0) {
  try {
    const raw = BigInt(rawValue || '0');
    const d = Math.max(0, Number(decimals || 0));
    if (!d) return Number(raw);
    const text = raw.toString().padStart(d + 1, '0');
    const whole = text.slice(0, -d) || '0';
    const fraction = text.slice(-d).replace(/0+$/, '').slice(0, 10);
    return Number(`${whole}.${fraction || '0'}`);
  } catch {
    return Number(rawValue || 0);
  }
}

function tokenAddress(token = {}) {
  return (token.address || token.address_hash || '').toLowerCase();
}

function tokenBalance(item) {
  return decimalAmount(item.value, item.token?.decimals);
}

function transferAmount(item) {
  const decimals = item.total?.decimals ?? item.token?.decimals ?? 0;
  return decimalAmount(item.total?.value || '0', decimals);
}

function transferRate(item) {
  return Number(item.token?.exchange_rate || 0);
}

function quoteInfo(item) {
  return QUOTE_TOKENS[tokenAddress(item.token)] || null;
}

function isIncoming(item, address) {
  return (item.to?.hash || '').toLowerCase() === address.toLowerCase();
}

function isOutgoing(item, address) {
  return (item.from?.hash || '').toLowerCase() === address.toLowerCase();
}

function renderTokens(items = []) {
  const body = $('tokensBody');
  body.innerHTML = '';
  const sorted = [...items].sort((a, b) => tokenBalance(b) * Number(b.token?.exchange_rate || 0) - tokenBalance(a) * Number(a.token?.exchange_rate || 0));

  for (const item of sorted.slice(0, 50)) {
    const token = item.token || {};
    const balance = tokenBalance(item);
    const rate = Number(token.exchange_rate || 0);
    const value = balance * rate;
    const address = tokenAddress(token);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${token.name || 'Unknown token'}</td>
      <td>${token.symbol || '—'}</td>
      <td>${formatNumber(balance, 6)}</td>
      <td>${rate ? formatUsd(value) : '—'}</td>
      <td><a target="_blank" rel="noopener noreferrer" href="https://base.blockscout.com/token/${address}">${address ? short(address) : '—'}</a></td>
    `;
    body.appendChild(row);
  }
}

function groupTransfersByTx(items = []) {
  const groups = new Map();
  for (const item of items) {
    const hash = item.transaction_hash;
    if (!hash) continue;
    if (!groups.has(hash)) groups.set(hash, []);
    groups.get(hash).push(item);
  }
  return groups;
}

function buildTradeSignals(transfers = [], txs = [], address) {
  const normalized = address.toLowerCase();
  const txByHash = new Map(txs.map((tx) => [tx.hash, tx]));
  const groups = groupTransfersByTx(transfers);
  const signals = [];

  for (const [hash, group] of groups) {
    const incoming = group.filter((item) => isIncoming(item, normalized) && item.token?.type === 'ERC-20');
    const outgoing = group.filter((item) => isOutgoing(item, normalized) && item.token?.type === 'ERC-20');
    const incomingQuotes = incoming.filter(quoteInfo);
    const outgoingQuotes = outgoing.filter(quoteInfo);
    const incomingAssets = incoming.filter((item) => !quoteInfo(item));
    const outgoingAssets = outgoing.filter((item) => !quoteInfo(item));
    const tx = txByHash.get(hash);
    const nativeEthOut = tx && (tx.from?.hash || '').toLowerCase() === normalized ? Number(BigInt(tx.value || '0')) / 1e18 : 0;

    if (incomingAssets.length && (outgoingQuotes.length || nativeEthOut > 0)) {
      for (const asset of incomingAssets) signals.push(makeSignal('BUY', asset, outgoingQuotes, nativeEthOut, tx));
      continue;
    }

    if (outgoingAssets.length && incomingQuotes.length) {
      for (const asset of outgoingAssets) signals.push(makeSignal('SELL', asset, incomingQuotes, 0, tx));
      continue;
    }

    for (const asset of incomingAssets) signals.push(makeSignal('TRANSFER IN', asset, [], 0, tx));
    for (const asset of outgoingAssets) signals.push(makeSignal('TRANSFER OUT', asset, [], 0, tx));
  }

  return signals.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
}

function makeSignal(type, assetTransfer, quotes = [], nativeEth = 0, tx) {
  const token = assetTransfer.token || {};
  const amount = transferAmount(assetTransfer);
  const rate = transferRate(assetTransfer);
  const currentValue = amount * rate;
  const marketCap = Number(token.circulating_market_cap || 0);

  let paidLabel = '—';
  let paidUsd = null;
  if (quotes.length) {
    const q = quotes[0];
    const info = quoteInfo(q);
    const qAmount = transferAmount(q);
    const qRate = info?.stable ? 1 : transferRate(q);
    paidLabel = `${formatNumber(qAmount, 6)} ${q.token?.symbol || info?.symbol || 'QUOTE'}`;
    if (qRate) paidUsd = qAmount * qRate;
  } else if (nativeEth > 0) {
    paidLabel = `${formatNumber(nativeEth, 6)} ETH`;
  }

  let performance = null;
  if (type === 'BUY' && paidUsd && currentValue) performance = ((currentValue - paidUsd) / paidUsd) * 100;

  return {
    type,
    token,
    amount,
    currentValue,
    marketCap,
    paidLabel,
    paidUsd,
    performance,
    timestamp: assetTransfer.timestamp || tx?.timestamp,
    txHash: assetTransfer.transaction_hash || tx?.hash,
  };
}

function renderTradeSignals(signals = []) {
  const root = $('tradeSignals');
  root.innerHTML = '';
  const buys = signals.filter((signal) => signal.type === 'BUY').length;
  $('buyCount').textContent = buys.toString();

  if (!signals.length) {
    root.innerHTML = '<div class="empty">No recent trade signals could be classified.</div>';
    return;
  }

  for (const signal of signals.slice(0, 30)) {
    const token = signal.token || {};
    const address = tokenAddress(token);
    const tone = signal.type === 'BUY' ? 'buy' : signal.type === 'SELL' ? 'sell' : 'transfer';
    const performance = signal.performance == null ? '—' : `${signal.performance >= 0 ? '+' : ''}${formatNumber(signal.performance, 2)}%`;
    const card = document.createElement('article');
    card.className = `trade-card ${tone}`;
    card.innerHTML = `
      <div class="trade-head">
        <div><span class="trade-pill ${tone}">${signal.type}</span><strong>${token.symbol || token.name || 'Token'}</strong><span class="muted">${token.name || ''}</span></div>
        <span class="acq-time">${signal.timestamp ? new Date(signal.timestamp).toLocaleString() : '—'}</span>
      </div>
      <div class="trade-grid">
        <div><span>Token amount</span><strong>${formatNumber(signal.amount, 6)}</strong></div>
        <div><span>${signal.type === 'SELL' ? 'Received' : 'Paid / quote'}</span><strong>${signal.paidLabel}</strong></div>
        <div><span>Current est. value</span><strong>${signal.currentValue ? formatUsd(signal.currentValue) : '—'}</strong></div>
        <div><span>Current market cap</span><strong>${signal.marketCap ? formatCompactUsd(signal.marketCap) : '—'}</strong></div>
        <div><span>Est. value delta</span><strong class="${signal.performance != null && signal.performance >= 0 ? 'positive' : signal.performance != null ? 'negative' : ''}">${performance}</strong></div>
      </div>
      <div class="acq-links">
        ${signal.txHash ? `<a target="_blank" rel="noopener noreferrer" href="https://base.blockscout.com/tx/${signal.txHash}">Transaction ↗</a>` : ''}
        ${address ? `<a target="_blank" rel="noopener noreferrer" href="https://base.blockscout.com/token/${address}">Token ↗</a>` : ''}
      </div>
    `;
    root.appendChild(card);
  }
}

function renderTransactions(items = [], address) {
  const root = $('transactions');
  root.innerHTML = '';
  if (!items.length) return root.innerHTML = '<div class="empty">No recent transactions returned.</div>';

  const normalized = address.toLowerCase();
  for (const tx of items.slice(0, 20)) {
    const from = tx.from?.hash || '';
    const to = tx.to?.hash || '';
    const direction = from.toLowerCase() === normalized ? 'OUT' : 'IN';
    const card = document.createElement('a');
    card.className = 'tx-card';
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.href = `https://base.blockscout.com/tx/${tx.hash}`;
    card.innerHTML = `
      <div><span class="pill ${direction.toLowerCase()}">${direction}</span><strong>${tx.method || 'Transaction'}</strong></div>
      <div class="tx-meta"><span>${short(tx.hash)}</span><span>${tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '—'}</span></div>
      <div class="tx-meta"><span>From ${short(from)}</span><span>To ${to ? short(to) : 'Contract creation'}</span></div>
    `;
    root.appendChild(card);
  }
}

async function analyze(address = walletInput.value.trim()) {
  if (!isAddress(address)) return setMessage('Enter a valid 0x wallet address.', 'error');

  walletInput.value = address;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Loading…';
  setMessage('Reading public Base data and classifying swaps…');

  try {
    const [account, tokens, txs, transfers] = await Promise.all([
      api(`/addresses/${address}`),
      api(`/addresses/${address}/token-balances`),
      api(`/addresses/${address}/transactions`),
      api(`/addresses/${address}/token-transfers?type=ERC-20`),
    ]);

    const txItems = txs.items || [];
    const tokenItems = Array.isArray(tokens) ? tokens : tokens.items || [];
    const transferItems = transfers.items || [];
    const eth = Number(BigInt(account.coin_balance || '0')) / 1e18;
    const signals = buildTradeSignals(transferItems, txItems, address);

    $('summaryAddress').textContent = short(address, 8, 6);
    $('ethBalance').textContent = `${formatNumber(eth, 6)} ETH`;
    $('tokenCount').textContent = tokenItems.length.toString();
    $('summary').classList.remove('hidden');
    $('tradeSignalsSection').classList.remove('hidden');
    $('tokensSection').classList.remove('hidden');
    $('transactionsSection').classList.remove('hidden');

    renderTradeSignals(signals);
    renderTokens(tokenItems);
    renderTransactions(txItems, address);
    setMessage('Wallet analyzed. BUY/SELL labels are heuristic and should be verified onchain.', 'success');
  } catch (error) {
    console.error(error);
    setMessage('Could not load Base data. Check the address or try again.', 'error');
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze';
  }
}

function getWatchlist() {
  try { return JSON.parse(localStorage.getItem('base-wallet-watchlist') || '[]'); }
  catch { return []; }
}

function renderWatchlist() {
  const root = $('watchlist');
  const list = getWatchlist();
  root.innerHTML = '';
  root.classList.toggle('empty', !list.length);
  if (!list.length) return root.textContent = 'No saved wallets yet.';

  for (const address of list) {
    const row = document.createElement('div');
    row.className = 'watch-row';
    row.innerHTML = `<button class="watch-address" data-address="${address}">${short(address, 10, 8)}</button><button class="remove" data-remove="${address}" aria-label="Remove wallet">Remove</button>`;
    root.appendChild(row);
  }
}

function saveCurrent() {
  const address = walletInput.value.trim();
  if (!isAddress(address)) return setMessage('Enter a valid wallet before saving.', 'error');
  const list = getWatchlist();
  if (!list.some((item) => item.toLowerCase() === address.toLowerCase())) list.unshift(address);
  localStorage.setItem('base-wallet-watchlist', JSON.stringify(list.slice(0, 25)));
  renderWatchlist();
  setMessage('Saved to local watchlist.', 'success');
}

$('watchlist').addEventListener('click', (event) => {
  const address = event.target.dataset.address;
  const remove = event.target.dataset.remove;
  if (address) analyze(address);
  if (remove) {
    const list = getWatchlist().filter((item) => item !== remove);
    localStorage.setItem('base-wallet-watchlist', JSON.stringify(list));
    renderWatchlist();
  }
});

analyzeBtn.addEventListener('click', () => analyze());
saveBtn.addEventListener('click', saveCurrent);
walletInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') analyze(); });
renderWatchlist();
