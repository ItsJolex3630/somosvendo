(function () {
  'use strict';

  // Compatibilidad: enlaces antiguos /club/?t=slug → URL limpia /club/slug
  var params = new URLSearchParams(window.location.search);
  var legacy = params.get('t') || params.get('tenant') || params.get('club');
  if (legacy) {
    var slug = legacy.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (slug) { window.location.replace('/club/' + slug); return; }
  }

  var ADVISOR = '584149428999';
  var modal = document.getElementById('quote-modal');
  var form = document.getElementById('quote-form');
  if (!modal || !form) return;

  var empresa = document.getElementById('q-empresa');
  var rubro = document.getElementById('q-rubro');
  var ciudad = document.getElementById('q-ciudad');
  var wa = document.getElementById('q-wa');
  var preview = document.getElementById('q-preview');

  function build() {
    var nombre = (empresa.value || '').trim() || '[Nombre de tu negocio]';
    return '¡Hola! Quiero contratar VÉNDO Conecta para mi negocio.\n\n' +
      '🏢 Negocio: ' + nombre + '\n' +
      '📦 Rubro: ' + rubro.value + '\n' +
      '📍 Ciudad: ' + ciudad.value + '\n' +
      '💬 WhatsApp: ' + ((wa.value || '').trim() || '—') + '\n\n' +
      'Servicio: VÉNDO Conecta (Fidelización)';
  }
  function update() { if (preview) preview.textContent = build(); }

  function open(e) {
    if (e) e.preventDefault();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    update();
    setTimeout(function () { if (empresa) empresa.focus(); }, 150);
  }
  function close() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  Array.prototype.forEach.call(document.querySelectorAll('.open-quote-modal'), function (b) {
    b.addEventListener('click', open);
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal || (e.target.hasAttribute && e.target.hasAttribute('data-close'))) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });
  form.addEventListener('input', update);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    window.open('https://wa.me/' + ADVISOR + '?text=' + encodeURIComponent(build()), '_blank', 'noopener');
    close();
  });
  update();
})();
