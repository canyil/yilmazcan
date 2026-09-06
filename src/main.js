const API = 'https://base.blockscout.com/api/v2';

const $ = (id) => document.getElementById(id);
const walletInput = $('wallet');
const analyzeBtn = $('analyze');
const saveBtn = $('save');
const message = $('message');

const isAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value.trim());
const short = (value, left = 6, right = 4) => `${value.slice(0, left)}…${value.slice(-right)}`;
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
    const fraction = text.slice(-d).replace(/0+$/, '').slice(0, 8);
    return Number(`${whole}.${fraction || '0'}`);
  } catch {
    return Number(rawValue || 0);
  }
}

function tokenBalance(item) {
  return decimalAmount(item.value, item.token?.decimals);
}

function renderTokens(items = []) {
  const body = $('tokensBody');
  body.innerHTML = '';
  const sorted = [...items].sort((a, b) => {
    const aValue = tokenBalance(a) * Number(a.token?.exchange_rate || 0);
    const bValue = tokenBalance(b) * Number(b.token?.exchange_rate || 0);
    return bValue - aValue;
  });

  for (const item of sorted.slice(0, 50)) {
    const token = item.token || {};
    const balance = tokenBalance(item);
    const rate = Number(token.exchange_rate || 0);
    const value = balance * rate;
    const address = token.address || token.address_hash || '';
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

function transferAmount(item) {
  const decimals = item.total?.decimals ?? item.token?.decimals ?? 0;
  return decimalAmount(item.total?.value || '0', decimals);
}

function renderAcquisitions(items = [], address) {
  const root = $('acquisitions');
  const normalized = address.toLowerCase();
  const incoming = items.filter((item) => {
    const to = item.to?.hash?.toLowerCase();
    return to === normalized && item.token?.type === 'ERC-20';
  });

  $('acquisitionCount').textContent = incoming.length.toString();
  root.innerHTML = '';

  if (!incoming.length) {
    root.innerHTML = '<div class="empty">No recent incoming ERC-20 transfers returned.</div>';
    return;
  }

  for (const item of incoming.slice(0, 25)) {
    const token = item.token || {};
    const amount = transferAmount(item);
    const rate = Number(token.exchange_rate || 0);
    const currentValue = amount * rate;
    const marketCap = Number(token.circulating_market_cap || 0);
    const tokenAddress = token.address || token.address_hash || '';
    const txHash = item.transaction_hash || '';
    const source = item.from?.hash || '';

    const card = document.createElement('article');
    card.className = 'acquisition-card';
    card.innerHTML = `
      <div class="acq-main">
        <div>
          <span class="pill in">IN</span>
          <strong>${token.symbol || token.name || 'Token'}</strong>
          <span class="muted">${token.name || ''}</span>
        </div>
        <span class="acq-time">${item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}</span>
      </div>
      <div class="acq-grid">
        <div><span>Amount</span><strong>${formatNumber(amount, 6)}</strong></div>
        <div><span>Current est. value</span><strong>${rate ? formatUsd(currentValue) : '—'}</strong></div>
        <div><span>Current market cap</span><strong>${marketCap ? formatCompactUsd(marketCap) : '—'}</strong></div>
        <div><span>Source</span><strong>${source ? short(source, 7, 5) : '—'}</strong></div>
      </div>
      <div class="acq-links">
        ${txHash ? `<a target="_blank" rel="noopener noreferrer" href="https://base.blockscout.com/tx/${txHash}">Transaction ↗</a>` : ''}
        ${tokenAddress ? `<a target="_blank" rel="noopener noreferrer" href="https://base.blockscout.com/token/${tokenAddress}">Token ↗</a>` : ''}
      </div>
    `;
    root.appendChild(card);
  }
}

function renderTransactions(items = [], address) {
  const root = $('transactions');
  root.innerHTML = '';

  if (!items.length) {
    root.innerHTML = '<div class="empty">No recent transactions returned.</div>';
    return;
  }

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
      <div class="tx-meta"><span>From ${from ? short(from) : '—'}</span><span>To ${to ? short(to) : 'Contract creation'}</span></div>
    `;
    root.appendChild(card);
  }
}

async function analyze(address = walletInput.value.trim()) {
  if (!isAddress(address)) {
    setMessage('Enter a valid 0x wallet address.', 'error');
    return;
  }

  walletInput.value = address;
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Loading…';
  setMessage('Reading public Base data…');

  try {
    const [account, tokens, txs, transfers] = await Promise.all([
      api(`/addresses/${address}`),
      api(`/addresses/${address}/token-balances`),
      api(`/addresses/${address}/transactions`),
      api(`/addresses/${address}/token-transfers?type=ERC-20&filter=to`),
    ]);

    const txItems = txs.items || [];
    const tokenItems = Array.isArray(tokens) ? tokens : tokens.items || [];
    const transferItems = transfers.items || [];
    const wei = BigInt(account.coin_balance || '0');
    const eth = Number(wei) / 1e18;

    $('summaryAddress').textContent = short(address, 8, 6);
    $('ethBalance').textContent = `${formatNumber(eth, 6)} ETH`;
    $('tokenCount').textContent = tokenItems.length.toString();
    $('summary').classList.remove('hidden');
    $('acquisitionsSection').classList.remove('hidden');
    $('tokensSection').classList.remove('hidden');
    $('transactionsSection').classList.remove('hidden');

    renderAcquisitions(transferItems, address);
    renderTokens(tokenItems);
    renderTransactions(txItems, address);
    setMessage('Wallet analyzed successfully.', 'success');
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

  if (!list.length) {
    root.textContent = 'No saved wallets yet.';
    return;
  }

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
walletInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') analyze();
});

renderWatchlist();
