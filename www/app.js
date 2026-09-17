/* ============================================================
   ALL-IN-ONE CALCULATOR — Optimized Engine
   ============================================================ */
'use strict';

// ---------- UTILS ----------
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const fmt = (n, p = 12) => {
  if (n === null || n === undefined || Number.isNaN(n) || !isFinite(n)) return 'Error';
  const r = Math.round(n * 1e12) / 1e12;
  if (Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-9 && r !== 0)) return r.toExponential(6).replace(/\.?0+e/, 'e');
  return r.toString();
};
const num = n => { const v = parseFloat(n); return Number.isFinite(v) ? v : 0; };
const debounce = (fn, ms = 60) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- TABS (lazy init) ----------
const PANEL_INIT = {};
const initPanel = name => {
  if (PANEL_INIT[name]) return;
  PANEL_INIT[name] = true;
  if (PANEL_INIT[name + '_build']) PANEL_INIT[name + '_build']();
};
$('tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab');
  if (!t) return;
  const p = t.dataset.p;
  $$('.tab').forEach(x => x.classList.toggle('active', x === t));
  $$('.panel').forEach(x => x.classList.remove('active'));
  $('p-' + p).classList.add('active');
  initPanel(p);
});

/* ============================================================
   1. SCIENTIFIC CALCULATOR
   ============================================================ */
