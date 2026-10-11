(function initCarousels(){
function setupCarousel(selector){
const track=document.querySelector(selector);
if(!track)return;
const slides=track.querySelectorAll('.carousel-slide');
const dots=track.querySelectorAll('.dot');
const prevBtn=track.querySelector('.carousel-btn.prev');
const nextBtn=track.querySelector('.carousel-btn.next');
let currentIndex=0;
let timer=null;
function showSlide(index){slides.forEach((s,i)=>s.classList.toggle('active',i===index));dots.forEach((d,i)=>d.classList.toggle('active',i===index));currentIndex=index;}
function nextSlide(){showSlide((currentIndex+1)%slides.length);}
function prevSlide(){showSlide((currentIndex-1+slides.length)%slides.length);}
function startAutoPlay(){stopAutoPlay();timer=setInterval(nextSlide,3500);}
function stopAutoPlay(){if(timer)clearInterval(timer);}
nextBtn?.addEventListener('click',()=>{nextSlide();startAutoPlay();});
prevBtn?.addEventListener('click',()=>{prevSlide();startAutoPlay();});
dots.forEach((dot,i)=>{dot.addEventListener('click',()=>{showSlide(i);startAutoPlay();});});
track.addEventListener('mouseenter',stopAutoPlay);
track.addEventListener('mouseleave',startAutoPlay);
startAutoPlay();
}
setupCarousel('#gtech-carousel');
setupCarousel('#jolie-carousel');
})();

// Navegación de Slider de Clientes (Desktop buttons + Scroll check)
(function initClientsSlider(){
const slider=document.getElementById('clients-slider');
const prevBtn=document.getElementById('clients-prev');
const nextBtn=document.getElementById('clients-next');
if(!slider||!prevBtn||!nextBtn)return;
function updateButtonStates(){
const atStart=slider.scrollLeft<=15;
const atEnd=slider.scrollLeft+slider.clientWidth>=slider.scrollWidth-15;
prevBtn.disabled=atStart;
nextBtn.disabled=atEnd;
}
function getScrollStep(){
const card=slider.querySelector('.client-card');
return card?card.offsetWidth+24:450;
}
nextBtn.addEventListener('click',()=>{slider.scrollBy({left:getScrollStep(),behavior:'smooth'});});
prevBtn.addEventListener('click',()=>{slider.scrollBy({left:-getScrollStep(),behavior:'smooth'});});
slider.addEventListener('scroll',updateButtonStates,{passive:true});
window.addEventListener('resize',updateButtonStates,{passive:true});
updateButtonStates();
})();

