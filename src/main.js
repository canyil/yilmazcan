const API = 'https://base.blockscout.com/api/v2';

const $ = (id) => document.getElementById(id);
const walletInput = $('wallet');
const analyzeBtn = $('analyze');
const saveBtn = $('save');
const message = $('message');

const isAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value.trim());
const short = (value, left = 6, right = 4) => `${value.slice(0, left)}…${value.slice(-right)}`;
const formatNumber = (value, max = 6) => new Intl.NumberFormat('en-US', { maximumFractionDigits: max }).format(value);

function setMessage(text, tone = '') {
  message.textContent = text;
  message.dataset.tone = tone;
}

async function api(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error(`Blockscout request failed (${response.status})`);
  return response.json();
}

function tokenBalance(item) {
  const raw = BigInt(item.value || '0');
  const decimals = Number(item.token?.decimals || 0);
  if (!decimals) return raw.toString();
  const divisor = 10 ** Math.min(decimals, 18);
  const safe = Number(raw / BigInt(10 ** Math.max(decimals - Math.min(decimals, 18), 0))) / divisor;
  return Number.isFinite(safe) ? formatNumber(safe, 6) : raw.toString();
}

function renderTokens(items = []) {
  const body = $('tokensBody');
  body.innerHTML = '';
  const sorted = [...items].sort((a, b) => Number(b.token?.exchange_rate || 0) - Number(a.token?.exchange_rate || 0));

  for (const item of sorted.slice(0, 50)) {
    const token = item.token || {};
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${token.name || 'Unknown token'}</td>
      <td>${token.symbol || '—'}</td>
      <td>${tokenBalance(item)}</td>
      <td><a target="_blank" rel="noopener noreferrer" href="https://base.blockscout.com/token/${token.address}">${token.address ? short(token.address) : '—'}</a></td>
    `;
    body.appendChild(row);
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
    const [account, tokens, txs] = await Promise.all([
      api(`/addresses/${address}`),
      api(`/addresses/${address}/token-balances`),
      api(`/addresses/${address}/transactions`),
    ]);

    const txItems = txs.items || [];
    const tokenItems = Array.isArray(tokens) ? tokens : tokens.items || [];
    const wei = BigInt(account.coin_balance || '0');
    const eth = Number(wei) / 1e18;

    $('summaryAddress').textContent = short(address, 8, 6);
    $('ethBalance').textContent = `${formatNumber(eth, 6)} ETH`;
    $('tokenCount').textContent = tokenItems.length.toString();
    $('txCount').textContent = txItems.length.toString();
    $('summary').classList.remove('hidden');
    $('tokensSection').classList.remove('hidden');
    $('transactionsSection').classList.remove('hidden');

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
  if (!list.includes(address)) list.unshift(address);
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
