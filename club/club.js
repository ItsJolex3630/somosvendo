import {
  api,
  applyTenantTheme,
  copyText,
  detectTenantSlug,
  digits,
  el,
  escapeHtml,
  money,
  qs,
  qsa,
  toast,
  waLink,
} from '../assets/js/app.js';

const METHOD_DEFS = [
  {
    key: 'pago_movil',
    label: 'Pago Móvil',
    fields: [
      { k: 'banco', label: 'Banco' },
      { k: 'telefono', label: 'Teléfono' },
      { k: 'cedula', label: 'Cédula / RIF' },
      { k: 'titular', label: 'Titular' },
    ],
  },
  {
    key: 'zelle',
    label: 'Zelle',
    fields: [
      { k: 'correo', label: 'Correo' },
      { k: 'titular', label: 'Titular' },
    ],
  },
];

const state = {
  slug: detectTenantSlug(),
  club: null,
  miembroId: null,
  member: {},
  amount: 0,
  currency: 'USD',
  activeMethod: 'pago_movil',
};

const dom = {
  loading: qs('#state-loading'),
  error: qs('#state-error'),
  app: qs('#app'),
  brandName: qs('#brand-name'),
  brandMark: qs('#brand-mark'),
  clubTitle: qs('#club-title'),
  clubDesc: qs('#club-desc'),
  clubBadge: qs('#club-badge'),
  clubPrice: qs('#club-price'),
  clubPriceNote: qs('#club-price-note'),
  savingsHook: qs('#savings-hook'),
  savingsText: qs('#savings-text'),
  benefits: qs('#benefits'),
  instructions: qs('#club-instructions'),
  instructionsText: qs('#instructions-text'),
  step1: qs('#step-1'),
  step2: qs('#step-2'),
  step3: qs('#step-3'),
  formCheckout: qs('#form-checkout'),
  btnCheckout: qs('#btn-checkout'),
  checkoutError: qs('#checkout-error'),
  formReportar: qs('#form-reportar'),
  btnReportar: qs('#btn-reportar'),
  reportError: qs('#report-error'),
  btnBack1: qs('#btn-back-1'),
  methodTabs: qs('#method-tabs'),
  methodPanel: qs('#method-panel'),
  payAmount: qs('#pay-amount'),
  inNombre: qs('#in-nombre'),
  inEmail: qs('#in-email'),
  inTelefono: qs('#in-telefono'),
  inReferencia: qs('#in-referencia'),
  successSummary: qs('#success-summary'),
  successDetail: qs('#success-detail'),
  btnGotoCarnet: qs('#btn-goto-carnet'),
  btnWaClub: qs('#btn-wa-club'),
};

function showStep(n) {
  const map = { 1: dom.step1, 2: dom.step2, 3: dom.step3 };
  for (const [key, node] of Object.entries(map)) {
    const active = Number(key) === n;
    node.classList.toggle('hidden', !active);
    if (active) {
      node.classList.remove('reveal');
      void node.offsetWidth;
      node.classList.add('reveal');
    }
  }
  qsa('.steps .step').forEach((step) => {
    const num = Number(step.dataset.step);
    step.dataset.state = num === n ? 'active' : num < n ? 'done' : '';
  });
  window.scrollTo({ top: dom.step1.offsetTop - 90, behavior: 'smooth' });
}

function setError(node, message) {
  if (!message) {
    node.textContent = '';
    node.classList.add('hidden');
    return;
  }
  node.textContent = message;
  node.classList.remove('hidden');
}