// Simulador Interactivo de Google Maps (Antes vs. Después)
(function initMapsSimulator(){
const btnBad=document.getElementById('toggle-bad');
const btnGood=document.getElementById('toggle-good');
const card=document.getElementById('map-card');
const pinBadge=document.getElementById('pin-badge');
const cardName=document.getElementById('card-name');
const cardRating=document.getElementById('card-rating');
const cardStatus=document.getElementById('card-status');
const footerNote=document.getElementById('card-footer-note');
const waBtn=document.getElementById('card-wa-btn');
if(!btnBad||!btnGood||!card)return;
let mode='good';
function t(key){const i=window.VENDO_I18N;return i?i.t(key):'';}
function setMode(next){
mode=next;
const bad=next==='bad';
const on=bad?btnBad:btnGood,off=bad?btnGood:btnBad;
on.classList.add('active');on.setAttribute('aria-selected','true');
off.classList.remove('active');off.setAttribute('aria-selected','false');
card.classList.toggle('mode-bad',bad);
card.classList.toggle('mode-good',!bad);
const p=bad?'bad':'good';
pinBadge.textContent=t('sim_'+p+'_badge');
cardName.textContent=t('sim_'+p+'_name');
cardRating.innerHTML='<span class="stars">'+t('sim_'+p+'_stars')+'</span> <span class="rating-num">'+t('sim_'+p+'_rating')+'</span> <span class="reviews-count">'+t('sim_'+p+'_reviews')+'</span>';
cardStatus.innerHTML='<span class="status-dot"></span> <span class="status-label">'+t('sim_'+p+'_status')+'</span>';
footerNote.textContent=t('sim_'+p+'_note');
if(waBtn)waBtn.style.display=bad?'none':'block';
}
btnBad.addEventListener('click',()=>setMode('bad'));
btnGood.addEventListener('click',()=>setMode('good'));
document.addEventListener('vendo:langchange',()=>setMode(mode));
setMode(mode);
})();
// ==========================================
// SISTEMA DE INTERNACIONALIZACIÓN (i18n) VENDO
// ==========================================
(function initI18n(){
const flags={
es:'<rect width="24" height="4.5" fill="#AA151B"/><rect y="4.5" width="24" height="7" fill="#F1BF00"/><rect y="11.5" width="24" height="4.5" fill="#AA151B"/>',
en:'<rect width="24" height="16" fill="#B22234"/><path d="M0,2.46h24M0,4.92h24M0,7.38h24M0,9.84h24M0,12.3h24M0,14.76h24" stroke="#fff" stroke-width="1.23"/><rect width="10" height="8.6" fill="#3C3B6E"/>'
};

const waMessages={
es:'Hola, me gustaría consultar con el asesor de VENDO los planes y precios para mi negocio.',
en:"Hi, I'd like to talk to the VENDO advisor about plans and pricing for my business."
};

const translations={
es:{
page_title:'VENDO | Presencia digital para comercios de San Diego y Valencia, Carabobo',
nav_contact:'Escríbenos',
hero_h1:'Que tu negocio se encuentre, se vea y venda.',
hero_p:'Páginas web y Google Maps optimizado para comercios de San Diego, Valencia y todo Carabobo. Sin promesas infladas: trabajo claro y resultados que puedes comprobar.',
hero_cta_advisor:'Hablar con un asesor',
hero_cta_services:'Ver servicios',
do_bubble:'Soy Do. Te ayudo a optimizar tu marca.',
do_alt:'Do, la mascota de VENDO',
maps_tag:'SIMULADOR EN VIVO · IMPACTO INMEDIATO',
maps_h2:'La diferencia entre que te encuentren o pasen de largo.',
maps_p:'El 82% de las personas en San Diego y Valencia buscan en Google antes de salir a comprar o pedir delivery. Un perfil abandonado ahuyenta a los clientes; un perfil optimizado genera confianza y ventas inmediatas.',
maps_feat1_title:'Ubicación y ruta exacta:',
maps_feat1_p:'Tus clientes llegan directo a tu local con Google Maps o Waze sin dar vueltas.',
maps_feat2_title:'Botón directo a WhatsApp:',
maps_feat2_p:'El cliente ve tus fotos, menú o catálogo y te contacta con un solo toque desde Google.',
maps_feat3_title:'Estrategia de reseñas reales:',
maps_feat3_p:'Te enseñamos a pedir opiniones a clientes satisfechos para mantenerte en el Top 3 local.',
maps_toggle_bad:'Sin optimizar',
maps_toggle_good:'Con VENDO',
maps_cat:'Comercio local · San Diego / Valencia, Carabobo',
maps_act_call:'Llamar',
maps_act_wa:'WhatsApp directo',
maps_act_dir:'Cómo llegar',
maps_act_web:'Sitio web',
sim_good_badge:'✓ Verificado en Google',
sim_good_name:'Tu Negocio',
sim_good_stars:'★★★★★',
sim_good_rating:'4.9',
sim_good_reviews:'(58 opiniones)',
sim_good_status:'Abierto ahora · Cierra 8:00 PM',
sim_good_note:'✓ Perfil optimizado y vinculado a WhatsApp por VENDO',
sim_bad_badge:'⚠️ Sin verificar',
sim_bad_name:'Tu Negocio (Sin reclamar)',
sim_bad_stars:'★★★☆☆',
sim_bad_rating:'3.1',
sim_bad_reviews:'(2 opiniones antiguas)',
sim_bad_status:'Horario no verificado · Podría estar cerrado',
sim_bad_note:'⚠️ ¿Eres el dueño de esta empresa? Reclámala ahora en Google',
services_h2:'Lo que hacemos por tu negocio',
service1_h3:'Páginas web',
service1_p:'Sitio rápido y pensado para el celular, con tu catálogo, tus datos de contacto y un botón directo a WhatsApp.',
service2_h3:'Google Maps',
service2_p:'Perfil de Empresa creado, verificado y optimizado para que los vecinos y visitantes te encuentren primero.',
service3_h3:'Marketing local',
service3_p:'Reseñas reales, WhatsApp Business, catálogos digitales y embudos de venta simples. También te ayudamos a vender en Yummy cuando aplica.',
bento_tag:'POR QUÉ VENDO · ESTÁNDAR PROFESIONAL',
bento_h2:'Tu marca merece más que un enlace prestado.',
bento_subtitle:'Muchos ofrecen páginas web; muy pocos resuelven de verdad la presencia y visibilidad de tu negocio. Así es como trabajamos:',
bento_d_badge:'Tu Identidad Digital',
bento_d_title:'¿Cansado de que el link de tu negocio se vea así?',
bento_d_bad_status:'❌ Enlaces genéricos de plataformas',
bento_d_bad_note:'Largo, sospechoso para el cliente y le hace publicidad a otra app.',
bento_d_good_status:'✅ Tu dominio propio con VENDO',
bento_d_good_note:'Limpio, profesional y memorable. Todo configurado por nosotros (DNS, SSL y hosting).',
bento_ssl:'· SSL Seguro',
bento_d_footer:'Tú no tocas configuraciones técnicas ni paneles raros. Nosotros dejamos tu dominio listo y funcionando para que solo te preocupes por vender.',
bento_s_badge:'Visibilidad Real',
bento_s_title:'No diseñamos páginas para que queden invisibles.',
bento_s_p:'Una página sin indexar es como abrir una tienda en medio del desierto. Conectamos tu web a las herramientas oficiales de Google para que comiences a aparecer en las búsquedas locales de tus clientes.',
seo_check1:'✓ Indexación de URLs en Google',
seo_check2:'✓ Optimización para búsqueda móvil',
seo_check3:'✓ Vinculación directa con Google Maps',
bento_c_badge:'Tus Ganancias',
bento_c_title:'0% comisiones por pedido',
bento_c_p:'El cliente ve tus productos y con un solo toque te escribe directamente a tu WhatsApp. No intermediarios, no comisiones por venta.',
bento_sup_badge:'Tranquilidad Total',
bento_sup_title:'Asesoría y soporte cercano',
bento_sup_p:'¿Dudas con tu plan, precios o cambios en tu web? Cuentas con asesoría comercial directa y soporte técnico continuo desde San Diego y Valencia, Carabobo.',
clients_tag:'CASOS REALES · RESULTADOS QUE SE VEN',
clients_h2:'¿Quiénes ya dejaron atrás la invisibilidad digital?',
clients_p:'Construimos la cara digital de negocios que compiten en serio. Proyectos con presencia sólida tanto en comercios locales como a nivel internacional.',
gtech_badge:'🇺🇸 Proyecto Internacional · Estados Unidos',
gtech_desc:'Solución web de catálogo y presentación de tecnología, repuestos y equipos para el mercado estadounidense. Estructura rápida, diseño sobrio y enfoque comercial directo.',
gtech_link:'Visitar gtechs.us',
jolie_badge:'🛍️ Catálogo Digital & Venta Directa',
jolie_desc:'Plataforma web para catálogo interactivo de perfumería exclusiva. Diseñada para navegación ágil en dispositivos móviles y canalización inmediata de pedidos a WhatsApp.',
jolie_link:'Visitar jolie-fragrances',
contact_tag:'PASO SIGUIENTE · SIN COMPROMISO',
contact_h2:'Cuéntanos de tu negocio y te armamos el plan ideal.',
contact_p:'Sin letras pequeñas ni tecnicismos confusos. Analizamos tu situación actual y te decimos exactamente cómo poner tu negocio en el mapa digital.',
contact_perk1:'<strong>Asesoría directa y personalizada:</strong> Hablas con nuestro asesor comercial en San Diego, Carabobo, para consultar precios, paquetes y evaluar lo que tu negocio necesita sin compromiso.',
contact_perk2:'<strong>Desarrollo técnico a medida:</strong> Tu página, dominio y herramientas quedan en manos de programación especializada, sin plantillas genéricas rotas.',
contact_perk3:'<strong>Presupuesto claro:</strong> Sabrás el monto exacto desde el primer contacto, sin sorpresas ni mensualidades escondidas.',
contact_cta_status:'Asesor comercial en línea',
contact_cta_title:'Consulta precios y disponibilidad',
contact_cta_desc:'Nuestro asesor te atenderá por WhatsApp para comercios de San Diego, Valencia, toda Venezuela o proyectos internacionales.',
contact_cta_btn:'Consultar precios por WhatsApp',
contact_ig_prefix:'O síguenos en',
aria_jolie_gallery:'Galería de Jolie Fragrances',
jolie1_alt:'Jolie Fragrances - Portada y asesoría de perfumes exclusivos',
jolie2_alt:'Jolie Fragrances - Selección de combos y maridajes olfativos',
jolie3_alt:'Jolie Fragrances - Catálogo interactivo de fragancias y pedidos directos',
gtech1_alt:'G-Tech.us - Vista de catálogo y productos',
gtech2_alt:'G-Tech.us - Identidad y plataforma digital',
gtech3_alt:'G-Tech.us - Interfaz móvil y experiencia de usuario',
aria_maps_sim:'Simulador de perfil Google Maps',
aria_clients_nav:'Navegación entre clientes',
aria_prev_client:'Ver cliente anterior',
aria_next_client:'Ver siguiente cliente',
aria_clients_carousel:'Carrusel de proyectos de clientes',
aria_gtech_gallery:'Galería de G-Tech.us',
aria_prev_img:'Imagen anterior',
aria_next_img:'Siguiente imagen',
aria_dot1:'Ir a diapositiva 1',
aria_dot2:'Ir a diapositiva 2',
aria_dot3:'Ir a diapositiva 3',
aria_footer_wa:'WhatsApp Asesor comercial al +58 414-9428999',
aria_footer_ig:'Instagram de VENDO, somosvendo.ve',
title_verified:'Perfil verificado',
title_prev:'Anterior',
title_next:'Siguiente',
modal_tag:'COTIZACIÓN RÁPIDA · ASESOR COMERCIAL',
modal_title:'Consulta precios y disponibilidad para tu negocio',
modal_desc:'Completa estos breves datos para que nuestro asesor en San Diego te atienda con la propuesta exacta para tu marca.',
modal_company_label:'Nombre de tu empresa o negocio *',
modal_company_placeholder:'Ej: Inversiones El Roble',
modal_category_label:'¿A qué rubro pertenece tu negocio? *',
modal_service_label:'¿Qué necesitas principalmente? *',
modal_location_label:'¿Dónde está ubicado tu negocio? *',
modal_ig_label:'Cuenta de Instagram (opcional)',
modal_ig_placeholder:'somosvendo.ve',
modal_ig_preview_status:'Cuenta lista para vincular a tu web',
modal_ig_verify:'Verificar mi perfil en Instagram',
modal_live_msg_title:'Mensaje listo para enviar a WhatsApp:',
modal_submit_btn:'Enviar consulta al asesor por WhatsApp',
aria_modal_close:'Cerrar ventana',
chip_cat_ferreteria:'🔧 Ferretería',
chip_cat_comunicaciones:'📻 Comunicaciones (Radios)',
chip_cat_comida:'🍔 Comida / Gastronomía',
chip_cat_perfumeria:'🧴 Perfumería',
chip_cat_relojería:'⌚ Relojería / Accesorios',
chip_cat_ropa:'🛍️ Ropa / Calzado',
chip_cat_servicios:'💼 Servicios profesionales',
chip_cat_otro:'✍️ Otro rubro',
val_ferreteria:'Ferretería',
val_comunicaciones:'Comunicaciones (Radios)',
val_comida:'Comida / Gastronomía',
val_perfumeria:'Perfumería',
val_relojería:'Relojería / Accesorios',
val_ropa:'Ropa / Calzado',
val_servicios:'Servicios profesionales',
val_otro:'Otro rubro',
chip_svc_paquete:'🚀 Paquete Completo (Web + Maps)',
chip_svc_web:'🌐 Página web con catálogo',
chip_svc_maps:'📍 Perfil en Google Maps',
val_paquete:'Paquete Completo (Web + Maps)',
val_web:'Página web con catálogo',
val_maps:'Perfil en Google Maps',
chip_loc_sandiego:'📍 San Diego',
chip_loc_valencia:'📍 Valencia',
chip_loc_otra_ve:'🇻🇪 Otra ciudad (Venezuela)',
chip_loc_internacional:'🌎 Internacional',
val_sandiego:'San Diego, Carabobo',
val_valencia:'Valencia, Carabobo',
val_otra_ve:'Otra ciudad de Venezuela',
val_internacional:'Internacional / Fuera del país',
footer_wa:'WhatsApp Asesor: +58 414-9428999',
footer_ig:'Instagram: @somosvendo.ve',
footer_geo:'San Diego & Valencia · Carabobo, Venezuela'
},

en:{
page_title:'VENDO | Digital presence for businesses & local brands',
nav_contact:'Contact us',
hero_h1:'Get your business found, seen, and selling.',
hero_p:'Websites and Google Maps optimization for businesses in San Diego, Valencia, and Carabobo, as well as international brands. Transparent work with proven results.',
hero_cta_advisor:'Talk to an advisor',
hero_cta_services:'View services',
do_bubble:"I'm Do. I'm here to help optimize your brand.",
do_alt:'Do, the VENDO mascot',
maps_tag:'LIVE SIMULATOR · PROVEN IMPACT',
maps_h2:'The difference between getting found or skipped.',
maps_p:'82% of shoppers search on Google before visiting a store or ordering delivery. An abandoned profile drives customers away; an optimized profile builds instant trust and sales.',
maps_feat1_title:'Exact pin & directions:',
maps_feat1_p:'Your customers arrive straight at your door via Google Maps or Waze without getting lost.',
maps_feat2_title:'Direct WhatsApp button:',
maps_feat2_p:'Customers view your catalog, menu, or products and contact you in a single tap from Google.',
maps_feat3_title:'Real customer reviews:',
maps_feat3_p:'We provide proven strategies to gather 5-star reviews from real clients and stay in the local Top 3.',
maps_toggle_bad:'Unoptimized',
maps_toggle_good:'With VENDO',
maps_cat:'Local business · San Diego / Valencia, Carabobo',
maps_act_call:'Call',
maps_act_wa:'WhatsApp',
maps_act_dir:'Directions',
maps_act_web:'Website',
sim_good_badge:'✓ Verified on Google',
sim_good_name:'Your Business',
sim_good_stars:'★★★★★',
sim_good_rating:'4.9',
sim_good_reviews:'(58 reviews)',
sim_good_status:'Open now · Closes 8:00 PM',
sim_good_note:'✓ Profile optimized and linked to WhatsApp by VENDO',
sim_bad_badge:'⚠️ Not verified',
sim_bad_name:'Your Business (Unclaimed)',
sim_bad_stars:'★★★☆☆',
sim_bad_rating:'3.1',
sim_bad_reviews:'(2 old reviews)',
sim_bad_status:'Hours unconfirmed · May be closed',
sim_bad_note:'⚠️ Are you the owner of this business? Claim it on Google',
services_h2:'What we do for your business',
service1_h3:'Websites',
service1_p:'Fast, mobile-first websites featuring your product catalog, contact info, and a direct WhatsApp button.',
service2_h3:'Google Maps',
service2_p:'Business Profile claimed, verified, and ranked so local neighbors and visitors find you first.',
service3_h3:'Local Marketing',
service3_p:'Genuine customer reviews, WhatsApp Business setup, digital catalogs, and conversion-focused funnels.',
bento_tag:'WHY VENDO · PROFESSIONAL STANDARD',
bento_h2:'Your brand deserves more than a borrowed link.',
bento_subtitle:'Many build websites; very few actually solve your visibility and customer acquisition. Here is how we do it:',
bento_d_badge:'Your Digital Identity',
bento_d_title:'Tired of your business link looking like this?',
bento_d_bad_status:'❌ Generic third-party platform links',
bento_d_bad_note:"Long, confusing to customers, and advertises someone else's platform.",
bento_d_good_status:'✅ Your own custom domain with VENDO',
bento_d_good_note:'Clean, memorable, and professional. Fully configured by us (DNS, SSL certificate, and hosting).',
bento_ssl:'· SSL Secured',
bento_d_footer:'You never deal with confusing control panels. We deliver your domain fully active so you can focus solely on selling.',
bento_s_badge:'Real Visibility',
bento_s_title:"We don't build websites to remain invisible.",
bento_s_p:'A website that is not indexed is like opening a store in the middle of nowhere. We connect your site to Google Search Console to index your pages for local searches.',
seo_check1:'✓ URL indexing in Google',
seo_check2:'✓ Mobile search optimization',
seo_check3:'✓ Direct Google Maps connection',
bento_c_badge:'Your Profits',
bento_c_title:'0% sales commission',
bento_c_p:'Shoppers browse your catalog and send orders straight to your WhatsApp. No middlemen, no commission fees taken.',
bento_sup_badge:'Worry-Free Service',
bento_sup_title:'Dedicated human support',
bento_sup_p:'Need price updates or new products added? Message us on chat and our technical team handles it promptly.',
clients_tag:'CASE STUDIES · REAL RESULTS',
clients_h2:'Who has already stepped into digital visibility?',
clients_p:'We craft the digital storefront for businesses that compete seriously. Proven impact for local merchants and international clients.',
gtech_badge:'🇺🇸 International Project · United States',
gtech_desc:'Modern digital product catalog and tech parts showcase for the US market. High-speed architecture, clean branding, and direct sales focus.',
gtech_link:'Visit gtechs.us',
jolie_badge:'🛍️ Digital Catalog & Direct Sales',
jolie_desc:'Interactive e-commerce web platform for exclusive fragrance collections. Built for smooth mobile browsing and instant WhatsApp order placement.',
jolie_link:'Visit jolie-fragrances',
contact_tag:'NEXT STEP · NO OBLIGATION',
contact_h2:"Tell us about your business and we'll craft the right plan.",
contact_p:'No confusing technical jargon. We analyze your current digital presence and show you exactly how to scale your brand.',
contact_perk1:'<strong>Direct commercial advisor:</strong> Chat directly with our sales advisor to discuss plans, custom packages, and pricing with zero hassle.',
contact_perk2:'<strong>Custom technical development:</strong> Your website, domain, and SEO are backed by dedicated software engineering, not broken templates.',
contact_perk3:'<strong>Transparent pricing:</strong> You will know the exact budget from day one with no hidden costs or surprise monthly fees.',
contact_cta_status:'Advisor online on WhatsApp',
contact_cta_title:'Inquire about plans and pricing',
contact_cta_desc:'Our sales advisor is available via WhatsApp for businesses in Carabobo, Venezuela, and international projects.',
contact_cta_btn:'Inquire pricing via WhatsApp',
contact_ig_prefix:'Follow us on',
aria_jolie_gallery:'Jolie Fragrances gallery',
jolie1_alt:'Jolie Fragrances - Hero showcase and luxury perfume consulting',
jolie2_alt:'Jolie Fragrances - Exclusive perfume pairings and combo sets',
jolie3_alt:'Jolie Fragrances - Interactive catalog and direct WhatsApp ordering',
gtech1_alt:'G-Tech.us - Product catalog and showcase',
gtech2_alt:'G-Tech.us - Brand identity and digital platform',
gtech3_alt:'G-Tech.us - Mobile interface and user experience',
aria_maps_sim:'Google Maps business profile simulator',
aria_clients_nav:'Client navigation',
aria_prev_client:'View previous client',
aria_next_client:'View next client',
aria_clients_carousel:'Client project carousel',
aria_gtech_gallery:'G-Tech.us gallery',
aria_prev_img:'Previous image',
aria_next_img:'Next image',
aria_dot1:'Go to slide 1',
aria_dot2:'Go to slide 2',
aria_dot3:'Go to slide 3',
aria_footer_wa:'VENDO sales advisor on WhatsApp at +58 414-9428999',
aria_footer_ig:'VENDO on Instagram, somosvendo.ve',
title_verified:'Verified profile',
title_prev:'Previous',
title_next:'Next',
modal_tag:'FAST QUOTE · SALES ADVISOR',
modal_title:'Check plans and pricing for your business',
modal_desc:'Fill in these quick details so our sales advisor in San Diego can provide you with the exact proposal for your brand.',
modal_company_label:'Business or Brand Name *',
modal_company_placeholder:'E.g.: Apex Tech Solutions',
modal_category_label:'What industry does your business belong to? *',
modal_service_label:'What do you primarily need? *',
modal_location_label:'Where is your business located? *',
modal_ig_label:'Instagram Account (optional)',
modal_ig_placeholder:'yourbrand',
modal_ig_preview_status:'Account ready to link with your site',
modal_ig_verify:'Verify profile on Instagram',
modal_live_msg_title:'Message formatted for WhatsApp:',
modal_submit_btn:'Send inquiry to advisor on WhatsApp',
aria_modal_close:'Close window',
chip_cat_ferreteria:'🔧 Hardware store',
chip_cat_comunicaciones:'📻 Communications (Radios)',
chip_cat_comida:'🍔 Food / Gastronomy',
chip_cat_perfumeria:'🧴 Perfumery',
chip_cat_relojería:'⌚ Watchmaking / Accessories',
chip_cat_ropa:'🛍️ Clothing / Footwear',
chip_cat_servicios:'💼 Professional services',
chip_cat_otro:'✍️ Other industry',
val_ferreteria:'Hardware store',
val_comunicaciones:'Communications (Radios)',
val_comida:'Food / Gastronomy',
val_perfumeria:'Perfumery',
val_relojería:'Watchmaking / Accessories',
val_ropa:'Clothing / Footwear',
val_servicios:'Professional services',
val_otro:'Other industry',
chip_svc_paquete:'🚀 Full Package (Web + Maps)',
chip_svc_web:'🌐 Website with catalog',
chip_svc_maps:'📍 Google Maps profile',
val_paquete:'Full Package (Web + Maps)',
val_web:'Website with catalog',
val_maps:'Google Maps profile',
chip_loc_sandiego:'📍 San Diego',
chip_loc_valencia:'📍 Valencia',
chip_loc_otra_ve:'🇻🇪 Other city (Venezuela)',
chip_loc_internacional:'🌎 International',
val_sandiego:'San Diego, Carabobo',
val_valencia:'Valencia, Carabobo',
val_otra_ve:'Another city in Venezuela',
val_internacional:'International / Outside the country',
footer_wa:'WhatsApp Advisor: +58 414-9428999',
footer_ig:'Instagram: @somosvendo.ve',
footer_geo:'San Diego & Valencia · Carabobo, Venezuela'
}
};

const switchBtns=document.querySelectorAll('.lang-switch-btn');

function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}

function detectInitialLanguage(){
const saved=store('vendo_lang');
if(saved==='es'||saved==='en')return saved;
const browserLang=(navigator.language||navigator.userLanguage||'es').toLowerCase();
if(browserLang.startsWith('en'))return 'en';
try{
const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';
if(/New_York|Chicago|Los_Angeles|London|Denver/.test(tz))return 'en';
}catch(e){}
return 'es';
}

let currentLang=detectInitialLanguage();

// Expuesto para módulos dependents (p. ej. el simulador de Google Maps)
window.VENDO_I18N={
get lang(){return currentLang;},
t(key){const d=translations[currentLang]||{};return d[key]!==undefined?d[key]:(translations.es[key]||'');},
toggle(){applyLanguage(currentLang==='es'?'en':'es');}
};

function waUrlFor(lang){return 'https://wa.me/584149428999?text='+encodeURIComponent(waMessages[lang]||waMessages.es);}

function applyLanguage(lang){
if(!translations[lang])return;
currentLang=lang;
document.documentElement.lang=lang;
store('vendo_lang',lang);
const dict=translations[lang];
document.querySelectorAll('[data-i18n]').forEach(el=>{
const key=el.getAttribute('data-i18n');
if(dict[key]!==undefined)el.innerHTML=dict[key];
});
document.querySelectorAll('[data-i18n-alt]').forEach(el=>{
const key=el.getAttribute('data-i18n-alt');
if(dict[key]!==undefined)el.setAttribute('alt',dict[key]);
});
document.querySelectorAll('[data-i18n-aria]').forEach(el=>{
const key=el.getAttribute('data-i18n-aria');
if(dict[key]!==undefined)el.setAttribute('aria-label',dict[key]);
});
document.querySelectorAll('[data-i18n-title]').forEach(el=>{
const key=el.getAttribute('data-i18n-title');
if(dict[key]!==undefined)el.setAttribute('title',dict[key]);
});
document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
const key=el.getAttribute('data-i18n-placeholder');
if(dict[key]!==undefined)el.setAttribute('placeholder',dict[key]);
});
document.querySelectorAll('[data-i18n-href]').forEach(el=>{
if(el.getAttribute('data-i18n-href')==='wa')el.setAttribute('href',waUrlFor(lang));
});
if(dict.page_title)document.title=dict.page_title;
document.querySelectorAll('.flag-svg').forEach(el=>{el.innerHTML=flags[lang]||'';});
document.querySelectorAll('[data-lang-label]').forEach(el=>{el.textContent=lang.toUpperCase();});
document.querySelectorAll('.lang-switch-btn').forEach(el=>{el.setAttribute('aria-label',lang==='es'?'Switch to English':'Cambiar a Español');});
document.dispatchEvent(new CustomEvent('vendo:langchange',{detail:{lang:lang}}));
}