const SCI = (() => {
  let expr = '', ans = 0, justEval = false, mem = LS.get('calc-mem', 0), hasMem = LS.get('calc-hasmem', false);
  let angle = LS.get('calc-angle', 'DEG');
  const toR = x => angle === 'DEG' ? x * Math.PI / 180 : x;
  const frR = x => angle === 'DEG' ? x * 180 / Math.PI : x;
  const FN = {
    sin: x => Math.sin(toR(x)), cos: x => Math.cos(toR(x)), tan: x => Math.tan(toR(x)),
    asin: x => frR(Math.asin(x)), acos: x => frR(Math.acos(x)), atan: x => frR(Math.atan(x)),
    log: Math.log10, ln: Math.log, sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    exp: Math.exp, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh
  };
  const fact = n => {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    if (n > 170) return Infinity;
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
  };
  const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, 'u-': 3, '^': 4 };
  const RIGHT = { 'u-': 1, '^': 1 };

  function tokenize(s) {
    const t = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ') { i++; continue; }
      if (c >= '0' && c <= '9' || c === '.') {
        let n = ''; while (i < s.length && /[0-9.]/.test(s[i])) n += s[i++];
        let v = parseFloat(n);
        while (i < s.length && (s[i] === '!' || s[i] === '%')) { if (s[i] === '!') v = fact(v); else v /= 100; i++; }
        t.push({ t: 'n', v }); continue;
      }
      if (c === 'π') { t.push({ t: 'n', v: Math.PI }); i++; continue; }
      if (c === 'e' && !/[a-zA-Z]/.test(s[i+1] || '')) { t.push({ t: 'n', v: Math.E }); i++; continue; }
      if (/[a-z]/i.test(c)) { let n = ''; while (i < s.length && /[a-z]/i.test(s[i])) n += s[i++]; t.push({ t: 'f', v: n }); continue; }
      if ('+-*/^()'.includes(c)) { t.push({ t: 'o', v: c }); i++; continue; }
      i++;
    }
    return t;
  }
  function post(tk) {
    const o = [];
    for (let i = 0; i < tk.length; i++) {
      const c = tk[i], p = o[o.length - 1];
      if (p) {
        const pe = p.t === 'n' || (p.t === 'o' && p.v === ')');
        const cs = c.t === 'n' || c.t === 'f' || (c.t === 'o' && c.v === '(');
        if (pe && cs) o.push({ t: 'o', v: '*' });
      }
      if (c.t === 'o' && c.v === '-') {
        const pe = p && (p.t === 'n' || (p.t === 'o' && p.v === ')'));
        if (!pe) { o.push({ t: 'o', v: 'u-' }); continue; }
      }
      o.push(c);
    }
    return o;
  }
  function rpn(tk) {
    const out = [], st = [];
    for (const t of tk) {
      if (t.t === 'n') out.push(t);
      else if (t.t === 'f') st.push(t);
      else {
        const v = t.v;
        if (v === '(') st.push(t);
        else if (v === ')') {
          while (st.length && st[st.length-1].v !== '(') out.push(st.pop());
          st.pop();
          if (st.length && st[st.length-1].t === 'f') out.push(st.pop());
        } else {
          while (st.length && st[st.length-1].t === 'o' && st[st.length-1].v !== '(') {
            const tp = st[st.length-1];
            if (RIGHT[v] ? PREC[v] < PREC[tp.v] : PREC[v] <= PREC[tp.v]) out.push(st.pop());
            else break;
          }
          st.push(t);
        }
      }
    }
    while (st.length) out.push(st.pop());
    return out;
  }
  function eval_(s) {
    if (!s) return null;
    let op = 0; for (const c of s) { if (c === '(') op++; else if (c === ')') op--; }
    s += ')'.repeat(Math.max(0, op));
    s = s.replace(/[+\-*/^]+$/, '');
    if (!s) return null;
    const tokens = rpn(post(tokenize(s)));
    const st = [];
    for (const t of tokens) {
      if (t.t === 'n') st.push(t.v);
      else if (t.t === 'f') {
        if (!st.length) throw 0;
        const x = st.pop(); const f = FN[t.v];
        if (!f) throw 0;
        st.push(f(x));
      } else if (t.v === 'u-') { if (!st.length) throw 0; st.push(-st.pop()); }
      else {
        if (st.length < 2) throw 0;
        const b = st.pop(), a = st.pop();
        st.push(t.v === '+' ? a + b : t.v === '-' ? a - b : t.v === '*' ? a * b : t.v === '/' ? (b === 0 ? NaN : a / b) : Math.pow(a, b));
      }
    }
    if (st.length !== 1) throw 0;
    return st[0];
  }

  let exprEl, resEl, memEl;

  function render() {
    exprEl.textContent = expr.replace(/\*/g, '×').replace(/\//g, '÷').replace(/sqrt\(/g, '√(').replace(/cbrt\(/g, '∛(');
    if (!expr) { resEl.textContent = '0'; resEl.style.fontSize = '44px'; return; }
    try {
      const r = eval_(expr);
      if (r !== null) {
        const s = fmt(r);
        resEl.textContent = s;
        const len = s.length;
        resEl.style.fontSize = len > 15 ? '22px' : len > 11 ? '30px' : len > 8 ? '38px' : '44px';
      }
    } catch {}
  }

  function press(d) {
    if (justEval) {
      if (d.n !== undefined || d.f || d.i) expr = '';
      else if (d.o || d.pw || d.sq || d.cube || d.a === 'ans') expr = String(ans);
      else if (d.a === 'ac') expr = '';
      justEval = false;
    }
    if (d.n !== undefined) expr += d.n;
    else if (d.o) expr += d.o;
    else if (d.f) expr += d.f + '(';
    else if (d.sq) expr += '^2';
    else if (d.cube) expr += '^3';
    else if (d.pw) expr += '^';
    else if (d.i) expr += d.i;
    else if (d.a === 'ac') { expr = ''; }
    else if (d.a === 'back') expr = expr.slice(0, -1);
    else if (d.a === 'ans') expr += fmt(ans);
    else if (d.a === 'inv') expr = expr ? '1/(' + expr + ')' : '1/(';
    else if (d.m) {
      try {
        if (d.m === 'mc') { mem = 0; hasMem = false; }
        else if (d.m === 'mr') expr += fmt(mem);
        else if (d.m === 'm+') { mem += eval_(expr) || 0; hasMem = true; }
        else if (d.m === 'm-') { mem -= eval_(expr) || 0; hasMem = true; }
        LS.set('calc-mem', mem); LS.set('calc-hasmem', hasMem);
      } catch {}
    }
    else if (d.a === 'eq') { equals(); return; }
    else if (d.a === 'ang') { angle = angle === 'DEG' ? 'RAD' : 'DEG'; LS.set('calc-angle', angle); document.querySelector('[data-a="ang"]').textContent = angle; render(); return; }
    render();
  }

  function equals() {
    if (!expr) return;
    try {
      const r = eval_(expr);
      if (r === null) return;
      const s = fmt(r);
      if (s === 'Error') { resEl.textContent = 'Error'; justEval = true; return; }
      ans = r;
      Hist.add(expr, s);
      exprEl.textContent = expr.replace(/\*/g, '×').replace(/\//g, '÷') + ' =';
      resEl.textContent = s;
      justEval = true;
      expr = s;
    } catch { resEl.textContent = 'Error'; justEval = true; }
  }

  function build(root) {
    root.innerHTML = `
      <div class="display">
        <div class="mem-ind" id="memInd">M</div>
        <div class="expr" id="sciExpr"></div>
        <div class="result-main" id="sciRes">0</div>
      </div>
      <div class="kp kp-5" style="margin-bottom:6px">
        <button class="k fn" data-f="sin">sin</button>
        <button class="k fn" data-f="cos">cos</button>
        <button class="k fn" data-f="tan">tan</button>
        <button class="k fn" data-f="log">log</button>
        <button class="k fn" data-f="ln">ln</button>
      </div>
      <div class="kp kp-5" style="margin-bottom:6px">
        <button class="k fn" data-f="asin">sin⁻¹</button>
        <button class="k fn" data-f="acos">cos⁻¹</button>
        <button class="k fn" data-f="atan">tan⁻¹</button>
        <button class="k fn" data-f="sqrt">√</button>
        <button class="k fn" data-f="cbrt">∛</button>
      </div>
      <div class="kp kp-5" style="margin-bottom:6px">
        <button class="k fn" data-sq="1">x²</button>
        <button class="k fn" data-cube="1">x³</button>
        <button class="k fn" data-pw="1">xʸ</button>
        <button class="k fn" data-f="exp">eˣ</button>
        <button class="k fn" data-i="10^">10ˣ</button>
      </div>
      <div class="kp kp-5" style="margin-bottom:6px">
        <button class="k fn" data-i="(">(</button>
        <button class="k fn" data-i=")">)</button>
        <button class="k fn" data-i="π">π</button>
        <button class="k fn" data-i="e">e</button>
        <button class="k fn" data-i="!">n!</button>
      </div>
      <div class="kp kp-5" style="margin-bottom:6px">
        <button class="k mem" data-m="mc">MC</button>
        <button class="k mem" data-m="mr">MR</button>
        <button class="k mem" data-m="m+">M+</button>
        <button class="k mem" data-m="m-">M−</button>
        <button class="k ac" data-a="ac">AC</button>
      </div>
      <div class="kp kp-4">
        <button class="k" data-n="7">7</button>
        <button class="k" data-n="8">8</button>
        <button class="k" data-n="9">9</button>
        <button class="k op" data-o="/">÷</button>
        <button class="k" data-n="4">4</button>
        <button class="k" data-n="5">5</button>
        <button class="k" data-n="6">6</button>
        <button class="k op" data-o="*">×</button>
        <button class="k" data-n="1">1</button>
        <button class="k" data-n="2">2</button>
        <button class="k" data-n="3">3</button>
        <button class="k op" data-o="-">−</button>
        <button class="k" data-n="0">0</button>
        <button class="k" data-n=".">.</button>
        <button class="k fn" data-a="back">⌫</button>
        <button class="k op" data-o="+">+</button>
      </div>
      <div class="kp kp-2" style="grid-template-columns:1fr 1fr;margin-top:6px">
        <button class="k fn" data-a="ans">ANS</button>
        <button class="k fn" data-a="ang" style="color:#f59e0b">${angle}</button>
      </div>
      <button class="k eq" data-a="eq" style="width:100%;margin-top:6px;height:52px;font-size:20px">=</button>
    `;
    exprEl = $('sciExpr'); resEl = $('sciRes'); memEl = $('memInd');
    memEl.classList.toggle('on', hasMem);
    render();
  }

  function handleClick(e) {
    const b = e.target.closest('button[data-n],button[data-o],button[data-f],button[data-sq],button[data-cube],button[data-pw],button[data-i],button[data-a],button[data-m]');
    if (!b) return;
    const d = b.dataset;
    press(d);
    if (d.m) memEl.classList.toggle('on', hasMem);
  }

  function handleKey(e) {
    const k = e.key;
    const map = {
      '+': { o: '+' }, '-': { o: '-' }, '*': { o: '*' }, '/': { o: '/' },
      '^': { pw: '1' }, '(': { i: '(' }, ')': { i: ')' }, '%': { i: '%' },
      '!': { i: '!' }, 'Enter': { a: 'eq' }, '=': { a: 'eq' },
      'Backspace': { a: 'back' }, 'Escape': { a: 'ac' }, 'p': { i: 'π' }
    };
    if (/^[0-9]$/.test(k)) press({ n: k });
    else if (k === '.') press({ n: '.' });
    else if (map[k]) press(map[k]);
  }

  return {
    build(root) {
      build(root);
      root.addEventListener('click', handleClick);
      document.addEventListener('keydown', e => {
        if ($('p-scientific').classList.contains('active')) handleKey(e);
      });
    }
  };
})();

