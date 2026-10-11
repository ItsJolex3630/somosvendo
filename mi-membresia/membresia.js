import {
  api,
  applyTenantTheme,
  detectTenantSlug,
  formatDate,
  qs,
  statusMeta,
  toast,
  waLink,
} from '../assets/js/app.js';

const state = { slug: detectTenantSlug(), club: null, member: null };

const dom = {
  login: qs('#view-login'),
  carnet: qs('#view-carnet'),
  form: qs('#form-login'),
  inEmail: qs('#in-email'),
  inLast4: qs('#in-last4'),
  loginError: qs('#login-error'),
  btnLogin: qs('#btn-login'),
  btnLogout: qs('#btn-logout'),
  linkJoin: qs('#link-join'),
  brandName: qs('#brand-name'),
  brandMark: qs('#brand-mark'),
  carClub: qs('#car-club'),
  carName: qs('#car-name'),
  carSince: qs('#car-since'),
  carUntil: qs('#car-until'),
  carStatus: qs('#car-status'),
  carDays: qs('#car-days'),
  carDaysLabel: qs('#car-days-label'),
  carMessage: qs('#car-message'),
  btnRenew: qs('#btn-renew'),
  btnContact: qs('#btn-contact'),
  btnOther: qs('#btn-other'),
};

function setError(message) {
  dom.loginError.textContent = message || '';
  dom.loginError.classList.toggle('hidden', !message);
}

function prefill() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('email')) dom.inEmail.value = params.get('email');
}

function showLogin() {
  state.member = null;
  dom.carnet.classList.add('hidden');
  dom.login.classList.remove('hidden');
  dom.btnLogout.classList.add('hidden');
}

function messagesFor(estado, days) {
  switch (estado) {
    case 'activo':
      return { days: String(days), label: days === 1 ? 'día de beneficios restante' : 'días de beneficios restantes',
        message: days > 0 ? '¡Disfruta tus beneficios exclusivos! Te avisaremos antes del vencimiento.' : 'Tu membresía vence hoy. Renueva para no perder tus beneficios.' };
    case 'gracia':
      return { days: String(days), label: days === 1 ? 'día en periodo de gracia' : 'días en periodo de gracia',
        message: 'Tu membresía venció y estás en periodo de gracia. Renueva ahora para no perder tus beneficios.' };
    case 'vencido':
      return { days: '0', label: 'membresía vencida',
        message: 'Tu membresía está vencida. Renueva para reactivar todos tus beneficios.' };
    case 'pendiente':
      return { days: '⌛', label: 'pago en revisión',
        message: 'Estamos validando tu pago. Te confirmaremos por WhatsApp en breve; luego verás tu carnet activo aquí.' };
    case 'rechazado':
      return { days: '!', label: 'pago rechazado',
        message: 'No pudimos validar tu último pago. Escríbenos por WhatsApp o intenta reportarlo de nuevo.' };
    default:
      return { days: '—', label: 'estado', message: '' };
  }
}

function renderCarnet(data) {
  state.member = { nombre: data.nombre, email: data.email, tenant: data.tenant };
  const meta = statusMeta(data.estado);
  const info = messagesFor(data.estado, data.dias_restantes);

  dom.brandName.textContent = data.tenant.nombre || 'Mi Membresía';
  dom.brandMark.textContent = (data.tenant.nombre || 'V').trim().charAt(0).toUpperCase();
  dom.carClub.textContent = data.tenant.nombre || 'Club VIP';
  dom.carName.textContent = data.nombre || '—';
  dom.carSince.textContent = formatDate(data.fecha_inicio);
  dom.carUntil.textContent = data.fecha_fin ? formatDate(data.fecha_fin) : 'Sin fecha';
  dom.carStatus.textContent = meta.label;
  dom.carStatus.className = `status ${meta.cls}`;
  dom.carDays.textContent = info.days;
  dom.carDaysLabel.textContent = info.label;
  dom.carMessage.textContent = info.message;

  const params = new URLSearchParams({ t: state.slug });
  if (data.email) params.set('email', data.email);
  if (data.nombre) params.set('nombre', data.nombre);
  dom.btnRenew.href = `../club/?${params.toString()}`;

  const wa = waLink(data.tenant.whatsapp, `Hola, soy ${data.nombre || 'miembro'} del club ${data.tenant.nombre}. Necesito ayuda con mi membresía.`);
  if (wa) {
    dom.btnContact.href = wa;
    dom.btnContact.classList.remove('hidden');
  } else {
    dom.btnContact.classList.add('hidden');
  }

  dom.login.classList.add('hidden');
  dom.carnet.classList.remove('hidden');
  dom.btnLogout.classList.remove('hidden');
  dom.carnet.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

dom.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('');
  const email = dom.inEmail.value.trim();
  const last4 = dom.inLast4.value.replace(/\D/g, '').slice(-4);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError('Escribe un correo válido.');
  if (last4.length !== 4) return setError('Ingresa los últimos 4 dígitos de tu WhatsApp.');

  dom.btnLogin.disabled = true;
  dom.btnLogin.textContent = 'Buscando…';
  try {
    const data = await api('/api/membresia/estado', {
      method: 'POST',
      body: { tenant_slug: state.slug, email, ultimos4_telefono: last4 },
    });
    renderCarnet(data);
  } catch (err) {
    if (err.status === 404) setError('No encontramos una membresía con estos datos. Revisa tu correo.');
    else if (err.status === 401) setError('Los últimos 4 dígitos no coinciden. Verifica e intenta de nuevo.');
    else setError(err.message || 'No pudimos consultar tu membresía.');
  } finally {
    dom.btnLogin.disabled = false;
    dom.btnLogin.textContent = 'Ver mi membresía';
  }
});

dom.btnLogout.addEventListener('click', () => {
  showLogin();
  dom.inLast4.value = '';
  toast('Sesión cerrada', 'info', 1600);
});
dom.btnOther.addEventListener('click', () => {
  showLogin();
  dom.inLast4.value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

async function init() {
  dom.linkJoin.href = `../club/?t=${encodeURIComponent(state.slug)}`;
  prefill();
  try {
    const data = await api(`/api/club/${encodeURIComponent(state.slug)}`);
    state.club = data.club;
    applyTenantTheme(state.club);
    dom.brandMark.textContent = state.club.nombre.trim().charAt(0).toUpperCase();
  } catch {
    /* el portal funciona igual con la paleta por defecto */
  }
}

init();
