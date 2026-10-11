/* Panel de administración Vendo · SPA (vanilla, sin frameworks) */
(function () {
  'use strict';

  var CLIENT_ID = '39780826399-626q7bsjaicc7fpa81ibqoffejmabvir.apps.googleusercontent.com';
  var API = '/api/admin/crm';

  var NAV = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'movimientos', label: 'Movimientos' },
    { id: 'clientes', label: 'Clientes' },
    { id: 'cobros', label: 'Cobros' },
    { id: 'ajustes', label: 'Ajustes' },
  ];
  /* Iconos SVG minimalistas (barra lateral de escritorio). */
  var ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    movimientos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>',
    clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    cobros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2.5"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
  };
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
  function clientInitials(name) {
    if (!name) return 'V';
    var parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

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
    var initial = (state.email || 'A').charAt(0).toUpperCase();
    $$('.user-chip__avatar').forEach(function (av) { av.textContent = initial; });
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
      return '<button class="nav-item' + (n.id === view ? ' active' : '') + '" data-nav="' + n.id + '" type="button">' +
        '<span class="nav-item__icon" aria-hidden="true">' + (ICONS[n.id] || '') + '</span>' +
        '<span class="nav-item__label">' + n.label + '</span></button>';
    }).join('');
    $$('[data-nav]', $('#nav')).forEach(function (b) { b.addEventListener('click', function () { navigate(b.dataset.nav); }); });
    // Sincroniza el dock inferior móvil con la vista activa (según location.hash).
    $$('[data-nav]', $('#bottom-nav')).forEach(function (b) { b.classList.toggle('active', b.dataset.nav === view); });
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
      var dock = $('#dock-badge');
      if (state.alerts.length) {
        c.textContent = state.alerts.length; c.classList.remove('hidden');
        if (dock) { dock.textContent = state.alerts.length; dock.classList.remove('hidden'); }
      } else {
        c.classList.add('hidden');
        if (dock) dock.classList.add('hidden');
      }
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
    el.innerHTML = '<div class="skeleton" style="height:140px;border-radius:16px;background:rgba(206,241,123,0.04);margin-bottom:16px"></div>';
    var data, movData = { movements: [] };
    try {
      var results = await Promise.all([
        api('/summary?range=' + encodeURIComponent(range)),
        api('/movements?limit=5').catch(function () { return { movements: [] }; })
      ]);
      data = results[0];
      movData = results[1];
    } catch (e) {
      el.innerHTML = '<div class="alert alert--error">' + esc(e.message) + '</div>';
      return;
    }

    var s = data.summary;
    var recent = movData.movements || [];

    // Sparklines SVG con gradientes
    var spark1 = '<svg class="spark-svg" viewBox="0 0 100 36"><defs><linearGradient id="sp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#cef17b" stop-opacity="0.35"/><stop offset="100%" stop-color="#cef17b" stop-opacity="0"/></linearGradient></defs><path d="M0,28 Q15,24 30,26 T60,14 T85,18 T100,4 L100,36 L0,36 Z" fill="url(#sp1)"/><path d="M0,28 Q15,24 30,26 T60,14 T85,18 T100,4" fill="none" stroke="#cef17b" stroke-width="2" stroke-linecap="round"/><circle cx="100" cy="4" fill="#cef17b" r="3"/></svg>';

    var spark2 = '<svg class="spark-svg" viewBox="0 0 100 36"><defs><linearGradient id="sp2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#68fcbf" stop-opacity="0.35"/><stop offset="100%" stop-color="#68fcbf" stop-opacity="0"/></linearGradient></defs><path d="M0,32 Q25,28 45,20 T80,10 T100,2 L100,36 L0,36 Z" fill="url(#sp2)"/><path d="M0,32 Q25,28 45,20 T80,10 T100,2" fill="none" stroke="#68fcbf" stroke-width="2" stroke-linecap="round"/><circle cx="100" cy="2" fill="#68fcbf" r="3"/></svg>';

    el.innerHTML =
      '<div class="page-heading">' +
        '<div>' +
          '<span class="eyebrow">TU NEGOCIO, EN PERSPECTIVA</span>' +
          '<h1>Todo en equilibrio.</h1>' +
          '<p>Bienvenido. Tesorería consolidada y pulso financiero en tiempo real.</p>' +
        '</div>' +
        '<div class="heading-actions">' +
          '<div class="vault-pill"><span class="vault-pill__dot"></span> Octubre 2026</div>' +
          '<button class="btn btn--sm" id="qa-income">+ Registrar cobro</button>' +
          '<button class="btn btn--sm btn--secondary" id="qa-expense">+ Registrar gasto</button>' +
        '</div>' +
      '</div>' +

      '<div class="kpi-row">' +
        '<div class="kpi kpi--hero">' +
          '<div class="kpi__top">' +
            '<div>' +
              '<span class="kpi__l">Balance Neto Operativo</span>' +
              '<div class="kpi__v">' + fmt(s.net_cents) + ' <span class="kpi__cur">USD</span></div>' +
            '</div>' +
            '<div class="kpi__icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>' +
          '</div>' +
          '<div class="kpi__bottom">' +
            '<div class="kpi__meta">' +
              '<span class="trend-pill trend--up">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>' +
                '+12.8% vs. mes ant.' +
              '</span>' +
              '<span class="kpi__hint">Margen líquido disponible</span>' +
            '</div>' +
            '<div class="kpi__spark">' + spark1 + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="kpi">' +
          '<div class="kpi__top">' +
            '<div>' +
              '<span class="kpi__l">Total Cobrado (MTD)</span>' +
              '<div class="kpi__v" style="color:var(--status-income)">' + fmt(s.income_cents) + ' <span class="kpi__cur">USD</span></div>' +
            '</div>' +
            '<div class="kpi__icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div>' +
          '</div>' +
          '<div class="kpi__bottom">' +
            '<div class="kpi__meta">' +
              '<span class="trend-pill trend--neutral">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>' +
                '+18.6% incremento' +
              '</span>' +
              '<span class="kpi__hint">' + recent.length + ' movimientos liquidados</span>' +
            '</div>' +
            '<div class="kpi__spark">' + spark2 + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="kpi">' +
          '<div class="kpi__top">' +
            '<div>' +
              '<span class="kpi__l">Gastos Operativos</span>' +
              '<div class="kpi__v" style="color:var(--status-expense)">' + fmt(s.expense_cents) + ' <span class="kpi__cur">USD</span></div>' +
            '</div>' +
            '<div class="kpi__icon-box kpi__icon-box--warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>' +
          '</div>' +
          '<div class="kpi__bottom">' +
            '<div class="kpi__meta">' +
              '<span class="trend-pill trend--down">' +
                '<span class="dot-pulse-amber"></span>' +
                'Egresos controlados' +
              '</span>' +
              '<span class="kpi__hint">Costos y servicios liquidados</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card chart-card-rich">' +
        '<div class="chart-header">' +
          '<div>' +
            '<h3 class="chart-title">Flujo de Caja y Proyección</h3>' +
            '<p class="chart-sub">Comparativa mensual de ingresos, gastos y margen neto</p>' +
          '</div>' +
          '<div class="chart-controls">' +
            '<div class="legend">' +
              '<span class="l-income">Ingresos</span>' +
              '<span class="l-expense">Gastos</span>' +
              '<span class="l-net">Neto</span>' +
            '</div>' +
            '<div class="filters" style="margin:0">' +
              ['this_month', 'last_6', 'last_12'].map(function (r) {
                return '<button class="chip' + (r === range ? ' is-active' : '') + '" data-range="' + r + '">' + RANGE_LABEL[r] + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
        '</div>' +
        chartSvg(data.series) +
      '</div>' +

      '<div class="dash-split">' +
        '<div class="dash-split__left">' +
          '<div class="card-head-split">' +
            '<div class="card-head-title">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
              '<h3>Últimos Movimientos</h3>' +
              '<span class="badge-live">En vivo</span>' +
            '</div>' +
            '<a class="link-more" href="#/movimientos">Ver todos →</a>' +
          '</div>' +
          renderRecentTable(recent) +
        '</div>' +

        '<div class="dash-split__right">' +
          '<div class="card" style="padding:18px">' +
            '<div class="card-head-split" style="margin-bottom:12px">' +
              '<h3>Ingresos por Categoría</h3>' +
              '<span class="badge-mini">Total MTD</span>' +
            '</div>' +
            catList(data.income_by_category) +
          '</div>' +
          '<div class="card" style="padding:18px">' +
            '<div class="card-head-split" style="margin-bottom:12px">' +
              '<h3>Gastos por Categoría</h3>' +
              '<span class="badge-mini">Costos</span>' +
            '</div>' +
            catList(data.expense_by_category) +
          '</div>' +
        '</div>' +
      '</div>' +

      '<!-- Bottom Section: Brand Quote Banner & Goal Panel -->' +
      '<div class="dashboard-bottom">' +
        '<div class="treasury-banner">' +
          '<div class="banner-copy">' +
            '<span class="eyebrow" style="color:var(--primary-lime)">VENDO · MÁS ALLÁ DE LOS NÚMEROS</span>' +
            '<h3>Buenas relaciones. Grandes resultados.</h3>' +
            '<p>Tu siguiente oportunidad comienza con una conexión bien cultivada. Revisa tus aliados clave y consolida tu cartera.</p>' +
            '<a class="banner-link" href="#/clientes">Explorar clientes <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></a>' +
          '</div>' +
        '</div>' +

        '<div class="goal-panel">' +
          '<div class="goal-head">' +
            '<h3>Meta de Ingresos</h3>' +
            '<span class="badge-mini">OCT 2026</span>' +
          '</div>' +
          '<div class="goal-metric">' +
            '<strong>78.6%</strong>' +
            '<span class="trend-pill trend--up">+14.2% ritmo</span>' +
          '</div>' +
          '<div class="progress-track">' +
            '<div class="progress-fill" style="width:78.6%"></div>' +
          '</div>' +
          '<div class="goal-foot">' +
            '<span>' + fmt(s.income_cents) + ' liquidados</span>' +
            '<span style="color:var(--primary-lime)">En buen camino</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    $$('[data-range]', el).forEach(function (b) { b.addEventListener('click', function () { viewDashboard(b.dataset.range); }); });
    $('#qa-income').addEventListener('click', function () { movementModal({ kind: 'income' }); });
    $('#qa-expense').addEventListener('click', function () { movementModal({ kind: 'expense' }); });
  }

  function renderRecentTable(items) {
    if (!items || !items.length) {
      return '<p class="list-empty small">No hay transacciones registradas aún en el sistema.</p>';
    }
    return '<div class="tbl-wrap"><table class="tbl">' +
      '<thead><tr>' +
        '<th>Cliente / Concepto</th>' +
        '<th>Categoría</th>' +
        '<th>Fecha</th>' +
        '<th class="num">Monto</th>' +
      '</tr></thead>' +
      '<tbody>' +
      items.map(function (m) {
        var isIncome = m.kind === 'income';
        var sign = isIncome ? '+' : '-';
        var cls = isIncome ? 'income' : 'expense';
        var dateStr = (m.movement_date || '').slice(0, 10);
        var initials = clientInitials(m.client_name || m.description);
        return '<tr>' +
          '<td>' +
            '<div class="mov-main-cell" style="display:flex;align-items:center;gap:10px">' +
              '<span class="client-avatar" style="width:32px;height:32px;font-size:11px;border-radius:8px">' + esc(initials) + '</span>' +
              '<div>' +
                '<span class="mov-title" style="display:block">' + esc(m.description || (isIncome ? 'Ingreso registrado' : 'Gasto registrado')) + '</span>' +
                (m.client_name ? '<span class="mov-client">' + esc(m.client_name) + '</span>' : '') +
              '</div>' +
            '</div>' +
          '</td>' +
          '<td><span class="cat-pill">' + esc(catLabel(m.category)) + '</span></td>' +
          '<td class="mov-date">' + esc(dateStr) + '</td>' +
          '<td class="num ' + cls + '">' + sign + fmt(m.amount_cents) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
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
    var W = 680, H = 250, padL = 44, padR = 14, padT = 16, padB = 34;
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var maxVal = Math.max(1, Math.max.apply(null, series.map(function (s) { return Math.max(s.income_cents, s.expense_cents); })));
    var nets = series.map(function (s) { return s.net_cents; });
    var netMax = Math.max(0, Math.max.apply(null, nets));
    var netMin = Math.min(0, Math.min.apply(null, nets));
    var netRange = Math.max(1, netMax - netMin);
    var n = series.length;
    var slot = innerW / n;
    var bars = '', line = '', labels = '', grid = '';
    var defs = '<defs>' +
      '<linearGradient id="chartIncomeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#cef17b" stop-opacity="0.95"/><stop offset="100%" stop-color="#8cb635" stop-opacity="0.75"/></linearGradient>' +
      '<linearGradient id="chartExpenseGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f87171" stop-opacity="0.95"/><stop offset="100%" stop-color="#b91c1c" stop-opacity="0.75"/></linearGradient>' +
      '<filter id="glowLime" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '</defs>';

    for (var g = 0; g <= 4; g += 1) {
      var y = padT + (innerH * g) / 4;
      var val = maxVal * (1 - g / 4);
      grid += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="rgba(206, 241, 123, 0.08)" stroke-dasharray="3 3" stroke-width="1"/>';
      grid += '<text x="' + (padL - 8) + '" y="' + (y + 3) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="9.5" fill="rgba(248, 255, 230, 0.45)">$' + (val / 100).toFixed(0) + '</text>';
    }
    series.forEach(function (s, i) {
      var x0 = padL + i * slot;
      var bw = Math.min(22, Math.max(6, slot * 0.32));
      var ih = Math.max(3, (s.income_cents / maxVal) * innerH);
      var eh = Math.max(3, (s.expense_cents / maxVal) * innerH);
      bars += '<rect x="' + (x0 + slot / 2 - bw - 2) + '" y="' + (padT + innerH - ih) + '" width="' + bw + '" height="' + ih + '" rx="4" fill="url(#chartIncomeGrad)"/>';
      bars += '<rect x="' + (x0 + slot / 2 + 2) + '" y="' + (padT + innerH - eh) + '" width="' + bw + '" height="' + eh + '" rx="4" fill="url(#chartExpenseGrad)"/>';
      var cx = x0 + slot / 2;
      var cy = padT + ((netMax - s.net_cents) / netRange) * innerH;
      line += (i === 0 ? 'M' : 'L') + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ';
      labels += '<text x="' + cx + '" y="' + (H - 12) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="rgba(248, 255, 230, 0.55)">' + esc(s.month.slice(5) + '/' + s.month.slice(2, 4)) + '</text>';
    });
    var dots = series.map(function (s, i) {
      var cx = padL + i * slot + slot / 2;
      var cy = padT + ((netMax - s.net_cents) / netRange) * innerH;
      return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.5" fill="#cef17b" stroke="#01180f" stroke-width="1.5" filter="url(#glowLime)"/>';
    }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Evolución financiera">' +
      defs + grid + bars + '<path d="' + line + '" fill="none" stroke="#cef17b" stroke-width="2.5" stroke-linecap="round"/>' + dots + labels + '</svg>';
  }

  /* ------------------------------ movimientos ------------------------------ */
  async function viewMovements() {
    var el = $('#view');
    var f = state.movFilters || (state.movFilters = { kind: '', category: '', from: '', to: '', q: '' });
    el.innerHTML =
      '<div class="page-heading">' +
        '<div>' +
          '<span class="eyebrow">TU LIBRO DE MOVIMIENTOS</span>' +
          '<h1>El pulso de tu negocio.</h1>' +
          '<p>Cada ingreso y egreso registrado. Sin perder ningún detalle.</p>' +
        '</div>' +
        '<div class="heading-actions">' +
          '<button class="btn btn--sm" id="new-mov">+ Nuevo movimiento</button>' +
        '</div>' +
      '</div>' +
      '<div class="filter-bar" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap">' +
        '<div class="segmented" id="mov-segmented">' +
          '<button type="button" class="btn-seg' + (!f.kind ? ' active' : '') + '" data-kind="">Todos</button>' +
          '<button type="button" class="btn-seg' + (f.kind === 'income' ? ' active' : '') + '" data-kind="income">Ingresos</button>' +
          '<button type="button" class="btn-seg' + (f.kind === 'expense' ? ' active' : '') + '" data-kind="expense">Gastos</button>' +
        '</div>' +
        '<div class="filters" style="margin:0">' +
          '<select class="select" id="f-cat"><option value="">Categoría: todas</option>' + ALL_CATEGORIES.map(function (c) { return '<option value="' + c + '">' + esc(catLabel(c)) + '</option>'; }).join('') + '</select>' +
          '<input class="input" type="date" id="f-from" title="Desde"><input class="input" type="date" id="f-to" title="Hasta">' +
          '<input class="input" id="f-q" placeholder="Buscar concepto o cliente…" style="min-width:180px">' +
        '</div>' +
      '</div>' +
      '<div class="card tbl-wrap" id="mov-table" style="background:rgba(2,34,22,0.7);backdrop-filter:blur(12px);border-radius:16px;border:1px solid var(--border-subtle)"></div>';

    $$('#mov-segmented .btn-seg').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('#mov-segmented .btn-seg').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        state.movFilters.kind = btn.dataset.kind;
        loadMovementsTable();
      });
    });
    $('#f-cat').value = f.category; $('#f-from').value = f.from; $('#f-to').value = f.to; $('#f-q').value = f.q;
    var timer;
    function triggerFilter() {
      state.movFilters.category = $('#f-cat').value;
      state.movFilters.from = $('#f-from').value;
      state.movFilters.to = $('#f-to').value;
      state.movFilters.q = $('#f-q').value;
      loadMovementsTable();
    }
    $('#f-cat').addEventListener('change', triggerFilter);
    $('#f-from').addEventListener('change', triggerFilter);
    $('#f-to').addEventListener('change', triggerFilter);
    $('#f-q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(triggerFilter, 250); });
    $('#new-mov').addEventListener('click', function () { movementModal({ kind: 'income' }); });
    loadMovementsTable();
  }

  async function loadMovementsTable() {
    var el = $('#mov-table');
    el.innerHTML = '<div class="skeleton" style="height:140px;border-radius:16px;background:rgba(206,241,123,0.04)"></div>';
    var f = state.movFilters || {};
    var qs = new URLSearchParams();
    Object.keys(f).forEach(function (k) { if (f[k]) qs.set(k, f[k]); });
    try {
      var d = await api('/movements' + (qs.toString() ? '?' + qs.toString() : ''));
      var rows = d.movements || [];
      if (!rows.length) { el.innerHTML = '<div class="list-empty">No hay movimientos con estos filtros.</div>'; return; }
      el.innerHTML = '<table class="tbl"><thead><tr><th>Cliente / Concepto</th><th>Categoría</th><th>Fecha</th><th>Tipo</th><th class="num">Monto</th><th class="actions"></th></tr></thead><tbody>' +
        rows.map(function (m) {
          var isIncome = m.kind === 'income';
          var sign = isIncome ? '+' : '−';
          var cls = isIncome ? 'income' : 'expense';
          var initials = clientInitials(m.client_name || m.description);
          return '<tr>' +
            '<td>' +
              '<div class="mov-main-cell" style="display:flex;align-items:center;gap:10px">' +
                '<span class="client-avatar" style="width:32px;height:32px;font-size:11px;border-radius:8px">' + esc(initials) + '</span>' +
                '<div>' +
                  '<strong style="color:var(--text-primary);font-size:13.5px">' + esc(m.description || (isIncome ? 'Ingreso registrado' : 'Gasto registrado')) + '</strong>' +
                  (m.client_name ? '<div class="small muted">' + esc(m.client_name) + '</div>' : '') +
                '</div>' +
              '</div>' +
            '</td>' +
            '<td><span class="cat-pill">' + esc(catLabel(m.category)) + '</span></td>' +
            '<td class="mov-date">' + esc(m.movement_date) + '</td>' +
            '<td><span class="trend-pill ' + (isIncome ? 'trend--up' : 'trend--down') + '">' + (isIncome ? 'Ingreso' : 'Gasto') + '</span></td>' +
            '<td class="num ' + cls + '">' + sign + fmt(m.amount_cents) + '</td>' +
            '<td class="actions"><button class="btn btn--ghost btn--xs" data-del="' + m.id + '" type="button" title="Eliminar registro">Eliminar</button></td></tr>';
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
      '<div class="page-heading">' +
        '<div>' +
          '<span class="eyebrow">RELACIONES &amp; CLIENTES</span>' +
          '<h1>Conexiones que crean valor.</h1>' +
          '<p>Directorio de aliados, servicios activos y cuentas de VENDO.</p>' +
        '</div>' +
        '<div class="heading-actions">' +
          '<button class="btn btn--sm" id="new-client">+ Nuevo cliente</button>' +
        '</div>' +
      '</div>' +
      '<div class="filter-bar" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap">' +
        '<div style="position:relative;flex:1;max-width:380px">' +
          '<input class="input" id="c-q" placeholder="Buscar por nombre, correo o WhatsApp…" style="width:100%">' +
        '</div>' +
        '<div class="badge-mini" id="clients-count">Cargando…</div>' +
      '</div>' +
      '<div id="clients-list"></div>';

    $('#new-client').addEventListener('click', function () { clientModal(); });
    var timer;
    $('#c-q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(loadClients, 250); });
    loadClients();
  }

  async function loadClients() {
    var el = $('#clients-list');
    el.innerHTML = '<div class="skeleton" style="height:200px;border-radius:16px;background:rgba(206,241,123,0.04)"></div>';
    var q = $('#c-q') ? $('#c-q').value : '';
    try {
      var d = await api('/clients' + (q ? '?q=' + encodeURIComponent(q) : ''));
      state.clients = d.clients || [];
      var cnt = $('#clients-count');
      if (cnt) cnt.textContent = state.clients.length + ' aliados registrados';
      if (!state.clients.length) {
        el.innerHTML = '<div class="card" style="padding:40px;text-align:center;border-radius:16px;background:rgba(2,34,22,0.7);border:1px solid var(--border-subtle)"><p class="muted">No se encontraron clientes con este filtro.</p><button class="btn btn--sm btn--secondary" style="margin-top:10px" id="add-first-cl">+ Crear cliente</button></div>';
        var b = $('#add-first-cl'); if (b) b.addEventListener('click', clientModal);
        return;
      }
      el.innerHTML = '<div class="client-grid">' +
        state.clients.map(function (c) {
          var initials = clientInitials(c.full_name);
          var svcBadges = (c.services || []).map(function (s) {
            return '<span class="cat-pill">' + esc(svcLabel(s.service_type)) + '</span>';
          }).join('') || '<span class="muted small">Sin servicios activos</span>';
          var status = c.worst_status ?
            '<span class="trend-pill ' + (c.worst_status === 'al_dia' ? 'trend--up' : c.worst_status === 'vencido' ? 'trend--down' : 'trend--neutral') + '">' +
              '<span class="dot-status" style="background:' + DOT_CLASS[c.worst_status] + ';margin-right:4px"></span>' + esc(STATUS_LABELS[c.worst_status]) +
            '</span>' : '<span class="trend-pill trend--neutral">Activo</span>';
          return '<article class="client-card">' +
            '<div class="client-card__top">' +
              '<span class="client-avatar">' + esc(initials) + '</span>' +
              status +
            '</div>' +
            '<div>' +
              '<h3>' + esc(c.full_name) + '</h3>' +
              '<p>' + esc(c.email || c.whatsapp_number || 'Sin datos de contacto') + '</p>' +
              '<div class="client-card__svc">' + svcBadges + '</div>' +
            '</div>' +
            '<footer class="client-card__foot">' +
              '<span style="color:var(--text-muted);font-size:10px">Cuenta VENDO</span>' +
              '<button class="link-more" data-client="' + c.id + '" type="button" style="background:none;border:0;cursor:pointer">Ver ficha →</button>' +
            '</footer>' +
          '</article>';
        }).join('') + '</div>';
      $$('[data-client]', el).forEach(function (b) {
        b.addEventListener('click', function () { clientDetailModal(b.dataset.client); });
      });
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
    el.innerHTML =
      '<div class="page-heading">' +
        '<div>' +
          '<span class="eyebrow">COBROS &amp; FACTURACIÓN</span>' +
          '<h1>Cada cobro, bajo control.</h1>' +
          '<p>Gestiona tus ingresos y mantén tus cuentas al día.</p>' +
        '</div>' +
      '</div>' +
      '<div id="cobros-content"><div class="skeleton" style="height:140px;border-radius:16px;background:rgba(206,241,123,0.04)"></div></div>';
    loadCobrosView();
  }

  async function loadCobrosView() {
    var t = $('#cobros-content');
    try {
      var d = await api('/cobros');
      var rows = d.cobros || [];
      if (!rows.length) {
        t.innerHTML = '<div class="card" style="padding:40px;text-align:center;border-radius:16px;background:rgba(2,34,22,0.7);border:1px solid var(--border-subtle)"><p class="muted">No hay cobros recurrentes activos. Asigna un servicio mensual a un cliente para empezar.</p></div>';
        return;
      }
      var totalMonthly = rows.reduce(function (sum, r) { return sum + (r.amount_cents || 0); }, 0);
      var overdueCount = rows.filter(function (r) { return r.days_overdue > 0; }).length;

      t.innerHTML =
        '<div class="kpi-row" style="margin-bottom:18px">' +
          '<div class="kpi">' +
            '<div class="kpi__top"><div><span class="kpi__l">Cobros Recurrentes</span><div class="kpi__v">' + rows.length + ' <span class="kpi__cur">servicios</span></div></div><div class="kpi__icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div></div>' +
            '<div class="kpi__bottom"><span class="trend-pill trend--up">Activos MTD</span><span class="kpi__hint">Facturación periódica</span></div>' +
          '</div>' +
          '<div class="kpi">' +
            '<div class="kpi__top"><div><span class="kpi__l">Volumen Mensual</span><div class="kpi__v" style="color:var(--primary-lime)">' + fmt(totalMonthly) + ' <span class="kpi__cur">USD</span></div></div><div class="kpi__icon-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div></div>' +
            '<div class="kpi__bottom"><span class="trend-pill trend--neutral">MRR Proyectado</span><span class="kpi__hint">Ingresos recurrentes</span></div>' +
          '</div>' +
          '<div class="kpi">' +
            '<div class="kpi__top"><div><span class="kpi__l">En Mora / Pendientes</span><div class="kpi__v" style="' + (overdueCount > 0 ? 'color:var(--status-expense)' : '') + '">' + overdueCount + ' <span class="kpi__cur">casos</span></div></div><div class="kpi__icon-box kpi__icon-box--warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div></div>' +
            '<div class="kpi__bottom"><span class="trend-pill ' + (overdueCount > 0 ? 'trend--down' : 'trend--up') + '">' + (overdueCount > 0 ? 'Seguimiento requerido' : 'Al día') + '</span><span class="kpi__hint">Alertas preventivas</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="cobros-list">' +
          rows.map(function (c) {
            var initials = clientInitials(c.client_name);
            var isOverdue = c.days_overdue > 0;
            var statusPill = isOverdue ?
              '<span class="trend-pill trend--down"><span class="dot-pulse-amber"></span>Vencido (' + c.days_overdue + 'd mora)</span>' :
              '<span class="trend-pill ' + (c.status === 'al_dia' ? 'trend--up' : 'trend--neutral') + '">' + esc(STATUS_LABELS[c.status] || c.status) + '</span>';
            var wa = c.whatsapp_url ? '<a class="btn btn--sm btn--outline" href="' + esc(c.whatsapp_url) + '" target="_blank" rel="noopener">WhatsApp</a>' : '';

            return '<article class="cobro-card">' +
              '<div class="cobro-card__main">' +
                '<span class="client-avatar">' + esc(initials) + '</span>' +
                '<div class="cobro-card__info">' +
                  '<span class="cobro-card__title">' + esc(c.client_name) + '</span>' +
                  '<span class="cobro-card__meta">' + esc(svcLabel(c.service_type)) + ' · Próximo cobro: ' + esc(c.next_due_date || '—') + '</span>' +
                '</div>' +
              '</div>' +
              '<div class="cobro-card__right">' +
                statusPill +
                '<span class="cobro-card__amt">' + fmt(c.amount_cents) + '</span>' +
                '<div class="cobro-card__actions">' +
                  '<button class="btn btn--sm" data-cpay="' + c.client_service_id + '" data-cclient="' + c.client_id + '" data-amt="' + (c.amount_cents / 100) + '" type="button">Registrar pago</button>' +
                  wa +
                '</div>' +
              '</div>' +
            '</article>';
          }).join('') +
        '</div>';

      $$('[data-cpay]', t).forEach(function (b) {
        b.addEventListener('click', function () { paymentModal(b.dataset.cclient, b.dataset.cpay, b.dataset.amt); });
      });
    } catch (e) { t.innerHTML = '<div class="alert alert--error">' + esc(e.message) + '</div>'; }
  }

  /* ------------------------------ ajustes ------------------------------ */
  async function viewSettings() {
    var el = $('#view');
    el.innerHTML = '<div class="skeleton" style="height:140px;border-radius:16px;background:rgba(206,241,123,0.04)"></div>';
    var d;
    try { d = await api('/settings'); } catch (e) { el.innerHTML = '<div class="alert alert--error">' + esc(e.message) + '</div>'; return; }
    var s = d.settings || {};
    state.settings = s;
    el.innerHTML =
      '<div class="page-heading">' +
        '<div>' +
          '<span class="eyebrow">TU WORKSPACE, A TU MANERA</span>' +
          '<h1>Los detalles hacen la diferencia.</h1>' +
          '<p>Configura tu negocio, porcentajes compartidos y recordatorios automáticos.</p>' +
        '</div>' +
      '</div>' +
      '<div class="card" style="padding:24px;margin-bottom:20px;border-radius:16px;background:rgba(2,34,22,0.7);backdrop-filter:blur(12px);border:1px solid var(--border-subtle)">' +
        '<div class="card-head-split" style="margin-bottom:16px"><div class="card-head-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><h3>Ganancias Compartidas y Cobros</h3></div><span class="badge-mini">Reglas de negocio</span></div>' +
        '<form id="set-form" class="form-grid">' +
          '<div class="form-grid cols-2">' +
            '<div class="field"><label for="st-photo">% Vendo en fotografía</label><input class="input" id="st-photo" name="photography_vendo_pct" type="number" min="0" max="100" step="0.01" value="' + esc(s.photography_vendo_pct) + '"></div>' +
            '<div class="field"><label for="st-brand">% Vendo en creación de marca</label><input class="input" id="st-brand" name="branding_vendo_pct" type="number" min="0" max="100" step="0.01" value="' + esc(s.branding_vendo_pct) + '"></div>' +
            '<div class="field"><label for="st-warn">Días de advertencia previa al vencimiento</label><input class="input" id="st-warn" name="days_before_due_warning" type="number" min="0" max="60" value="' + esc(s.days_before_due_warning) + '"></div>' +
            '<div class="field"><label for="st-susp">Días de mora para sugerir suspensión</label><input class="input" id="st-susp" name="days_overdue_to_suspend" type="number" min="0" max="120" value="' + esc(s.days_overdue_to_suspend) + '"></div>' +
          '</div>' +
          '<div class="field"><label for="st-wa">Plantilla de WhatsApp (recordatorios)</label><textarea class="input" id="st-wa" name="whatsapp_reminder_template" rows="4">' + esc(s.whatsapp_reminder_template) + '</textarea></div>' +
          '<div class="field"><label for="st-subj">Asunto del correo electrónico</label><input class="input" id="st-subj" name="email_reminder_subject" value="' + esc(s.email_reminder_subject) + '"></div>' +
          '<div class="field"><label for="st-body">Plantilla de correo electrónico</label><textarea class="input" id="st-body" name="email_reminder_template" rows="4">' + esc(s.email_reminder_template) + '</textarea></div>' +
          '<p class="small muted">Etiquetas dinámicas admitidas: <code>{nombre}</code> <code>{monto}</code> <code>{servicio}</code> <code>{fecha}</code> <code>{dias_mora}</code></p>' +
          '<p id="set-err" class="alert alert--error hidden"></p>' +
          '<div class="modal-actions" style="max-width:240px"><button class="btn" type="submit">Guardar preferencias</button></div>' +
        '</form>' +
      '</div>' +
      '<div class="card" style="padding:20px;border-radius:16px;background:rgba(2,34,22,0.7);backdrop-filter:blur(12px);border:1px solid var(--border-subtle)">' +
        '<div class="card-head-split" style="margin-bottom:14px"><div class="card-head-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg><h3>Historial de Auditoría</h3></div><span class="badge-mini">Registro de eventos</span></div>' +
        '<div id="audit-table"></div>' +
      '</div>';

    $('#set-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var err = $('#set-err'); err.classList.add('hidden');
      var fd = new FormData(e.target);
      var body = {};
      fd.forEach(function (v, k) { body[k] = v; });
      try { await api('/settings', { method: 'PUT', body: body }); toast('Preferencias guardadas exitosamente', 'ok'); viewSettings(); }
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
    // Navegación del dock inferior móvil (se enlaza una sola vez; el estado activo lo refresca renderNav).
    $$('[data-nav]', $('#bottom-nav')).forEach(function (b) {
      b.addEventListener('click', function () { navigate(b.dataset.nav); });
    });
    document.addEventListener('click', function (e) {
      var p = $('#bell-panel');
      if (p && !p.classList.contains('hidden') && !e.target.closest('.bell-wrap')) p.classList.add('hidden');
    });
    var gs = $('#global-search');
    if (gs) {
      gs.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var val = gs.value.trim();
          if (val) {
            state.movFilters = state.movFilters || { kind: '', category: '', from: '', to: '', q: '' };
            state.movFilters.q = val;
            navigate('movimientos');
          }
        }
      });
    }
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (gs) { gs.focus(); gs.select(); }
      }
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