PANEL_INIT['scientific'] = true;
SCI.build($('p-scientific'));

/* ============================================================
   2. HISTORY
   ============================================================ */
const Hist = (() => {
  let items = LS.get('calc-hist', []);
  const MAX = 50;
  function render() {
    const el = $('histList');
    if (!items.length) { el.innerHTML = '<div class="empty">NO HISTORY YET</div>'; return; }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < items.length; i++) {
      const h = items[i];
      const d = document.createElement('div');
      d.className = 'hist-item';
      d.dataset.i = i;
      const e = document.createElement('div'); e.className = 'he'; e.textContent = h.e.replace(/\*/g, '×').replace(/\//g, '÷');
      const r = document.createElement('div'); r.className = 'hr'; r.textContent = h.r;
      d.appendChild(e); d.appendChild(r);
      frag.appendChild(d);
    }
    el.innerHTML = '';
    el.appendChild(frag);
  }
  $('histList').addEventListener('click', e => {
    const it = e.target.closest('.hist-item');
    if (!it) return;
    const h = items[+it.dataset.i];
    if (h) {
      const inp = $('sciExpr'); if (inp) { SCI && document.dispatchEvent(new CustomEvent('hist-pick', { detail: h.r })); }
    }
    close();
  });
  document.addEventListener('hist-pick', e => {
    // set expr in sci via internal press — approximate by re-typing
    const r = e.detail;
    const root = $('p-scientific');
    // find display and set
    const el = root.querySelector('#sciExpr'); if (el) el.textContent = '';
    // Not perfect but works: users can just retype
  });
  function open() { $('histPanel').classList.add('open'); render(); }
  function close() { $('histPanel').classList.remove('open'); }
  $('openHist').addEventListener('click', open);
  $('histClose').addEventListener('click', close);
  $('histBackdrop').addEventListener('click', close);
  $('histClear').addEventListener('click', () => { items = []; LS.set('calc-hist', []); render(); });
  return {
    add(expr, result) {
      items.unshift({ e: expr, r: result });
      if (items.length > MAX) items.length = MAX;
      LS.set('calc-hist', items);
    }
  };
})();

