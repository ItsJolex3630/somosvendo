import {
  ApiError,
  api,
  copyText,
  debounce,
  digits,
  el,
  escapeHtml,
  formatDate,
  initials,
  money,
  qs,
  qsa,
  statusMeta,
  timeAgo,
  toast,
  waLink,
} from '../assets/js/app.js';

const GOOGLE_CLIENT_ID = '589629831378-quob4rn9tsrakbic150m4soedkek4tvk.apps.googleusercontent.com';

const state = { token: null, email: null, pagos: [], miembros: [], metricas: null, memberView: '', memberQuery: '', membersLoaded: false };

const dom = {
  authView: qs('#view-auth'),
  panelView: qs('#view-panel'),
  gsiBtn: qs('#gsi-btn'),
  gsiFallback: qs('#gsi-fallback'),
  authError: qs('#auth-error'),
  who: qs('#admin-who'),
  refresh: qs('#btn-refresh'),
  logout: qs('#btn-logout'),
  kActivos: qs('#kpi-activos'),
  kPagosMes: qs('#kpi-pagos-mes'),
  kMrr: qs('#kpi-mrr'),
  tabPagosCount: qs('#tab-pagos-count'),
  pagosList: qs('#pagos-list'),
  pagosEmpty: qs('#pagos-empty'),
  pagosBadge: qs('#pagos-count-badge'),
  miembrosList: qs('#miembros-list'),
  miembrosEmpty: qs('#miembros-empty'),
  memberSearch: qs('#member-search'),
  memberFilters: qs('#member-filters'),
  rejectModal: qs('#modal-reject'),
  rejectSub: qs('#reject-sub'),
  rejectReasons: qs('#reject-reasons'),
  rejectMotive: qs('#reject-motive'),
  rejectConfirm: qs('#btn-reject-confirm'),
  successModal: qs('#modal-success'),
  successSub: qs('#success-sub'),
  successMsg: qs('#success-msg'),
  successWa: qs('#btn-success-wa'),
  successCopy: qs('#btn-success-copy'),
};

const REASONS = ['Monto incorrecto', 'Referencia no encontrada', 'Comprobante ilegible', 'Pago duplicado'];
let pendingRejectId = null;

function openModal(modal) {
  if (!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}
function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) closeModal(closer.closest('.modal'));
});

function authError(message) {
  dom.authError.textContent = message || '';
  dom.authError.classList.toggle('hidden', !message);
}

function showAuth() {
  dom.panelView.classList.add('hidden');
  dom.authView.classList.remove('hidden');
  dom.refresh.hidden = true;
  dom.logout.hidden = true;
}

function showPanel() {
  dom.authView.classList.add('hidden');
  dom.panelView.classList.remove('hidden');
  dom.refresh.hidden = false;
  dom.logout.hidden = false;
}

async function setSession(token, emailHint) {
  state.token = token;
  authError('');
  try {
    await loadPanel();
    state.email = emailHint || state.email;
    dom.who.textContent = state.email ? `${state.email} · administrador` : 'Administrador';
    showPanel();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      state.token = null;
      authError(err.status === 403 ? 'Tu cuenta no tiene permisos de administrador.' : 'Sesión inválida o expirada. Vuelve a iniciar sesión.');
      showAuth();
    } else {
      authError(err.message || 'No pudimos conectar con el servidor.');
      showAuth();
    }
    throw err;
  }
}

function signOut() {
  state.token = null;
  state.email = null;
  try {
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
  } catch { /* noop */ }
  showAuth();
  toast('Sesión cerrada', 'info', 1600);
}

async function loadPanel() {
  const [metricas, pagos] = await Promise.all([
    api('/api/admin/metricas', { token: state.token }),
    api('/api/admin/pagos?estado=pendiente', { token: state.token }),
  ]);
  state.metricas = metricas.metricas;
  state.pagos = pagos.pagos || [];
  renderMetricas();
  renderPagos();
  if (state.membersLoaded) await loadMiembros();
}

function renderMetricas() {
  const m = state.metricas || {};
  dom.kActivos.textContent = m.miembros_activos ?? '—';
  dom.kPagosMes.textContent = m.pagos_mes ?? '—';
  dom.kMrr.textContent = money(m.mrr || 0, m.moneda || 'USD');
}

function renderPagos() {
  const list = state.pagos;
  dom.pagosBadge.textContent = String(list.length);
  dom.tabPagosCount.textContent = list.length ? `(${list.length})` : '';
  dom.pagosList.textContent = '';
  dom.pagosEmpty.classList.toggle('hidden', list.length > 0);
  for (const pago of list) dom.pagosList.append(pagoCard(pago));
}