function renderClub(club) {
  applyTenantTheme(club);
  dom.brandName.textContent = club.nombre || 'Club VIP';
  dom.brandMark.textContent = (club.nombre || 'V').trim().charAt(0).toUpperCase();
  dom.clubTitle.textContent = `Club ${club.nombre || 'VIP'}`;
  dom.clubDesc.textContent = club.descripcion || 'Accede a beneficios exclusivos como miembro.';
  dom.clubBadge.textContent = '★ Membresía mensual';
  dom.clubPrice.textContent = `${money(club.precio, club.moneda)} / mes`;
  const each = money(club.precio, club.moneda);
  dom.clubPriceNote.textContent = `Equivale a ${each} al mes, sin contratos ni permanencia.`;
  dom.savingsText.textContent = `Con solo 2 compras al mes ya amortizas tu membresía de ${each}. Todo lo demás es ganancia.`;
  dom.savingsHook.style.display = 'block';

  dom.benefits.textContent = '';
  const benefits = Array.isArray(club.beneficios) ? club.beneficios : [];
  if (benefits.length) {
    dom.benefits.append(el('div', { class: 'small muted', text: 'Beneficios exclusivos de tu membresía' }));
    for (const benefit of benefits) {
      dom.benefits.append(
        el('div', { class: 'card', style: 'display:flex;gap:12px;align-items:flex-start' }, [
          el('div', { style: 'font-size:20px;line-height:1', text: '✅' }),
          el('p', { style: 'font-size:15px;margin:0', text: benefit }),
        ]),
      );
    }
  }

  if (club.instrucciones_pago) {
    dom.instructionsText.textContent = club.instrucciones_pago;
    dom.instructions.style.display = 'block';
  }

  document.title = `Únete al Club ${club.nombre || 'VIP'}`;
  dom.error.classList.add('hidden');
  dom.loading.classList.add('hidden');
  dom.app.classList.remove('hidden');

  prefillFromQuery();
  renderMethodTabs();
}

function prefillFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('nombre')) dom.inNombre.value = params.get('nombre');
  if (params.get('email')) dom.inEmail.value = params.get('email');
  if (params.get('whatsapp')) dom.inTelefono.value = params.get('whatsapp');
}

function renderMethodTabs() {
  dom.methodTabs.textContent = '';
  for (const method of METHOD_DEFS) {
    const tab = el('button', {
      class: 'tab',
      type: 'button',
      role: 'tab',
      text: method.label,
      'aria-selected': String(method.key === state.activeMethod),
      onclick: () => {
        state.activeMethod = method.key;
        renderMethodTabs();
      },
    });
    if (method.key === state.activeMethod) tab.classList.add('is-active');
    dom.methodTabs.append(tab);
  }
  renderMethodPanel();
}

function renderMethodPanel() {
  const method = METHOD_DEFS.find((m) => m.key === state.activeMethod) || METHOD_DEFS[0];
  const data = (state.club && state.club.metodos_pago && state.club.metodos_pago[method.key]) || {};
  const rows = method.fields
    .map((field) => ({ ...field, value: String(data[field.k] || '').trim() }))
    .filter((field) => field.value);

  dom.methodPanel.textContent = '';

  if (!rows.length) {
    const phone = state.club && state.club.whatsapp;
    const link = waLink(phone, `Hola, quiero unirme al club ${state.club ? state.club.nombre : ''} y saber cómo pagar.`);
    dom.methodPanel.append(
      el('div', { class: 'alert alert--warn' }, [
        el('strong', { text: 'Datos de pago próximamente. ' }),
        el('span', { text: 'Escríbenos por WhatsApp y te indicamos cómo completar tu pago.' }),
      ]),
    );
    if (link) {
      dom.methodPanel.append(el('a', { class: 'btn btn--ghost btn--block', href: link, target: '_blank', rel: 'noopener', text: 'Escribir al club por WhatsApp' }));
    }
    return;
  }

  for (const row of rows) {
    const value = row.value;
    dom.methodPanel.append(
      el('div', { class: 'copy-row' }, [
        el('div', {}, [
          el('div', { class: 'k', text: row.label }),
          el('div', { class: 'v', text: value }),
        ]),
        el('button', {
          class: 'btn btn--ghost btn--xs copy',
          type: 'button',
          text: 'Copiar',
          onclick: async (e) => {
            const ok = await copyText(value);
            e.currentTarget.textContent = ok ? 'Copiado ✓' : 'Error';
            toast(ok ? `${row.label} copiado` : 'No se pudo copiar', ok ? 'ok' : 'error', 1600);
            setTimeout(() => { e.currentTarget.textContent = 'Copiar'; }, 1600);
          },
        }),
      ]),
    );
  }
}

async function loadClub() {
  try {
    const data = await api(`/api/club/${encodeURIComponent(state.slug)}`);
    state.club = data.club;
    renderClub(state.club);
  } catch (err) {
    dom.loading.classList.add('hidden');
    dom.error.classList.remove('hidden');
    if (err.status && err.status !== 404) {
      toast('No pudimos cargar el club. Intenta de nuevo.', 'error');
    }
  }
}