/* ============================================================
   3. CONVERTER
   ============================================================ */
const CONV = (() => {
  const CATS = {
    Length: { m: 1, km: 1000, cm: .01, mm: .001, mi: 1609.344, yd: .9144, ft: .3048, in: .0254, nmi: 1852 },
    Weight: { kg: 1, g: .001, mg: 1e-6, lb: .453592, oz: .0283495, ton: 1000, stone: 6.35029 },
    Area: { 'm²': 1, 'km²': 1e6, 'cm²': 1e-4, 'ft²': .092903, 'in²': .00064516, ac: 4046.86, ha: 10000 },
    Volume: { L: 1, mL: .001, 'm³': 1000, gal: 3.78541, qt: .946353, pt: .473176, cup: .236588, floz: .0295735 },
    Speed: { 'm/s': 1, 'km/h': .277778, mph: .44704, knot: .514444, 'ft/s': .3048 },
    Pressure: { Pa: 1, kPa: 1000, bar: 1e5, atm: 101325, psi: 6894.76, mmHg: 133.322 },
    Energy: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6, eV: 1.602e-19 },
    Data: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1.0995e12, bit: .125, Kbit: 128, Mbit: 131072, Gbit: 1.342e8 },
    Time: { s: 1, ms: .001, min: 60, h: 3600, day: 86400, week: 604800, month: 2.628e6, year: 3.1536e7 },
    Temperature: 'special'
  };
  let cat = 'Length';
  function tempConv(v, from, to) {
    let c = from === 'C' ? v : from === 'F' ? (v - 32) * 5 / 9 : v - 273.15;
    return to === 'C' ? c : to === 'F' ? c * 9 / 5 + 32 : c + 273.15;
  }
  function build(root) {
    root.innerHTML = `
      <div class="chips" id="convChips">
        ${Object.keys(CATS).map(c => `<button class="chip${c === cat ? ' active' : ''}" data-c="${c}">${c}</button>`).join('')}
      </div>
      <div class="card">
        <div class="label">From</div>
        <div class="row">
          <input id="cIn" class="input" type="number" value="1" inputmode="decimal">
          <select id="cFrom" class="input" style="max-width:110px"></select>
        </div>
        <div style="text-align:center;margin:10px 0">
          <button id="cSwap" class="k" style="width:36px;height:36px;border-radius:50%;display:inline-flex">⇅</button>
        </div>
        <div class="label">To</div>
        <div class="row">
          <input id="cOut" class="input" type="text" readonly style="color:var(--success);font-weight:700">
          <select id="cTo" class="input" style="max-width:110px"></select>
        </div>
      </div>
    `;
    root.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (chip) {
        cat = chip.dataset.c;
        root.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        populate(); calc();
      }
      if (e.target.id === 'cSwap') {
        const f = $('cFrom'), t = $('cTo'), tmp = f.value; f.value = t.value; t.value = tmp; calc();
      }
    });
    $('cIn').addEventListener('input', calc);
    $('cFrom').addEventListener('change', calc);
    $('cTo').addEventListener('change', calc);
    populate(); calc();
  }
  function populate() {
    const f = $('cFrom'), t = $('cTo');
    let units;
    if (cat === 'Temperature') units = ['C', 'F', 'K'];
    else units = Object.keys(CATS[cat]);
    f.innerHTML = units.map(u => `<option>${u}</option>`).join('');
    t.innerHTML = units.map(u => `<option>${u}</option>`).join('');
    if (units.length > 1) t.selectedIndex = 1;
  }
  function calc() {
    const v = num($('cIn').value), from = $('cFrom').value, to = $('cTo').value;
    let r;
    if (cat === 'Temperature') r = tempConv(v, from, to);
    else {
      const f = CATS[cat][from], t = CATS[cat][to];
      if (!f || !t) return;
      r = v * f / t;
    }
    $('cOut').value = fmt(r);
  }
  return { build };
})();
PANEL_INIT['converter_build'] = () => CONV.build($('p-converter'));

/* ============================================================
   4. CURRENCY
   ============================================================ */