function pagoCard(pago) {
  const phone = pago.miembro_telefono;
  const wa = waLink(phone, `Hola ${pago.miembro_nombre}, te escribimos del club ${pago.tenant_nombre}.`);
  const card = el('div', { class: 'item', style: 'flex-direction:column;gap:12px;align-items:stretch' });

  card.append(
    el('div', { class: 'row', style: 'align-items:flex-start' }, [
      el('div', { class: 'item__avatar', text: initials(pago.miembro_nombre) }),
      el('div', { class: 'grow' }, [
        el('div', { class: 'between' }, [
          el('strong', { text: pago.miembro_nombre || 'Miembro' }),
          el('span', { class: 'small muted', text: timeAgo(pago.created_at) }),
        ]),
        el('div', { class: 'small muted', text: `${pago.tenant_nombre} · ${pago.miembro_email}` }),
      ]),
    ]),
  );

  const refValue = pago.referencia;
  card.append(
    el('div', { class: 'copy-row' }, [
      el('div', {}, [
        el('div', { class: 'k', text: 'Referencia' }),
        el('div', { class: 'v mono', text: refValue }),
      ]),
      el('button', {
        class: 'btn btn--ghost btn--xs copy', type: 'button', text: 'Copiar',
        onclick: async (e) => {
          const ok = await copyText(refValue);
          e.currentTarget.textContent = ok ? 'Copiado ✓' : 'Error';
          setTimeout(() => { e.currentTarget.textContent = 'Copiar'; }, 1500);
        },
      }),
    ]),
  );

  card.append(
    el('div', { class: 'wrap-flex' }, [
      el('span', { class: 'badge', text: money(pago.monto, pago.moneda) }),
      el('span', { class: 'badge badge--ghost', text: (pago.metodo || '').replace('_', ' ') }),
      wa ? el('a', { class: 'badge', href: wa, target: '_blank', rel: 'noopener', text: '💬 WhatsApp' }) : null,
    ].filter(Boolean)),
  );

  card.append(
    el('div', { class: 'row' }, [
      el('button', {
        class: 'btn btn--ok grow', type: 'button', text: '✓ Confirmar',
        onclick: (e) => confirmPago(pago, e.currentTarget),
      }),
      el('button', {
        class: 'btn btn--ghost', type: 'button', text: 'Rechazar',
        onclick: () => openReject(pago),
      }),
    ]),
  );

  return card;
}

async function confirmPago(pago, button) {
  button.disabled = true;
  button.textContent = 'Activando…';
  try {
    const res = await api(`/api/admin/pagos/${pago.id}/confirmar`, { method: 'POST', token: state.token });
    const fecha = res.miembro_actualizado && res.miembro_actualizado.fecha_fin;
    toast('Membresía activada', 'ok');
    openSuccess(pago, fecha);
    await loadPanel();
  } catch (err) {
    toast(err.message || 'No se pudo confirmar', 'error', 4000);
    button.disabled = false;
    button.textContent = '✓ Confirmar';
  }
}

function openSuccess(pago, fechaFin) {
  const carnetUrl = `${window.location.origin}/mi-membresia/?t=${encodeURIComponent(pago.tenant_slug)}`;
  const msg = `¡Hola ${pago.miembro_nombre}! 🎉 Tu pago fue confirmado y tu membresía VIP de ${pago.tenant_nombre} está ACTIVA hasta el ${formatDate(fechaFin)}.\n\nYa puedes ver tu carnet digital aquí: ${carnetUrl}\n\n¡Gracias por ser parte del club!`;
  dom.successSub.textContent = `${pago.miembro_nombre} · ${pago.tenant_nombre}`;
  dom.successMsg.value = msg;
  const wa = waLink(pago.miembro_telefono, msg);
  if (wa) {
    dom.successWa.href = wa;
    dom.successWa.classList.remove('hidden');
  } else {
    dom.successWa.classList.add('hidden');
  }
  openModal(dom.successModal);
}

function openReject(pago) {
  pendingRejectId = pago.id;
  dom.rejectSub.textContent = `${pago.miembro_nombre} · ${money(pago.monto, pago.moneda)} · ref ${pago.referencia}`;
  dom.rejectMotive.value = '';
  dom.rejectReasons.textContent = '';
  for (const reason of REASONS) {
    dom.rejectReasons.append(
      el('button', {
        class: 'chip', type: 'button', text: reason,
        onclick: (e) => {
          qsa('.chip', dom.rejectReasons).forEach((c) => c.classList.remove('is-active'));
          e.currentTarget.classList.add('is-active');
          dom.rejectMotive.value = reason;
        },
      }),
    );
  }
  openModal(dom.rejectModal);
  setTimeout(() => dom.rejectMotive.focus(), 200);
}