dom.formCheckout.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError(dom.checkoutError, '');
  const nombre = dom.inNombre.value.trim();
  const email = dom.inEmail.value.trim();
  const telefono = dom.inTelefono.value.trim();
  if (!nombre || nombre.length < 2) return setError(dom.checkoutError, 'Escribe tu nombre completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError(dom.checkoutError, 'Escribe un correo válido.');
  if (digits(telefono).length < 7) return setError(dom.checkoutError, 'Escribe un WhatsApp válido.');

  dom.btnCheckout.disabled = true;
  dom.btnCheckout.textContent = 'Procesando…';
  try {
    const res = await api('/api/checkout/iniciar', {
      method: 'POST',
      body: { tenant_slug: state.slug, nombre, email, telefono },
    });
    state.miembroId = res.miembro_id;
    state.member = { nombre, email, telefono };
    state.amount = res.monto;
    state.currency = res.moneda;
    if (res.metodos_pago && state.club) state.club.metodos_pago = res.metodos_pago;
    dom.payAmount.textContent = money(state.amount, state.currency);
    renderMethodTabs();
    showStep(2);
    if (res.estado === 'activo') {
      toast('Tu membresía ya está activa. Reporta tu renovación.', 'info', 4000);
    }
  } catch (err) {
    setError(dom.checkoutError, err.message || 'No pudimos registrar tus datos.');
  } finally {
    dom.btnCheckout.disabled = false;
    dom.btnCheckout.textContent = 'Continuar al pago';
  }
});

dom.btnBack1.addEventListener('click', () => showStep(1));

dom.formReportar.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError(dom.reportError, '');
  const referencia = dom.inReferencia.value.trim();
  if (referencia.length < 4) return setError(dom.reportError, 'Escribe el número de referencia de tu pago.');

  dom.btnReportar.disabled = true;
  dom.btnReportar.textContent = 'Enviando…';
  try {
    const res = await api('/api/pagos/reportar', {
      method: 'POST',
      body: {
        tenant_slug: state.slug,
        miembro_id: state.miembroId,
        referencia,
        metodo: state.activeMethod,
        monto: state.amount,
      },
    });
    renderSuccess(referencia);
    showStep(3);
  } catch (err) {
    if (err.status === 409) {
      setError(dom.reportError, '⚠️ Esta referencia ya fue reportada. Verifica tu comprobante o contacta al club.');
    } else {
      setError(dom.reportError, err.message || 'No pudimos reportar el pago.');
    }
  } finally {
    dom.btnReportar.disabled = false;
    dom.btnReportar.textContent = 'Reportar pago';
  }
});

function renderSuccess(referencia) {
  const methodLabel = (METHOD_DEFS.find((m) => m.key === state.activeMethod) || {}).label || state.activeMethod;
  dom.successSummary.style.display = 'block';
  dom.successSummary.innerHTML = `
    <div class="between"><span class="small muted">Miembro</span><strong>${escapeHtml(state.member.nombre || '')}</strong></div>
    <div class="between" style="margin-top:8px"><span class="small muted">Club</span><strong>${escapeHtml(state.club.nombre)}</strong></div>
    <div class="between" style="margin-top:8px"><span class="small muted">Método</span><strong>${escapeHtml(methodLabel)}</strong></div>
    <div class="between" style="margin-top:8px"><span class="small muted">Referencia</span><strong class="mono">${escapeHtml(referencia)}</strong></div>
    <div class="between" style="margin-top:8px"><span class="small muted">Monto</span><strong class="mono">${escapeHtml(money(state.amount, state.currency))}</strong></div>`;

  const carnetUrl = `../mi-membresia/?t=${encodeURIComponent(state.slug)}`;
  dom.btnGotoCarnet.href = carnetUrl;
  const wa = waLink(state.club.whatsapp, `Hola, acabo de reportar mi pago de membresía (ref. ${referencia}). Mi correo es ${state.member.email}.`);
  if (wa) {
    dom.btnWaClub.href = wa;
    dom.btnWaClub.classList.remove('hidden');
  }
}

loadClub();