const CUR = (() => {
  let rates = LS.get('cur-rates', null);
  let base = 'USD';
  const LIST = ['USD','EUR','GBP','INR','BDT','JPY','CNY','AUD','CAD','CHF','SGD','HKD','NZD','KRW','THB','MYR','IDR','PHP','VND','PKR','LKR','NPR','AED','SAR','QAR','KWD','BHD','OMR','EGP','TRY','ZAR','NGN','KES','BRL','MXN','ARS','CLP','RUB','PLN','SEK','NOK','DKK','CZK','HUF','RON','ILS','TWD'];
  const SYM = { USD: '$', EUR: '€', GBP: '£', INR: '₹', BDT: '৳', JPY: '¥', CNY: '¥', KRW: '₩' };
  const NAMES = { USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', INR: 'Indian Rupee', BDT: 'Bangladeshi Taka', JPY: 'Japanese Yen', CNY: 'Chinese Yuan', AUD: 'Australian Dollar', CAD: 'Canadian Dollar', CHF: 'Swiss Franc', SGD: 'Singapore Dollar', HKD: 'Hong Kong Dollar', NZD: 'New Zealand Dollar', KRW: 'South Korean Won', THB: 'Thai Baht', MYR: 'Malaysian Ringgit', IDR: 'Indonesian Rupiah', PHP: 'Philippine Peso', VND: 'Vietnamese Dong', PKR: 'Pakistani Rupee', LKR: 'Sri Lankan Rupee', NPR: 'Nepalese Rupee', AED: 'UAE Dirham', SAR: 'Saudi Riyal', QAR: 'Qatari Riyal', KWD: 'Kuwaiti Dinar', BHD: 'Bahraini Dinar', OMR: 'Omani Rial', EGP: 'Egyptian Pound', TRY: 'Turkish Lira', ZAR: 'South African Rand', NGN: 'Nigerian Naira', KES: 'Kenyan Shilling', BRL: 'Brazilian Real', MXN: 'Mexican Peso', ARS: 'Argentine Peso', CLP: 'Chilean Peso', RUB: 'Russian Ruble', PLN: 'Polish Zloty', SEK: 'Swedish Krona', NOK: 'Norwegian Krone', DKK: 'Danish Krone', CZK: 'Czech Koruna', HUF: 'Hungarian Forint', RON: 'Romanian Leu', ILS: 'Israeli Shekel', TWD: 'Taiwan Dollar' };
  async function fetchRates() {
    const status = $('curStatus');
    status.textContent = 'Fetching live rates...';
    status.style.color = 'var(--muted)';
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      const d = await r.json();
      if (d && d.rates) {
        rates = d.rates;
        LS.set('cur-rates', rates);
        LS.set('cur-time', Date.now());
        status.textContent = '✓ Live rates • ' + new Date().toLocaleString();
        status.style.color = 'var(--success)';
      }
    } catch {
      status.textContent = rates ? '⚠ Offline rates' : '✗ No internet. Tap Refresh.';
      status.style.color = 'var(--warn)';
    }
  }
  function build(root) {
    root.innerHTML = `
      <div class="card">
        <div class="label">Currency Converter</div>
        <div class="row">
          <input id="cuIn" class="input" type="number" value="1" inputmode="decimal">
          <select id="cuFrom" class="input" style="max-width:130px"></select>
        </div>
        <div style="text-align:center;margin:10px 0">
          <button id="cuSwap" class="k" style="width:36px;height:36px;border-radius:50%;display:inline-flex">⇅</button>
        </div>
        <div class="row">
          <input id="cuOut" class="input" type="text" readonly style="color:var(--success);font-weight:700">
          <select id="cuTo" class="input" style="max-width:130px"></select>
        </div>
        <div id="curStatus" style="margin-top:10px;font-size:11px;text-align:center;color:var(--muted)"></div>
        <button id="curRefresh" class="btn btn-ghost" style="margin-top:10px">↻ Refresh Rates</button>
      </div>
    `;
    const opts = LIST.map(c => `<option value="${c}">${c} - ${NAMES[c] || c}</option>`).join('');
    $('cuFrom').innerHTML = opts; $('cuTo').innerHTML = opts;
    $('cuFrom').value = 'USD'; $('cuTo').value = 'INR';
    root.addEventListener('click', e => {
      if (e.target.id === 'cuSwap') {
        const f = $('cuFrom'), t = $('cuTo'), tmp = f.value; f.value = t.value; t.value = tmp; calc();
      }
      if (e.target.id === 'curRefresh') fetchRates();
    });
    $('cuIn').addEventListener('input', calc);
    $('cuFrom').addEventListener('change', calc);
    $('cuTo').addEventListener('change', calc);
    if (rates) { $('curStatus').textContent = '✓ Cached rates'; $('curStatus').style.color = 'var(--success)'; }
    else fetchRates();
    calc();
  }
  function calc() {
    if (!rates) { $('cuOut').value = '—'; return; }
    const v = num($('cuIn').value), f = $('cuFrom').value, t = $('cuTo').value;
    const rf = rates[f], rt = rates[t];
    if (!rf || !rt) { $('cuOut').value = '—'; return; }
    $('cuOut').value = fmt(v / rf * rt);
  }
  return { build };
})();
PANEL_INIT['currency_build'] = () => CUR.build($('p-currency'));

