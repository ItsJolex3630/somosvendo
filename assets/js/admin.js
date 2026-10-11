/* Panel de administración Vendo · SPA (vanilla, sin frameworks) */
(function () {
  'use strict';

  var CLIENT_ID = '39780826399-626q7bsjaicc7fpa81ibqoffejmabvir.apps.googleusercontent.com';
  var API = '/api/admin/crm';

  var NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'movimientos', label: 'Movimientos', icon: '💸' },
    { id: 'clientes', label: 'Clientes', icon: '👥' },
    { id: 'cobros', label: 'Cobros', icon: '🔔' },
    { id: 'ajustes', label: 'Ajustes', icon: '⚙️' },
  ];
  var RANGE_LABEL = { this_month: 'Este mes', last_6: '6 meses', last_12: '12 meses' };
  var CATEGORY_LABELS = {
    web_sale: 'Venta web', hosting_monthly: 'Hosting mensual', vendo_conecta_monthly: 'Vendo Conecta mensual',
    feature_implementation: 'Implementación', photography: 'Sesión fotográfica', branding: 'Creación de marca',
    subscription: 'Suscripción', nfc_reinvestment: 'Reinversión NFC', unexpected: 'Imprevisto', savings: 'Ahorro', partner_payout: 'Pago a socio',
  };
  var SERVICE_LABELS = {
    web_dev: 'Desarrollo web', hosting: 'Hosting', vendo_conecta: 'Vendo Conecta', nfc_cards: 'Tarjetas NFC',
    photography: 'Sesión fotográfica', branding: 'Creación de marca', feature_implementation: 'Implementación',
  };
  var PAYMENT_KIND_LABELS = { one_time: 'Pago único', recurring: 'Mensual' };
  var STATUS_LABELS = { al_dia: 'Al día', proximo_a_vencer: 'Próximo a vencer', vencido: 'Vencido', suspendido: 'Suspendido' };
  var STATUS_CLASS = { al_dia: 'status--activo', proximo_a_vencer: 'status--gracia', vencido: 'status--vencido', suspendido: 'status--pendiente' };
  var DOT_CLASS = { al_dia: 'var(--ok)', proximo_a_vencer: 'var(--warn)', vencido: 'var(--danger)', suspendido: 'var(--mut)' };
  var TYPE_LABEL = { payment_due_soon: 'Próximo a vencer', payment_overdue: 'Pago vencido', suspension_suggested: 'Sugerencia de suspensión' };

  var INCOME_CATEGORIES = ['web_sale', 'hosting_monthly', 'vendo_conecta_monthly', 'feature_implementation', 'photography', 'branding', 'subscription'];
  var EXPENSE_CATEGORIES = ['nfc_reinvestment', 'unexpected', 'savings'];
  var ALL_CATEGORIES = INCOME_CATEGORIES.concat(EXPENSE_CATEGORIES, ['partner_payout']);
  var SHARED = ['photography', 'branding'];
  var SERVICE_TO_CATEGORY = {
    web_dev: 'web_sale', hosting: 'hosting_monthly', vendo_conecta: 'vendo_conecta_monthly', nfc_cards: 'web_sale',
    feature_implementation: 'feature_implementation', photography: 'photography', branding: 'branding',
  };

  var state = { token: null, email: null, alerts: [], clients: [], settings: null, summaryRange: 'this_month', movFilters: null };
  var view = 'dashboard';

  /* ------------------------------ utilidades ------------------------------ */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(cents) { return '$' + (Number(cents || 0) / 100).toFixed(2); }
  function catLabel(c) { return CATEGORY_LABELS[c] || c; }
  function svcLabel(s) { return SERVICE_LABELS[s] || s; }

  var toastHost;
  function toast(msg, type) {
    if (!toastHost) { toastHost = document.createElement('div'); toastHost.className = 'toast-host'; document.body.appendChild(toastHost); }
    var n = document.createElement('div');
    n.className = 'toast toast--' + (type || 'info');
    n.textContent = msg;
    toastHost.appendChild(n);
    setTimeout(function () { n.style.opacity = '0'; setTimeout(function () { n.remove(); }, 260); }, 3200);
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = { Authorization: 'Bearer ' + state.token };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    var res;
    try {
      res = await fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    } catch (e) { throw new Error('Sin conexión. Revisa tu internet.'); }
    var data = null;
    try { data = await res.json(); } catch (e) { /* noop */ }
    if (res.status === 401 || res.status === 403) { signOut(); throw new Error((data && data.error) || 'Sesión no válida'); }
    if (!res.ok) throw new Error((data && data.error) || ('Error ' + res.status));
    return data;
  }

  /* -------------------------------- modal -------------------------------- */
  function openModal(html) {
    var m = $('#modal');
    $('#modal-panel').innerHTML = html;
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    var m = $('#modal');
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
    $('#modal-panel').innerHTML = '';
  }
  document.addEventListener('click', function (e) {
    var closer = e.target.closest('[data-close]');
    if (closer) closeModal();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* ------------------------------ autenticación ------------------------------ */
  function showLogin() {
    $('#app-view').classList.add('hidden');
    $('#login-view').classList.remove('hidden');
  }
  function showApp() {
    $('#login-view').classList.add('hidden');
    $('#app-view').classList.remove('hidden');
    $('#user-email').textContent = state.email || '';
  }
  function loginError(msg) {
    var el = $('#login-error');
    if (!msg) { el.classList.add('hidden'); el.textContent = ''; return; }
    el.textContent = msg; el.classList.remove('hidden');
  }
  function decodeEmail(jwt) {
    try {
      var part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var pad = part.length % 4 ? '='.repeat(4 - (part.length % 4)) : '';
      return JSON.parse(atob(part + pad)).email || '';
    } catch (e) { return ''; }
  }
  function setToken(token, email) {
    state.token = token;
    state.email = email || state.email || '';
    try { sessionStorage.setItem('vendo_admin_token', token); sessionStorage.setItem('vendo_admin_email', state.email); } catch (e) { /* noop */ }
    loginError('');
    showApp();
    refreshAll();
  }
  function signOut() {
    state.token = null;
    try { sessionStorage.removeItem('vendo_admin_token'); sessionStorage.removeItem('vendo_admin_email'); } catch (e) { /* noop */ }
    showLogin();
    try { if (window.google && window.google.accounts && window.google.accounts.id) window.google.accounts.id.disableAutoSelect(); } catch (e) { /* noop */ }
  }

  var gsiReady = false;
  function initGsi(clientId) {
    if (gsiReady || !(window.google && window.google.accounts && window.google.accounts.id)) return;
    gsiReady = true;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: function (res) {
        if (res && res.credential) setToken(res.credential, decodeEmail(res.credential));
      },
    });
    window.google.accounts.id.renderButton($('#gsi-btn'), {
      theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', logo_alignment: 'left', width: 300,
    });
  }
  function loadGsi() {
    function ensureScript(clientId) {
      if (window.google && window.google.accounts && window.google.accounts.id) { initGsi(clientId); return; }
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = function () { initGsi(clientId); };
      s.onerror = function () { loginError('No se pudo cargar Google Sign-In. Revisa tu conexión.'); };
      document.head.appendChild(s);
    }
    // El Client ID se configura una sola vez en el backend (env.GOOGLE_CLIENT_ID)
    // para no desincronizarse del aud que valida el servidor.
    fetch('/api/config')
      .then(function (r) { return r.json(); })
      .then(function (cfg) { ensureScript((cfg && cfg.google_client_id) || CLIENT_ID); })
      .catch(function () { ensureScript(CLIENT_ID); });
  }

  /* -------------------------------- router -------------------------------- */
  function currentView() {
    var h = location.hash.replace(/^#\/?/, '').split('?')[0];
    return h || 'dashboard';
  }
  function navigate(v) {
    if (currentView() !== v) location.hash = '#/' + v;
    else render(v);
  }
  function renderNav() {
    $('#nav').innerHTML = NAV.map(function (n) {
      return '<button class="nav-item' + (n.id === view ? ' active' : '') + '" data-nav="' + n.id + '"><span aria-hidden="true">' + n.icon + '</span>' + n.label + '</button>';
    }).join('');
    $$('[data-nav]').forEach(function (b) { b.addEventListener('click', function () { navigate(b.dataset.nav); }); });
  }
  function render(v) {
    view = NAV.some(function (n) { return n.id === v; }) ? v : 'dashboard';
    $('#page-title').textContent = (NAV.find(function (n) { return n.id === view; }) || {}).label || 'Panel';
    renderNav();
    $('#app-view').classList.remove('nav-open');
    if (view === 'dashboard') viewDashboard(state.summaryRange);
    else if (view === 'movimientos') viewMovements();
    else if (view === 'clientes') viewClients();
    else if (view === 'cobros') viewCobros();
    else viewSettings();
  }

  /* ------------------------------ campana ------------------------------ */
  async function loadBell() {
    try {
      var d = await api('/notifications');
      state.alerts = d.alerts || [];
      var c = $('#bell-count');
      if (state.alerts.length) { c.textContent = state.alerts.length; c.classList.remove('hidden'); }
      else c.classList.add('hidden');
    } catch (e) { /* silencioso */ }
  }
  function toggleBell() {
    var p = $('#bell-panel');
    if (!p.classList.contains('hidden')) { p.classList.add('hidden'); return; }
    if (!state.alerts.length) { p.innerHTML = '<p class="list-empty small">Sin notificaciones.</p>'; }
    else {
      p.innerHTML = state.alerts.map(function (a) {
        return '<div class="bell-item" data-goto="cobros"><span class="t">' + esc(TYPE_LABEL[a.type] || a.type) + '</span>' + esc(a.message) + '</div>';
      }).join('');
      $$('.bell-item', p).forEach(function (i) { i.addEventListener('click', function () { p.classList.add('hidden'); navigate('cobros'); }); });
    }
    p.classList.remove('hidden');
  }

  /* ------------------------------ dashboard ------------------------------ */
  async function viewDashboard(range) {
    var el = $('#view');
    range = range || 'this_month';
    state.summaryRange = range;
    el.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    var data;
    try { data = await api('/summary?range=' + encodeURIComponent(range)); }
    catch (e) { el.innerHTML = '<div class="alert alert--error">' + esc(e.message) + '</div>'; return; }
    var s = data.summary;
    el.innerHTML =
      '<div class="section-head">' +
        '<div class="filters" style="margin:0">' +
          ['this_month', 'last_6', 'last_12'].map(function (r) {
            return '<button class="chip' + (r === range ? ' is-active' : '') + '" data-range="' + r + '">' + RANGE_LABEL[r] + '</button>';
          }).join('') +
        '</div>' +
        '<div class="wrap-flex">' +
          '<button class="btn btn--sm" id="qa-income">+ Registrar ingreso</button>' +
          '<button class="btn btn--sm btn--ghost" id="qa-expense">+ Registrar gasto</button>' +
        '</div>' +
      '</div>' +
      '<div class="kpi-row">' +
        '<div class="kpi"><div class="kpi__v" style="color:var(--ok)">' + fmt(s.income_cents) + '</div><div class="kpi__l">Ingresos</div></div>' +
        '<div class="kpi"><div class="kpi__v" style="color:var(--danger)">' + fmt(s.expense_cents) + '</div><div class="kpi__l">Gastos</div></div>' +
        '<div class="kpi kpi--hero"><div class="kpi__v">' + fmt(s.net_cents) + '</div><div class="kpi__l">Ganancia neta</div></div>' +
      '</div>' +
      '<div class="card" style="padding:18px;margin-bottom:16px">' +
        '<div class="between" style="margin-bottom:8px"><h2 style="font-size:16px;margin:0">Evolución financiera</h2>' +
        '<div class="legend"><span class="l-income">Ingresos</span><span class="l-expense">Gastos</span><span class="l-net">Neto</span></div></div>' +
        chartSvg(data.series) +
      '</div>' +
      '<div class="grid-2">' +
        '<div class="card" style="padding:18px"><h2 style="font-size:15px;margin:0 0 10px">Ingresos por categoría</h2>' + catList(data.income_by_category) + '</div>' +
        '<div class="card" style="padding:18px"><h2 style="font-size:15px;margin:0 0 10px">Gastos por categoría</h2>' + catList(data.expense_by_category) + '</div>' +
      '</div>';

    $$('[data-range]', el).forEach(function (b) { b.addEventListener('click', function () { viewDashboard(b.dataset.range); }); });
    $('#qa-income').addEventListener('click', function () { movementModal({ kind: 'income' }); });
    $('#qa-expense').addEventListener('click', function () { movementModal({ kind: 'expense' }); });
  }

  function catList(items) {
    if (!items || !items.length) return '<p class="list-empty small">Sin datos.</p>';
    var max = Math.max.apply(null, items.map(function (i) { return i.total_cents; })) || 1;
    return items.map(function (i) {
      var pct = Math.max(4, Math.round((i.total_cents / max) * 100));
      return '<div class="cat-row"><span class="cat-name">' + esc(catLabel(i.category)) + '</span>' +
        '<span class="cat-bar" style="width:' + pct + 'px;max-width:120px"></span>' +
        '<span class="cat-val">' + fmt(i.total_cents) + '</span></div>';
    }).join('');
  }

  function chartSvg(series) {
    if (!series || !series.length) return '<p class="list-empty small">Sin datos en el rango.</p>';
    var W = 680, H = 250, padL = 40, padR = 12, padT = 14, padB = 34;
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var maxVal = Math.max(1, Math.max.apply(null, series.map(function (s) { return Math.max(s.income_cents, s.expense_cents); })));
    var nets = series.map(function (s) { return s.net_cents; });
    var netMax = Math.max(0, Math.max.apply(null, nets));
    var netMin = Math.min(0, Math.min.apply(null, nets));
    var netRange = Math.max(1, netMax - netMin);
    var n = series.length;
    var slot = innerW / n;
    var bars = '', line = '', labels = '', grid = '';
    for (var g = 0; g <= 4; g += 1) {
      var y = padT + (innerH * g) / 4;
      var val = maxVal * (1 - g / 4);
      grid += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="var(--t-line)" stroke-width="1"/>';
      grid += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end" font-size="9" fill="var(--t-muted)">' + (val / 100).toFixed(0) + '</text>';
    }
    series.forEach(function (s, i) {
      var x0 = padL + i * slot;
      var bw = Math.min(20, slot * 0.3);
      var ih = (s.income_cents / maxVal) * innerH;
      var eh = (s.expense_cents / maxVal) * innerH;
      bars += '<rect x="' + (x0 + slot / 2 - bw - 2) + '" y="' + (padT + innerH - ih) + '" width="' + bw + '" height="' + ih + '" rx="3" fill="var(--ok)"/>';
      bars += '<rect x="' + (x0 + slot / 2 + 2) + '" y="' + (padT + innerH - eh) + '" width="' + bw + '" height="' + eh + '" rx="3" fill="var(--danger)"/>';
      var cx = x0 + slot / 2;
      var cy = padT + ((netMax - s.net_cents) / netRange) * innerH;
      line += (i === 0 ? 'M' : 'L') + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ';
      labels += '<text x="' + cx + '" y="' + (H - 12) + '" text-anchor="middle" font-size="10" fill="var(--t-muted)">' + esc(s.month.slice(5) + '/' + s.month.slice(2, 4)) + '</text>';
    });
    var dots = series.map(function (s, i) {
      var cx = padL + i * slot + slot / 2;
      var cy = padT + ((netMax - s.net_cents) / netRange) * innerH;
      return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3" fill="var(--t-primary)"/>';
    }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Evolución financiera">' +
      grid + bars + '<path d="' + line + '" fill="none" stroke="var(--t-primary)" stroke-width="2"/>' + dots + labels + '</svg>';
  }

  /* ------------------------------ movimientos ------------------------------ */
  async function viewMovements() {
    var el = $('#view');
    var f = state.movFilters || (state.movFilters = { kind: '', category: '', from: '', to: '', q: '' });
    el.innerHTML =
      '<div class="section-head"><h2>Movimientos</h2><button class="btn btn--sm" id="new-mov">+ Nuevo movimiento</button></div>' +
      '<div class="filters">' +
        '<select class="select" id="f-kind"><option value="">Tipo: todos</option><option value="income">Ingresos</option><option value="expense">Gastos</option></select>' +
        '<select class="select" id="f-cat"><option value="">Categoría: todas</option>' + ALL_CATEGORIES.map(function (c) { return '<option value="' + c + '">' + esc(catLabel(c)) + '</option>'; }).join('') + '</select>' +
        '<input class="input" type="date" id="f-from"><input class="input" type="date" id="f-to">' +
        '<input class="input" id="f-q" placeholder="Buscar…">' +
        '<button class="btn btn--sm btn--secondary" id="f-apply" type="button">Filtrar</button>' +
      '</div>' +
      '<div class="card tbl-wrap" id="mov-table"></div>';
    $('#f-kind').value = f.kind; $('#f-cat').value = f.category; $('#f-from').value = f.from; $('#f-to').value = f.to; $('#f-q').value = f.q;
    $('#new-mov').addEventListener('click', function () { movementModal({ kind: 'income' }); });
    $('#f-apply').addEventListener('click', function () {
      state.movFilters = { kind: $('#f-kind').value, category: $('#f-cat').value, from: $('#f-from').value, to: $('#f-to').value, q: $('#f-q').value };
      loadMovementsTable();
    });
    loadMovementsTable();
  }
  async function loadMovementsTable() {
    var el = $('#mov-table');
    el.innerHTML = '<div class="list-empty">Cargando…</div>';
    var f = state.movFilters || {};
    var qs = new URLSearchParams();
    Object.keys(f).forEach(function (k) { if (f[k]) qs.set(k, f[k]); });
    try {
      var d = await api('/movements' + (qs.toString() ? '?' + qs.toString() : ''));
      var rows = d.movements || [];
      if (!rows.length) { el.innerHTML = '<div class="list-empty">Sin movimientos.</div>'; return; }
      el.innerHTML = '<table class="tbl"><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Cliente</th><th class="num">Monto</th><th class="actions"></th></tr></thead><tbody>' +
        rows.map(function (m) {
          return '<tr><td>' + esc(m.movement_date) + '</td>' +
            '<td><span class="status ' + (m.kind === 'income' ? 'status--activo' : 'status--vencido') + '">' + (m.kind === 'income' ? 'Ingreso' : 'Gasto') + '</span></td>' +
            '<td>' + esc(catLabel(m.category)) + '</td>' +
            '<td class="muted">' + esc(m.description || '—') + '</td>' +
            '<td class="muted">' + esc(m.client_name || '—') + '</td>' +
            '<td class="num ' + (m.kind === 'income' ? 'income' : 'expense') + '">' + (m.kind === 'income' ? '+' : '−') + fmt(m.amount_cents) + '</td>' +
            '<td class="actions"><button class="btn btn--ghost btn--xs" data-del="' + m.id + '" type="button">Eliminar</button></td></tr>';
        }).join('') + '</tbody></table>';
      $$('[data-del]', el).forEach(function (b) { b.addEventListener('click', function () { deleteMovement(b.dataset.del); }); });
    } catch (e) { el.innerHTML = '<div class="alert alert--error">' + esc(e.message) + '</div>'; }
  }
  async function deleteMovement(id) {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    try { await api('/movements/' + encodeURIComponent(id), { method: 'DELETE' }); toast('Movimiento eliminado', 'info'); loadMovementsTable(); loadBell(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function movementModal(preset) {
    preset = preset || {};
    var kind = preset.kind === 'expense' ? 'expense' : 'income';
    openModal(
      '<h3 style="font-size:19px;margin-bottom:14px">Nuevo movimiento</h3>' +
      '<form id="mov-form" class="form-grid">' +
        '<div class="form-grid cols-2">' +
          '<div class="field"><label for="mv-kind">Tipo</label><select class="select" id="mv-kind" name="kind"><option value="income">Ingreso</option><option value="expense">Gasto</option></select></div>' +
          '<div class="field"><label for="mv-cat">Categoría</label><select class="select" id="mv-cat" name="category"></select></div>' +
          '<div class="field"><label for="mv-amt">Monto (USD)</label><input class="input" id="mv-amt" name="amount_usd" inputmode="decimal" placeholder="100.00" required></div>' +
          '<div class="field"><label for="mv-date">Fecha</label><input class="input" id="mv-date" type="date" name="date"></div>' +
        '</div>' +
        '<div class="field"><label for="mv-client">Cliente (opcional)</label><select class="select" id="mv-client" name="client_id"><option value="">— Sin cliente —</option>' +
          (state.clients || []).map(function (c) { return '<option value="' + c.id + '">' + esc(c.full_name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="mv-desc">Descripción</label><input class="input" id="mv-desc" name="description"></div>' +
        '<div id="split-box" class="hidden">' +
          '<div class="field"><label for="mv-pct">% que se queda Vendo</label><input class="input" id="mv-pct" type="number" name="vendo_share_pct" min="0" max="100" step="0.01" value="50"></div>' +
          '<div class="split-preview"><span>Vendo recibe: <strong id="sp-vendo" style="color:var(--t-primary)">$0.00</strong></span><span>Socio recibe: <strong id="sp-partner">$0.00</strong></span></div>' +
        '</div>' +
        '<p id="mov-err" class="alert alert--error hidden"></p>' +
        '<div class="modal-actions"><button class="btn" type="submit">Guardar</button><button class="btn btn--ghost" type="button" data-close>Cancelar</button></div>' +
      '</form>');

    var form = $('#mov-form');
    var kindSel = $('#mv-kind'), catSel = $('#mv-cat'), amt = $('#mv-amt'), pct = $('#mv-pct'), splitBox = $('#split-box');
    kindSel.value = kind;
    function refreshCats() {
      var list = kindSel.value === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      catSel.innerHTML = list.map(function (c) { return '<option value="' + c + '">' + esc(catLabel(c)) + '</option>'; }).join('');
      refreshSplit();
    }
    function refreshSplit() {
      var shared = kindSel.value === 'income' && SHARED.indexOf(catSel.value) !== -1;
      splitBox.classList.toggle('hidden', !shared);
      if (shared) {
        var cents = Math.round((parseFloat(amt.value || '0') || 0) * 100);
        var p = parseFloat(pct.value || '0') || 0;
        var v = Math.round((cents * p) / 100);
        $('#sp-vendo').textContent = fmt(v);
        $('#sp-partner').textContent = fmt(cents - v);
      }
    }
    kindSel.addEventListener('change', refreshCats);
    catSel.addEventListener('change', refreshSplit);
    amt.addEventListener('input', refreshSplit);
    pct.addEventListener('input', refreshSplit);
    refreshCats();

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = $('#mov-err'); err.classList.add('hidden');
      var fd = new FormData(form);
      var body = {
        kind: fd.get('kind'), category: fd.get('category'), amount_usd: fd.get('amount_usd'),
        date: fd.get('date') || undefined, description: fd.get('description') || undefined, client_id: fd.get('client_id') || undefined,
      };
      if (kindSel.value === 'income' && SHARED.indexOf(catSel.value) !== -1) body.vendo_share_pct = parseFloat(pct.value || '50');
      try {
        await api('/movements', { method: 'POST', body: body });
        closeModal(); toast('Movimiento registrado', 'ok');
        if (view === 'dashboard') viewDashboard(state.summaryRange);
        else if (view === 'movimientos') loadMovementsTable();
        loadBell();
      } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
    });
  }

  /* ------------------------------ clientes ------------------------------ */
  async function loadClientsCache() {
    try { var d = await api('/clients'); state.clients = d.clients || []; } catch (e) { /* noop */ }
  }
  async function viewClients() {
    var el = $('#view');
    el.innerHTML =
      '<div class="section-head"><h2>Clientes</h2><button class="btn btn--sm" id="new-client">+ Nuevo cliente</button></div>' +
      '<div class="filters"><input class="input" id="c-q" placeholder="Buscar por nombre, correo o WhatsApp…" style="min-width:280px"></div>' +
      '<div class="card tbl-wrap" id="clients-list"></div>';
    $('#new-client').addEventListener('click', function () { clientModal(); });
    var timer;
    $('#c-q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(loadClients, 250); });
    loadClients();
  }
  async function loadClients() {
    var el = $('#clients-list');
    el.innerHTML = '<div class="list-empty">Cargando…</div>';
    var q = $('#c-q') ? $('#c-q').value : '';
    try {
      var d = await api('/clients' + (q ? '?q=' + encodeURIComponent(q) : ''));
      state.clients = d.clients || [];
      if (!state.clients.length) { el.innerHTML = '<div class="list-empty">Aún no hay clientes. Crea el primero.</div>'; return; }
      el.innerHTML = '<table class="tbl"><thead><tr><th>Cliente</th><th>Servicios</th><th>Etiqueta</th><th>Pagos</th><th class="actions"></th></tr></thead><tbody>' +
        state.clients.map(function (c) {
          var svcBadges = (c.services || []).map(function (s) { return '<span class="badge badge--ghost" style="margin:2px">' + esc(svcLabel(s.service_type)) + '</span>'; }).join('') || '<span class="muted small">Sin servicios</span>';
          var status = c.worst_status ? '<span class="dot-status" style="background:' + DOT_CLASS[c.worst_status] + '"></span>' + esc(STATUS_LABELS[c.worst_status]) : '<span class="muted small">—</span>';
          return '<tr><td><strong>' + esc(c.full_name) + '</strong><div class="small muted">' + esc(c.email || c.whatsapp_number || '—') + '</div></td>' +
            '<td>' + svcBadges + '</td>' +
            '<td>' + (c.is_entrepreneur ? '<span class="badge">Emprendedor</span>' : '<span class="muted small">—</span>') + '</td>' +
            '<td>' + status + '</td>' +
            '<td class="actions"><button class="btn btn--sm btn--outline" data-client="' + c.id + '" type="button">Ver ficha</button></td></tr>';
        }).join('') + '</tbody></table>';
      $$('[data-client]', el).forEach(function (b) { b.addEventListener('click', function () { clientDetailModal(b.dataset.client); }); });
    } catch (e) { el.innerHTML = '<div class="alert alert--error">' + esc(e.message) + '</div>'; }
  }

  function clientModal() {
    openModal(
      '<h3 style="font-size:19px;margin-bottom:14px">Nuevo cliente</h3>' +
      '<form id="client-form" class="form-grid">' +
        '<div class="field"><label for="cl-name">Nombre completo *</label><input class="input" id="cl-name" name="full_name" required></div>' +
        '<div class="form-grid cols-2">' +
          '<div class="field"><label for="cl-email">Correo</label><input class="input" id="cl-email" type="email" name="email"></div>' +
          '<div class="field"><label for="cl-wa">WhatsApp (dígitos con código país)</label><input class="input" id="cl-wa" name="whatsapp_number" placeholder="584121234567"></div>' +
        '</div>' +
        '<div class="field"><label for="cl-notes">Notas</label><input class="input" id="cl-notes" name="notes"></div>' +
        '<p id="cl-err" class="alert alert--error hidden"></p>' +
        '<div class="modal-actions"><button class="btn" type="submit">Crear cliente</button><button class="btn btn--ghost" type="button" data-close>Cancelar</button></div>' +
      '</form>');
    var form = $('#client-form');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = $('#cl-err'); err.classList.add('hidden');
      var fd = new FormData(form);
      try {
        await api('/clients', { method: 'POST', body: {
          full_name: fd.get('full_name'), email: fd.get('email') || undefined,
          whatsapp_number: fd.get('whatsapp_number') || undefined, notes: fd.get('notes') || undefined,
        } });
        closeModal(); toast('Cliente creado', 'ok');
        await loadClientsCache();
        if (view === 'clientes') loadClients();
      } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
    });
  }

  function clientDetailModal(clientId) {
    var client = (state.clients || []).find(function (c) { return c.id === clientId; });
    if (!client) return;
    var services = client.services || [];
    var svcHtml = services.length ? services.map(function (s) {
      return '<div class="svc-line">' +
        '<div><strong>' + esc(svcLabel(s.service_type)) + '</strong><div class="small muted">' + fmt(s.amount_cents) + ' · ' + esc(PAYMENT_KIND_LABELS[s.payment_kind] || s.payment_kind) +
          (s.next_due_date ? ' · vence ' + esc(s.next_due_date) : '') + '</div></div>' +
        '<button class="btn btn--sm" data-pay="' + s.id + '" data-amt="' + (s.amount_cents / 100) + '" type="button">Registrar pago</button>' +
      '</div>';
    }).join('') : '<p class="list-empty small">Sin servicios.</p>';

    openModal(
      '<div class="between" style="margin-bottom:6px"><h3 style="font-size:19px;margin:0">' + esc(client.full_name) + '</h3>' +
        (client.is_entrepreneur ? '<span class="badge">Emprendedor</span>' : '') + '</div>' +
      '<p class="small muted" style="margin-bottom:14px">' + esc(client.email || 'sin correo') + ' · ' + esc(client.whatsapp_number || 'sin WhatsApp') + '</p>' +
      '<h4 style="font-size:14px;margin:0 0 6px">Servicios</h4>' + svcHtml +
      '<h4 style="font-size:14px;margin:16px 0 8px">Agregar servicio</h4>' +
      '<form id="svc-form" class="form-grid">' +
        '<div class="form-grid cols-2">' +
          '<div class="field"><label for="sv-type">Servicio</label><select class="select" id="sv-type" name="service_type">' +
            Object.keys(SERVICE_LABELS).map(function (k) { return '<option value="' + k + '">' + esc(SERVICE_LABELS[k]) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="sv-kind">Forma de pago</label><select class="select" id="sv-kind" name="payment_kind"><option value="one_time">Pago único</option><option value="recurring">Mensual recurrente</option></select></div>' +
          '<div class="field"><label for="sv-amt">Precio (USD)</label><input class="input" id="sv-amt" name="amount_usd" inputmode="decimal" placeholder="15.00" required></div>' +
          '<div class="field" id="sv-day-wrap" style="display:none"><label for="sv-day">Día de cobro (1–28)</label><input class="input" id="sv-day" name="billing_day" type="number" min="1" max="28" value="1"></div>' +
        '</div>' +
        '<p id="sv-err" class="alert alert--error hidden"></p>' +
        '<div class="modal-actions"><button class="btn" type="submit">Agregar servicio</button><button class="btn btn--ghost" type="button" data-close>Cerrar</button></div>' +
      '</form>');

    $$('[data-pay]', $('#modal-panel')).forEach(function (b) {
      b.addEventListener('click', function () { paymentModal(client.id, b.dataset.pay, b.dataset.amt); });
    });
    var kindSel = $('#sv-kind'), dayWrap = $('#sv-day-wrap');
    kindSel.addEventListener('change', function () { dayWrap.style.display = kindSel.value === 'recurring' ? '' : 'none'; });
    $('#svc-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = $('#sv-err'); err.classList.add('hidden');
      var fd = new FormData(e.target);
      var body = { service_type: fd.get('service_type'), payment_kind: fd.get('payment_kind'), amount_usd: fd.get('amount_usd') };
      if (body.payment_kind === 'recurring') body.billing_day = parseInt(fd.get('billing_day') || '1', 10);
      try {
        await api('/clients/' + encodeURIComponent(client.id) + '/services', { method: 'POST', body: body });
        toast('Servicio agregado', 'ok');
        await loadClientsCache();
        clientDetailModal(client.id);
      } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
    });
  }

  function paymentModal(clientId, serviceId, amountUsd) {
    var client = (state.clients || []).find(function (c) { return c.id === clientId; });
    var service = client ? (client.services || []).find(function (s) { return s.id === serviceId; }) : null;
    var category = service ? (SERVICE_TO_CATEGORY[service.service_type] || 'web_sale') : 'web_sale';
    var shared = SHARED.indexOf(category) !== -1;
    openModal(
      '<h3 style="font-size:19px;margin-bottom:14px">Registrar pago</h3>' +
      '<p class="small muted" style="margin-bottom:12px">' + esc(client ? client.full_name : '') + (service ? ' · ' + esc(svcLabel(service.service_type)) : '') + '</p>' +
      '<form id="pay-form" class="form-grid">' +
        '<div class="form-grid cols-2">' +
          '<div class="field"><label for="pay-amt">Monto (USD)</label><input class="input" id="pay-amt" name="amount_usd" inputmode="decimal" value="' + esc(amountUsd || '') + '" required></div>' +
          '<div class="field"><label for="pay-date">Fecha</label><input class="input" id="pay-date" type="date" name="date"></div>' +
        '</div>' +
        '<div id="pay-split" class="' + (shared ? '' : 'hidden') + '">' +
          '<div class="field"><label for="pay-pct">% que se queda Vendo</label><input class="input" id="pay-pct" type="number" min="0" max="100" step="0.01" value="50"></div>' +
        '</div>' +
        '<p id="pay-err" class="alert alert--error hidden"></p>' +
        '<div class="modal-actions"><button class="btn" type="submit">Registrar pago</button><button class="btn btn--ghost" type="button" data-close>Cancelar</button></div>' +
      '</form>');
    $('#pay-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = $('#pay-err'); err.classList.add('hidden');
      var fd = new FormData(e.target);
      var body = { client_service_id: serviceId, amount_usd: fd.get('amount_usd'), date: fd.get('date') || undefined };
      if (shared) body.vendo_share_pct = parseFloat($('#pay-pct').value || '50');
      try {
        await api('/payments', { method: 'POST', body: body });
        closeModal(); toast('Pago registrado', 'ok');
        await loadClientsCache();
        if (view === 'clientes') loadClients();
        else if (view === 'cobros') viewCobros();
        loadBell();
      } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
    });
  }

  /* ------------------------------ cobros ------------------------------ */
  async function viewCobros() {
    var el = $('#view');
    el.innerHTML = '<div class="section-head"><h2>Cobros recurrentes</h2></div><div class="card tbl-wrap" id="cobros-table"></div>';
    var t = $('#cobros-table');
    t.innerHTML = '<div class="list-empty">Cargando…</div>';
    try {
      var d = await api('/cobros');
      var rows = d.cobros || [];
      if (!rows.length) { t.innerHTML = '<div class="list-empty">No hay membresías. Crea un cliente con servicio mensual.</div>'; return; }
      t.innerHTML = '<table class="tbl"><thead><tr><th>Cliente</th><th>Servicio</th><th>Próximo pago</th><th class="num">Monto</th><th>Estado</th><th class="num">Mora</th><th class="actions">Acciones</th></tr></thead><tbody>' +
        rows.map(function (c) {
          var wa = c.whatsapp_url ? '<a class="btn btn--sm btn--ghost" href="' + esc(c.whatsapp_url) + '" target="_blank" rel="noopener">WhatsApp</a>' : '';
          return '<tr><td><strong>' + esc(c.client_name) + '</strong></td>' +
            '<td>' + esc(svcLabel(c.service_type)) + '</td>' +
            '<td>' + esc(c.next_due_date) + '</td>' +
            '<td class="num">' + fmt(c.amount_cents) + '</td>' +
            '<td><span class="status ' + (STATUS_CLASS[c.status] || 'status--pendiente') + '">' + esc(STATUS_LABELS[c.status] || c.status) + '</span></td>' +
            '<td class="num">' + (c.days_overdue > 0 ? '<span style="color:var(--danger)">' + c.days_overdue + ' d</span>' : '—') + '</td>' +
            '<td class="actions"><button class="btn btn--sm" data-cpay="' + c.client_service_id + '" data-cclient="' + c.client_id + '" data-amt="' + (c.amount_cents / 100) + '" type="button">Registrar pago</button> ' + wa + '</td></tr>';
        }).join('') + '</tbody></table>';
      $$('[data-cpay]', t).forEach(function (b) {
        b.addEventListener('click', function () { paymentModal(b.dataset.cclient, b.dataset.cpay, b.dataset.amt); });
      });
    } catch (e) { t.innerHTML = '<div class="alert alert--error">' + esc(e.message) + '</div>'; }
  }

  /* ------------------------------ ajustes ------------------------------ */
  async function viewSettings() {
    var el = $('#view');
    el.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    var d;
    try { d = await api('/settings'); } catch (e) { el.innerHTML = '<div class="alert alert--error">' + esc(e.message) + '</div>'; return; }
    var s = d.settings || {};
    state.settings = s;
    el.innerHTML =
      '<div class="section-head"><h2>Ajustes</h2></div>' +
      '<div class="card" style="padding:18px;margin-bottom:16px">' +
        '<h3 style="font-size:15px;margin:0 0 12px">Ganancias compartidas y cobros</h3>' +
        '<form id="set-form" class="form-grid">' +
          '<div class="form-grid cols-2">' +
            '<div class="field"><label for="st-photo">% Vendo en fotografía</label><input class="input" id="st-photo" name="photography_vendo_pct" type="number" min="0" max="100" step="0.01" value="' + esc(s.photography_vendo_pct) + '"></div>' +
            '<div class="field"><label for="st-brand">% Vendo en creación de marca</label><input class="input" id="st-brand" name="branding_vendo_pct" type="number" min="0" max="100" step="0.01" value="' + esc(s.branding_vendo_pct) + '"></div>' +
            '<div class="field"><label for="st-warn">Días de advertencia previa</label><input class="input" id="st-warn" name="days_before_due_warning" type="number" min="0" max="60" value="' + esc(s.days_before_due_warning) + '"></div>' +
            '<div class="field"><label for="st-susp">Días de mora para suspensión</label><input class="input" id="st-susp" name="days_overdue_to_suspend" type="number" min="0" max="120" value="' + esc(s.days_overdue_to_suspend) + '"></div>' +
          '</div>' +
          '<div class="field"><label for="st-wa">Plantilla WhatsApp</label><textarea class="input" id="st-wa" name="whatsapp_reminder_template" rows="4">' + esc(s.whatsapp_reminder_template) + '</textarea></div>' +
          '<div class="field"><label for="st-subj">Asunto del correo</label><input class="input" id="st-subj" name="email_reminder_subject" value="' + esc(s.email_reminder_subject) + '"></div>' +
          '<div class="field"><label for="st-body">Plantilla de correo</label><textarea class="input" id="st-body" name="email_reminder_template" rows="4">' + esc(s.email_reminder_template) + '</textarea></div>' +
          '<p class="small muted">Variables: {nombre} {monto} {servicio} {fecha} {dias_mora}</p>' +
          '<p id="set-err" class="alert alert--error hidden"></p>' +
          '<div class="modal-actions" style="max-width:260px"><button class="btn" type="submit">Guardar ajustes</button></div>' +
        '</form>' +
      '</div>' +
      '<div class="card tbl-wrap" style="padding:0"><div style="padding:16px 16px 0"><h3 style="font-size:15px;margin:0">Historial de cambios</h3></div><div id="audit-table" style="padding:0 16px 16px"></div></div>';

    $('#set-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = $('#set-err'); err.classList.add('hidden');
      var fd = new FormData(e.target);
      var body = {};
      fd.forEach(function (v, k) { body[k] = v; });
      try { await api('/settings', { method: 'PUT', body: body }); toast('Ajustes guardados', 'ok'); viewSettings(); }
      catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
    });
    loadAudit();
  }
  async function loadAudit() {
    var el = $('#audit-table');
    if (!el) return;
    try {
      var d = await api('/audit');
      var rows = d.audit || [];
      if (!rows.length) { el.innerHTML = '<div class="list-empty small">Sin registros.</div>'; return; }
      el.innerHTML = '<table class="tbl"><thead><tr><th>Fecha</th><th>Admin</th><th>Tabla</th><th>Acción</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td class="muted">' + esc(r.created_at) + '</td><td>' + esc(r.user_name || 'Sistema') + '</td><td>' + esc(r.table_name) + '</td><td><span class="badge badge--ghost">' + esc(r.action) + '</span></td></tr>';
        }).join('') + '</tbody></table>';
    } catch (e) { el.innerHTML = '<div class="alert alert--error">' + esc(e.message) + '</div>'; }
  }

  /* ------------------------------ arranque ------------------------------ */
  function refreshAll() {
    loadBell();
    loadClientsCache();
    render(currentView());
  }

  function bind() {
    $('#menu-btn').addEventListener('click', function () { $('#app-view').classList.toggle('nav-open'); });
    $('#bell-btn').addEventListener('click', function (e) { e.stopPropagation(); toggleBell(); });
    $('#logout-btn').addEventListener('click', signOut);
    document.addEventListener('click', function (e) {
      var p = $('#bell-panel');
      if (p && !p.classList.contains('hidden') && !e.target.closest('.bell-wrap')) p.classList.add('hidden');
    });
    window.addEventListener('hashchange', function () { render(currentView()); });
  }

  function boot() {
    bind();
    loadGsi();
    var token = null, email = null;
    try { token = sessionStorage.getItem('vendo_admin_token'); email = sessionStorage.getItem('vendo_admin_email'); } catch (e) { /* noop */ }
    if (token) { setToken(token, email); }
    else { showLogin(); }

    // Hook de integración/pruebas.
    window.VendoAdmin = {
      setToken: setToken,
      signOut: signOut,
      refresh: refreshAll,
      state: state,
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