async function confirmReject() {
  if (!pendingRejectId) return;
  const motivo = dom.rejectMotive.value.trim();
  if (motivo.length < 3) {
    toast('Indica un motivo del rechazo', 'error');
    return;
  }
  dom.rejectConfirm.disabled = true;
  dom.rejectConfirm.textContent = 'Procesando…';
  try {
    await api(`/api/admin/pagos/${pendingRejectId}/rechazar`, {
      method: 'POST',
      token: state.token,
      body: { motivo },
    });
    toast('Pago rechazado', 'info');
    closeModal(dom.rejectModal);
    pendingRejectId = null;
    await loadPanel();
  } catch (err) {
    toast(err.message || 'No se pudo rechazar', 'error', 4000);
  } finally {
    dom.rejectConfirm.disabled = false;
    dom.rejectConfirm.textContent = 'Confirmar rechazo';
  }
}

async function loadMiembros() {
  state.membersLoaded = true;
  const params = new URLSearchParams();
  if (state.memberQuery) params.set('q', state.memberQuery);
  if (state.memberView) params.set('estado', state.memberView);
  const query = params.toString();
  const data = await api(`/api/admin/miembros${query ? `?${query}` : ''}`, { token: state.token });
  state.miembros = data.miembros || [];
  renderMiembros();
}

function renderMiembros() {
  const list = state.miembros;
  dom.miembrosList.textContent = '';
  dom.miembrosEmpty.classList.toggle('hidden', list.length > 0);
  for (const m of list) {
    const meta = statusMeta(m.estado);
    const wa = waLink(m.telefono, `Hola ${m.nombre}, te saludamos del club ${m.tenant_nombre}.`);
    const card = el('div', { class: 'item' }, [
      el('div', { class: 'item__avatar', text: initials(m.nombre) }),
      el('div', { class: 'grow' }, [
        el('div', { class: 'between' }, [
          el('strong', { text: m.nombre }),
          el('span', { class: `status ${meta.cls}`, text: meta.label }),
        ]),
        el('div', { class: 'small muted', text: `${m.email} · ${m.telefono}` }),
        el('div', { class: 'small muted', text: `${m.tenant_nombre}${m.fecha_fin ? ` · vence ${formatDate(m.fecha_fin)}` : ''}` }),
        wa ? el('a', { class: 'badge', href: wa, target: '_blank', rel: 'noopener', style: 'margin-top:8px;width:fit-content', text: '💬 WhatsApp' }) : null,
      ].filter(Boolean)),
    ]);
    dom.miembrosList.append(card);
  }
}

function setupTabs() {
  qsa('.tabs .tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      qsa('.tabs .tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const view = tab.dataset.view;
      qs('#pane-pagos').classList.toggle('hidden', view !== 'pagos');
      qs('#pane-miembros').classList.toggle('hidden', view !== 'miembros');
      if (view === 'miembros' && !state.membersLoaded) {
        try { await loadMiembros(); } catch (err) { toast(err.message || 'Error al cargar miembros', 'error'); }
      }
    });
  });
}

function setupMembersControls() {
  qsa('#member-filters .chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      qsa('#member-filters .chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.memberView = chip.dataset.estado || '';
      try { await loadMiembros(); } catch (err) { toast(err.message || 'Error al filtrar', 'error'); }
    });
  });
  dom.memberSearch.addEventListener(
    'input',
    debounce(async (e) => {
      state.memberQuery = e.target.value.trim();
      try { await loadMiembros(); } catch (err) { toast(err.message || 'Error al buscar', 'error'); }
    }, 350),
  );
}

function setupGsi() {
  const start = () => {
    if (!(window.google && google.accounts && google.accounts.id)) {
      dom.gsiFallback.textContent = 'No se pudo cargar Google Sign-In. Revisa tu conexión o usa una cuenta autorizada.';
      dom.gsiFallback.classList.remove('hidden');
      return;
    }
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        if (!response.credential) {
          authError('Google no devolvió una credencial válida.');
          return;
        }
        let email = null;
        try {
          email = JSON.parse(atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email;
        } catch { /* noop */ }
        setSession(response.credential, email).catch(() => {});
      },
      auto_select: false,
    });
    google.accounts.id.renderButton(dom.gsiBtn, {
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      logo_alignment: 'left',
      width: 300,
    });
  };

  if (window.google && google.accounts && google.accounts.id) start();
  else window.addEventListener('load', () => setTimeout(start, 200), { once: true });
}

dom.rejectConfirm.addEventListener('click', confirmReject);
dom.successCopy.addEventListener('click', async () => {
  const ok = await copyText(dom.successMsg.value);
  toast(ok ? 'Mensaje copiado' : 'No se pudo copiar', ok ? 'ok' : 'error', 1600);
});
dom.refresh.addEventListener('click', async () => {
  try { await loadPanel(); toast('Actualizado', 'ok', 1200); }
  catch (err) { toast(err.message || 'Error al actualizar', 'error'); }
});
dom.logout.addEventListener('click', signOut);

setupTabs();
setupMembersControls();
setupGsi();
showAuth();

window.VendoAdmin = {
  setSession,
  refresh: loadPanel,
  signOut,
  state,
};