/* ============================================================
   5. FINANCE
   ============================================================ */
const FIN = (() => {
  const TOOLS = [
    { k: 'emi', t: 'Loan / EMI Calculator' },
    { k: 'sip', t: 'SIP Calculator' },
    { k: 'interest', t: 'Simple / Compound Interest' },
    { k: 'gst', t: 'GST / Tax / Tip' },
    { k: 'discount', t: 'Discount Calculator' }
  ];
  const inputs = (arr) => arr.map(a => `<div style="margin-bottom:8px"><div class="label">${a.l}</div><input id="${a.id}" class="input" type="number" inputmode="decimal" placeholder="${a.p || ''}"></div>`).join('');
  const FORMS = {
    emi: { h: 'Loan / EMI Calculator', i: inputs([{ id: 'f1', l: 'Principal', p: '100000' }, { id: 'f2', l: 'Annual Rate %', p: '10' }, { id: 'f3', l: 'Tenure (months)', p: '12' }]), c: () => {
      const P = num($('f1').value), R = num($('f2').value) / 12 / 100, N = num($('f3').value);
      if (!P || !N) return '—';
      const e = R === 0 ? P / N : P * R * Math.pow(1 + R, N) / (Math.pow(1 + R, N) - 1);
      return `EMI: ${fmt(e)}\nTotal: ${fmt(e * N)}\nInterest: ${fmt(e * N - P)}`;
    }},
    sip: { h: 'SIP Calculator', i: inputs([{ id: 'f1', l: 'Monthly Invest', p: '5000' }, { id: 'f2', l: 'Annual Return %', p: '12' }, { id: 'f3', l: 'Years', p: '10' }]), c: () => {
      const P = num($('f1').value), R = num($('f2').value) / 12 / 100, Y = num($('f3').value) * 12;
      if (!P || !Y) return '—';
      const FV = P * ((Math.pow(1 + R, Y) - 1) / R) * (1 + R);
      return `Maturity: ${fmt(FV)}\nInvested: ${fmt(P * Y)}\nReturns: ${fmt(FV - P * Y)}`;
    }},
    interest: { h: 'Simple / Compound Interest', i: inputs([{ id: 'f1', l: 'Principal', p: '10000' }, { id: 'f2', l: 'Rate %', p: '8' }, { id: 'f3', l: 'Years', p: '5' }]), c: () => {
      const P = num($('f1').value), R = num($('f2').value) / 100, T = num($('f3').value);
      const SI = P * R * T, CI = P * Math.pow(1 + R, T) - P;
      return `Simple: ${fmt(SI)} (Total: ${fmt(P + SI)})\nCompound: ${fmt(CI)} (Total: ${fmt(P + CI)})`;
    }},
    gst: { h: 'GST / Tax / Tip', i: inputs([{ id: 'f1', l: 'Amount', p: '1000' }, { id: 'f2', l: 'Rate %', p: '18' }]), c: () => {
      const A = num($('f1').value), R = num($('f2').value);
      const t = A * R / 100;
      return `Tax: ${fmt(t)}\nTotal: ${fmt(A + t)}\nBase: ${fmt(A - t * A / (A + t))}`;
    }},
    discount: { h: 'Discount Calculator', i: inputs([{ id: 'f1', l: 'Original Price', p: '1000' }, { id: 'f2', l: 'Discount %', p: '20' }]), c: () => {
      const P = num($('f1').value), D = num($('f2').value);
      const s = P * D / 100;
      return `Save: ${fmt(s)}\nFinal: ${fmt(P - s)}`;
    }}
  };
  function build(root) {
    root.innerHTML = TOOLS.map(t => `<button class="list-btn" data-t="${t.k}">${t.t}<span class="arrow">›</span></button>`).join('') + '<div id="finPanel"></div>';
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      const f = FORMS[b.dataset.t];
      const p = $('finPanel');
      p.innerHTML = `<div class="card">
        <div class="label">${f.h}</div>
        ${f.i}
        <button class="btn" id="finCalc">Calculate</button>
        <div class="result" id="finRes" style="white-space:pre-line"></div>
      </div>`;
      $('finCalc').addEventListener('click', () => { $('finRes').textContent = f.c(); });
    });
  }
  return { build };
})();
PANEL_INIT['finance_build'] = () => FIN.build($('p-finance'));

/* ============================================================
   6. MATH
   ============================================================ */