switchBtns.forEach(b=>b.addEventListener('click',()=>applyLanguage(currentLang==='es'?'en':'es')));

applyLanguage(currentLang);

// Detección geográfica por IP (no bloquea la carga). Requiere conexión; si falla se conserva el idioma detectado.
if(!store('vendo_lang')){
fetch('https://api.country.is/',{mode:'cors'})
.then(r=>r.ok?r.json():Promise.reject(new Error('http')))
.then(data=>{
if(data&&data.country){
const enCountries=['US','CA','GB','AU','NZ','IE'];
const detected=enCountries.includes(data.country)?'en':'es';
if(detected!==currentLang)applyLanguage(detected);
}
})
.catch(()=>{});
}
})();

// ==========================================
// MODAL DE COTIZACIÓN PREVIA A WHATSAPP
// ==========================================
(function initQuoteModal(){
const modal=document.getElementById('quote-modal');
const closeBtn=document.getElementById('modal-close-btn');
const form=document.getElementById('quote-form');
if(!modal||!form)return;

const triggerBtns=[...document.querySelectorAll('.open-quote-modal')];
const card=modal.querySelector('.modal-card');
const inputCompany=document.getElementById('company-name');
const inputCategory=document.getElementById('selected-category');
const inputService=document.getElementById('selected-service');
const inputLocation=document.getElementById('selected-location');
const inputIg=document.getElementById('instagram-handle');

const igPreviewBox=document.getElementById('ig-preview-box');
const igPreviewUser=document.getElementById('ig-preview-user');
const igVerifyLink=document.getElementById('ig-verify-link');
const igAvatarLetter=document.getElementById('ig-avatar-letter');
const liveMsgPreview=document.getElementById('live-msg-preview');

let lastFocused=null;

// El valor de cada chip es una clave estable: la etiqueta y el valor que viaja
// al mensaje de WhatsApp se resuelven por i18n, para que ambos traducibles.
function t(key){const i=window.VENDO_I18N;return i?i.t(key):'';}
function isEn(){return document.documentElement.lang==='en';}
function chipLabel(key){return t('chip_'+key);}
function chipValue(key){return t('val_'+key)||key;}
// Instagram solo admite letras, numeros, puntos y guion bajo. Sin este filtro,
// un "/" acababa en el enlace como %2F y la URL ya no representaba al usuario.
function igHandle(){return inputIg.value.trim().replace(/^@+/,'').replace(/\s+/g,'').replace(/[^A-Za-z0-9._]/g,'');}

function openModal(e){
if(e)e.preventDefault();
lastFocused=document.activeElement;
modal.classList.add('active');
modal.setAttribute('aria-hidden','false');
document.body.style.overflow='hidden';
updateLiveMessage();
setTimeout(()=>inputCompany?.focus(),150);
}

function closeModal(){
if(!modal.classList.contains('active'))return;
modal.classList.remove('active');
modal.setAttribute('aria-hidden','true');
document.body.style.overflow='';
if(lastFocused&&document.contains(lastFocused))lastFocused.focus();
}

triggerBtns.forEach(btn=>btn.addEventListener('click',openModal));
closeBtn?.addEventListener('click',closeModal);
modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
window.addEventListener('keydown',e=>{
if(!modal.classList.contains('active'))return;
if(e.key==='Escape'){closeModal();return;}
// Retiene el foco dentro del modal mientras está abierto
if(e.key==='Tab'){
const f=[...card.querySelectorAll('button,input,a[href],[tabindex]:not([tabindex="-1"])')]
.filter(el=>el.offsetParent!==null&&!el.disabled);
if(!f.length)return;
const first=f[0],last=f[f.length-1];
if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
}
});

// Configurar Chips Seleccionables (exclusión mutua)
function setupChips(containerId,hiddenInput){
const container=document.getElementById(containerId);
if(!container)return;
const chips=[...container.querySelectorAll('.chip-btn')];
chips.forEach(chip=>chip.addEventListener('click',()=>{
chips.forEach(c=>{c.classList.remove('active');c.setAttribute('aria-pressed','false');});
chip.classList.add('active');
chip.setAttribute('aria-pressed','true');
hiddenInput.value=chip.getAttribute('data-value');
updateLiveMessage();
}));
}

setupChips('category-chips',inputCategory);
setupChips('service-chips',inputService);
setupChips('location-chips',inputLocation);

// Vista Previa de Instagram en vivo
inputIg?.addEventListener('input',()=>{
const raw=igHandle();
if(raw){
igPreviewBox.style.display='flex';
igPreviewUser.textContent='@'+raw;
igAvatarLetter.textContent=raw.charAt(0).toUpperCase();
igVerifyLink.href='https://instagram.com/'+encodeURIComponent(raw);
}else{
igPreviewBox.style.display='none';
igVerifyLink.href='#';
}
updateLiveMessage();
});

inputCompany?.addEventListener('input',updateLiveMessage);

// Generador de Mensaje en Tiempo Real
function updateLiveMessage(){
const company=inputCompany.value.trim()||(isEn()?'[Your Business Name]':'[Nombre de tu empresa]');
const category=chipValue(inputCategory.value);
const service=chipValue(inputService.value);
const location=chipValue(inputLocation.value);
const igRaw=igHandle();
const igText=igRaw?'@'+igRaw:(isEn()?'Not yet / In progress':'Aún no poseo');

let msg;
if(isEn()){
msg=`Hello! I would like to request a quote for my business:\n\n`+
`🏢 Business: ${company}\n`+
`📦 Category: ${category}\n`+
`🎯 Service Needed: ${service}\n`+
`📍 Location: ${location}\n`+
`📸 Instagram: ${igText}\n\n`+
`What plans and options do you have available?`;
}else{
msg=`¡Hola! Me gustaría cotizar un plan para mi negocio:\n\n`+
`🏢 Empresa: ${company}\n`+
`📦 Rubro: ${category}\n`+
`🎯 Servicio requerido: ${service}\n`+
`📍 Ubicación: ${location}\n`+
`📸 Instagram: ${igText}\n\n`+
`¿Qué planes y opciones tienen disponibles?`;
}
if(liveMsgPreview)liveMsgPreview.textContent=msg;
return msg;
}

// Si el usuario cambia el idioma con el modal abierto, el mensaje se regenera
document.addEventListener('vendo:langchange',updateLiveMessage);

// Enviar a WhatsApp
form.addEventListener('submit',e=>{
e.preventDefault();
const finalMsg=updateLiveMessage();
window.open('https://wa.me/584149428999?text='+encodeURIComponent(finalMsg),'_blank','noopener');
closeModal();
});

// Estado inicial del mensaje
updateLiveMessage();
})();
