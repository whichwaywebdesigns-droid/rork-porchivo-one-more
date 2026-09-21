/*! Porchivo static-page i18n — EN/ES swap for the 4 step pages.
 * Syncs with the site-wide language toggle via localStorage "porchivo.language"
 * (same key i18next-browser-languagedetector uses on the SPA, load:"languageOnly").
 * Pages are authored in English; originals are snapshotted at load so toggling
 * back to EN always restores them byte-for-byte. Supports ?lang=es|en deep links.
 */
(function () {
  "use strict";

  var KEY = "porchivo.language";
  var page = document.body.getAttribute("data-pv-page");
  var DICTS = {
    register: {
      meta: {
        title: "Registra tu comunidad — Porchivo",
        desc: "Trae tu HOA, comunidad de departamentos o propiedad administrada a Porchivo en minutos, no en meses. Sin hardware. Sin proyecto de TI. Los residentes se unen gratis.",
      },
      alt: { ".hero-shot": "App de Porchivo — pantalla de código de invitación de una comunidad registrada" },
      sel: {
        ".nav-links a:not(.nav-cta)": ["Cómo funciona", "Funciones", "Precios"],
        ".nav-cta": "Registra tu comunidad",
        ".eyebrow": "~Paso 01 — Configuración de la comunidad",
        ".hero h1": 'Registra tu <span class="grad">comunidad</span> en minutos, no en meses.',
        ".hero-sub":
          "Trae tu HOA, comunidad de departamentos o propiedad administrada a Porchivo. Crea tu perfil, agrega lo básico e invita a tu gente. Sin hardware que comprar. Sin cita de instalación. Nada del frágil proyecto 'involucremos a TI' que dura hasta que el sol se apague.",
        ".hero-ctas .btn-primary": "Registra tu comunidad →",
        ".hero-ctas .btn-ghost": "Mira qué puedes configurar",
        ".proof-item": ["~~5 minutos de configuración", "~Cero hardware", "~Sin proyecto de TI"],
        ".hc-title": "Configuración de la comunidad",
        ".hc-badge": "VISTA EN VIVO",
        ".step-row h4": [
          "Crea el perfil de tu comunidad",
          "Agrega a tu equipo",
          "Invita a los residentes",
          "Personaliza las entregas",
        ],
        ".step-row p": [
          "Nombre, dirección y tipo de propiedad: listo en aproximadamente un minuto.",
          "Administradores, personal de recepción y miembros de la mesa directiva reciben el acceso correcto.",
          "Comparte un enlace simple o una invitación por correo: los residentes se unen gratis.",
          "Configura cómo tu propiedad maneja los paquetes entrantes y las alertas.",
        ],
        ".hc-progress p": "<strong>4 de 5 pasos completados</strong> — tiempo promedio de configuración: 4 min 38 s",
        ".stat-num": ["~5 min", "$0", "190+"],
        ".stat-label": [
          "para registrar una comunidad y empezar a proteger entregas",
          "en hardware, instalación o integración de TI",
          "países con soporte: funciona donde esté tu propiedad",
        ],
        "#how .section-tag": "Después de registrarte",
        "#how h2": "Lo que puedes hacer en tu primera sesión",
        "#how .section-sub":
          "Todo lo siguiente está disponible en cuanto tu comunidad se active — sin extras, sin ventas adicionales, sin llamadas de ventas.",
        "#how .checklist li": [
          "~Configura el nombre, la dirección y el tipo de propiedad de tu comunidad",
          "~Agrega administradores, personal de recepción, miembros de la mesa directiva o miembros autorizados del equipo",
          "~Invita a los residentes con un enlace simple o una invitación por correo",
          "~Organiza entregas, actividad de paquetes y notificaciones en un solo lugar",
          "~Personaliza cómo tu propiedad maneja las entregas entrantes",
          "~Empieza con una comunidad: agrega más propiedades conforme creces",
        ],
        "#features .section-tag": "Hecho para propiedades reales",
        "#features h2": "Un punto de partida simple. Cero reemplazos.",
        "#features .split > div:first-child > p": [
          "Ya sea que administres una HOA pequeña, un edificio de condominios, una comunidad de departamentos o varias propiedades, Porchivo le da a tu equipo un punto de partida simple — <strong>sin obligarte a reemplazar cada sistema que ya usas.</strong>",
          "Empieza con una comunidad. Agrega más conforme crezcas. Tus flujos de trabajo existentes se quedan intactos mientras el caos de paquetes por fin tiene un solo hogar.",
        ],
        "#features .split .btn-primary": "Empieza gratis →",
        "#features .property-item h4": ["HOAs y vecindarios", "Edificios de condominios", "Comunidades de departamentos", "Operadores multipropiedad"],
        "#features .property-item p": [
          "Protege cada porche de la cuadra con un solo registro.",
          "Flujos de recepción y administración incluidos desde el día uno.",
          "Los residentes se unen gratis con tu código de invitación en un minuto.",
          "Agrega portafolios ahora o después: escala sin cambiar de plataforma.",
        ],
        ".final-cta .section-tag": "Listo cuando tú lo estés",
        ".final-cta h2": "¿Listo para que las entregas sean menos caóticas?",
        ".final-cta .section-sub":
          "Registra tu comunidad hoy y deja tu propiedad configurada en unos cinco minutos. Los residentes se unen gratis — siempre.",
        ".final-cta .btn-primary": "Registra tu comunidad →",
        ".fineprint": '¿Preguntas? Escribe a <a href="mailto:support@porchivo.com">support@porchivo.com</a> — responde una persona humana, rápido.',
      },
    },
    residents: {
      meta: {
        title: "Los residentes se unen gratis — Porchivo",
        desc: "Los residentes descargan la app de Porchivo y se unen con el código de invitación de tu comunidad en un minuto. Siempre gratis — sin compras dentro de la app, sin ventas adicionales.",
      },
      alt: { ".hero-shot": "Un Porch Partner entrega un paquete a un vecino sobre la cerca" },
      sel: {
        ".nav-links a:not(.nav-cta)": ["Cómo se unen", "Porch Partners", "Gratis, siempre"],
        ".nav-cta": "Obtén el código de invitación",
        ".eyebrow": "~Paso 02 — Los residentes se unen gratis",
        ".hero h1": 'Los residentes se unen <span class="grad">en un minuto.</span> Y nunca pagan un centavo.',
        ".hero-sub":
          "Los residentes descargan la app de Porchivo y se unen a tu comunidad con un código de invitación simple — sin maratones de formularios, sin hardware, sin tickets de soporte. Acceso completo sin costo: sin compras dentro de la app, sin ventas adicionales, sin costo para los residentes. Nunca.",
        ".hero-ctas .btn-primary": "Descarga la app →",
        ".hero-ctas .btn-ghost": "Conviértete en Porch Partner",
        ".proof-item": ["~Gratis para los residentes — siempre", "~Se unen en ~1 minuto", "~Solo con consentimiento"],
        ".hc-title": "Invitación de tu comunidad",
        ".hc-badge": "EN VIVO",
        ".invite-box p": "Comparte este código por tu lista de correo o portal de residentes",
        ".join-row h4": ["Marta R. — Depto. 4B", "Devon K. — Depto. 7A", "Amara S. — Depto. 12C"],
        ".join-row p": [
          "Se unió con código de invitación · 38 s",
          "Se unió con código de invitación · 51 s",
          "Optó por ser Porch Partner",
        ],
        ".join-row .status": ["SE UNIÓ", "SE UNIÓ", "PARTNER"],
        ".stat-num": ["~1 min", "$0", "100%"],
        ".stat-label": [
          "para que un residente descargue la app y se una a tu comunidad",
          "para los residentes — sin compras dentro de la app, sin ventas adicionales, nunca",
          "opcional. Ningún residente está obligado a hacer nada",
        ],
        "#how .section-tag": "Onboarding sin fricción",
        "#how h2": "Cómo se unen los residentes a tu comunidad",
        "#how .section-sub":
          "Tu equipo de administración distribuye un código de invitación por tu correo o portal de residentes existente. Ese es todo el plan de lanzamiento.",
        "#how .card h3": ["1. Descarga la app", "2. Ingresa el código de invitación", "3. Queda protegido al instante"],
        "#how .card p": [
          "Los residentes consiguen Porchivo en el App Store o Google Play — en el teléfono que ya tienen. Nada que instalar en la propiedad, nada que configurar.",
          "Un código los conecta con tu comunidad. Están dentro, verificados y recibiendo protección de paquetes — en aproximadamente un minuto.",
          "Puntaje de riesgo, alertas de robo y entregas con Porch Partners se activan de inmediato. Los residentes pueden unirse a la red de Partners cuando quieran.",
        ],
        "#partner .section-tag": "Opcional — siempre con consentimiento",
        "#partner h2": "Los residentes pueden ser Porch Partners",
        "#partner .split > div:first-child > p": [
          "Los Porch Partners son vecinos de confianza que optan por recibir y guardar entregas de otros cuando el riesgo es alto o nadie está en casa. <strong>Los Partners ganan ingreso extra por cada entrega segura</strong> y construyen un puntaje de reputación en el vecindario.",
          "Es solo opcional — ningún residente está obligado, y tu mesa directiva controla si la red está activada para tu comunidad.",
        ],
        "#partner .split .btn-primary": "Conoce la red de Partners →",
        "#partner .partner-item h4": ["Gana ingreso extra", "Construye reputación", "Entregas más seguras", "Control de la mesa directiva"],
        "#partner .partner-item p": [
          "Por cada entrega segura, pagado dentro de la app.",
          "Un puntaje del vecindario que crece con cada paquete cuidado con éxito.",
          "Los paquetes llegan a una persona, no a un porche vacío.",
          "Tu mesa directiva decide si la red está activada — los residentes deciden si se unen.",
        ],
        "#faq-strip .section-tag": "La letra pequeña (no hay)",
        "#faq-strip h2": "Los residentes siempre se unen gratis",
        "#faq-strip .section-sub":
          "Las comunidades tienen planes desde $99 USD al mes. Los residentes reciben la app completa sin costo — es el trato desde el día uno y nunca cambia.",
        "#faq-strip .checklist li": [
          "~Sin compras dentro de la app — nada que comprar, nunca",
          "~Sin ventas adicionales, niveles premium ni planes 'residente pro'",
          "~Únete con un código en un minuto — sin papeleo",
          "~Funciona en los teléfonos que los residentes ya tienen",
        ],
        ".final-cta .section-tag": "Listo cuando tú lo estés",
        ".final-cta h2": "Un código. Un minuto. Cada porche protegido.",
        ".final-cta .section-sub":
          "Envía a tus residentes un solo código de invitación y mira a toda tu comunidad conectarse — gratis para ellos, sin esfuerzo para ti.",
        ".final-cta .btn-primary": "Obtén el código de invitación de tu comunidad →",
        ".fineprint": '¿Preguntas? Escribe a <a href="mailto:support@porchivo.com">support@porchivo.com</a> — responde una persona humana, rápido.',
      },
    },
    risk: {
      meta: {
        title: "Puntaje de riesgo de paquetes en tiempo real — Porchivo",
        desc: "Cada paquete entrante recibe un puntaje de riesgo en tiempo real según horarios, actividad del vecindario e historial de robos — antes de llegar.",
      },
      alt: { ".hero-shot": "Equipo de administración de la HOA en la oficina de su comunidad" },
      sel: {
        ".nav-links a:not(.nav-cta)": ["Cómo funciona el puntaje", "Ciclo del puntaje", "Cadena de custodia"],
        ".nav-cta": "Registra tu comunidad",
        ".eyebrow": "~Paso 03 — Los puntajes se actualizan sin parar",
        ".hero h1": 'Cada paquete con puntaje <span class="grad">antes de llegar.</span>',
        ".hero-sub":
          "Cada entrega entrante recibe un puntaje de riesgo en tiempo real según patrones de horarios, actividad de robo en el vecindario y el historial de entregas de tu comunidad. Cuando un paquete cruza un umbral de riesgo, las alertas se disparan al instante — para que los piratas de porches nunca tengan ventaja.",
        ".hero-ctas .btn-primary": "Registra tu comunidad →",
        ".hero-ctas .btn-ghost": "Mira cómo funciona el puntaje",
        ".proof-item": ["~Puntaje en tiempo real", "~Alertas instantáneas por umbral", "~Cadena de custodia completa"],
        ".hc-title": "Puntaje de riesgo del paquete",
        ".hc-badge": "PUNTAJE EN VIVO",
        ".gauge-inner .of": "/ 100 riesgo",
        ".score-gauge p": "Paquete #4821 · Entrega en porche · ETA 14 min",
        ".factor-row .fname": [
          "Patrón de horarios de entrega",
          "Actividad de robo en el vecindario",
          "Historial de entregas de la comunidad",
        ],
        ".stat-num": ["21M", "Tiempo real", "Instantáneas"],
        ".stat-label": [
          "paquetes robados en EE. UU. cada año — el 4% de todo lo entregado",
          "puntajes que se actualizan continuamente según cambian las condiciones",
          "alertas en el momento en que un paquete cruza tu umbral de riesgo",
        ],
        "#factors .section-tag": "Bajo el capó",
        "#factors h2": "Tres señales. Un puntaje. Cero suposiciones.",
        "#factors .section-sub":
          "Porchivo pondera continuamente los factores que en realidad predicen el robo de paquetes — sin cámaras, sin sensores, sin adivinanzas.",
        "#factors .card h3": ["Patrones de horario", "Actividad del vecindario", "Tu historial de entregas"],
        "#factors .card p": [
          "Cuándo llega el paquete importa. Las entregas en ventanas de alto robo — a mediodía, cuando los porches están vacíos — reciben un puntaje más alto automáticamente.",
          "La actividad de robo en vivo alrededor de tu comunidad alimenta el puntaje. Una semana tranquila lo baja; un pico cercano lo sube — antes de que llegue el siguiente camión.",
          "Los patrones propios de tu comunidad afinan cada puntaje. Congestión, incidentes pasados y tendencias de entrega hacen las predicciones más precisas con el tiempo.",
        ],
        "#flow .section-tag": "Continuo, no de una sola vez",
        "#flow h2": "El ciclo de vida de un puntaje de riesgo",
        "#flow .section-sub":
          "Los puntajes no se fijan cuando se imprime la etiqueta. Se actualizan continuamente hasta que el paquete está seguro en tus manos.",
        ".flow-step h3": ["Envío detectado", "Puntaje base", "Actualizaciones continuas", "El umbral activa acciones"],
        ".flow-step p": [
          "El escaneo del transportista o la notificación del residente crea un registro del paquete en tu comunidad.",
          "Horario, actividad del vecindario e historial se combinan en un puntaje de riesgo inicial.",
          "Las condiciones cambian — el puntaje se reevalúa en tiempo real conforme se acerca la entrega.",
          "Al cruzar la línea, residentes y Porch Partners reciben una alerta al instante.",
        ],
        "#chain .section-tag": "Pruebas, no promesas",
        "#chain h2": "Cadena de custodia completa para cada entrega",
        "#chain .section-sub":
          "Cada entrega protegida se registra de extremo a extremo — quién la recibió, cuándo y a dónde fue después. Las disputas desaparecen cuando el registro es automático.",
        "#chain .checklist li": [
          "~Cada entrega con marca de tiempo y responsable",
          "~Identidad del residente y del Partner verificada en la app",
          "~Registro completo exportable para informes y reclamos",
          "~Cero hardware necesario para mantener el registro",
        ],
        ".final-cta .section-tag": "Entérate antes de que sea demasiado tarde",
        ".final-cta h2": "Deja de adivinar qué paquetes están en riesgo.",
        ".final-cta .section-sub":
          "Registra tu comunidad y empieza a puntuar cada entrega en tiempo real — sin hardware, sin proyecto de TI, sin cámaras.",
        ".final-cta .btn-primary": "Registra tu comunidad →",
        ".fineprint": '¿Preguntas? Escribe a <a href="mailto:support@porchivo.com">support@porchivo.com</a> — responde una persona humana, rápido.',
      },
    },
    alerts: {
      meta: {
        title: "Alertas instantáneas de robo de paquetes — Porchivo",
        desc: "Residentes y Porch Partners reciben una notificación al instante cuando se cruzan los umbrales de riesgo — con cadena de custodia completa para cada entrega.",
      },
      alt: { ".hero-shot": "App de Porchivo — pantalla de Puntaje de Seguridad con medidor de riesgo, factores que contribuyen y estadísticas de robo de paquetes" },
      sel: {
        ".nav-links a:not(.nav-cta)": ["Cómo funcionan las alertas", "Panel para administradores", "El ciclo completo"],
        ".nav-cta": "Registra tu comunidad",
        ".eyebrow": "~Paso 04 — Las alertas activan acciones",
        ".hero h1": 'Cuando el riesgo cruza la línea, <span class="grad">el vecindario se mueve.</span>',
        ".hero-sub":
          "En el momento en que un paquete cruza tu umbral de riesgo, los residentes y los Porch Partners cercanos reciben una notificación al instante — vecinos de confianza listos para recibir y guardar entregas de forma segura. Cada entrega queda registrada con una cadena de custodia completa, para que nada se esfume.",
        ".hero-ctas .btn-primary": "Registra tu comunidad →",
        ".hero-ctas .btn-ghost": "Mira las alertas en acción",
        ".proof-item": ["~Alertas instantáneas por umbral", "~Porch Partners en espera", "~Cadena de custodia registrada"],
        ".hc-title": "Feed de alertas de la comunidad",
        ".hc-badge": "● ALERTA ACTIVA",
        ".alert-item h4": [
          "Umbral de riesgo cruzado — Paquete #4821",
          "Amara S. aceptó la entrega",
          "Paquete recibido y registrado",
          "Entrega completa — residente notificado",
        ],
        ".alert-item p": [
          "Residente + 3 Porch Partners cercanos notificados",
          "Porch Partner · Depto. 12C · reputación 4.9",
          "Cadena de custodia actualizada · fotos adjuntas",
          "Marta R. confirmó la recolección en el Depto. 4B",
        ],
        ".alert-item .time": ["ahora", "1m", "4m", "26m"],
        ".custody-strip span": [
          "<strong>Cadena de custodia completa</strong> · 4 eventos · 0 vacíos · exportable",
          "<strong>Exportación lista</strong> · informe para la mesa directiva · CSV · 1 clic",
        ],
        ".stat-num": ["Instantáneas", "4%", "100%"],
        ".stat-label": [
          "alertas a residentes y Porch Partners cercanos en el momento en que se cruzan los umbrales",
          "de los paquetes entregados son robados del porche — las alertas cierran la ventana que los piratas necesitan",
          "de las entregas protegidas quedan registradas con una cadena de custodia completa y exportable",
        ],
        "#alerts .section-tag": "Del puntaje a la acción",
        "#alerts h2": "Qué pasa cuando se cruza el umbral",
        "#alerts .section-sub":
          "Sin tableros que vigilar. Sin cadenas de llamadas. La alerta hace la coordinación — los vecinos hacen la protección.",
        "#alerts .card h3": ["Residente alertado al instante", "Partners cercanos avisados", "Cada entrega queda registrada"],
        "#alerts .card p": [
          "El residente sabe que su paquete está en riesgo antes de que el repartidor se aleje — con opciones para redirigir, reprogramar o llamar a un Partner.",
          "Los Porch Partners que aceptaron participar y están cerca también reciben la alerta. El primero en aceptar toma la entrega — ganando ingreso y reputación.",
          "Aceptación, recepción, fotos y recolección final — todo registrado. Si alguna vez hay un reclamo, el historial ya existe.",
        ],
        "#insights .section-tag": "Para administradores y mesas directivas",
        "#insights h2": "Ve el panorama completo — no solo las alertas",
        "#insights .split > div:first-child > p": [
          "Los administradores ven <strong>zonas de riesgo activas, puntos calientes de robo y congestión de entregas</strong> en toda la comunidad, además de los registros de cadena de custodia de cada entrega protegida.",
          "Las señales de participación y satisfacción de los residentes te ayudan a <strong>detectar el riesgo de no renovación antes de que se vuelva una carta de renuncia.</strong> Todo es exportable para los informes de la mesa directiva.",
        ],
        "#insights .split .btn-primary": "Mira el panel para administradores →",
        ".insight-panel h4": "Mapa de riesgo de la comunidad en vivo — esta semana",
        ".zone-name": ["Maple Ct. — Edificio A", "Sycamore Row — Grupo de porches", "Recepción — Resguardos en lobby", "Elm Dr. — Zona de Partners"],
        "#recap .section-tag": "El ciclo completo",
        "#recap h2": "Cuatro pasos. Cero hardware. Un vecindario protegido.",
        "#recap .section-sub": "Ese es todo el sistema — del registro a la entrega resuelta.",
        ".step-chip .num": ["PASO 01", "PASO 02", "PASO 03", "PASO 04 — ESTÁS AQUÍ"],
        ".step-chip h3": ["Registra tu comunidad", "Los residentes se unen gratis", "Los puntajes se actualizan", "Las alertas activan acciones"],
        ".step-chip p": [
          "Cinco minutos. Sin hardware, sin TI.",
          "Un código de invitación. Un minuto aprox.",
          "Puntaje en tiempo real en cada paquete.",
          "Los vecinos se mueven. Las entregas quedan registradas.",
        ],
        ".final-cta .section-tag": "Entérate antes de que sea demasiado tarde",
        ".final-cta h2": "Tu comunidad podría estar protegida para esta noche.",
        ".final-cta .section-sub":
          "Regístrate en unos cinco minutos. Los residentes se unen gratis. Las alertas empiezan a funcionar en cuanto tu primer paquete esté en riesgo.",
        ".final-cta .btn-primary": "Registra tu comunidad →",
        ".fineprint": '¿Preguntas? Escribe a <a href="mailto:support@porchivo.com">support@porchivo.com</a> — responde una persona humana, rápido.',
      },
    },
  };

  var dict = DICTS[page];
  var snap = null;
  var pillButtons = null;

  function readKey() {
    try {
      return localStorage.getItem(KEY) || "";
    } catch (e) {
      return "";
    }
  }
  function writeKey(v) {
    try {
      localStorage.setItem(KEY, v);
    } catch (e) {
      /* private mode — choice just won't persist */
    }
  }
  function urlLang() {
    var m = /[?&]lang=(en|es)\b/i.exec(location.search);
    return m ? m[1].toLowerCase() : "";
  }
  function detect() {
    var u = urlLang();
    if (u) return u;
    var s = readKey().toLowerCase();
    if (s) return s.slice(0, 2) === "es" ? "es" : "en";
    var langs = navigator.languages || [navigator.language || "en"];
    for (var i = 0; i < langs.length; i++) {
      if (/^es\b/i.test(langs[i] || "")) return "es";
    }
    return "en";
  }
  function els(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }
  /** Patch only the trailing text node — keeps leading svg/span icons intact. */
  function setText(el, val) {
    if (val.charAt(0) === "~") {
      var body = val.slice(1);
      var nodes = el.childNodes;
      for (var i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].nodeType === 3 && nodes[i].nodeValue.trim()) {
          nodes[i].nodeValue = body;
          return;
        }
      }
      return;
    }
    el.innerHTML = val;
  }

  function snapshot() {
    var out = { sel: {}, alt: {}, meta: { title: document.title, desc: "" } };
    var md = document.querySelector('meta[name="description"]');
    if (md) out.meta.desc = md.getAttribute("content") || "";
    Object.keys(dict.sel).forEach(function (sel) {
      out.sel[sel] = els(sel).map(function (el) {
        return el.innerHTML;
      });
    });
    Object.keys(dict.alt || {}).forEach(function (sel) {
      out.alt[sel] = els(sel).map(function (el) {
        return el.getAttribute("alt") || "";
      });
    });
    return out;
  }

  function apply(lang) {
    if (!dict || !snap) return;
    Object.keys(dict.sel).forEach(function (sel) {
      var targets = els(sel);
      if (lang === "en") {
        var orig = snap.sel[sel];
        targets.forEach(function (el, i) {
          if (orig[i] != null) el.innerHTML = orig[i];
        });
        return;
      }
      var val = dict.sel[sel];
      if (Array.isArray(val)) {
        targets.forEach(function (el, i) {
          if (val[i] != null) setText(el, val[i]);
        });
      } else {
        targets.forEach(function (el) {
          setText(el, val);
        });
      }
    });
    Object.keys(dict.alt || {}).forEach(function (sel) {
      els(sel).forEach(function (el) {
        el.setAttribute("alt", lang === "es" ? dict.alt[sel] : snap.alt[sel][0] || "");
      });
    });
    document.documentElement.setAttribute("lang", lang);
    document.title = lang === "es" ? dict.meta.title : snap.meta.title;
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute("content", lang === "es" ? dict.meta.desc : snap.meta.desc);
    if (pillButtons) {
      Array.prototype.forEach.call(pillButtons, function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false");
      });
    }
  }

  function buildPill() {
    var nav = document.querySelector(".nav-links");
    if (!nav) return;
    var pill = document.createElement("div");
    pill.className = "pv-lang";
    pill.setAttribute("role", "group");
    pill.setAttribute("aria-label", "Language / Idioma");
    ["en", "es"].forEach(function (l) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = l.toUpperCase();
      b.setAttribute("data-lang", l);
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        writeKey(l);
        apply(l);
      });
      pill.appendChild(b);
    });
    var cta = nav.querySelector(".nav-cta");
    if (cta) nav.insertBefore(pill, cta);
    else nav.appendChild(pill);
    pillButtons = pill.querySelectorAll("button");
    var st = document.createElement("style");
    st.textContent =
      ".pv-lang{display:flex;align-items:center;gap:2px;background:rgba(255,255,255,.05);" +
      "border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:3px;flex-shrink:0;}" +
      ".pv-lang button{appearance:none;background:transparent;border:0;cursor:pointer;font-family:inherit;" +
      "font-size:.7rem;font-weight:800;letter-spacing:.06em;color:var(--muted);padding:6px 10px;" +
      "border-radius:999px;transition:background .2s,color .2s;}" +
      ".pv-lang button[aria-pressed='true']{background:var(--accent);color:#04121c;}" +
      ".pv-lang button:not([aria-pressed='true']):hover{color:var(--text);}";
    document.head.appendChild(st);
  }

  if (dict) {
    var u = urlLang();
    if (u) writeKey(u); // deep link pins the choice for the whole site
    snap = snapshot();
    buildPill();
    apply(detect());
  }
})();