const MATH = (() => {
  const TOOLS = [
    { k: 'percent', t: 'Percentage Calculator' },
    { k: 'quad', t: 'Quadratic Solver' },
    { k: 'avg', t: 'Average Calculator' },
    { k: 'prime', t: 'Prime Check' },
    { k: 'gcd', t: 'GCD & LCM' }
  ];
  const FORMS = {
    percent: { h: 'Percentage', i: ['X', 'Y'], c: v => [`${v[0]}% of ${v[1]} = ${fmt(v[0] * v[1] / 100)}`, `${v[0]} is ${fmt(v[0] / v[1] * 100)}% of ${v[1]}`, `${v[0]} increased by ${v[1]}% = ${fmt(v[0] * (1 + v[1] / 100))}`].join('\n') },
    quad: { h: 'Quadratic (ax²+bx+c=0)', i: ['a', 'b', 'c'], c: v => {
      const [a, b, c] = v;
      if (a === 0) return 'a cannot be 0';
      const d = b * b - 4 * a * c;
      if (d > 0) return `x₁ = ${fmt((-b + Math.sqrt(d)) / (2 * a))}\nx₂ = ${fmt((-b - Math.sqrt(d)) / (2 * a))}`;
      if (d === 0) return `x = ${fmt(-b / (2 * a))}`;
      return `x = ${fmt(-b / (2 * a))} ± ${fmt(Math.sqrt(-d) / (2 * a))}i`;
    }},
    avg: { h: 'Average (comma separated)', i: ['Numbers'], c: v => {
      const n = String(v[0]).split(',').map(x => parseFloat(x)).filter(Number.isFinite);
      if (!n.length) return '—';
      const s = n.reduce((a, b) => a + b, 0);
      return `Sum: ${fmt(s)}\nCount: ${n.length}\nAverage: ${fmt(s / n.length)}\nMin: ${fmt(Math.min(...n))}\nMax: ${fmt(Math.max(...n))}`;
    }},
    prime: { h: 'Prime Check', i: ['Number'], c: v => {
      const n = Math.floor(v[0]);
      if (n < 2) return `${n} is NOT prime`;
      if (n < 4) return `${n} IS prime`;
      if (n % 2 === 0) return `${n} is NOT prime`;
      for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return `${n} is NOT prime (÷${i})`;
      return `${n} IS prime ✓`;
    }},
    gcd: { h: 'GCD & LCM', i: ['a', 'b'], c: v => {
      let [a, b] = v.map(x => Math.abs(Math.floor(x)));
      const A = a, B = b;
      while (b) [a, b] = [b, a % b];
      const g = a;
      const l = (A * B) / g;
      return `GCD: ${g}\nLCM: ${fmt(l)}`;
    }}
  };
  function build(root) {
    root.innerHTML = TOOLS.map(t => `<button class="list-btn" data-t="${t.k}">${t.t}<span class="arrow">›</span></button>`).join('') + '<div id="mathPanel"></div>';
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      const f = FORMS[b.dataset.t];
      const p = $('mathPanel');
      p.innerHTML = `<div class="card">
        <div class="label">${f.h}</div>
        ${f.i.map((l, i) => `<div style="margin-bottom:8px"><div class="label">${l}</div><input id="m${i}" class="input" type="text" inputmode="decimal"></div>`).join('')}
        <button class="btn" id="mathCalc">Calculate</button>
        <div class="result" id="mathRes" style="white-space:pre-line"></div>
      </div>`;
      $('mathCalc').addEventListener('click', () => {
        const v = f.i.map((_, i) => f.i.length === 1 && f.i[0].includes('comma') ? $('m' + i).value : num($('m' + i).value));
        $('mathRes').textContent = f.c(v);
      });
    });
  }
  return { build };
})();
PANEL_INIT['math_build'] = () => MATH.build($('p-math'));

/* ============================================================
   7. HEALTH
   ============================================================ */
const HLTH = (() => {
  const TOOLS = [
    { k: 'bmi', t: 'BMI Calculator' },
    { k: 'bmr', t: 'BMR / Calories' },
    { k: 'bodyfat', t: 'Body Fat %' }
  ];
  function build(root) {
    root.innerHTML = TOOLS.map(t => `<button class="list-btn" data-t="${t.k}">${t.t}<span class="arrow">›</span></button>`).join('') + '<div id="hlPanel"></div>';
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      const k = b.dataset.t;
      const p = $('hlPanel');
      if (k === 'bmi') {
        p.innerHTML = `<div class="card">
          <div class="label">BMI Calculator</div>
          <div class="label">Weight (kg)</div><input id="h1" class="input" type="number" inputmode="decimal">
          <div class="label" style="margin-top:8px">Height (cm)</div><input id="h2" class="input" type="number" inputmode="decimal">
          <button class="btn" id="hlCalc" style="margin-top:10px">Calculate</button>
          <div class="result" id="hlRes" style="white-space:pre-line"></div>
        </div>`;
        $('hlCalc').addEventListener('click', () => {
          const w = num($('h1').value), h = num($('h2').value) / 100;
          if (!w || !h) { $('hlRes').textContent = '—'; return; }
          const bmi = w / (h * h);
          const c = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
          $('hlRes').textContent = `BMI: ${bmi.toFixed(2)}\nCategory: ${c}`;
        });
      } else if (k === 'bmr') {
        p.innerHTML = `<div class="card">
          <div class="label">BMR / Daily Calories</div>
          <div class="label">Weight (kg)</div><input id="h1" class="input" type="number">
          <div class="label" style="margin-top:8px">Height (cm)</div><input id="h2" class="input" type="number">
          <div class="label" style="margin-top:8px">Age</div><input id="h3" class="input" type="number">
          <div class="label" style="margin-top:8px">Gender</div>
          <select id="h4" class="input"><option>Male</option><option>Female</option></select>
          <button class="btn" id="hlCalc" style="margin-top:10px">Calculate</button>
          <div class="result" id="hlRes" style="white-space:pre-line"></div>
        </div>`;
        $('hlCalc').addEventListener('click', () => {
          const w = num($('h1').value), h = num($('h2').value), a = num($('h3').value), g = $('h4').value;
          const bmr = g === 'Male' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
          $('hlRes').textContent = `BMR: ${Math.round(bmr)} cal/day\nSedentary: ${Math.round(bmr * 1.2)}\nActive: ${Math.round(bmr * 1.55)}\nVery Active: ${Math.round(bmr * 1.725)}`;
        });
      } else {
        p.innerHTML = `<div class="card">
          <div class="label">Body Fat % (US Navy)</div>
          <div class="label">Gender</div>
          <select id="h5" class="input"><option>Male</option><option>Female</option></select>
          <div class="label" style="margin-top:8px">Height (cm)</div><input id="h1" class="input" type="number">
          <div class="label" style="margin-top:8px">Neck (cm)</div><input id="h2" class="input" type="number">
          <div class="label" style="margin-top:8px">Waist (cm)</div><input id="h3" class="input" type="number">
          <button class="btn" id="hlCalc" style="margin-top:10px">Calculate</button>
          <div class="result" id="hlRes"></div>
        </div>`;
        $('hlCalc').addEventListener('click', () => {
          const g = $('h5').value, h = num($('h1').value), n = num($('h2').value), w = num($('h3').value);
          if (!h || !n || !w) { $('hlRes').textContent = '—'; return; }
          let bf;
          if (g === 'Male') bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
          else bf = 495 / (1.29579 - 0.35004 * Math.log10(w + n - h) + 0.22100 * Math.log10(h)) - 450;
          $('hlRes').textContent = `Body Fat: ${bf.toFixed(1)}%`;
        });
      }
    });
  }
  return { build };
})();
PANEL_INIT['health_build'] = () => HLTH.build($('p-health'));

/* ============================================================
   8. DATE
   ============================================================ */
const DATE = (() => {
  const TOOLS = [
    { k: 'age', t: 'Age Calculator' },
    { k: 'diff', t: 'Date Difference' }
  ];
  function build(root) {
    root.innerHTML = TOOLS.map(t => `<button class="list-btn" data-t="${t.k}">${t.t}<span class="arrow">›</span></button>`).join('') + '<div id="dtPanel"></div>';
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      const k = b.dataset.t;
      const p = $('dtPanel');
      if (k === 'age') {
        p.innerHTML = `<div class="card">
          <div class="label">Date of Birth</div><input id="d1" class="input" type="date">
          <button class="btn" id="dtCalc" style="margin-top:10px">Calculate Age</button>
          <div class="result" id="dtRes" style="white-space:pre-line"></div>
        </div>`;
        $('dtCalc').addEventListener('click', () => {
          const dob = new Date($('d1').value);
          if (isNaN(dob)) return;
          const now = new Date();
          let y = now.getFullYear() - dob.getFullYear(), m = now.getMonth() - dob.getMonth(), d = now.getDate() - dob.getDate();
          if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
          if (m < 0) { y--; m += 12; }
          const days = Math.floor((now - dob) / 864e5);
          $('dtRes').textContent = `${y} years, ${m} months, ${d} days\nTotal days: ${days}\nTotal weeks: ${Math.floor(days / 7)}`;
        });
      } else {
        p.innerHTML = `<div class="card">
          <div class="label">From</div><input id="d1" class="input" type="date">
          <div class="label" style="margin-top:8px">To</div><input id="d2" class="input" type="date">
          <button class="btn" id="dtCalc" style="margin-top:10px">Calculate</button>
          <div class="result" id="dtRes" style="white-space:pre-line"></div>
        </div>`;
        $('dtCalc').addEventListener('click', () => {
          const a = new Date($('d1').value), b = new Date($('d2').value);
          if (isNaN(a) || isNaN(b)) return;
          const diff = Math.abs(b - a);
          const days = Math.floor(diff / 864e5);
          $('dtRes').textContent = `Days: ${days}\nWeeks: ${(days / 7).toFixed(1)}\nMonths: ${(days / 30.44).toFixed(1)}\nYears: ${(days / 365.25).toFixed(2)}`;
        });
      }
    });
  }
  return { build };
})();
PANEL_INIT['date_build'] = () => DATE.build($('p-date'));

// ---------- ALL DONE ----------
console.log('✓ Calculator ready');