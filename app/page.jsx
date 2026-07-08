"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { HOOKS } from "@/lib/hooks";
import { presetToRange } from "@/lib/dates"; // date-math puro, sirve client-side (módulo COMPARAR)

// ─────────────────────────────────────────────────────────────
// VEREDICTO — Fase 1 · estética retro-VHS 80s
// P1 veredicto · P2 Qué hacer hoy · P3 Dashboard · P4 Top Performers · P5 Vistas por rol
// Datos = forma de tu Sheet de Juanita. Reemplazá SAMPLE por filas reales (Parte 8).
// ─────────────────────────────────────────────────────────────


const SAMPLE = [
  { id: 1,  nombre: "02-06 · Catálogo Dinámico",  fecha: "02-06-26", spend: 558000, roas: 21.2, cpa: 2122, ventas: 263, ang: "Catálogo", sec: "—",            split: "100/0", aud: "Advantage+",  hook: "—",           fmt: "CAT" },
  { id: 2,  nombre: "31-05 · HotSaleBotas",        fecha: "31-05-26", spend: 210000, roas: 24.6, cpa: 2187, ventas: 96,  ang: "HotSale",  sec: "Urgencia",     split: "70/30", aud: "Amplio",      hook: "HotSale",     fmt: "VID" },
  { id: 3,  nombre: "29-05 · ReseñaBota",          fecha: "29-05-26", spend: 88000,  roas: 27.0, cpa: 2146, ventas: 41,  ang: "Reseña",   sec: "Evidencia",    split: "60/40", aud: "Retargeting", hook: "Reseña",      fmt: "VID" },
  { id: 4,  nombre: "30-05 · FomoArizona",         fecha: "30-05-26", spend: 134000, roas: 22.1, cpa: 2310, ventas: 58,  ang: "Fomo",     sec: "Urgencia",     split: "80/20", aud: "Amplio",      hook: "Fomo",        fmt: "IMG" },
  { id: 5,  nombre: "01-06 · Catálogo Invierno",   fecha: "01-06-26", spend: 61000,  roas: 19.8, cpa: 2259, ventas: 27,  ang: "Catálogo", sec: "Estacional",   split: "100/0", aud: "Advantage+",  hook: "—",           fmt: "CAT" },
  { id: 6,  nombre: "28-05 · HookPetra",           fecha: "28-05-26", spend: 76000,  roas: 18.3, cpa: 2451, ventas: 31,  ang: "Identidad",sec: "Aspiracional", split: "60/40", aud: "Amplio",      hook: "Hook",        fmt: "VID" },
  { id: 7,  nombre: "27-05 · VersusBotas",         fecha: "27-05-26", spend: 52000,  roas: 17.4, cpa: 2600, ventas: 20,  ang: "Versus",   sec: "—",            split: "100/0", aud: "Amplio",      hook: "Versus",      fmt: "VID" },
  { id: 8,  nombre: "26-05 · StockBotas",          fecha: "26-05-26", spend: 120000, roas: 13.0, cpa: 3529, ventas: 34,  ang: "Stock",    sec: "Escasez",      split: "70/30", aud: "Amplio",      hook: "Stock",       fmt: "IMG" },
  { id: 9,  nombre: "25-05 · MemeBotas",           fecha: "25-05-26", spend: 70000,  roas: 11.2, cpa: 4117, ventas: 17,  ang: "Meme",     sec: "Humor",        split: "100/0", aud: "Amplio",      hook: "Meme",        fmt: "VID" },
  { id: 10, nombre: "24-05 · PromoBot",            fecha: "24-05-26", spend: 58000,  roas: 9.6,  cpa: 4833, ventas: 12,  ang: "Promo",    sec: "Precio",       split: "100/0", aud: "Amplio",      hook: "Promo",       fmt: "IMG" },
  { id: 11, nombre: "23-05 · DemoMonic",           fecha: "23-05-26", spend: 92000,  roas: 4.1,  cpa: 11500,ventas: 8,   ang: "Demo",     sec: "Producto",     split: "100/0", aud: "Amplio",      hook: "Demo",        fmt: "VID" },
  { id: 12, nombre: "03-06 · LanzamientoCitrus",   fecha: "03-06-26", spend: 31000,  roas: 33.0, cpa: 1409, ventas: 22,  ang: "Lanzamiento",sec: "—",          split: "100/0", aud: "Amplio",      hook: "Lanzamiento", fmt: "VID" },
  { id: 13, nombre: "04-06 · DemoBotas",           fecha: "04-06-26", spend: 1900,   roas: 312.0,cpa: 317,  ventas: 6,   ang: "Demo",     sec: "Producto",     split: "100/0", aud: "Amplio",      hook: "Demo",        fmt: "VID" },
  { id: 14, nombre: "04-06 · HookDenisse",         fecha: "04-06-26", spend: 12000,  roas: 6.2,  cpa: 4000, ventas: 3,   ang: "Identidad",sec: "—",            split: "100/0", aud: "Amplio",      hook: "Hook",        fmt: "IMG" },
];

const BUCKETS = {
  Escalar:       { color: "#2E8B6B", bg: "#DCE9E1", desc: "Cumple ROAS y CPA. Escalá: más budget al conjunto/campaña donde corre." },
  Mantener:      { color: "#C2861F", bg: "#F1E4C4", desc: "Cerca del objetivo y rentable. Sostené y vigilá." },
  Pausar:        { color: "#C5362B", bg: "#F1D9D3", desc: "Por debajo del objetivo. Apagá o iterá." },
  "Observación": { color: "#857A6A", bg: "#E5DBC8", desc: "Spend bajo el piso. Data no confiable todavía." },
};
const ORDER = { Escalar: 0, Pausar: 1, Mantener: 2, "Observación": 3 };

function veredicto(r, u, modo = "ventas") {
  if (r.spend < u.pisoSpend) return "Observación";
  if (modo === "mensajes") {
    // mensajes: juzga por costo por conversación (menor = mejor) + que tenga conversaciones
    if (!r.conversaciones) return "Pausar";
    if (r.costoConv <= u.costoMax) return "Escalar";
    if (r.costoConv <= u.costoMax * 1.4) return "Mantener";
    return "Pausar";
  }
  if (r.roas >= u.roasMin && r.cpa <= u.cpaMax) return "Escalar";
  if (r.roas >= u.roasMin * 0.85 && r.cpa <= u.cpaMax * 1.4) return "Mantener";
  return "Pausar";
}

// Dimensiones del ranking. Las del Sheet (ang/hook) leen de r.sheet; con fallback al campo legacy
// si no hay cruce. "cat" (categoría) usa categoria_primaria/secundaria (r.ang/r.sec) ponderado por split.
function aggregate(rows, dim) {
  const m = {};
  const add = (key, w, r) => {
    if (!key || key === "—" || key === "nd") return;
    if (!m[key]) m[key] = { key, spend: 0, revenue: 0, ventas: 0, conversaciones: 0, n: 0 };
    m[key].spend += r.spend * w; m[key].revenue += r.spend * r.roas * w; m[key].ventas += r.ventas * w; m[key].conversaciones += (r.conversaciones || 0) * w; m[key].n += 1;
  };
  rows.forEach((r) => {
    if (dim === "cat") {
      // split malformado ("nd", vacío) → 100/0; un NaN acá envenenaría todo el bucket del ranking
      let [p, s] = (r.split || "100/0").split("/").map(Number);
      if (!isFinite(p) || !isFinite(s)) { p = 100; s = 0; }
      add(r.ang, p / 100, r); if (r.sec && r.sec !== "—") add(r.sec, s / 100, r);
    } else {
      const key = dim === "aud" ? r.aud
        : dim === "hook" ? (r.sheet?.tipo_gancho || r.hook)
        : dim === "fam" ? r.sheet?.familia // familia psicológica del hook (Ruptura/Evidencia/Pérdida/Identidad); solo con Sheet
        : dim === "ang" ? (r.sheet?.angulo || r.ang)
        : dim === "estr" ? r.sheet?.estructura  // estructura_narrativa del Sheet (solo con cruce)
        : dim === "fvideo" ? r.sheet?.formato   // formato_video del Sheet (≠ r.fmt, que sale del nombre)
        : dim === "catp" ? r.ang                // categoría primaria sola (sin ponderar split como "cat")
        : r.fmt;
      add(key, 1, r);
    }
  });
  return Object.values(m).map((g) => ({ ...g, roas: g.spend ? g.revenue / g.spend : 0, costoConv: g.conversaciones ? g.spend / g.conversaciones : 0 })).sort((a, b) => b.roas - a.roas);
}

const nf = new Intl.NumberFormat("es-AR");
// Montos chicos (< 3 dígitos) con fracción → 2 decimales, para no perder los centavos (cuentas en USD).
const money = (n) => "$" + (Math.abs(n) < 100 && !Number.isInteger(n) ? Number(n).toFixed(2) : nf.format(Math.round(n)));
const short = (n) => { n = Math.round(n); if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1).replace(".0", "") + "M"; if (Math.abs(n) >= 1e3) return "$" + Math.round(n / 1e3) + "k"; return "$" + nf.format(n); };
// Fingerprint de tiempo (HH.MM.SS) que identifica cada creativo. Vive en row.id ("concepto (HH.MM.SS)").
const tf = (r) => { const m = String(r?.id || "").match(/\((\d{1,2}\.\d{2}\.\d{2})\)/); return m ? m[1] : null; };
const TF = ({ r }) => tf(r) ? <span className="tf">{tf(r)}</span> : null;
// Tag de estado: solo aparece si SABEMOS que el creativo está pausado (activa === false).
const Paused = ({ r }) => r && r.activa === false ? <span className="pausedtag">⏸ PAUSADA</span> : null;
// Clasificación de calidad de Meta (vs competencia por la misma audiencia). Solo aparece si Meta
// la informó (≥500 impresiones); diagnóstico de creativo. Valor titular = ponderado por spend.
const QUAL = {
  ABOVE_AVERAGE:    { short: "Calidad ▲", lab: "Calidad arriba del promedio (Meta)", color: "#2E8B6B", bg: "#DCE9E1" },
  AVERAGE:          { short: "Calidad =", lab: "Calidad promedio (Meta)", color: "#857A6A", bg: "#E5DBC8" },
  BELOW_AVERAGE_35: { short: "Calidad ▼", lab: "Calidad debajo del promedio — peor 35% (Meta)", color: "#C5362B", bg: "#F1D9D3" },
  BELOW_AVERAGE_20: { short: "Calidad ▼", lab: "Calidad debajo del promedio — peor 20% (Meta)", color: "#C5362B", bg: "#F1D9D3" },
  BELOW_AVERAGE_10: { short: "Calidad ▼▼", lab: "Calidad debajo del promedio — peor 10% (Meta)", color: "#C5362B", bg: "#F1D9D3" },
};
const Calidad = ({ v, mix }) => { const q = v && QUAL[v]; if (!q) return null; return <span className="qualtag" style={{ color: q.color, background: q.bg }} title={q.lab + (mix ? " · varía entre conjuntos (apretá para ver el detalle)" : "")}>{q.short}{mix ? "*" : ""}</span>; };
// Frecuencia (impresiones/persona). Flag de fatiga: ≥max rojo, ≥max-1 amarillo (default max=4). Solo
// se usa a nivel CONJUNTO (granularidad correcta): la frecuencia es por audiencia/adset y promediarla
// entre conjuntos distintos no es una métrica de fatiga válida, así que NO se muestra por creativo.
// max=null → sin flag.
const Freq = ({ v, max = 4 }) => {
  if (!v) return null;
  const flag = max != null;
  const tone = !flag ? { c: "#857A6A", b: "#E5DBC8" } : v >= max ? { c: "#C5362B", b: "#F1D9D3" } : v >= max - 1 ? { c: "#C2861F", b: "#F1E4C4" } : { c: "#2E8B6B", b: "#DCE9E1" };
  return <span className="qualtag" style={{ color: tone.c, background: tone.b }} title={`Frecuencia: cada persona vio el aviso ~${v.toFixed(1)} veces en el período${flag && v >= max ? " · fatiga (alta)" : flag && v >= max - 1 ? " · vigilar" : ""}`}>✱ {v.toFixed(1)}</span>;
};
// Rol de embudo del creativo: AUDIENCIA real (0.6) + ÁNGULO Sheet/categoría (0.4), 0 = arriba/frío
// (enganchar) … 2 = abajo/remate (cerrar). La audiencia llega PONDERADA POR SPEND desde buildRows
// (r.audPos): un creativo que corre en varias audiencias se clasifica por dónde está la plata, no
// por la etiqueta dominante. Graduada por intención: Hot 2 / Tibio 1.5 / LAL 1 / frío 0.
// AUD_POS (por etiqueta) queda como fallback (data vieja / creativos sin spend) y para freqCap.
const AUD_POS = (aud) => { const s = String(aud || "").toLowerCase(); if (/retarget|rmkt/.test(s)) return /hot/.test(s) ? 2 : 1.5; if (/lookalike|\blal\b/.test(s)) return 1; if (/advantage|amplio|inter/.test(s)) return 0; return null; };
// Umbral de fatiga POR NIVEL de audiencia: retargeting (audiencia chica, Hot o Tibio) tolera el
// doble que prospecting — una frecuencia 6 en remarketing es normal, en frío ya es fatiga.
// base = umbral de prospecting (configurable en el panel). null = sin flag.
const freqCap = (aud, base) => base == null ? null : (AUD_POS(aud) >= 1.5 ? base * 2 : base);
const ANG_POS = (ang) => { const s = String(ang || "").toLowerCase();
  if (/transaccional|urgencia|comparativo|versus|oferta|descuento|promo|hot.?sale|fomo|escasez|stock|liquidaci|precio|ahorro/.test(s)) return 2; // remate
  if (/demostrativo|testimonial|rese|educativo|lista|unboxing|prueba social|social proof|tutorial|como funciona/.test(s)) return 1; // consideración
  if (/aspiracional|lanzamiento|identidad|marca|storytelling|meme|humor/.test(s)) return 0; // awareness/frío
  // OJO: "catálogo/colección" NO clasifica — es formato, no mensaje (un DPA sobre retargeting Hot
  // es remate puro; el mismo catálogo sobre Advantage+ es prospecting). Decide la audiencia.
  return null; };
function rolEmbudo(r) {
  const a = r.audPos != null ? r.audPos : AUD_POS(r.aud);
  const g = ANG_POS(r.sheet?.angulo || r.ang);
  const ps = []; if (a != null) ps.push([a, 0.6]); if (g != null) ps.push([g, 0.4]);
  if (!ps.length) return null;
  let sc = ps.reduce((s, [v, w]) => s + v * w, 0) / ps.reduce((s, [, w]) => s + w, 0);
  // El objetivo DECLARADO del adset (r.goalPos) no asigna el rol — en e-commerce ~90% del spend
  // optimiza a PURCHASE y no discrimina — pero sí lo TECHEA: si el buyer configuró tráfico/awareness
  // o ATC/checkout, el creativo no puede clasificar más abajo de esa etapa.
  if (r.goalPos != null && r.goalPos <= 0.5) sc = Math.min(sc, 0.5);
  else if (r.goalPos === 1) sc = Math.min(sc, 1);
  return sc < 0.67 ? "frio" : sc < 1.34 ? "medio" : "remate";
}
const ROL = {
  frio:   { lab: "ARRIBA · frío", short: "ARRIBA", desc: "Enganchar y traer tráfico barato. Se juzga por hook rate y CTR, NO por ROAS.", color: "#2E6E94", bg: "#D9E6EE" },
  medio:  { lab: "MEDIO · consideración", short: "MEDIO", desc: "Mover a carrito. Costo por add-to-cart y CTR.", color: "#6E3E94", bg: "#E6DCEE" },
  remate: { lab: "ABAJO · remate", short: "REMATE", desc: "Cerrar la venta. ROAS y CPA mandan.", color: "#2E8B6B", bg: "#DCE9E1" },
};
const RolTag = ({ r }) => { const k = rolEmbudo(r); if (!k) return null; const x = ROL[k]; return <span className="qualtag" style={{ color: x.color, background: x.bg }} title={x.desc + (r.audMix ? " · MIXTO: la inversión está repartida entre audiencias frías y de remate — el rol es el promedio ponderado por spend, mirá el desglose." : "")}>{x.short}{r.audMix ? " ±" : ""}</span>; };
// Ganadores para coronar/iterar: prioriza creativos ACTIVOS y confiables (>=5 ventas). Así no
// corona un HotSale pausado o un ROAS de chiripa. Cae a lo que haya si no llega.
function topWinners(rows, n = 3) {
  const conSpend = rows.filter((r) => r.spend > 0);
  const live = conSpend.filter((r) => r.activa !== false);
  const base = live.length ? live : conSpend;
  const conf = base.filter((r) => r.ventas >= 5);
  return [...(conf.length ? conf : base)].sort((a, b) => b.roas - a.roas).slice(0, n);
}

const ROLES = { vos: "control total · todo editable", equipo: "ejecución del día · umbral bloqueado", cliente: "reporte limpio para compartir" };


const PROMPTS = [{"n": "P1", "title": "Imagen UGC del producto desde referencia", "cat": "Producción / Imagen", "que": "Genera una imagen del producto en uso, copiando pose/encuadre/luz de una imagen de referencia.", "text": "Quiero una imagen de mi [PRODUCTO] con el estilo de la imagen de referencia: misma pose, encuadre y luz natural tipo UGC. Sin textos ni placeholders. Solo el producto en uso."}, {"n": "P2", "title": "Investigación de competidores en Meta Ads", "cat": "Investigación", "que": "Lista competidores activos en Meta para modelar sus ofertas, hooks y creatividades.", "text": "Quiero que me identifiques competidores activos y relevantes en Meta Ads para analizar y modelar sus estrategias publicitarias, ofertas, hooks y creatividades.\n\nInformación de mi negocio:\n- Industria/Nicho: [especificar]\n- Producto o servicio: [especificar]\n- Público objetivo: [edad, género, ubicación, intereses]\n- Modelo de negocio: [e-commerce, leads, SaaS, info-producto, etc.]\n- Precio promedio: [especificar]\n- Diferenciales principales frente a la competencia: [especificar]\n\nQué quiero que hagas:\n- Buscar y listar competidores relevantes en el país/mercado donde quiero anunciarme.\n- Incluir: nombre de la marca, enlace al sitio, enlace a Instagram/Facebook, breve descripción de su oferta y ángulo de posicionamiento.\n- Identificar si están activos en Meta Ads (o si tienen presencia relevante en redes).\n- Sugerirme qué hooks, ángulos o tipos de creatividades utilizan que podría considerar.\n\nCuando te envíe este prompt completado, realizá la investigación y entregame un listado claro y accionable para planificar mis Ads en Meta."}, {"n": "P3", "title": "15 hooks de alta conversión (con investigación)", "cat": "Hooks", "que": "Investiga reseñas/foros/social y genera 15 hooks como titulares de ads + justificación psicológica.", "text": "Eres un copywriter de respuesta directa y estratega de marketing de clase mundial. Te especializas en crear hooks publicitarios de alta conversión mediante investigación profunda de tendencias, disparadores psicológicos y ángulos probados.\n\nInformación de producto y avatar:\n#descripciónproducto\n#descripciónavatar\n\nInvestiga en anuncios de alto rendimiento, reseñas, foros (Reddit, Quora), social (comentarios YouTube/TikTok/Twitter) y ejemplos de eCommerce.\n\nTarea:\n- Identificar disparadores emocionales clave, deseos no satisfechos o problemas urgentes del mercado objetivo.\n- Modelar estilos de hooks de alto rendimiento (preguntas, afirmaciones atrevidas, curiosidad, controversia, prueba social, desafío).\n- Escribir 15 hooks como titulares (máx. 150 caracteres c/u), que capten atención en 1.5 s.\n- Para cada hook, 1 frase de justificación según la investigación.\n- (Opcional) Sugerir 3 ángulos para duplicar esfuerzos si escalás a audiencias frías.\n\nEtiquetá las secciones: Resumen de Investigación · 15 Hooks de Alta Conversión · Psicología de Cada Hook · Ángulos Publicitarios.\nSé conciso pero profundo. Prioriza impacto emocional/psicológico probado. Evita relleno genérico."}, {"n": "P6", "title": "Hooks que subvierten patrones narrativos", "cat": "Hooks", "que": "Identifica patrones narrativos familiares y los rompe entre la palabra 5 y 8 (codificación predictiva).", "text": "Necesito un hook para [producto/servicio] que use estructuras de historias conocidas pero las subvierta de forma inesperada.\n\nActúa como copywriter experto en psicología narrativa. Primero identifica 3 patrones narrativos comunes que mi audiencia [descripción] reconozca al instante en [industria].\n\nPara cada patrón:\n- Crea 2 hooks que empiecen con ese patrón familiar pero introduzcan una sorpresa entre la palabra 5 y 8.\n- Que la sorpresa se conecte con el beneficio principal del producto.\n- Intelectualmente intrigantes y emocionalmente resonantes. Menos de 20 palabras.\n\nPara cada hook explica: qué patrón interrumpís, qué tensión psicológica genera, cómo esa tensión despierta curiosidad, por qué sería efectivo con esta audiencia.\n\nAntes de generar, hazme preguntas específicas sobre producto, audiencia, beneficio principal, industria y tono de marca."}, {"n": "P7", "title": "10 hooks que detienen el scroll", "cat": "Hooks", "que": "10 hooks que desafían una creencia común, cada uno con un disparador psicológico distinto.", "text": "Eres un copywriter especializado en hooks que interrumpen patrones y detienen el scroll. Necesito hooks para [producto/servicio] que conecten con [descripción detallada de la audiencia].\n\nLos hooks deben: desafiar una creencia común de esta audiencia, generar curiosidad inmediata, usar patrones de lenguaje que resuenen, tener menos de 15 palabras siempre que sea posible.\n\nGenera 10 hooks distintos, cada uno usando un disparador psicológico diferente (escasez, prueba social, identidad, etc.) y explica por qué funcionaría con esta audiencia.\n\nAntes de generar, hazme preguntas específicas sobre producto, audiencia, sus creencias y tono de marca."}, {"n": "P4", "title": "Ángulos de Identidad", "cat": "Ángulos Publicitarios", "que": "Posicionan el producto como algo que refuerza/eleva la identidad del comprador (pertenencia, estatus, buen gusto).", "text": "Estoy creando textos publicitarios y necesito ayuda con ángulos de identidad para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [su identidad, cómo se ven, a quién aspiran parecerse, con qué grupos se identifican]\n\nLos ángulos de identidad posicionan el producto como algo que refuerza o eleva la identidad del comprador. Les hace sentir que pertenecen, que están un paso adelante o que tienen buen gusto.\n\n- Entendé a qué grupo quiere pertenecer el comprador.\n- Escribí 5 ángulos que hagan que alguien se sienta visto, con estilo, seguro o en control.\n- Evitá la descripción técnica. Enfocate en confianza, estilo de vida, estatus.\n\nEjemplos de formato:\n- \"No solo me importa el bienestar — me gusta que se note sin esfuerzo\"\n- \"Todas las It Girls que sigo lo usan, así que tuve que probarlo\""}, {"n": "P5", "title": "Ángulos Críticos", "cat": "Ángulos Publicitarios", "que": "Para gente racional, enfocada en resultados: ahorro de dinero/tiempo, simplicidad, lógica. Sin hype.", "text": "Estoy escribiendo copys y necesito ayuda con ángulos críticos para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [prácticos, valoran eficiencia, ahorro, escépticos]\n\nLos ángulos críticos apelan a personas racionales, enfocadas en resultados. Resaltan ahorro de dinero, tiempo, simplicidad y lógica. Son directos.\n\n- Identificá cómo el producto ahorra tiempo, dinero o complicaciones.\n- Escribí 5 ángulos que suenen inteligentes, directos y sin exageraciones.\n- Evitá el hype. Apuntá a la lógica y el valor por el dinero.\n\nEjemplos de formato:\n- \"Más barato que una sola visita al salón — y actúa más rápido\"\n- \"¿Para qué complicarlo? Esto funciona. Punto.\""}, {"n": "P11", "title": "Ángulos Emocionales", "cat": "Ángulos Publicitarios", "que": "Apelan a sentimientos y transformaciones, con forma de testimonio/reseña (especialmente impacto en alguien querido).", "text": "Necesito ayuda para crear ángulos emocionales para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [edad, estilo de vida, valores, dolores emocionales, a quién cuidan]\n\nLos ángulos emocionales apelan a sentimientos, deseos, luchas o transformaciones — especialmente cuando impacta a alguien que quieren (pareja, padre/madre, hijx o su \"yo\" del pasado). Deben tener forma de historia y generar empatía.\n\n- Leé la página del producto y entendé los resultados emocionales que promete.\n- Escribí 5 ángulos emocionales que suenen a testimonios reales o reseñas de TikTok.\n- Evitá describir funciones; enfocate en cambios de vida, alivio y conexión emocional.\n\nEjemplos de formato:\n- \"Tenía miedo de salir sin maquillaje. Ahora ni me acuerdo de usarlo.\"\n- \"Se lo compré a mi mamá y me dijo que se sentía 10 años más joven.\""}, {"n": "P12", "title": "Ángulos Prácticos", "cat": "Ángulos Publicitarios", "que": "Se centran en problemas concretos que el producto resuelve y los resultados. Parten de la utilidad.", "text": "Necesito ayuda para generar ángulos prácticos para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [edad, hábitos, estilo de vida, casos típicos de uso]\n\nLos ángulos prácticos se centran en problemas concretos que el producto resuelve y los resultados que entrega. Apelan a la lógica; podés insinuar emociones, pero partí de la utilidad.\n\n- Identificá los principales dolores y soluciones de la página del producto.\n- Escribí 5 ángulos prácticos que expliquen qué hace el producto y por qué funciona.\n- Cada uno corto, enfocado en el beneficio, fácil de entender.\n\nEjemplos de formato:\n- \"Elimina el acné en 10 minutos al día, sin turnos ni clínicas\"\n- \"Diseñado para piel sensible. Efectivo desde el tercer uso\""}, {"n": "P8", "title": "Anuncios FB/IG con límites de caracteres", "cat": "Copy / Anuncios", "que": "Genera ads de tráfico frío en 6 formatos, respetando límites estrictos (Headline 40 / Description 40 / Primary Text 125).", "text": "Eres un copywriter senior de respuesta directa especializado en copy para anuncios de Facebook e Instagram para ecommerce. Genera anuncios de alta conversión para tráfico frío.\n\nInputs:\n- Nombre y descripción del producto: #PRODUCTNAME\n- Detalles de la oferta: #OFFER\n- Avatar del cliente: #AUDIENCE\n- Formato(s) preferido(s): #ADFORMAT\n- Voz de marca: #BRANDVOICE\n\nLímites: Headline máx 40 · Description máx 40 · Primary Text máx 125 caracteres.\n\nFormatos a elegir: 1) Problem-Solution · 2) Benefit-Focused · 3) Social Proof · 4) Story-Driven · 5) List-Style · 6) Urgency/Scarcity.\n\nReglas: asumir tráfico frío; estructura Hook → Dolor → Solución → Transformación → CTA; beneficios emocionales y prácticos; viñetas en List-Style; terminar con CTA claro; adaptar voz de marca; entregar solo el copy, sin explicaciones; múltiples variaciones; respetar límites de caracteres por bloque."}, {"n": "P9", "title": "Anuncio estilo historia", "cat": "Copy / Anuncios", "que": "Mini-relato (inicio/conflicto/solución/desenlace) que funciona como publicidad.", "text": "Eres un narrador creativo con experiencia en marketing. Redacta un anuncio para Facebook/Instagram que cuente una historia breve alrededor de [producto/servicio] para [público objetivo]. Estructura narrativa (inicio, conflicto, solución, desenlace) que a la vez sirva como publicidad.\n\nIncluí:\n- Título de la historia (ej. \"El día que [Nombre] descubrió [Producto]\").\n- Introducción: presentá al protagonista y su situación inicial; enganchá.\n- Conflicto/Desafío: el problema o frustración; que el lector se identifique. Breve pero emotivo.\n- Nudo: introducí [Producto] de forma natural; cómo lo prueba.\n- Clímax y Resolución: el resultado positivo; sentimientos de alivio/felicidad/logro.\n- Cierre con CTA narrativo: invitá al lector a ser el próximo protagonista.\n\nBreve pero completa (2-3 párrafos). Lenguaje emocional y cercano, como un testimonio sincero. Tono: [inspirador, amistoso, etc.]."}, {"n": "P10", "title": "Reescribir copy de un Canva (mismo conteo de caracteres)", "cat": "Copy / Anuncios", "que": "Detecta jerarquías de texto en un diseño de Canva y genera copys de reemplazo del mismo largo, sin romper el diseño.", "text": "Actúa como AI Copywriter experto en performance ads. Analiza la imagen de Canva que te envío y detectá:\n- Jerarquías de texto: Headline, Subheadline, Bullets/beneficios, Botón/CTA, Texto secundario, Disclaimer.\n- El tono (formal, casual, premium, motivacional, etc.).\n- El tipo de estructura (comparativo, testimonial, informativo, emocional, etc.).\n\nLuego generá NUEVOS COPYS de reemplazo alineados a MI PRODUCTO:\n- Exactamente la misma cantidad de caracteres (±5) por bloque, para no deformar el diseño.\n- Misma estructura, jerarquías y longitud aproximada. Lenguaje claro y persuasivo. CTA coherente.\n- De cada texto detectado, 4 variantes (todas dentro del rango de caracteres).\n\nTe entregaré: Nombre del producto · Público objetivo · Beneficios clave (3-5) · Problemas que resuelve · Tono · Imagen/descripción del Canva.\n\nOutput: por cada bloque, 4 variantes con conteo de caracteres; sugerencia de CTA y emojis si el tono lo permite; adaptación a comparativo/testimonial/informativo; listo para copiar/pegar en Canva."}];
const EJECOLOR = { Identidad:"#2E8B6B", Ruptura:"#6E3E94", "Pérdida":"#C5362B", Evidencia:"#C2861F" };

const PRESETS = [{ v: "today", l: "Hoy" }, { v: "last_7d", l: "Últimos 7 días" }, { v: "last_14d", l: "Últimos 14 días" }, { v: "last_30d", l: "Últimos 30 días" }, { v: "last_90d", l: "Últimos 90 días" }, { v: "this_month", l: "Este mes" }, { v: "last_month", l: "Mes pasado" }, { v: "maximum", l: "Máximo" }];

// ─────────── Gráfico diario de la banda Tienda Nube ───────────
// Cruza por día: inversión (Meta/TikTok) vs facturación (tienda) + órdenes + visitas (LPV del
// pixel). Tres paneles apilados con el MISMO eje x — nunca doble eje y: la plata comparte escala
// en el panel 1 (misma unidad) y los conteos van cada uno en su panel. Paleta validada contra el
// fondo oscuro de la banda (#1A1A17): inversión #4E97D1 · facturación #35A276 · órdenes #BD8722 ·
// visitas #A97FD1. Hover con crosshair + tooltip con los 4 valores del día; tabla plegada abajo.
const TN_SERIES = [
  { k: "inversion", lab: "INVERSIÓN", color: "#4E97D1", money: true },
  { k: "facturacion", lab: "FACTURACIÓN", color: "#35A276", money: true },
  { k: "ordenes", lab: "ÓRDENES", color: "#BD8722", money: false },
  { k: "visitas", lab: "VISITAS", color: "#A97FD1", money: false },
];
function TnDaily({ dias }) {
  const [hover, setHover] = useState(null);
  const n = dias.length;
  // INSET separa la primera/última marca del borde del plot — sin esto la primera barra se come
  // el margen y queda pegada a las etiquetas del eje y.
  const W = 860, PADL = 64, PADR = 10, INSET = 10, plotW = W - PADL - PADR - INSET * 2;
  const hasVis = dias.some((d) => d.visitas != null);
  // paneles: [título, alto, series que dibuja, máximo]
  const maxMoney = Math.max(1, ...dias.map((d) => Math.max(d.facturacion || 0, d.inversion || 0)));
  const maxOrd = Math.max(1, ...dias.map((d) => d.ordenes || 0));
  const maxVis = Math.max(1, ...dias.map((d) => d.visitas || 0));
  const panels = [
    { titulo: "$ POR DÍA", h: 148, max: maxMoney, series: ["inversion", "facturacion"], fmt: short },
    { titulo: "ÓRDENES", h: 56, max: maxOrd, series: ["ordenes"], fmt: (v) => nf.format(Math.round(v)) },
    ...(hasVis ? [{ titulo: "VISITAS (pixel)", h: 56, max: maxVis, series: ["visitas"], fmt: (v) => nf.format(Math.round(v)) }] : []),
  ];
  const GAP = 24, TOP = 6;
  let y0 = TOP;
  for (const p of panels) { p.y = y0; y0 += p.h + GAP; }
  const H = y0 + 14; // + espacio para las fechas
  const x = (i) => PADL + INSET + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const yOf = (p, v) => p.y + p.h - (Math.max(0, v) / p.max) * p.h;
  const path = (p, key) => dias.map((d, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + yOf(p, d[key] || 0).toFixed(1)).join(" ");
  const col = (k) => TN_SERIES.find((s) => s.k === k).color;
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((mx - PADL - INSET) / plotW) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };
  const fshort = (f) => f.slice(8, 10) + "/" + f.slice(5, 7);
  const step = Math.max(1, Math.ceil(n / 9)); // etiquetas de fecha cada ~9
  const bw = Math.max(2, Math.min(12, plotW / n - 3)); // ancho de barra (órdenes)
  const d = hover != null ? dias[hover] : null;
  return (
    <div className="tnchart">
      <div className="tnlegend">{TN_SERIES.filter((s) => s.k !== "visitas" || hasVis).map((s) => <span key={s.k} className="tnchip"><i style={{ background: s.color }} />{s.lab}</span>)}</div>
      <div className="tnchart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {panels.map((p) => (
            <g key={p.titulo}>
              <text x={PADL} y={p.y - 7} className="tnax tnaxt">{p.titulo}</text>
              {[0, 0.5, 1].map((t) => (
                <g key={t}>
                  <line x1={PADL} x2={W - PADR} y1={p.y + p.h * (1 - t)} y2={p.y + p.h * (1 - t)} stroke="rgba(242,235,217,0.09)" strokeWidth="1" />
                  <text x={PADL - 6} y={p.y + p.h * (1 - t) + 3} className="tnax" textAnchor="end">{p.fmt(p.max * t)}</text>
                </g>
              ))}
              {p.series.map((k) => k === "ordenes"
                ? dias.map((dd, i) => { const yv = yOf(p, dd.ordenes || 0); return (dd.ordenes || 0) > 0 ? <rect key={i} x={x(i) - bw / 2} y={yv} width={bw} height={p.y + p.h - yv} rx="2" fill={col(k)} /> : null; })
                : <path key={k} d={path(p, k)} fill="none" stroke={col(k)} strokeWidth="2" strokeLinejoin="round" />)}
              {hover != null && p.series.map((k) => (k !== "ordenes" && dias[hover][k] != null)
                ? <circle key={k} cx={x(hover)} cy={yOf(p, dias[hover][k] || 0)} r="4" fill={col(k)} stroke="#1A1A17" strokeWidth="2" />
                : null)}
            </g>
          ))}
          {/* la última fecha siempre se etiqueta; las periódicas se saltean si quedan pegadas a ella */}
          {dias.map((dd, i) => ((i % step === 0 && n - 1 - i >= step / 2) || i === n - 1) ? <text key={i} x={i === n - 1 ? x(i) + 8 : x(i)} y={H - 2} className="tnax" textAnchor={i === n - 1 ? "end" : "middle"}>{fshort(dd.fecha)}</text> : null)}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={H - 14} stroke="rgba(242,235,217,0.35)" strokeWidth="1" strokeDasharray="3 3" />}
        </svg>
        {d && (
          <div className="tntip" style={{ left: `${(x(hover) / W) * 100}%`, transform: x(hover) > W * 0.7 ? "translateX(-105%)" : "translateX(8px)" }}>
            <div className="tntipf">{d.fecha}</div>
            {TN_SERIES.filter((s) => s.k !== "visitas" || d.visitas != null).map((s) => (
              <div key={s.k} className="tntipr"><i style={{ background: s.color }} />{s.lab.toLowerCase()}: <b>{s.money ? money(d[s.k] || 0) : nf.format(d[s.k] || 0)}</b></div>
            ))}
          </div>
        )}
      </div>
      <details className="tntable">
        <summary>ver tabla</summary>
        <div className="tntable-scroll">
          <table>
            <thead><tr><th>fecha</th><th>inversión</th><th>facturación</th><th>órdenes</th>{hasVis && <th>visitas</th>}</tr></thead>
            <tbody>{dias.map((dd) => <tr key={dd.fecha}><td>{dd.fecha}</td><td>{money(dd.inversion || 0)}</td><td>{money(dd.facturacion || 0)}</td><td>{nf.format(dd.ordenes || 0)}</td>{hasVis && <td>{dd.visitas != null ? nf.format(dd.visitas) : "—"}</td>}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default function App() {
  const [u, setU] = useState({ roasMin: 10, cpaMax: null, pisoSpend: 20000, costoMax: null, freqMax: 3 });
  const [modo, setModo] = useState("ventas"); // ventas | mensajes
  const [goal, setGoal] = useState(0);
  const [sort, setSort] = useState({ key: "veredicto", dir: "asc" });
  const [view, setView] = useState("dash");
  const [role, setRole] = useState("vos");
  const [done, setDone] = useState(() => new Set());
  const toggle = (id) => setDone((d) => { const n = new Set(d); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState("");
  const [extras, setExtras] = useState([]); // cuentas EXTRA sumadas a la vista (combinada, ej. Meta + Google de la misma marca)
  const [curForce, setCurForce] = useState(""); // override manual de la moneda de la cuenta ("" = auto desde Meta)
  const [fx, setFx] = useState(null); // cotización del dólar oficial (promedio compra/venta) para convertir a pesos
  const [preset, setPreset] = useState("last_30d");
  const [cSince, setCSince] = useState("");
  const [cUntil, setCUntil] = useState("");
  // Rango personalizado activo solo si elegiste "custom" y cargaste las dos fechas.
  const customRange = preset === "custom" && cSince && cUntil ? "&since=" + cSince + "&until=" + cUntil : "";
  // Moneda de la cuenta de Meta: se detecta sola (currency que devuelve Meta), con override manual.
  // Importa para el MER y el Plan: si la cuenta está en USD y la tienda en pesos, hay que convertir.
  const curDetected = (accounts.find((a) => a.id === account) || {}).currency || "";
  const accCur = (curForce || curDetected || "ARS").toUpperCase();
  // Si la cuenta está en USD y tenemos cotización, convertimos TODA la plata de Meta a pesos
  // (factor = pesos por USD). En pesos (o sin cotización) el factor es 1 y no se toca nada.
  const fxRate = accCur === "USD" && fx && fx.rate ? fx.rate : 1;
  const convirtiendo = fxRate !== 1;
  // Vista COMBINADA: la cuenta elegida + las extras, todas juntas en el panel (filas mergeadas,
  // inversión sumada, MER multi-canal). Cada cuenta usa SU moneda (el override manual solo aplica
  // a la principal). La selección queda recordada por cuenta principal en este browser.
  useEffect(() => {
    try { setExtras(JSON.parse(localStorage.getItem("nusa_extras_" + account) || "[]").filter((id) => id && id !== account)); }
    catch { setExtras([]); }
  }, [account]);
  const setExtrasSave = (v) => { setExtras(v); try { localStorage.setItem("nusa_extras_" + account, JSON.stringify(v)); } catch {} };
  const allIds = account ? [account, ...extras] : [];
  const curOf = (id) => (id === account ? accCur : String((accounts.find((a) => a.id === id) || {}).currency || "ARS").toUpperCase());
  const platOf = (id) => (String(id || "").startsWith("g:") ? "google" : String(id || "").startsWith("tt:") ? "tiktok" : "meta");
  const accountsQS = allIds.join(",");
  const cursQS = allIds.map(curOf).join(",");
  const mixOn = extras.length > 0;
  const [sheetTabs, setSheetTabs] = useState([]);
  const [sheetTab, setSheetTab] = useState("");
  const [tnStores, setTnStores] = useState([]);
  const [tnStore, setTnStore] = useState("");
  // Criterio de VENTA de la tienda: "pagadas" (panel TN) o "no_canceladas" (conteo interno del
  // cliente, ej. MoraShop). Default por tienda (campo `ventas` en TIENDANUBE_STORES); el toggle
  // de la banda lo overridea y queda recordado por tienda en este browser.
  const [tnCount, setTnCount] = useState("pagadas");
  useEffect(() => {
    if (!tnStore) return;
    let saved = null; try { saved = localStorage.getItem("nusa_tncount_" + tnStore); } catch {}
    const def = (tnStores.find((s) => s.name === tnStore) || {}).ventas || "pagadas";
    setTnCount(saved === "pagadas" || saved === "no_canceladas" ? saved : def);
  }, [tnStore, tnStores]);
  const setCount = (v) => { setTnCount(v); try { localStorage.setItem("nusa_tncount_" + tnStore, v); } catch {} };
  const [tnSummary, setTnSummary] = useState(null);
  const [tnLoading, setTnLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null); // lectura del cerebro, persiste entre pestañas
  const [hookMatch, setHookMatch] = useState(null); // {probados, byTemplate} del match de biblioteca, persiste
  const [plan, setPlan] = useState(null); // plan para llegar al objetivo, persiste entre pestañas
  const [data, setData] = useState([]); // sin cliente elegido => vacío (no data de muestra)
  const [audiencias, setAudiencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [metaErr, setMetaErr] = useState("");
  const [me, setMe] = useState(null);
  useEffect(() => { fetch("/api/accounts").then((r) => r.json()).then((j) => { setAccounts(j.accounts || []); setMe(j.me || null); setMetaErr(j.error && !(j.accounts || []).length ? j.error : ""); }).catch(() => setMetaErr("No se pudo conectar con Meta")); }, []);
  const logout = async () => { try { await fetch("/api/logout", { method: "POST" }); } finally { window.location.href = "/login"; } };
  // la lectura del analista queda obsoleta si cambia el cliente/período/tienda/mezcla → la limpiamos
  useEffect(() => { setAnalysis(null); setHookMatch(null); }, [accountsQS, preset, tnStore, cSince, cUntil, accCur]);
  useEffect(() => { setPlan(null); }, [accountsQS, tnStore, goal, accCur, tnCount]); // el plan depende de la meta, el mes, la moneda y el criterio de venta
  useEffect(() => { fetch("/api/fx").then((r) => r.json()).then((j) => setFx(j && j.rate ? j : null)).catch(() => setFx(null)); }, []);
  useEffect(() => { fetch("/api/sheets/tabs").then((r) => r.json()).then((j) => setSheetTabs(j.tabs || [])).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/tiendanube/stores").then((r) => r.json()).then((j) => setTnStores(j.stores || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (!tnStore) { setTnSummary(null); return; }
    let cancelled = false;
    setTnLoading(true);
    fetch("/api/tiendanube/summary?store=" + encodeURIComponent(tnStore) + "&preset=" + preset + "&count=" + tnCount + (account ? "&accounts=" + encodeURIComponent(accountsQS) + "&curs=" + cursQS : "") + customRange)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setTnSummary(j.error ? null : j); })
      .catch(() => { if (!cancelled) setTnSummary(null); })
      .finally(() => { if (!cancelled) setTnLoading(false); });
    return () => { cancelled = true; };
  }, [tnStore, accountsQS, cursQS, preset, customRange, tnCount]);
  // Detalle diario de la banda (CAC + gráfico día por día): va APARTE del summary porque el barrido
  // de órdenes con el customer embebido es lento — la banda pinta al toque y esto completa después.
  const [tnDetail, setTnDetail] = useState(null);
  const [tnDetailLoading, setTnDetailLoading] = useState(false);
  const [tnChartOpen, setTnChartOpen] = useState(false);
  useEffect(() => {
    if (!tnStore) { setTnDetail(null); return; }
    if (preset === "custom" && !(cSince && cUntil)) return;
    let cancelled = false;
    setTnDetailLoading(true); setTnDetail(null);
    fetch("/api/tiendanube/daily?store=" + encodeURIComponent(tnStore) + "&preset=" + preset + "&count=" + tnCount + (account ? "&accounts=" + encodeURIComponent(accountsQS) + "&curs=" + cursQS : "") + customRange)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setTnDetail(j); })
      .catch(() => { if (!cancelled) setTnDetail(null); })
      .finally(() => { if (!cancelled) setTnDetailLoading(false); });
    return () => { cancelled = true; };
  }, [tnStore, accountsQS, cursQS, preset, customRange, tnCount]);
  // Margen bruto % del cliente (producto − costo, ANTES de la pauta) para el margen de contribución.
  // Lo carga el usuario una vez y queda por tienda en este browser.
  const [margen, setMargen] = useState("");
  useEffect(() => { if (!tnStore) return; try { setMargen(localStorage.getItem("nusa_margen_" + tnStore) || ""); } catch {} }, [tnStore]);
  const setMargenP = (v) => { setMargen(v); try { localStorage.setItem("nusa_margen_" + tnStore, v); } catch {} };
  useEffect(() => {
    if (!account) { setData([]); setAudiencias([]); setErr(""); return; }
    if (preset === "custom" && !(cSince && cUntil)) return; // esperá a que cargue las dos fechas
    let cancelled = false;
    setLoading(true); setErr("");
    // Vista combinada: un fetch por cuenta en paralelo y merge client-side. Cada fila queda
    // tagueada con su plataforma (plat) y su cuenta (_acc, para la conversión de moneda por
    // cuenta). Si una cuenta falla, las otras siguen: el error se muestra como aviso.
    const ids = [account, ...extras];
    Promise.all(ids.map((id) =>
      fetch("/api/ads?account=" + id + "&preset=" + preset + (sheetTab && platOf(id) !== "google" ? "&tab=" + encodeURIComponent(sheetTab) : "") + customRange)
        .then((r) => r.json())
        .then((j) => ({ id, ...j }))
        .catch((e) => ({ id, error: e.message }))
    )).then((res) => {
      if (cancelled) return;
      const rows = [], auds = [], errs = [];
      for (const j of res) {
        const plat = platOf(j.id);
        if (j.error) { errs.push(((accounts.find((a) => a.id === j.id) || {}).name || j.id) + ": " + j.error); continue; }
        // en mezcla el id se prefija con la cuenta: dos cuentas pueden tener el mismo fingerprint
        for (const r of j.rows || []) rows.push({ ...r, plat, _acc: j.id, id: ids.length > 1 ? j.id + "‖" + r.id : r.id });
        for (const g of j.audiencias || []) auds.push({ ...g, plat, _acc: j.id });
      }
      setData(rows); setAudiencias(auds);
      setErr(errs.length ? (rows.length ? "⚠ " : "") + errs.join(" · ") : (!rows.length ? "sin datos en el rango" : ""));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountsQS, preset, sheetTab, customRange]);

  // ── Módulo COMPARAR (solo Dashboard): un segundo rango de fechas y los mismos KPIs con delta ──
  const [cmpOn, setCmpOn] = useState(false);
  const [cmpPreset, setCmpPreset] = useState("prev"); // "prev" = período anterior equivalente
  const [cmpSince, setCmpSince] = useState("");
  const [cmpUntil, setCmpUntil] = useState("");
  const [dataCmp, setDataCmp] = useState([]);
  const [cmpLoading, setCmpLoading] = useState(false);
  // "prev" espeja el rango actual: misma cantidad de días, ventana inmediatamente anterior.
  const cmpRange = useMemo(() => {
    if (!cmpOn) return null;
    if (cmpPreset === "custom") return cmpSince && cmpUntil ? { since: cmpSince, until: cmpUntil } : null;
    if (cmpPreset !== "prev") return presetToRange(cmpPreset);
    const cur = preset === "custom" ? (cSince && cUntil ? { since: cSince, until: cUntil } : null) : presetToRange(preset);
    if (!cur) return null;
    const s = new Date(cur.since + "T00:00:00Z"), u = new Date(cur.until + "T00:00:00Z");
    const days = Math.round((u - s) / 86400000) + 1;
    const pu = new Date(s); pu.setUTCDate(pu.getUTCDate() - 1);
    const ps = new Date(pu); ps.setUTCDate(ps.getUTCDate() - (days - 1));
    return { since: ps.toISOString().slice(0, 10), until: pu.toISOString().slice(0, 10) };
  }, [cmpOn, cmpPreset, cmpSince, cmpUntil, preset, cSince, cUntil]);
  // Mismo fetch multi-cuenta que la data principal, con el rango de comparación. Sin Sheet: los
  // KPIs no lo necesitan.
  useEffect(() => {
    if (!account || !cmpOn || !cmpRange) { setDataCmp([]); return; }
    let cancelled = false;
    setCmpLoading(true);
    const ids = [account, ...extras];
    Promise.all(ids.map((id) =>
      fetch("/api/ads?account=" + id + "&preset=custom&since=" + cmpRange.since + "&until=" + cmpRange.until)
        .then((r) => r.json()).then((j) => ({ id, ...j })).catch(() => ({ id }))
    )).then((res) => {
      if (cancelled) return;
      const rows = [];
      for (const j of res) { const plat = platOf(j.id); for (const r of j.rows || []) rows.push({ ...r, plat, _acc: j.id }); }
      setDataCmp(rows);
    }).finally(() => { if (!cancelled) setCmpLoading(false); });
    return () => { cancelled = true; };
  }, [accountsQS, cmpOn, cmpRange ? cmpRange.since + cmpRange.until : ""]); // eslint-disable-line react-hooks/exhaustive-deps

  // Umbral EFECTIVO: un umbral vacío (null) deja de ser condición. roasMin→0 (sin mínimo),
  // cpaMax→∞ (sin tope), pisoSpend→0 (sin piso). Así filtrás solo por los que cargaste.
  const ueff = useMemo(() => ({
    roasMin: u.roasMin == null ? 0 : u.roasMin,
    cpaMax: u.cpaMax == null ? Infinity : u.cpaMax,
    pisoSpend: u.pisoSpend == null ? 0 : u.pisoSpend,
    costoMax: u.costoMax == null ? Infinity : u.costoMax,
    freqMax: u.freqMax == null ? null : u.freqMax, // null = sin flag de fatiga
  }), [u]);
  // Conversión a pesos: multiplicamos los montos (spend, cpa, costo/conv) por el dólar. El factor
  // es POR CUENTA (r._acc): en la vista combinada cada cuenta puede estar en otra moneda. ROAS
  // (ratio), ventas y conversaciones (conteos) no se tocan. Todo lo de abajo (stats, top, dash,
  // panel, cerebro) hereda pesos automáticamente sin más cambios.
  const fxOf = (id) => (curOf(id || account) === "USD" && fx && fx.rate ? fx.rate : 1);
  const dataConv = useMemo(() => data.map((r) => {
    const f = fxOf(r._acc);
    return f === 1 ? r : {
      ...r,
      spend: r.spend * f,
      cpa: r.cpa ? r.cpa * f : r.cpa,
      costoConv: r.costoConv ? r.costoConv * f : r.costoConv,
      breakdown: (r.breakdown || []).map((b) => ({ ...b, spend: b.spend * f })),
    };
  }), [data, fx, accCur, accounts]); // eslint-disable-line react-hooks/exhaustive-deps
  // Las audiencias (ranking por targeting real) también traen plata de la plataforma → mismo factor.
  const audConv = useMemo(() => audiencias.map((g) => {
    const f = fxOf(g._acc);
    return f === 1 ? g : { ...g, spend: g.spend * f, revenue: g.revenue * f };
  }), [audiencias, fx, accCur, accounts]); // eslint-disable-line react-hooks/exhaustive-deps
  // Filtramos por modo: en Ventas excluimos campañas de mensajes (nunca dan buen ROAS) y viceversa.
  const dataModo = useMemo(() => dataConv.filter((r) => (r.tipo || "ventas") === modo), [dataConv, modo]);
  const withV = useMemo(() => dataModo.map((r) => ({ ...r, v: veredicto(r, ueff, modo) })), [dataModo, ueff, modo]);

  const rows = useMemo(() => {
    const { key, dir } = sort, sign = dir === "asc" ? 1 : -1;
    return [...withV].sort((a, b) => {
      if (key === "veredicto") { const d = ORDER[a.v] - ORDER[b.v]; return (d !== 0 ? d : b.spend - a.spend) * sign; }
      if (key === "nombre") return a.nombre.localeCompare(b.nombre) * sign;
      return (a[key] - b[key]) * sign;
    });
  }, [withV, sort]);

  const stats = useMemo(() => {
    const counts = { Escalar: 0, Mantener: 0, Pausar: 0, "Observación": 0 };
    let spendTotal = 0, simpleSum = 0, wSpend = 0, wRoas = 0, revenue = 0, ventasTotal = 0, convTotal = 0;
    const spendByPlat = {}; // desglose por plataforma para la vista combinada (Meta + Google)
    withV.forEach((r) => {
      counts[r.v]++; spendTotal += r.spend; simpleSum += r.roas; revenue += r.spend * r.roas; ventasTotal += r.ventas; convTotal += (r.conversaciones || 0);
      const p = r.plat || "meta";
      spendByPlat[p] = (spendByPlat[p] || 0) + r.spend;
      if (r.spend >= ueff.pisoSpend) { wSpend += r.spend; wRoas += r.spend * r.roas; }
    });
    const topAds = [...withV].filter((r) => r.spend >= ueff.pisoSpend).sort((a, b) => modo === "mensajes" ? (a.costoConv || 9e12) - (b.costoConv || 9e12) : b.roas - a.roas).slice(0, 6);
    return { counts, spendTotal, spendByPlat, revenue, ventasTotal, convTotal, costoConvProm: convTotal ? spendTotal / convTotal : 0, roasSimple: withV.length ? simpleSum / withV.length : 0, roasConfiable: wSpend ? wRoas / wSpend : 0, cpaProm: ventasTotal ? spendTotal / ventasTotal : 0, accountRoas: spendTotal ? revenue / spendTotal : 0, topAds };
  }, [withV, ueff.pisoSpend, modo]);

  // KPIs del período de COMPARACIÓN: misma conversión de moneda por cuenta y filtro por modo.
  // Sin veredictos (los KPIs del Dash no los necesitan). null mientras carga → el Dash lo indica.
  const statsCmp = useMemo(() => {
    if (!cmpOn || !cmpRange || cmpLoading) return null;
    let spendTotal = 0, revenue = 0, ventasTotal = 0, convTotal = 0;
    for (const r of dataCmp) {
      if ((r.tipo || "ventas") !== modo) continue;
      const f = fxOf(r._acc);
      spendTotal += r.spend * f; revenue += r.spend * f * r.roas; ventasTotal += r.ventas; convTotal += (r.conversaciones || 0);
    }
    return { spendTotal, revenue, ventasTotal, convTotal, accountRoas: spendTotal ? revenue / spendTotal : 0, cpaProm: ventasTotal ? spendTotal / ventasTotal : 0, costoConvProm: convTotal ? spendTotal / convTotal : 0 };
  }, [dataCmp, cmpOn, cmpRange, cmpLoading, modo, fx, accCur, accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  const acciones = useMemo(() => {
    const escalar = [], apagar = [], validar = [], esperar = [];
    const byEff = (a, b) => modo === "mensajes" ? (a.costoConv || 9e12) - (b.costoConv || 9e12) : b.roas - a.roas;
    const bestAng = [...withV].filter((r) => r.v === "Escalar").sort(byEff)[0]?.ang || "Reseña";
    const promete = (r) => modo === "mensajes" ? r.conversaciones > 0 : r.roas >= ueff.roasMin;
    withV.forEach((r) => {
      // Ya pausado (el anuncio, o su conjunto/campaña arriba): NO genera tarea en "Qué hacer hoy"
      // ni suma al contador. Su data sigue visible en Panel, Top Performers y el cerebro.
      if (r.activa === false) return;
      if (r.v === "Escalar") escalar.push({ ...r, nuevo: r.spend * 1.25 });
      else if (r.v === "Pausar") apagar.push({ ...r, modo: modo === "ventas" && ueff.roasMin && r.roas / ueff.roasMin < 0.5 ? "apagar" : "iterar", bestAng });
      else if (r.v === "Observación" && promete(r)) validar.push(r);
      else if (r.v === "Observación") esperar.push(r);
    });
    escalar.sort((a, b) => b.spend - a.spend); apagar.sort((a, b) => b.spend - a.spend);
    return { escalar, apagar, validar, esperar };
  }, [withV, ueff.roasMin, modo]);

  const totalTasks = acciones.escalar.length + acciones.apagar.length + acciones.validar.length;
  const doneCount = [...acciones.escalar, ...acciones.apagar, ...acciones.validar].filter((r) => done.has(r.id)).length;
  const setSortKey = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  const locked = role === "equipo";
  const effView = role === "equipo" && view === "dash" ? "hoy" : view;
  // Google Ads: los datos andan igual que Meta, pero las pestañas CREATIVAS (nomenclatura/hooks)
  // no aplican a sus anuncios. soloGoogle = TODA la vista es Google → esas pestañas se gatean;
  // en mezcla (Meta + Google) trabajan solo sobre las filas no-Google (withVCreative).
  const isG = String(account || "").startsWith("g:");
  const soloGoogle = allIds.length > 0 && allIds.every((id) => platOf(id) === "google");
  const withVCreative = useMemo(() => withV.filter((r) => r.plat !== "google"), [withV]);

  return (
    <div className="root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="top">
        <div className="topinner">
          <div className="brand">
            <div className="mark">◆</div>
            <div><div className="bname">NUSA APP</div><div className="bsub">{account && data.length > 0 && !loading && <span className="rec">● REC</span>}PANEL DE CREATIVOS · MOTOR DE DECISIÓN</div></div>
            {me && <div className="userbox"><span className="uname">▸ {me.u}{me.admin ? " · admin" : ""}</span><button className="logout" onClick={logout}>salir</button></div>}
          </div>
          <div className="client"><div className="clabel">▦ CLIENTE</div><select className="cselect" value={account} onChange={(e) => setAccount(e.target.value)}><option value="">— elegí un cliente —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}</select>{account && accounts.length > 1 && <select className="cselect" value="" onChange={(e) => { const v = e.target.value; if (v) setExtrasSave([...extras, v]); }}><option value="">➕ combinar cuenta…</option>{accounts.filter((a) => a.id !== account && !extras.includes(a.id)).map((a) => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}</select>}{extras.map((id) => { const a = accounts.find((x) => x.id === id); return <span className="mixchip" key={id}>{(a && a.name) || id}<button title="sacar de la vista" onClick={() => setExtrasSave(extras.filter((x) => x !== id))}>✕</button></span>; })}{!soloGoogle && <select className="cselect" value={sheetTab} onChange={(e) => setSheetTab(e.target.value)}><option value="">— pestaña sheet —</option>{sheetTabs.map((t) => <option key={t.gid} value={t.title}>{t.title}</option>)}</select>}<select className="cselect" value={preset} onChange={(e) => setPreset(e.target.value)}><option value="today">Hoy</option><option value="yesterday">Ayer</option><option value="last_7d">Últimos 7 días</option><option value="last_14d">Últimos 14 días</option><option value="last_30d">Últimos 30 días</option><option value="last_90d">Últimos 90 días</option><option value="this_month">Este mes</option><option value="last_month">Mes pasado</option><option value="maximum">Máximo</option><option value="custom">Personalizado…</option></select>{preset === "custom" && <span className="daterange"><input type="date" className="cdate" value={cSince} max={cUntil || undefined} onChange={(e) => setCSince(e.target.value)} /><i>→</i><input type="date" className="cdate" value={cUntil} min={cSince || undefined} onChange={(e) => setCUntil(e.target.value)} /></span>}{tnStores.length > 0 &&<select className="cselect" value={tnStore} onChange={(e) => setTnStore(e.target.value)}><option value="">— sin tienda nube —</option>{tnStores.map((s) => <option key={s.name} value={s.name}>🛒 {s.name}</option>)}</select>}<div className="cmeta">{loading ? "cargando…" : err ? err : account ? ("● data en vivo · " + data.length + " creativos") : "— elegí un cliente —"}</div></div>
        </div>
        <div className="stripe"><i/><i/><i/><i/><i/><i/></div>
        <div className="phasebar"><span>FASE 01 — HIGH GRADE</span><span>HQ ▮▮▮</span></div>
        {metaErr && (
          <div className="metaerr">
            <strong>⚠ Token de Meta caído.</strong> {/expired|expir|session/i.test(metaErr) ? "El token venció — regeneralo en Meta Business (System User) como “Sin vencimiento” y actualizá META_SYSTEM_TOKEN en Vercel." : metaErr} <span className="metaerr-sample">Mientras tanto se muestra data de muestra.</span>
          </div>
        )}
      </header>

      {tnStore && (
        <section className={"tnband" + (tnLoading ? " tnloading" : "")}>
          <div className="tnband-head">
            <span className="tntag">🛒 TIENDA NUBE · {tnStore}</span>
            <div className="modobox"><span className="tncountlab">VENTA =</span>
              <button className={"modotgl tng" + (tnCount === "pagadas" ? " on" : "")} onClick={() => setCount("pagadas")}>PAGADAS</button>
              <button className={"modotgl tng" + (tnCount === "no_canceladas" ? " on" : "")} onClick={() => setCount("no_canceladas")}>NO CANCELADAS</button>
            </div>
            <span className="tnrange">{tnLoading ? "cargando…" : tnSummary ? (tnSummary.since + " → " + tnSummary.until) : "sin datos"}</span>
          </div>
          {tnSummary && (
            <>
              <div className="tnstats">
                <div className="tnstat"><div className="tnlab">FACTURACIÓN TIENDA</div><div className="tnval">{money(tnSummary.facturacion)}</div><div className="tnsub">{tnSummary.orders} órdenes {tnSummary.criterio === "no_canceladas" ? "(pagadas + pendientes)" : "pagadas"} · ticket {money(tnSummary.ticket)}</div></div>
                <div className="tnstat"><div className="tnlab">INVERSIÓN {mixOn ? "ADS" : String(account || "").startsWith("g:") ? "GOOGLE" : String(account || "").startsWith("tt:") ? "TIKTOK" : "META"}</div><div className="tnval">{account ? money(tnSummary.fx && !tnSummary.fx.error ? tnSummary.inversionConv : tnSummary.inversion) : "—"}</div><div className="tnsub">{!account ? "elegí el cliente de Meta" : tnSummary.porPlataforma ? tnSummary.porPlataforma.map((p) => (p.plataforma === "Google" ? "G " : p.plataforma === "TikTok" ? "TT " : "M ") + short(p.inversion)).join(" · ") : tnSummary.fx && !tnSummary.fx.error ? ("USD " + money(tnSummary.inversion) + " · " + tnSummary.fx.fuente + " $" + nf.format(Math.round(tnSummary.fx.rate))) : tnSummary.fx && tnSummary.fx.error ? ("⚠ no pude cotizar el dólar — MER sin convertir") : ("ROAS pixel " + (tnSummary.roasMeta || 0).toFixed(1) + "x")}</div></div>
                <div className="tnstat tnmer"><div className="tnlab">MER (FACT / INV)</div><div className="tnval">{tnSummary.mer != null ? tnSummary.mer.toFixed(2) + "x" : "—"}</div><div className="tnsub">{tnSummary.criterio === "no_canceladas" ? ("pagadas: " + money(tnSummary.facturacionPagada) + " (" + tnSummary.ordersPagadas + ") · pendientes: " + money(tnSummary.facturacionPendiente) + " (" + tnSummary.ordersPendientes + ")") : tnSummary.ordersPendientes ? ("+ " + money(tnSummary.facturacionPendiente) + " pendientes (" + tnSummary.ordersPendientes + " órd.) sin contar") : "facturación / inversión"}</div></div>
                <div className="tnstat" title="Inversión en pauta ÷ clientes NUEVOS de la tienda en el período (primera compra). No es el CPA del pixel: acá cuentan personas nuevas reales, no compras atribuidas.">
                  <div className="tnlab">CAC (CLIENTE NUEVO)</div>
                  <div className="tnval">{tnDetail && tnDetail.cac != null ? money(tnDetail.cac) : tnDetailLoading ? "…" : "—"}</div>
                  <div className="tnsub">{tnDetail && tnDetail.cac != null ? (nf.format(tnDetail.clientesNuevos) + " nuevos · " + nf.format(tnDetail.clientesRecurrentes) + " recurrentes") : tnDetailLoading ? "contando clientes nuevos…" : tnDetail && tnDetail.error ? (tnDetail.code === "RANGO_MUY_GRANDE" ? "rango muy grande — acotá el período" : "no se pudo calcular") : "inversión / clientes nuevos"}</div>
                </div>
                <div className="tnstat" title="Margen de contribución del período: facturación × tu margen bruto (producto − costo, antes de la pauta) − inversión en pauta. Lo que queda para cubrir fijos y ganar.">
                  <div className="tnlab">MARGEN CONTRIBUCIÓN</div>
                  {(() => {
                    const m = parseFloat(String(margen).replace(",", "."));
                    const inv = account ? (tnSummary.fx && !tnSummary.fx.error ? tnSummary.inversionConv : tnSummary.inversion) : 0;
                    const cm = isFinite(m) && m > 0 ? Math.round(tnSummary.facturacion * (m / 100) - inv) : null;
                    return <>
                      <div className="tnval" style={cm != null && cm < 0 ? { color: "#E08578" } : undefined}>{cm != null ? money(cm) : "—"}</div>
                      <div className="tnsub">fact × <input className="tnmargin" type="number" min="1" max="95" placeholder="%" value={margen} onChange={(e) => setMargenP(e.target.value)} />% margen bruto − inversión{cm == null ? " → cargá tu margen" : ""}</div>
                    </>;
                  })()}
                </div>
              </div>
              <div className="tnnote">{tnSummary.criterio === "no_canceladas"
                ? "MER = facturación de TODAS las órdenes no canceladas (pagadas + pendientes de pago, sin las de pago anulado — criterio interno del cliente) dividida la inversión en Meta, mismo período. Mide la eficiencia global del marketing, no solo lo atribuido al pixel."
                : "MER = facturación COBRADA de la tienda (órdenes pagadas, igual que Tienda Nube) dividida la inversión en Meta, mismo período. Las pendientes de pago no suman al titular. Mide la eficiencia global del marketing, no solo lo atribuido al pixel."}</div>
              <button className="tnchart-toggle" onClick={() => setTnChartOpen(!tnChartOpen)}>{tnChartOpen ? "▴ OCULTAR DÍA POR DÍA" : "▾ VER DÍA POR DÍA — inversión · facturación · órdenes · visitas"}</button>
              {tnChartOpen && (tnDetail && Array.isArray(tnDetail.dias) && tnDetail.dias.length
                ? <TnDaily dias={tnDetail.dias} />
                : <div className="tnsub" style={{ marginTop: 8 }}>{tnDetailLoading ? "cargando la serie diaria…" : tnDetail && tnDetail.error ? tnDetail.error : "sin datos del período"}</div>)}
            </>
          )}
        </section>
      )}

      <div className="rolebar">
        <span className="rlabel">▶ VISTA</span>
        <div className="rolebtns">
          {Object.keys(ROLES).map((k) => <button key={k} className={"rolebtn" + (role === k ? " on" : "")} onClick={() => setRole(k)}>{k.toUpperCase()}</button>)}
          {(me === null || me?.admin) && <button className={"rolebtn usuariosbtn" + (effView === "usuarios" ? " on" : "")} onClick={() => { setView("usuarios"); if (role === "cliente") setRole("vos"); }}>⚙ USUARIOS</button>}
        </div>
        <span className="rdesc">{ROLES[role]}</span>
        <div className="rolebarright">
          <div className="modobox"><span className="rlabel">◉ MEDIR</span><button className={"modotgl" + (modo === "ventas" ? " on" : "")} onClick={() => setModo("ventas")}>VENTAS</button><button className={"modotgl" + (modo === "mensajes" ? " on" : "")} onClick={() => setModo("mensajes")}>MENSAJES</button></div>
          {account && modo === "ventas" && (
            <div className="modobox"><span className="rlabel">$ MONEDA CUENTA</span>
              <button className={"modotgl" + (accCur === "ARS" ? " on" : "")} onClick={() => setCurForce("ARS")}>PESOS</button>
              <button className={"modotgl" + (accCur === "USD" ? " on" : "")} onClick={() => setCurForce("USD")}>USD</button>
              <span className="curhint">{(curForce ? "manual" : (curDetected ? "auto · " + (isG ? "Google " : String(account || "").startsWith("tt:") ? "TikTok " : "Meta ") + curDetected : "auto")) + (accCur === "USD" ? (convirtiendo ? " · todo en $ARS @ $" + nf.format(Math.round(fxRate)) : " · ⚠ sin cotización") : "")}</span>
            </div>
          )}
        </div>
      </div>

      {role === "cliente" ? (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Cliente withV={withV} u={ueff} stats={stats} goal={goal} accountName={(accounts.find((a) => a.id === account) || {}).name || ""} factTienda={tnSummary ? tnSummary.facturacion : null} modo={modo} />) : (
        <>
          <nav className="nav">
            {role === "vos" && <button className={"tab" + (effView === "dash" ? " active" : "")} onClick={() => setView("dash")}>DASHBOARD</button>}
            <button className={"tab tabai" + (effView === "an" ? " active" : "")} onClick={() => setView("an")}>◆ ANÁLISIS</button>
            <button className={"tab tabai" + (effView === "plan" ? " active" : "")} onClick={() => setView("plan")}>◎ PLAN</button>
            <button className={"tab" + (effView === "hoy" ? " active" : "")} onClick={() => setView("hoy")}>QUÉ HACER HOY {totalTasks ? <span className="tabn">{totalTasks}</span> : null}</button>
            <button className={"tab" + (effView === "grabar" ? " active" : "")} onClick={() => setView("grabar")}>QUÉ GRABAR</button>
            <button className={"tab" + (effView === "top" ? " active" : "")} onClick={() => setView("top")}>TOP PERFORMERS</button>
            <button className={"tab" + (effView === "embudo" ? " active" : "")} onClick={() => setView("embudo")}>EMBUDO</button>
            <button className={"tab" + (effView === "panel" ? " active" : "")} onClick={() => setView("panel")}>PANEL</button>
            <button className={"tab" + (effView === "bib" ? " active" : "")} onClick={() => setView("bib")}>BIBLIOTECA</button>
            <button className={"tab" + (effView === "gen" ? " active" : "")} onClick={() => setView("gen")}>GENERAR</button>
            <button className={"tab" + (effView === "chat" ? " active" : "")} onClick={() => setView("chat")}>PREGUNTAR</button>
          </nav>

          {!!withV.length && (
            <section className="umbral">
              <div className="ulabel">UMBRAL<br/>DEL CLIENTE</div>
              {modo === "mensajes" ? (
                <Field label="Costo x conv. máx" prefix="$" value={u.costoMax} step={50} locked={locked} onChange={(v) => setU({ ...u, costoMax: v })} />
              ) : (<>
                <Field label="ROAS mínimo" suffix="x" value={u.roasMin} step={0.5} locked={locked} onChange={(v) => setU({ ...u, roasMin: v })} />
                <Field label="CPA máximo" prefix="$" value={u.cpaMax} step={100} locked={locked} onChange={(v) => setU({ ...u, cpaMax: v })} />
              </>)}
              <Field label="Piso de spend" prefix="$" value={u.pisoSpend} step={5000} locked={locked} onChange={(v) => setU({ ...u, pisoSpend: v })} />
              <Field label="Frecuencia máx" suffix="✱" value={u.freqMax} step={1} locked={locked} onChange={(v) => setU({ ...u, freqMax: v })} />
              <div className="uhint">{locked ? "🔒 definido por la cuenta · no editable" : "cambiá los valores · todo recalcula en vivo"}</div>
            </section>
          )}

          {effView === "an" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Analisis withV={withV} stats={stats} audiencias={audConv} tnSummary={tnSummary} u={ueff} accountName={(accounts.find((a) => a.id === account) || {}).name || ""} periodo={preset === "custom" && cSince && cUntil ? cSince + " → " + cUntil : preset} analysis={analysis} setAnalysis={setAnalysis} modo={modo} account={account} extras={extras} />)}
          {effView === "plan" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Plan account={account} store={tnStore} goal={goal} plan={plan} setPlan={setPlan} modo={modo} accCur={accCur} extras={extras} extrasCur={extras.map(curOf)} count={tnCount} />)}
          {effView === "dash" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Dash stats={stats} u={ueff} goal={goal} setGoal={setGoal} factTienda={tnSummary ? tnSummary.facturacion : null} tnStore={tnStore} modo={modo} cmp={{ on: cmpOn, setOn: setCmpOn, preset: cmpPreset, setPreset: setCmpPreset, since: cmpSince, setSince: setCmpSince, until: cmpUntil, setUntil: setCmpUntil, range: cmpRange, loading: cmpLoading, stats: statsCmp }} />)}
          {effView === "hoy" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Hoy acc={acciones} u={ueff} done={done} toggle={toggle} total={totalTasks} doneCount={doneCount} mantener={stats.counts.Mantener} modo={modo} />)}
          {effView === "grabar" && (soloGoogle ? <SinGoogle que="Qué grabar" /> : !withVCreative.length ? <EmptyState account={account} loading={loading} err={err} /> : <QueGrabar withV={withVCreative} u={ueff} modo={modo} role={role} accountName={(accounts.find((a) => a.id === account) || {}).name || ""} />)}
          {effView === "top" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Top withV={withV} u={ueff} audData={audConv} modo={modo} />)}
          {effView === "embudo" && (soloGoogle ? <SinGoogle que="El embudo" /> : !withVCreative.length ? <EmptyState account={account} loading={loading} err={err} /> : <Embudo withV={withVCreative} u={ueff} modo={modo} accountName={(accounts.find((a) => a.id === account) || {}).name || ""} />)}
          {effView === "panel" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Panel rows={rows} u={ueff} stats={stats} sort={sort} setSortKey={setSortKey} modo={modo} />)}
          {effView === "bib" && <Biblioteca rows={withVCreative} hookMatch={hookMatch} setHookMatch={setHookMatch} />}
          {effView === "gen" && (soloGoogle ? <SinGoogle que="El generador" /> : <Generar rows={withVCreative} accountName={(accounts.find((a) => a.id === account) || {}).name || ""} />)}
          {effView === "chat" && (!account ? <EmptyState account={account} loading={loading} err={err} /> : <Chat account={account} accountName={(accounts.find((a) => a.id === account) || {}).name || ""} store={tnStore} tab={sheetTab} accCur={accCur} extras={extras} extrasCur={extras.map(curOf)} criterio={tnCount} />)}
          {effView === "usuarios" && <Usuarios accounts={accounts} sheetTabs={sheetTabs} tnStores={tnStores} />}
        </>
      )}
    </div>
  );
}

// ─────────── Vista: CLIENTE (Parte 5) ───────────
function Cliente({ withV, u, stats, goal, accountName, factTienda, modo = "ventas" }) {
  const msg = modo === "mensajes";
  const reliable = useMemo(() => withV.filter((r) => r.spend >= u.pisoSpend), [withV, u.pisoSpend]);
  const facturado = factTienda != null ? factTienda : stats.revenue;
  const pct = goal ? Math.min(100, (facturado / goal) * 100) : 0;
  const mes = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" }).toUpperCase();
  const topAng = aggregate(reliable, "ang")[0]?.key || "—";
  const wins = [...reliable].sort((a, b) => msg ? (a.costoConv || 9e12) - (b.costoConv || 9e12) : b.roas - a.roas).slice(0, 4);
  const resumen = msg
    ? `La cuenta generó ${nf.format(stats.convTotal)} conversaciones con una inversión de ${short(stats.spendTotal)}, a un costo promedio de ${money(stats.costoConvProm)} por conversación. El ángulo ${topAng} lideró el volumen, con varios anuncios listos para escalar.`
    : `La cuenta facturó ${short(facturado)} con un ROAS de ${stats.accountRoas.toFixed(1)}x y ${nf.format(stats.ventasTotal)} ventas${goal > 0 ? ` — al ${pct.toFixed(0)}% del objetivo` : ""}. El ángulo ${topAng} y los catálogos lideraron el rendimiento, con varios anuncios listos para escalar.`;
  return (
    <>
      <div className="repbar">
        <div><div className="reptitle">REPORTE MENSUAL · {mes}</div><div className="repsub">{accountName || "Cliente"} · preparado por tu agencia</div></div>
      </div>

      {!msg && (
      <section className="goal light">
        <div className="goalhead"><span className="goaltitle">OBJETIVO DEL MES</span><span className="repnote">→ exportable a PDF en la Parte 10</span></div>
        {goal > 0 ? (<>
          <div className="goalbar"><span style={{ width: pct + "%" }} /></div>
          <div className="goalnums"><div className="goalpct">{pct.toFixed(0)}<small>%</small></div><div className="goalstack"><div><b className="mono">{short(facturado)}</b> <span className="soft">facturado de {short(goal)}</span></div></div></div>
        </>) : (
          <div className="goalnums"><div className="goalstack"><div><b className="mono">{short(facturado)}</b> <span className="soft">facturado · definí la meta del mes en el Dashboard</span></div></div></div>
        )}
      </section>
      )}

      <section className="kpis repk">
        {msg ? (<>
          <Kpi lab="CONVERSACIONES" val={nf.format(stats.convTotal)} mod="grn" />
          <Kpi lab="COSTO / CONV" val={money(stats.costoConvProm)} />
          <Kpi lab="INVERSIÓN" val={short(stats.spendTotal)} />
        </>) : (<>
          <Kpi lab="FACTURACIÓN" val={short(stats.revenue)} mod="grn" />
          <Kpi lab="ROAS" val={stats.accountRoas.toFixed(1) + "x"} mod="grn" />
          <Kpi lab="VENTAS" val={nf.format(stats.ventasTotal)} />
        </>)}
      </section>

      <section className="sect">
        <div className="secthead"><span className="sverb" style={{ background: "#1E1812", color: "#F4C24A" }}><span className="sq" style={{ background: "#F4C24A" }} />★</span><span className="stitle">ANUNCIOS DESTACADOS</span></div>
        <div className="topgrid">
          {wins.map((r, i) => (
            <div className="topcard" key={r.id} style={{ "--bar": "#2E8B6B" }}>
              <div className="tcardtop"><span className="trank">{String(i + 1).padStart(2, "0")}</span><span className="winstar">★</span></div>
              <div className="tname">{r.nombre} <span className="fmt">{r.fmt}</span><TF r={r} /><Paused r={r} /></div>
              {msg ? <div className="troas grn">{money(r.costoConv)}</div> : <div className="troas grn">{r.roas.toFixed(1)}<small>x</small></div>}
              <div className="tmeta mono">{msg ? (nf.format(r.conversaciones) + " conv · " + r.ang) : (r.ang + " · " + r.aud)}</div>
            </div>))}
        </div>
      </section>

      <section className="repcards">
        <div className="repcard"><div className="repcardh">RESUMEN DEL MES</div><p>{resumen}</p></div>
        <div className="repcard"><div className="repcardh">PRÓXIMO MES</div><ul className="plan"><li>Escalar los anuncios ganadores</li><li>Producir variantes del ángulo {topAng}</li><li>Testear 2 ángulos nuevos de alto potencial</li></ul></div>
      </section>

      <QueGrabar withV={withV} u={u} modo={modo} role="cliente" accountName={accountName} />
    </>
  );
}

// ─────────── Vista: TOP PERFORMERS (Parte 4) ───────────
function Top({ withV, u, audData, modo = "ventas" }) {
  const msg = modo === "mensajes";
  const [dim, setDim] = useState("ang");
  const reliable = useMemo(() => withV.filter((r) => r.spend >= u.pisoSpend), [withV, u.pisoSpend]);
  const MINV = 5;
  const data = useMemo(() => {
    return (dim === "aud" && audData && audData.length)
      ? audData.map((g) => ({ ...g, roas: g.spend ? g.revenue / g.spend : 0, costoConv: g.conversaciones ? g.spend / g.conversaciones : 0 }))
      : aggregate(reliable, dim);
  }, [reliable, dim, audData]);
  // Cuántos mostrar por dimensión. Audiencia = todas; el resto, un top.
  const LIMITS = { ang: 5, cat: 5, aud: Infinity, hook: 10, fam: 4, fmt: 8 };
  const limit = LIMITS[dim] ?? 5;
  // Métrica de orden. En mensajes: costo por conversación (menor = mejor), conversaciones, spend, ads.
  const [metric, setMetric] = useState(msg ? "costo" : "roas");
  const METRICS = msg ? [["costo", "Costo/conv"], ["conv", "Conversac."], ["spend", "Spend"], ["ads", "Ads"]] : [["roas", "ROAS"], ["spend", "Spend"], ["ventas", "Ventas"], ["ads", "Ads"]];
  const lowerBetter = metric === "costo";
  const valOf = (d) => metric === "spend" ? d.spend : metric === "ventas" ? d.ventas : metric === "conv" ? (d.conversaciones || 0) : metric === "ads" ? d.n : metric === "costo" ? (d.costoConv || 0) : d.roas;
  const ordered = [...data].filter((d) => metric !== "costo" || d.costoConv > 0).sort((a, b) => lowerBetter ? valOf(a) - valOf(b) : valOf(b) - valOf(a));
  const ranked = ordered.slice(0, limit);
  const thin = ordered.slice(limit);
  const top3 = useMemo(() => msg ? [...reliable.filter((r) => r.conversaciones > 0 && r.activa !== false)].sort((a, b) => (a.costoConv || 9e12) - (b.costoConv || 9e12)).slice(0, 3) : topWinners(reliable, 3), [reliable, msg]);
  const best = top3[0];
  const max = Math.max(...ranked.map((d) => valOf(d)), 1) || 1;
  const barOf = (d) => lowerBetter ? Math.max(8, (1 - valOf(d) / max) * 100) : (valOf(d) / max) * 100;
  const fmtVal = (d) => metric === "spend" ? short(d.spend) : metric === "ventas" ? nf.format(Math.round(d.ventas)) : metric === "conv" ? nf.format(Math.round(d.conversaciones || 0)) : metric === "ads" ? (d.n + " ad" + (d.n !== 1 ? "s" : "")) : metric === "costo" ? money(d.costoConv) : (d.roas.toFixed(1) + "x");
  const colorFor = (d) => msg ? (d.costoConv && d.costoConv <= u.costoMax ? BUCKETS.Escalar.color : d.costoConv && d.costoConv <= u.costoMax * 1.4 ? BUCKETS.Mantener.color : BUCKETS.Pausar.color) : (d.roas >= u.roasMin ? BUCKETS.Escalar.color : d.roas >= u.roasMin * 0.85 ? BUCKETS.Mantener.color : BUCKETS.Pausar.color);
  const dims = [["ang", "Ángulo"], ["cat", "Categoría"], ["aud", "Audiencia"], ["hook", "Hook"], ["fam", "Familia"], ["fmt", "Formato"]];
  // Acordeón: solo para ángulo, categoría, hook y familia (no audiencia/formato). Lista qué
  // creativos componen cada fila y, dentro de cada uno, en qué campañas/adsets corren.
  const expandable = dim === "ang" || dim === "cat" || dim === "hook" || dim === "fam";
  const [open, setOpen] = useState(null);
  const membersFor = (key) => {
    if (dim === "ang") return reliable.filter((r) => (r.sheet?.angulo || r.ang) === key);
    if (dim === "hook") return reliable.filter((r) => (r.sheet?.tipo_gancho || r.hook) === key);
    if (dim === "fam") return reliable.filter((r) => r.sheet?.familia === key);
    if (dim === "cat") return reliable.filter((r) => r.ang === key || r.sec === key);
    return [];
  };
  return (
    <>
      {best && (
        <section className="combo">
          <div className="combohead"><span className="combotag">★ TUS 3 MEJORES COMBINACIONES</span><span className="comboname">{best.nombre}</span><TF r={best} /></div>
          <div className="comborow">
            {msg ? <div className="comboroas">{money(best.costoConv)}</div> : <div className="comboroas">{best.roas.toFixed(1)}<small>x</small></div>}
            <div className="comborec"><Rec k="ÁNGULO" v={best.sheet?.angulo || best.ang} /><Rec k="AUDIENCIA" v={best.aud} /><Rec k="HOOK" v={best.sheet?.tipo_gancho || best.hook} /><Rec k="FORMATO" v={best.fmt} /></div>
          </div>
          <div className="combostats">{msg ? (nf.format(best.conversaciones) + " conversaciones · " + short(best.spend) + " spend") : (nf.format(best.ventas) + " ventas · " + short(best.spend) + " spend")}</div>
          {top3.length > 1 && (
            <div className="combomore">
              {top3.slice(1).map((r, i) => (
                <div className="comboalt" key={r.id}>
                  <span className="caltrank">{String(i + 2).padStart(2, "0")}</span>
                  <span className="caltroas">{msg ? money(r.costoConv) : r.roas.toFixed(1) + "x"}</span>
                  <span className="caltname">{r.nombre}</span><TF r={r} />
                  <span className="caltmeta">{(r.sheet?.angulo || r.ang)} · {(r.sheet?.tipo_gancho || r.hook)} · {r.aud} · {r.fmt} · {msg ? (nf.format(r.conversaciones) + " conv") : (nf.format(r.ventas) + " vtas")} · {short(r.spend)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="combonote">Tus 3 recetas más rentables. La #1 es la base ideal para el próximo creativo → la cableamos al generador en la <b>Parte 7</b>.</div>
        </section>
      )}
      <section className="sect">
        <div className="secthead"><span className="sverb" style={{ background: "#1E1812", color: "#F4C24A" }}><span className="sq" style={{ background: "#F4C24A" }} />RANK</span><span className="stitle">TOP PERFORMERS</span><span className="scount">spend ≥ piso</span></div>
        <div className="dimpills">{dims.map(([k, l]) => <button key={k} className={"dimpill" + (dim === k ? " on" : "")} onClick={() => setDim(k)}>{l}</button>)}</div>
        <div className="metricpills"><span className="mplabel">ordenar por</span>{METRICS.map(([k, l]) => <button key={k} className={"metricpill" + (metric === k ? " on" : "")} onClick={() => setMetric(k)}>{l}</button>)}</div>
        {dim === "cat" && <div className="dedup">▦ Ponderado por <b>split</b> (categoría primaria/secundaria) — sin doble conteo. Un anuncio 70/30 suma 70% a su categoría principal y 30% a la secundaria, no el total a cada una.</div>}
        {dim === "ang" && <div className="dedup">▦ Ángulo de venta (columna <b>angulo_de_venta</b> del Sheet).</div>}
        {dim === "hook" && <div className="dedup">▦ Tipo de gancho (columna <b>tipo_gancho</b> del Sheet).</div>}
        {dim === "fam" && <div className="dedup">▦ Familia psicológica del hook (<b>Ruptura</b> rompe un patrón · <b>Evidencia</b> prueba con datos/demos · <b>Pérdida</b> lo que te sangra · <b>Identidad</b> quién sos). Es la misma taxonomía de la Biblioteca. Sale de la columna <b>gancho_familia</b> del Sheet; en videos viejos se deriva del tipo_gancho cuando se puede{ranked.length === 0 ? " — elegí una pestaña del Sheet para ver este ranking" : ""}.</div>}
        {dim === "aud" && audData && audData.length > 0 && <div className="dedup">▦ Audiencia leída del <b>targeting real</b> de cada conjunto (audiencias custom, lookalikes, intereses, Advantage+). Hot/Tibio según la intención de las audiencias. Si falla, cae al nombre del conjunto.</div>}
        {dim === "aud" && (!audData || !audData.length) && <div className="dedup">▦ La audiencia se lee del targeting real del conjunto. Con datos en vivo se completa automáticamente.</div>}
        <div className="ranklist">
          {ranked.map((d, i) => {
            const isOpen = expandable && open === d.key;
            return (
            <div className="rankwrap" key={d.key}>
              <div className={"rankrow" + (expandable ? " clickable" : "") + (isOpen ? " open" : "")} onClick={expandable ? () => setOpen(isOpen ? null : d.key) : undefined}>
                {expandable && <span className="rcaret">{isOpen ? "▾" : "▸"}</span>}
                <span className="rrank">{String(i + 1).padStart(2, "0")}</span><span className="rname">{d.key}</span>
                <div className="rbar"><span className="rfill" style={{ width: barOf(d) + "%", background: colorFor(d) }} /></div>
                <span className="rval" style={{ color: colorFor(d) }}>{fmtVal(d)}</span>
                <span className="rmeta">{msg ? (nf.format(Math.round(d.conversaciones || 0)) + " conv · " + short(d.spend) + " · " + d.n + " ad" + (d.n !== 1 ? "s" : "")) : ((metric !== "roas" ? d.roas.toFixed(1) + "x · " : "") + short(d.spend) + " · " + nf.format(Math.round(d.ventas)) + " vtas · " + d.n + " ad" + (d.n !== 1 ? "s" : ""))}</span>
              </div>
              {isOpen && (
                <div className="rexp">
                  {membersFor(d.key).sort((a, b) => b.spend - a.spend).map((m) => (
                    <div className="rexad" key={m.id}>
                      <div className="rexhead"><b>{m.nombre}</b><TF r={m} /><Paused r={m} /><RolTag r={m} /><Calidad v={m.calidad} mix={m.calidadMix} /> <span className="rexkpi">{msg ? (money(m.costoConv) + "/conv · " + short(m.spend) + " · " + nf.format(m.conversaciones) + " conv") : (m.roas.toFixed(1) + "x · " + short(m.spend) + " · " + nf.format(m.ventas) + " vtas")}</span></div>
                      {(m.breakdown || []).map((b, j) => (
                        <div className="rexline" key={j}><span className="rexcamp">{b.campaign}</span> › <span className="rexset">{b.adset}</span>{b.aud ? <span className="rexaud">{b.aud}</span> : null}<Calidad v={b.calidad} /><Freq v={b.freq} max={freqCap(b.aud, u.freqMax)} /><span className="rexmeta">{short(b.spend)} · {msg ? (nf.format(b.conversaciones) + " conv") : (nf.format(b.ventas) + " vtas · " + b.roas.toFixed(1) + "x")}</span></div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>);
          })}
        </div>
        {thin.length > 0 && <div className="thinnote">+ {thin.length} fuera del top {limit}: {thin.map((g) => g.key).join(", ")}.</div>}
      </section>
    </>
  );
}
function Rec({ k, v }) { return <div className="recchip"><span className="reck">{k}</span><span className="recv">{v}</span></div>; }

// ─────────── Vista: EMBUDO (full-funnel) ───────────
// El problema que resuelve: rankear TODO por ROAS castiga a los creativos de arriba del embudo
// (frío), cuyo trabajo es enganchar y traer tráfico, no rematar. Acá: (1) el embudo de la cuenta
// (waterfall con % de paso y costo por etapa) y (2) los creativos agrupados por ROL de embudo, cada
// uno juzgado por la métrica de SU etapa (frío→hook/CTR, medio→costo/ATC, remate→ROAS).
function Embudo({ withV, u, modo = "ventas", accountName = "" }) {
  const msg = modo === "mensajes";
  const reliable = useMemo(() => withV.filter((r) => r.spend >= u.pisoSpend), [withV, u.pisoSpend]);
  // Totales de cuenta: los CONTEOS se suman (reach no, pero acá no lo usamos).
  const tot = useMemo(() => {
    const s = { spend: 0, imp: 0, video3s: 0, clics: 0, lpv: 0, vc: 0, atc: 0, checkout: 0, ventas: 0, revenue: 0 };
    withV.forEach((r) => { s.spend += r.spend; s.imp += (r.impresiones || 0); s.video3s += (r.video3s || 0); s.clics += (r.clics || 0); s.lpv += (r.lpv || 0); s.vc += (r.vc || 0); s.atc += (r.atc || 0); s.checkout += (r.checkout || 0); s.ventas += r.ventas; s.revenue += r.spend * r.roas; });
    return s;
  }, [withV]);
  const rate = (n, d) => d ? n / d : 0;
  const pc = (x) => (x * 100).toFixed(x < 0.1 && x > 0 ? 1 : 0) + "%";

  if (!tot.imp) return (
    <section className="empty"><div className="emptymark">◆</div><div className="emptytitle">Sin datos de embudo en este período</div><div className="emptysub">El embudo se arma con las impresiones, clics y eventos del pixel de Meta. (TikTok todavía no reporta el embudo completo.)</div></section>
  );

  // Cadena de conversión (los conteos de Meta no siempre son monótonos — VC puede superar a clics por
  // multi-disparo/omni; lo mostramos honesto y el costo por etapa es lo más comparable).
  const chain = [
    { lab: "Clics al enlace", n: tot.clics },
    { lab: "Landing page views", n: tot.lpv },
    { lab: "View content", n: tot.vc },
    { lab: "Add to cart", n: tot.atc },
    { lab: "Checkout iniciado", n: tot.checkout },
    { lab: "Compras", n: tot.ventas },
  ];
  const base = tot.clics || 1;

  // Creativos por rol de embudo (solo confiables). Cada rol con su métrica de etapa.
  const roles = useMemo(() => {
    const g = { frio: [], medio: [], remate: [] };
    reliable.forEach((r) => { const k = rolEmbudo(r); if (k) g[k].push(r); });
    const ctr = (r) => rate(r.clics, r.impresiones);
    g.frio.sort((a, b) => ctr(b) - ctr(a));
    g.medio.sort((a, b) => (a.atc ? a.spend / a.atc : 9e12) - (b.atc ? b.spend / b.atc : 9e12));
    g.remate.sort((a, b) => b.roas - a.roas);
    return g;
  }, [reliable]);

  const KPI = ({ lab, val, sub }) => <div className="kpi"><div className="klab">{lab}</div><div className="kval">{val}</div>{sub ? <div className="ksub">{sub}</div> : null}</div>;

  return (
    <>
      <div className="dayhead">
        <div><div className="daytitle">EMBUDO</div><div className="daysub">{accountName || "Cuenta"} · de la impresión a la venta — para ver TODO el recorrido, no solo el remate</div></div>
      </div>

      {/* Entrega y atención (tasas, no es una cadena de personas) */}
      <section className="kpis">
        <KPI lab="IMPRESIONES" val={short(tot.imp).replace("$", "")} sub={`CPM ${money(rate(tot.spend, tot.imp) * 1000)}`} />
        <KPI lab="HOOK RATE (3s)" val={pc(rate(tot.video3s, tot.imp))} sub={`${nf.format(tot.video3s)} reproducciones 3s`} />
        <KPI lab="CTR (enlace)" val={pc(rate(tot.clics, tot.imp))} sub={`${nf.format(tot.clics)} clics`} />
        <KPI lab="INVERSIÓN" val={short(tot.spend)} sub={msg ? "" : `ROAS cuenta ${rate(tot.revenue, tot.spend).toFixed(1)}x`} />
      </section>

      {/* Embudo de conversión */}
      <section className="sect">
        <div className="secthead"><span className="sverb" style={{ background: "#1E1812", color: "#F4C24A" }}><span className="sq" style={{ background: "#F4C24A" }} />▼</span><span className="stitle">EMBUDO DE CONVERSIÓN</span><span className="scount">cuenta · período</span></div>
        <div className="ranklist">
          {chain.map((st, i) => {
            const prev = i > 0 ? chain[i - 1].n : null;
            const step = prev ? st.n / prev : null;
            return (
              <div className="rankrow" key={st.lab}>
                <span className="rname" style={{ minWidth: 150 }}>{st.lab}</span>
                <div className="rbar"><span className="rfill" style={{ width: Math.max(2, (st.n / base) * 100) + "%", background: "#2E6E94" }} /></div>
                <span className="rval">{nf.format(st.n)}</span>
                <span className="rmeta">{step != null ? <b style={{ color: step < 0.5 ? "#C5362B" : step > 1.05 ? "#857A6A" : "#2E8B6B" }}>{pc(step)} del paso previo</b> : "—"} · {st.n ? money(tot.spend / st.n) + "/u" : "—"}</span>
              </div>
            );
          })}
        </div>
        <div className="dedup">▦ Embudo de la <b>cuenta completa</b> (todos los anuncios del período). Los rankings por rol de abajo muestran solo creativos con <b>spend ≥ piso</b>. Los costos por etapa (spend ÷ acciones) son lo más comparable; algunos pasos pueden dar &gt;100% porque Meta cuenta ciertos eventos (view content) por múltiples vías — tomalo como dirección, no al centímetro.</div>
      </section>

      {/* Creativos por rol de embudo */}
      {["frio", "medio", "remate"].map((k) => {
        const list = roles[k]; const x = ROL[k]; if (!list.length) return null;
        const top = list.slice(0, 6);
        return (
          <section className="sect" key={k}>
            <div className="secthead"><span className="sverb" style={{ background: x.bg, color: x.color }}><span className="sq" style={{ background: x.color }} />{x.short}</span><span className="stitle">{x.lab}</span><span className="scount">{list.length} creativo{list.length !== 1 ? "s" : ""}</span></div>
            <div className="dedup">▦ {x.desc}</div>
            <div className="ranklist">
              {top.map((r, i) => {
                const ctr = rate(r.clics, r.impresiones), hook = rate(r.video3s, r.impresiones), cAtc = r.atc ? r.spend / r.atc : 0;
                const val = k === "frio" ? pc(ctr) : k === "medio" ? (cAtc ? money(cAtc) : "—") : r.roas.toFixed(1) + "x";
                const meta = k === "frio" ? `hook ${pc(hook)} · CPM ${money(rate(r.spend, r.impresiones) * 1000)} · ${short(r.spend)}`
                  : k === "medio" ? `${nf.format(r.atc)} ATC · CTR ${pc(ctr)} · ${short(r.spend)}`
                  : `CPA ${money(r.cpa)} · ${nf.format(r.ventas)} vtas · ${short(r.spend)}`;
                return (
                  <div className="rankrow" key={r.id}>
                    <span className="rrank">{String(i + 1).padStart(2, "0")}</span>
                    <span className="rname">{r.nombre} <TF r={r} /><Paused r={r} /></span>
                    <span className="rval" style={{ color: x.color }}>{val}</span>
                    <span className="rmeta">{meta}</span>
                  </div>
                );
              })}
            </div>
            <div className="thinnote">Métrica de orden: {k === "frio" ? "CTR (mayor = mejor)" : k === "medio" ? "costo por add-to-cart (menor = mejor)" : "ROAS (mayor = mejor)"}. {list.length > 6 ? `+${list.length - 6} más.` : ""}</div>
          </section>
        );
      })}
    </>
  );
}

// ─────────── Vista: QUÉ GRABAR (prescripción de la próxima tanda) ───────────
// NO es "Qué hacer hoy" (eso opera sobre ads que YA corren). Acá miramos PATRONES históricos para
// decir qué conviene GRABAR la próxima vez. Agrupamos los creativos confiables (spend ≥ piso) por
// cada dimensión creativa del Sheet (gancho_familia, categoría primaria, ángulo, formato_video,
// estructura) y rankeamos cada valor por ROAS ponderado (o costo/conv en mensajes) vs el promedio
// de la cuenta. Exigimos N≥3 por grupo: con menos es ruido y va aparte. Honestidad estadística: si
// la cobertura o el N son bajos, lo enmarcamos como TENDENCIA, nunca como comprobado.
const QG_MINV = 3;
function QueGrabar({ withV, u, modo = "ventas", role = "vos", accountName = "" }) {
  const msg = modo === "mensajes";
  const cli = role === "cliente";
  const reliable = useMemo(() => withV.filter((r) => r.spend >= u.pisoSpend), [withV, u.pisoSpend]);

  // Referencia de cuenta: ROAS confiable ponderado (ventas) o costo/conv promedio (mensajes).
  const ref = useMemo(() => {
    let sp = 0, rev = 0, conv = 0;
    reliable.forEach((r) => { sp += r.spend; rev += r.spend * r.roas; conv += (r.conversaciones || 0); });
    return msg ? (conv ? sp / conv : 0) : (sp ? rev / sp : 0);
  }, [reliable, msg]);

  // Cobertura: % del spend de la cuenta matcheado a un creativo con gancho_familia real.
  const coverage = useMemo(() => {
    let tot = 0, fam = 0;
    withV.forEach((r) => { tot += r.spend; if (r.sheet?.familia && r.sheet.familia !== "nd") fam += r.spend; });
    return tot ? fam / tot : 0;
  }, [withV]);

  const valOf = (g) => msg ? (g.costoConv || 0) : g.roas;
  const better = (a, b) => msg ? valOf(a) - valOf(b) : valOf(b) - valOf(a); // mejor primero
  const beats = (g) => msg ? (g.costoConv > 0 && g.costoConv < ref) : g.roas > ref;
  const deltaFrac = (g) => !ref ? 0 : (msg ? (g.costoConv - ref) / ref : (g.roas - ref) / ref);
  // ↑ = mejor que la cuenta (más ROAS, o menor costo/conv en mensajes). Cliente: sin número crudo.
  const deltaLabel = (g) => {
    const up = msg ? deltaFrac(g) < 0 : deltaFrac(g) > 0;
    if (cli) return up ? "↑ por encima del promedio" : "↓ por debajo del promedio";
    return `${up ? "↑" : "↓"} ${Math.abs(Math.round(deltaFrac(g) * 100))}% vs cuenta`;
  };
  const rowColor = (g) => beats(g) ? BUCKETS.Escalar.color
    : (msg ? g.costoConv > ref * 1.15 : g.roas < ref * 0.85) ? BUCKETS.Pausar.color
    : BUCKETS.Mantener.color;

  const DIMS = [
    { key: "fam",    label: "GANCHO (FAMILIA)",     noun: "GANCHO" },
    { key: "ang",    label: "ÁNGULO DE VENTA",      noun: "ÁNGULO" },
    { key: "fvideo", label: "FORMATO DE VIDEO",     noun: "FORMATO" },
    { key: "estr",   label: "ESTRUCTURA NARRATIVA", noun: "ESTRUCT" },
    { key: "catp",   label: "CATEGORÍA PRIMARIA",   noun: "CATEG" },
  ];
  const dims = useMemo(() => DIMS.map((d) => {
    const groups = aggregate(reliable, d.key);
    const ranked = groups.filter((g) => g.n >= QG_MINV).sort(better);
    const thin = groups.filter((g) => g.n < QG_MINV);
    const best = ranked[0] || null; // mejor valor disponible con muestra suficiente (top del ranking)
    const worst = ranked.length >= 2 ? ranked[ranked.length - 1] : null;
    return { ...d, ranked, thin, best, worst };
  }), [reliable, msg, ref]);

  const byKey = (k) => dims.find((d) => d.key === k);
  const famDim = byKey("fam"), angDim = byKey("ang"), fvDim = byKey("fvideo");

  const hasAnySheet = withV.some((r) => r.sheet);
  if (!reliable.length) return (
    <section className="empty"><div className="emptymark">◆</div><div className="emptytitle">Sin creativos sobre el piso de spend</div><div className="emptysub">Bajá el piso de spend del umbral o esperá a que junten recorrido para prescribir la próxima tanda.</div></section>
  );
  if (!hasAnySheet) return (
    <section className="empty"><div className="emptymark">◆</div><div className="emptytitle">Falta el cruce con el Sheet</div><div className="emptysub">QUÉ GRABAR lee los patrones creativos (gancho, ángulo, formato, estructura) del análisis de Gemini. Elegí una pestaña del Sheet arriba para activarla.</div></section>
  );

  // Directiva sintetizada: el mejor valor (N≥3) de cada dimensión clave + el peor gancho a evitar.
  const parts = [];
  if (famDim.best) parts.push(`gancho ${famDim.best.key}`);
  if (angDim.best) parts.push(`ángulo ${angDim.best.key}`);
  if (fvDim.best) parts.push(`formato ${fvDim.best.key}`);
  const avoid = famDim.worst && (!famDim.best || famDim.worst.key !== famDim.best.key) && !beats(famDim.worst) ? famDim.worst.key : null;
  const directiva = parts.length
    ? `Próxima tanda para ${accountName || "el cliente"}: ${parts.join(", ")}.${avoid ? ` Evitá ${avoid}.` : ""}`
    : `Todavía no hay un patrón con muestra suficiente (N≥${QG_MINV}) para prescribir la próxima tanda en ${accountName || "esta cuenta"}.`;
  // Tendencia (no comprobado) si la cobertura es baja o el mejor gancho se apoya en pocos casos.
  const tendencia = coverage < 0.6 || !famDim.best || famDim.best.n < 5;

  return (
    <>
      <div className="dayhead">
        <div>
          <div className="daytitle">QUÉ GRABAR</div>
          <div className="daysub">Prescripción para la próxima tanda · patrones de {cli ? "tus creativos con más recorrido" : `${reliable.length} creativos confiables (spend ≥ ${money(u.pisoSpend)})`}</div>
        </div>
      </div>

      <section className="combo">
        <div className="combohead"><span className="combotag">{tendencia ? "◷ TENDENCIA" : "▶ DIRECTIVA"}</span><span className="comboname">{accountName || "Cliente"}</span></div>
        <div className="combostats" style={{ fontSize: "15px", lineHeight: 1.5 }}>{directiva}</div>
        <div className="combonote">
          {tendencia
            ? `Muestra parcial o pocos casos por grupo: tomalo como TENDENCIA, no como comprobado. Más volumen grabado = más certeza.`
            : `Combinación de los valores con mejor rendimiento (N≥${QG_MINV}) en cada dimensión. Un editor lo ejecuta sin vueltas.`}
          {cli
            ? (coverage < 0.6 ? " · ⚠ Muestra parcial: parte de la pauta todavía no está clasificada." : "")
            : (coverage < 0.6 ? ` · ⚠ Solo el ${Math.round(coverage * 100)}% del spend está clasificado con gancho_familia — muestra parcial.` : ` · Cobertura ${Math.round(coverage * 100)}% del spend clasificado.`)}
        </div>
      </section>

      {dims.map((d) => {
        if (!d.ranked.length) {
          if (cli) return null; // en el reporte del cliente no mostramos dimensiones sin data
          return (
          <section className="sect" key={d.key}>
            <div className="secthead"><span className="sverb" style={{ background: "#1E1812", color: "#F4C24A" }}><span className="sq" style={{ background: "#F4C24A" }} />{d.noun}</span><span className="stitle">{d.label}</span><span className="scount">sin data</span></div>
            <div className="dedup">Sin grupos con N≥{QG_MINV}.{d.thin.length ? ` Muestra chica (no rankeada): ${d.thin.map((g) => `${g.key} ·${g.n}`).join(", ")}.` : " Todavía no hay creativos clasificados en esta dimensión."}</div>
          </section>
          );
        }
        const max = Math.max(...d.ranked.map(valOf), msg ? 0 : 1) || 1;
        const barOf = (g) => msg ? Math.max(8, (1 - valOf(g) / max) * 100) : (valOf(g) / max) * 100;
        const winners = d.ranked.slice(0, 3);
        const losers = d.ranked.length > 3 ? [...d.ranked].slice(-3).reverse().filter((g) => !winners.includes(g)) : [];
        return (
          <section className="sect" key={d.key}>
            <div className="secthead"><span className="sverb" style={{ background: "#1E1812", color: "#F4C24A" }}><span className="sq" style={{ background: "#F4C24A" }} />{d.noun}</span><span className="stitle">{d.label}</span><span className="scount">{d.ranked.length} grupo{d.ranked.length !== 1 ? "s" : ""}</span></div>
            <div className="ranklist">
              {winners.map((g, i) => (
                <div className="rankrow" key={g.key}>
                  <span className="rrank">{String(i + 1).padStart(2, "0")}</span>
                  <span className="rname">{g.key}</span>
                  <div className="rbar"><span className="rfill" style={{ width: barOf(g) + "%", background: rowColor(g) }} /></div>
                  {!cli && <span className="rval" style={{ color: rowColor(g) }}>{msg ? money(g.costoConv) : g.roas.toFixed(1) + "x"}</span>}
                  <span className="rmeta">{cli ? deltaLabel(g) : `${g.n} ads · ${short(g.spend)} · ${deltaLabel(g)}`}</span>
                </div>
              ))}
            </div>
            {losers.length > 0 && <div className="thinnote">⚠ Por debajo del promedio: {losers.map((g) => `${g.key} (${cli ? deltaLabel(g) : (msg ? money(g.costoConv) : g.roas.toFixed(1) + "x") + ", " + g.n + " ads"})`).join(" · ")}.</div>}
            {!cli && d.thin.length > 0 && <div className="thinnote">Sin data suficiente (N&lt;{QG_MINV}, no rankeados): {d.thin.map((g) => `${g.key} ·${g.n}`).join(", ")}.</div>}
          </section>
        );
      })}
    </>
  );
}

// Aviso para las pestañas creativas que no aplican a Google Ads (dependen de la nomenclatura de
// los nombres, de los hooks o del Sheet — los anuncios de Google no llevan nada de eso).
function SinGoogle({ que }) {
  return (
    <section className="empty">
      <div className="emptymark">🔍</div>
      <div className="emptytitle">No disponible para Google Ads</div>
      <div className="emptysub">{que} depende de la nomenclatura y los hooks de los creativos, que los anuncios de Google (RSA/PMax) no llevan. Con Google tenés veredictos, Panel, Top, Qué hacer hoy, Análisis, Plan y el chat.</div>
    </section>
  );
}

function EmptyState({ account, loading, err }) {
  return (
    <section className="empty">
      <div className="emptymark">◆</div>
      <div className="emptytitle">{loading ? "Cargando…" : !account ? "Elegí un cliente para empezar" : (err || "Sin datos en este período")}</div>
      {!account && !loading && <div className="emptysub">El panel se llena con los creativos de la cuenta que selecciones arriba.</div>}
    </section>
  );
}

// ─────────── Historial de lecturas/planes (localStorage, por cliente) ───────────
// Cada lectura del cerebro y cada plan quedan guardados con fecha, para auditar qué dijo, qué
// decisiones se tomaron y si nos fue guiando bien. Vive en localStorage (sin DB, cero infra):
// es por browser/máquina. Acordeón con lo más nuevo arriba; al abrir, renderiza EXACTAMENTE lo
// mismo que una lectura recién generada (mismos componentes).
const histLoad = (key) => { try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const fdate = (t) => new Date(t).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Historial HÍBRIDO: localStorage siempre (cache local + fallback) y, si Upstash está conectado
// (/api/history responde enabled:true), también server-side → compartido entre máquinas y usuarios
// con acceso a la cuenta. Si el server tiene data manda el server; si el server está vacío y este
// browser tiene historial viejo, lo migra solo (primera vez). Sin Upstash todo sigue como antes.
function useHistSync(kind, account) {
  const key = "nusa_" + kind + "_" + (account || "x");
  const [items, setItems] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const local = histLoad(key);
    setItems(local);
    if (!account) return;
    fetch("/api/history?kind=" + kind + "&account=" + account)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j || j.enabled !== true) return;
        const server = Array.isArray(j.items) ? j.items : [];
        if (server.length) {
          setItems(server);
          try { localStorage.setItem(key, JSON.stringify(server)); } catch {}
        } else if (local.length) {
          // server recién conectado y vacío → subimos lo que había en este browser
          fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, account, items: local }) }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [key, kind, account]);
  const save = (v) => {
    setItems(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
    if (account) fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, account, items: v }) }).catch(() => {});
  };
  return [items, save];
}

function Historial({ items, render }) {
  const [open, setOpen] = useState(null);
  if (!items.length) return null;
  return (
    <div className="histsect">
      <div className="histtitle">🗂 HISTORIAL · {items.length} {items.length === 1 ? "guardado" : "guardados"}</div>
      {items.map((it, i) => (
        <div className="histitem" key={it.t || i}>
          <button className="histhead" onClick={() => setOpen(open === i ? null : i)}>
            <span className="histcaret">{open === i ? "▾" : "▸"}</span>
            <span className="histdate">{fdate(it.t)}</span>
            <span className="histmeta">{it.label}</span>
          </button>
          {open === i && <div className="histbody">{render(it)}</div>}
        </div>
      ))}
    </div>
  );
}

// ─────────── Vista: USUARIOS (ABM de logins de clientes, solo admin) ───────────
// Los usuarios viven en Upstash con password hasheada (PBKDF2) y se administran desde acá: sin
// tocar env vars ni redeploy. Los admin de respaldo siguen en APP_USERS (env) y solo se listan.
function Usuarios({ accounts, sheetTabs, tnStores = [] }) {
  const [data, setData] = useState(null); // { enabled, users, envUsers }
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // usuario en edición (null = alta)
  const [fu, setFu] = useState(""); const [fp, setFp] = useState("");
  const [fAdmin, setFAdmin] = useState(false);
  const [fAcc, setFAcc] = useState([]); const [fTabs, setFTabs] = useState([]); const [fStores, setFStores] = useState([]);

  const load = () => { fetch("/api/users").then((r) => r.json()).then((j) => j.error ? setErr(j.error) : setData(j)).catch((e) => setErr(String(e.message || e))); };
  useEffect(load, []);

  const genPass = () => { const a = new Uint8Array(10); crypto.getRandomValues(a); setFp(Array.from(a, (b) => "abcdefghjkmnpqrstuvwxyzACDEFHJKLMNPRTUVWXY3479".charAt(b % 46)).join("")); };
  const toggleIn = (arr, set) => (v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const startEdit = (u) => { setEditing(u.u); setFu(u.u); setFp(""); setFAdmin(!!u.admin); setFAcc(u.accounts || []); setFTabs(u.tabs || []); setFStores(u.stores || []); setOkMsg(""); setErr(""); };
  const reset = () => { setEditing(null); setFu(""); setFp(""); setFAdmin(false); setFAcc([]); setFTabs([]); setFStores([]); };

  const save = async () => {
    setSaving(true); setErr(""); setOkMsg("");
    try {
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upsert", u: fu, p: fp || undefined, admin: fAdmin, accounts: fAcc, tabs: fTabs, stores: fStores }) });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setOkMsg((editing ? "Actualizado: " : "Creado: ") + fu + (fp ? " · pasale la contraseña por un canal seguro" : ""));
      reset(); load();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };
  const del = async (u) => {
    if (!window.confirm("¿Borrar el usuario \"" + u + "\"? Deja de poder entrar.")) return;
    setErr(""); setOkMsg("");
    try {
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", u }) });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setOkMsg("Borrado: " + u); load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <section className="an">
      <div className="anhead">
        <div><div className="antitle">▸ USUARIOS</div><div className="ansub">Logins de clientes: alta, contraseña y qué cuentas/pestañas ve cada uno. Contraseñas hasheadas en Upstash — acá no se ven ni se recuperan, solo se resetean.</div></div>
      </div>
      {err && <div className="generr">{err}</div>}
      {okMsg && <div className="usrok">✓ {okMsg}</div>}
      {data && data.enabled === false && <div className="anplaceholder">Falta conectar <b>Upstash</b> (Vercel → Storage) para administrar usuarios desde acá. Mientras tanto siguen por la env var <b>APP_USERS</b>.</div>}
      {data && data.enabled && (
        <>
          <div className="usrlist">
            {(data.users || []).map((u) => (
              <div className="usrrow" key={u.u}>
                <span className="usrname">{u.u}{u.admin ? <i className="usradmin">ADMIN</i> : null}</span>
                <span className="usrmeta">{u.admin ? "ve todo" : (u.accounts.length + (u.accounts.length === 1 ? " cuenta" : " cuentas") + ((u.stores || []).length ? " · 🛒 " + u.stores.join(", ") : "") + (u.tabs.length ? " · " + u.tabs.length + " pestañas" : ""))}</span>
                <button className="usrbtn" onClick={() => startEdit(u)}>editar</button>
                <button className="usrbtn del" onClick={() => del(u.u)}>borrar</button>
              </div>
            ))}
            {!data.users.length && <div className="sempty">Sin usuarios en Upstash todavía. Creá el primero abajo.</div>}
            {data.envUsers && data.envUsers.length > 0 && <div className="usrenv">De respaldo en env (APP_USERS, se editan en Vercel): {data.envUsers.join(", ")}</div>}
          </div>
          <div className="usrform">
            <div className="usrformtitle">{editing ? "EDITAR: " + editing : "NUEVO USUARIO"}</div>
            <div className="usrfields">
              <input className="chatinput" placeholder="usuario (ej: morashop)" value={fu} onChange={(e) => setFu(e.target.value)} disabled={!!editing} />
              <span className="usrpass"><input className="chatinput" placeholder={editing ? "nueva contraseña (vacío = no cambiar)" : "contraseña (mín. 8)"} value={fp} onChange={(e) => setFp(e.target.value)} /><button className="usrbtn" onClick={genPass}>generar</button></span>
              <label className="usrchk"><input type="checkbox" checked={fAdmin} onChange={(e) => setFAdmin(e.target.checked)} /> admin (ve todas las cuentas)</label>
            </div>
            {!fAdmin && (
              <div className="usrpick">
                <div className="usrpickcol"><div className="usrpicklab">CUENTAS QUE VE</div>{accounts.map((a) => <label key={a.id} className="usrchk"><input type="checkbox" checked={fAcc.includes(a.id)} onChange={() => toggleIn(fAcc, setFAcc)(a.id)} /> {a.name}</label>)}</div>
                <div className="usrpickcol"><div className="usrpicklab">🛒 TIENDA NUBE</div>{tnStores.map((s) => <label key={s.name} className="usrchk"><input type="checkbox" checked={fStores.includes(s.name)} onChange={() => toggleIn(fStores, setFStores)(s.name)} /> {s.name}</label>)}{!tnStores.length && <div className="sempty">sin tiendas</div>}</div>
                <div className="usrpickcol"><div className="usrpicklab">PESTAÑAS DEL SHEET</div>{sheetTabs.map((t) => <label key={t.gid} className="usrchk"><input type="checkbox" checked={fTabs.includes(t.title)} onChange={() => toggleIn(fTabs, setFTabs)(t.title)} /> {t.title}</label>)}{!sheetTabs.length && <div className="sempty">sin pestañas</div>}</div>
              </div>
            )}
            <div className="usractions">
              <button className="anbtn" onClick={save} disabled={saving || !fu.trim() || (!editing && (fp || "").length < 8)}>{saving ? "…" : editing ? "✓ GUARDAR" : "+ CREAR"}</button>
              {editing && <button className="usrbtn" onClick={reset}>cancelar</button>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ─────────── Vista: PREGUNTAR (chat capado a los datos de la cuenta) ───────────
// Preguntas en lenguaje natural sobre la cuenta (Meta + Tienda Nube + planilla). El backend
// (/api/chat) corre tool-use con herramientas read-only scopeadas a esta cuenta: no puede
// responder nada que no salga de esos datos. Historial por cliente en localStorage.
const CHAT_SUGS = [
  "¿Cuánto consume por día toda la cuenta?",
  "Listame los anuncios que más consumieron",
  "Top 10 productos más vendidos en los últimos 60 días",
  "Escribime un guion con un hook de Ruptura para el próximo video",
];
function Chat({ account, accountName, store, tab, accCur, extras = [], extrasCur = [], criterio = "" }) {
  // Conversación por cliente: localStorage + Upstash si está conectado (compartida entre máquinas)
  const [msgs, saveMsgs] = useHistSync("chat", account);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs, loading]);

  const enviar = async (texto) => {
    const text = String(texto ?? q).trim();
    if (!text || loading) return;
    const next = [...msgs, { role: "user", content: text }];
    saveMsgs(next); setQ(""); setLoading(true); setErr("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, accountName, store, tab, accCur, extras, extrasCur, criterio, messages: next.slice(-12) }),
      });
      // El server puede no responder JSON: si la consulta se pasa de los 60s, Vercel devuelve su
      // propia página de error en texto. Parseamos a mano para no romper con "Unexpected token".
      const raw = await res.text();
      let d;
      try { d = JSON.parse(raw); }
      catch { throw new Error(res.status === 504 || /timeout|FUNCTION_INVOCATION/i.test(raw) ? "La consulta tardó demasiado y se cortó. Probá un período más corto (por ejemplo, un mes a la vez)." : "El servidor no respondió bien. Probá de nuevo o acotá la consulta."); }
      if (d.error) throw new Error(d.error);
      saveMsgs([...next, { role: "assistant", content: d.text }].slice(-30));
    } catch (e) { setErr("No se pudo responder: " + e.message); } finally { setLoading(false); }
  };
  const limpiar = () => saveMsgs([]);

  return (
    <section className="an">
      <div className="anhead">
        <div><div className="antitle">▸ PREGUNTALE A LA CUENTA</div><div className="ansub">Preguntas en lenguaje natural sobre {accountName || "la cuenta"}: Meta{store ? " + 🛒 " + store : ""}{tab ? " + planilla " + tab : ""}. Datos + contenido (guiones, hooks, copys) de esta cuenta — nada de afuera ni de otros clientes.</div></div>
        {msgs.length > 0 && <button className="anbtn" onClick={limpiar}>✕ LIMPIAR</button>}
      </div>
      <div className="chatbox">
        {!msgs.length && !loading && (
          <div className="chatsugs">
            <div className="chatsugtitle">PROBÁ CON:</div>
            {CHAT_SUGS.map((s, i) => <button key={i} className="chatsug" onClick={() => enviar(s)}>{s}</button>)}
          </div>
        )}
        <div className="chatmsgs">
          {msgs.map((m, i) => (
            <div key={i} className={"chatmsg " + (m.role === "user" ? "user" : "ai")}>
              <span className="chatwho">{m.role === "user" ? "VOS" : "NUSA"}</span>
              <div className="chattext">{m.content}</div>
            </div>
          ))}
          {loading && <div className="chatmsg ai"><span className="chatwho">NUSA</span><div className="chattext chatthinking">● consultando la cuenta…</div></div>}
          {err && <div className="generr">{err}</div>}
          <div ref={endRef} />
        </div>
        <div className="chatrow">
          <input className="chatinput" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviar(); }} placeholder="ej: ¿cuánto invertimos esta semana y qué dejó?" disabled={loading} />
          <button className="anbtn" onClick={() => enviar()} disabled={loading || !q.trim()}>{loading ? "…" : "▶ PREGUNTAR"}</button>
        </div>
      </div>
    </section>
  );
}

// Render del output del analista (lo usa la lectura fresca Y el historial).
function AnalisisOut({ out }) {
  const PR = { alta: "#C0392B", media: "#E0852E", baja: "#857A66" };
  if (!out) return null;
  return (
    <div className="anout">
      <div className="antop">{out.titular}</div>
      <div className="andiag">{out.diagnostico}</div>
      {Array.isArray(out.acciones) && out.acciones.length > 0 && (
        <div className="anblock"><div className="anbh">ACCIONES</div>
          {out.acciones.map((a, i) => (
            <div className="anaccion" key={i}>
              <span className="anprio" style={{ background: PR[a.prioridad] || "#857A66" }}>{(a.prioridad || "").toUpperCase()}</span>
              <div><div className="anacc">{a.accion}</div><div className="anporque">{a.porque}</div></div>
            </div>
          ))}
        </div>
      )}
      {Array.isArray(out.explorar) && out.explorar.length > 0 && (
        <div className="anblock"><div className="anbh">PARA EXPLORAR</div>{out.explorar.map((e, i) => <div className="anitem" key={i}>↗ {e}</div>)}</div>
      )}
      {Array.isArray(out.riesgos) && out.riesgos.length > 0 && (
        <div className="anblock"><div className="anbh">RIESGOS</div>{out.riesgos.map((e, i) => <div className="anitem riesgo" key={i}>⚠ {e}</div>)}</div>
      )}
    </div>
  );
}

// ─────────── Vista: ANÁLISIS (el "cerebro" read-only) ───────────
function Analisis({ withV, stats, audiencias, tnSummary, u, accountName, periodo, analysis, setAnalysis, modo = "ventas", account = "", extras = [] }) {
  const out = analysis; // persiste en el padre: no se borra al cambiar de pestaña
  const setOut = setAnalysis;
  const msg = modo === "mensajes";
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Plataforma(s) de la vista: una sola, o "mixta (...)" en la vista combinada (Meta + Google).
  const platDe = (id) => (String(id || "").startsWith("g:") ? "google" : String(id || "").startsWith("tt:") ? "tiktok" : "meta");
  const plats = [...new Set([account, ...extras].filter(Boolean).map(platDe))];
  const plataforma = plats.length > 1 ? "mixta (" + plats.join(" + ") + ")" : (plats[0] || "meta");

  // Salud de tracking (pixel de Meta) — fase 2A. Se trae aparte porque no vive en withV. Degrada a
  // null. En Google/TikTok no hay pixel de Meta → ni fetcheamos (vale la cuenta PRINCIPAL).
  const [tracking, setTracking] = useState(null);
  useEffect(() => {
    if (!account || platDe(account) !== "meta") { setTracking(null); return; }
    let vivo = true;
    fetch("/api/tracking?account=" + encodeURIComponent(account))
      .then((r) => r.json()).then((d) => { if (vivo) setTracking(d && d.tracking ? d.tracking : null); })
      .catch(() => { if (vivo) setTracking(null); });
    return () => { vivo = false; };
  }, [account]);

  // Resumen COMPACTO calculado acá (no mandamos anuncios crudos → pocos tokens).
  const snapshot = useMemo(() => {
    const reliable = withV.filter((r) => r.spend >= u.pisoSpend);
    const m = (g) => msg ? { k: g.key, costo_conv: +(g.costoConv || 0).toFixed(2), conversaciones: Math.round(g.conversaciones || 0), spend: Math.round(g.spend), ads: g.n } : { k: g.key, roas: +g.roas.toFixed(1), spend: Math.round(g.spend), ventas: Math.round(g.ventas), ads: g.n };
    const top = (dim) => [...aggregate(reliable, dim)].sort((a, b) => msg ? (a.costoConv || 9e12) - (b.costoConv || 9e12) : b.roas - a.roas).slice(0, 5).map(m);
    const aud = (audiencias && audiencias.length ? audiencias : []).map((g) => ({ ...g, roas: g.spend ? g.revenue / g.spend : 0, costoConv: g.conversaciones ? g.spend / g.conversaciones : 0 })).sort((a, b) => msg ? (a.costoConv || 9e12) - (b.costoConv || 9e12) : b.roas - a.roas).slice(0, 6).map(m);
    const r2 = (r) => msg ? { nombre: r.nombre, costo_conv: r.costoConv, conversaciones: r.conversaciones, spend: r.spend, ya_pausado: r.activa === false } : { nombre: r.nombre, roas: r.roas, spend: r.spend, ventas: r.ventas, ya_pausado: r.activa === false };
    const sangrado = [...withV].filter((r) => r.v === "Pausar").sort((a, b) => b.spend - a.spend).slice(0, 5).map(r2);
    const topActivos = [...reliable.filter((r) => r.activa !== false)].sort((a, b) => msg ? (a.costoConv || 9e12) - (b.costoConv || 9e12) : b.roas - a.roas).slice(0, 5).map((r) => ({ ...r2(r), activa: true }));
    const b = msg ? (topActivos[0] && withV.find((r) => r.nombre === topActivos[0].nombre)) : topWinners(reliable, 1)[0];
    // Salud estructural (auditoría plegada en el cerebro, no en una pestaña): diversidad de formatos,
    // conjuntos fatigados (frecuencia sobre el cap por nivel de audiencia) y concentración de audiencia.
    const formatos = new Set(reliable.map((r) => r.fmt).filter((f) => f && f !== "nd"));
    let conjFat = 0, conjTot = 0;
    reliable.forEach((r) => (r.breakdown || []).forEach((bk) => {
      if (!bk.freq) return; conjTot += 1;
      const cap = freqCap(bk.aud, u.freqMax);
      if (cap != null && bk.freq >= cap) conjFat += 1;
    }));
    const audList = (audiencias && audiencias.length ? audiencias : []);
    const audTotalSpend = audList.reduce((s, a) => s + (a.spend || 0), 0);
    const audTop = [...audList].sort((a, b2) => (b2.spend || 0) - (a.spend || 0))[0];
    const salud_estructural = {
      formatos_distintos: formatos.size,
      conjuntos_fatigados: conjFat, total_conjuntos: conjTot,
      audiencia_concentracion_pct: audTotalSpend && audTop ? Math.round((audTop.spend / audTotalSpend) * 100) : null,
    };
    return {
      modo, plataforma, cuenta: accountName || "—", periodo,
      inversion: stats.spendTotal,
      // vista combinada: el desglose por plataforma le da al cerebro la foto multi-canal real
      ...(plats.length > 1 && stats.spendByPlat ? { inversion_por_plataforma: Object.fromEntries(Object.entries(stats.spendByPlat).map(([p, s]) => [p, Math.round(s)])) } : {}),
      ...(msg
        ? { conversaciones: stats.convTotal, costo_conv_prom: +stats.costoConvProm.toFixed(2) }
        : { ventas: stats.ventasTotal, cpa: Math.round(stats.cpaProm), roas_cuenta: +stats.accountRoas.toFixed(1), tienda: tnSummary ? { facturacion: tnSummary.facturacion, criterio_venta: tnSummary.criterio === "no_canceladas" ? "todas las no canceladas (pagadas + pendientes)" : "solo pagadas", mer: tnSummary.mer, roas_pixel: +(tnSummary.roasMeta || 0).toFixed(1) } : null }),
      veredictos: stats.counts,
      umbral: msg ? { costo_conv_max: u.costoMax === Infinity ? null : u.costoMax, piso_spend: u.pisoSpend || null } : { roas_min: u.roasMin || null, cpa_max: u.cpaMax === Infinity ? null : u.cpaMax, piso_spend: u.pisoSpend || null },
      ranking: { angulo_venta: top("ang"), categoria: top("cat"), hook: top("hook"), audiencia: aud, formato: top("fmt") },
      sangrando: sangrado,
      top_activos: topActivos,
      receta_ganadora: b ? { angulo: b.sheet?.angulo || b.ang, categoria: b.ang, hook: b.sheet?.tipo_gancho || b.hook, audiencia: b.aud, formato: b.fmt, ...(msg ? { costo_conv: b.costoConv, conversaciones: b.conversaciones } : { roas: b.roas, ventas: b.ventas }), spend: b.spend, activa: b.activa !== false } : null,
      salud_estructural,
      ...(tracking ? { salud_tracking: tracking } : {}),
    };
  }, [withV, stats, audiencias, tnSummary, u, accountName, periodo, msg, modo, tracking, plataforma]);

  // Historial por cliente: localStorage + Upstash si está conectado (compartido entre máquinas)
  const [hist, saveHist] = useHistSync("hist_an", account);

  const pedir = async () => {
    setLoading(true); setErr(""); setOut(null);
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshot }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOut(data.analysis);
      saveHist([{ t: Date.now(), label: (accountName || "—") + " · " + periodo + " · " + modo, out: data.analysis }, ...hist].slice(0, 15));
    } catch (e) { setErr("No se pudo analizar: " + e.message); } finally { setLoading(false); }
  };

  return (
    <section className="an">
      <div className="anhead">
        <div><div className="antitle">◆ LECTURA DEL ANALISTA</div><div className="ansub">Claude mira toda la cuenta ({snapshot.cuenta} · {periodo}) y te dice qué pasa y qué hacer. Read-only, no toca nada.</div></div>
        <button className="anbtn" onClick={pedir} disabled={loading}>{loading ? "● PENSANDO..." : out ? "↻ VOLVER A LEER" : "▶ PEDIR LECTURA"}</button>
      </div>
      {err && <div className="generr">{err}</div>}
      {!out && !loading && !err && <div className="anplaceholder">Apretá <b>“Pedir lectura”</b> y el analista cruza tus rankings, el MER vs ROAS del pixel, qué escalar, qué sangra y qué te falta probar. Cada lectura cuesta ~2 centavos de IA y corre solo cuando vos la pedís.</div>}
      {out && <AnalisisOut out={out} />}
      <Historial items={hist} render={(it) => <AnalisisOut out={it.out} />} />
    </section>
  );
}

// Render del output del plan (lo usa el plan fresco Y el historial).
function PlanOut({ p, snap, msg }) {
  const COL = { Pesimista: "#C0392B", Normal: "#E0852E", Optimista: "#2E8B6B" };
  const ACC = { subir: "↑", bajar: "↓", pausar: "⏸", mantener: "=" };
  if (!p) return null;
  return (
    <div className="anout">
      {snap && (msg
        ? <div className="planbar"><span>CONVERSACIONES MTD {nf.format(snap.conversaciones_mtd)}</span><span>COSTO/CONV {money(snap.costo_conv)}</span><span>INVERSIÓN {money(snap.inversion_mtd)}</span><span>FALTAN {snap.dias_restantes} días</span></div>
        : <div className="planbar"><span>META {money(snap.meta)}</span><span>FACTURADO MTD {money(snap.facturacion_mtd)}</span><span>MER {snap.mer}x</span><span>PROYECCIÓN {money(snap.proyeccion_sin_cambios)}</span><span>FALTAN {snap.dias_restantes} días</span></div>)}
      <div className="andiag">{p.resumen}</div>
      <div className="planscenarios">
        {(p.escenarios || []).map((e, i) => (
          <div className="plansc" key={i} style={{ "--sc": COL[e.nombre] || "#857A66" }}>
            <div className="planschead"><span className="planscname">{e.nombre}</span>{!msg && <span className={"planscmeta" + (e.alcanza_meta ? " ok" : "")}>{e.alcanza_meta ? "✓ llega" : "✗ no llega"}</span>}</div>
            <div className="planscsup">{e.supuesto}</div>
            <div className="planscnums"><div><b>{money(e.inversion_extra_diaria)}</b><span>/día extra</span></div><div><b>{money(e.inversion_extra_total)}</b><span>total al mes</span></div>{msg ? <div><b>{nf.format(e.conversaciones_proyectadas || 0)}</b><span>conv. proyectadas</span></div> : <div><b>{money(e.facturacion_proyectada)}</b><span>proyección</span></div>}</div>
            <div className="planscacc">
              {(e.acciones || []).map((a, j) => (
                <div className="planacc" key={j}>
                  <span className="planaccico">{ACC[a.accion] || "•"}</span>
                  <div><div className="planacct"><b>{a.unidad}</b> <span className="planlvl">{a.nivel}</span> {a.de != null && a.a != null ? <span className="planba">{money(a.de)}→{money(a.a)}/día</span> : a.accion}</div><div className="planaccp">{a.porque}</div></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {Array.isArray(p.desinversion) && p.desinversion.length > 0 && (
        <div className="anblock"><div className="anbh">DESINVERTIR / REASIGNAR</div>{p.desinversion.map((d, i) => <div className="anitem" key={i}>↓ {d}</div>)}</div>
      )}
    </div>
  );
}

// ─────────── Vista: PLAN (cómo llegar al objetivo) ───────────
function Plan({ account, store, goal, plan, setPlan, modo = "ventas", accCur = "ARS", extras = [], extrasCur = [], count = "" }) {
  const msg = modo === "mensajes";
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  // Historial por cliente: localStorage + Upstash si está conectado (compartido entre máquinas)
  const [hist, saveHist] = useHistSync("hist_plan", account);
  const pedir = async () => {
    setLoading(true); setErr("");
    try {
      // vista combinada: mandamos todas las cuentas con su moneda (params paralelos, los ids llevan ":")
      const qs = "accounts=" + encodeURIComponent([account, ...extras].join(",")) + "&curs=" + [accCur, ...extrasCur].join(",") + (store ? "&store=" + encodeURIComponent(store) + "&count=" + count : "") + "&goal=" + goal + "&modo=" + modo;
      const res = await fetch("/api/plan?" + qs, { method: "POST" });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setPlan(d);
      saveHist([{ t: Date.now(), label: (msg ? "mensajes" : "meta " + money(goal)) + " · " + modo, modo, plan: d.plan, snapshot: d.snapshot }, ...hist].slice(0, 15));
    } catch (e) { setErr("No se pudo armar el plan: " + e.message); } finally { setLoading(false); }
  };
  const p = plan && plan.plan;
  const snap = plan && plan.snapshot;
  return (
    <section className="an">
      <div className="anhead">
        <div><div className="antitle">◎ PLAN {msg ? "DE OPTIMIZACIÓN" : "PARA LLEGAR AL OBJETIVO"}</div><div className="ansub">{msg ? "Claude mira tu inversión real por adset/campaña (ABO/CBO) del mes y te da 3 escenarios de cuánto/dónde invertir para escalar conversaciones bajando el costo." : "Claude mira tu inversión real por adset/campaña (ABO/CBO) del mes en curso y te da 3 escenarios de cuánto y dónde invertir."} Read-only.</div></div>
        {(msg || goal > 0) && <button className="anbtn" onClick={pedir} disabled={loading}>{loading ? "● CALCULANDO..." : p ? "↻ RECALCULAR" : "▶ PEDIR PLAN"}</button>}
      </div>
      {!msg && goal <= 0 && <div className="anplaceholder">Primero cargá la <b>META del mes</b> en el Dashboard (Objetivo del mes). Sin meta no hay a dónde llegar.</div>}
      {err && <div className="generr">{err}</div>}
      {(msg || goal > 0) && !p && !loading && !err && <div className="anplaceholder">Apretá <b>“Pedir plan”</b>. El sistema cruza {msg ? "las conversaciones del mes, el costo por conversación" : "la meta, lo facturado del mes"}, los días que faltan y el budget real de cada unidad, y arma escenarios <b>pesimista / normal / optimista</b> de cuánto invertir y dónde (y qué desinvertir). ~5 centavos de IA, on-demand.</div>}
      {p && <PlanOut p={p} snap={snap} msg={msg} />}
      <Historial items={hist} render={(it) => <PlanOut p={it.plan} snap={it.snapshot} msg={it.modo === "mensajes"} />} />
    </section>
  );
}

// ─────────── Vista: DASHBOARD (Parte 3) ───────────
function Dash({ stats, u = {}, goal, setGoal, factTienda, tnStore, modo = "ventas", cmp = null }) {
  const msg = modo === "mensajes";
  const [openCard, setOpenCard] = useState(null); // card de Top Ads desplegada (detalle por conjunto)
  // COMPARAR: c = KPIs del período comparado (null si está apagado o cargando). dl arma el prop
  // de delta de cada Kpi: invert=true cuando BAJAR es bueno (CPA, costo/conv); null = neutro.
  const c = cmp && cmp.on && !cmp.loading ? cmp.stats : null;
  const dl = (cur, prev, fmt, invert) => (c ? { cur, prev, fmt, invert } : null);
  // El objetivo lo marca la facturación de Tienda Nube si hay tienda elegida; si no, la revenue de Meta.
  const facturado = factTienda != null ? factTienda : stats.revenue;
  const fuenteTienda = factTienda != null;
  const pct = goal ? Math.min(100, (facturado / goal) * 100) : 0;
  const falta = Math.max(0, goal - facturado);
  const hoy = new Date();
  const diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diasRestan = diasMes - hoy.getDate();
  return (
    <>
      {!msg && (
      <section className="goal">
        <div className="goalhead"><span className="goaltitle">OBJETIVO DEL MES{fuenteTienda ? <span className="goalsrc">🛒 {tnStore}</span> : null}</span><label className="goaledit">META<span className="finput"><i>$</i><input type="text" inputMode="numeric" value={goal} onChange={(e) => { const n = parseInt(String(e.target.value).replace(/[^\d]/g, ""), 10); setGoal(isNaN(n) ? 0 : n); }} /></span></label></div>
        {goal > 0 ? (<>
          <div className="goalbar"><span style={{ width: pct + "%" }} /></div>
          <div className="goalnums"><div className="goalpct">{pct.toFixed(0)}<small>%</small></div><div className="goalstack"><div><b className="mono">{short(facturado)}</b> <span className="soft">{fuenteTienda ? "facturado (tienda) de " : "facturado de "}{short(goal)}</span></div><div className="soft mono">faltan {short(falta)} · quedan {diasRestan} días</div></div></div>
        </>) : (
          <div className="goalnums"><div className="goalstack"><div><b className="mono">{short(facturado)}</b> <span className="soft">{fuenteTienda ? "facturado (tienda)" : "facturado"} · cargá una META arriba para ver el progreso</span></div></div></div>
        )}
      </section>
      )}
      {cmp && (
        <section className="cmpbar">
          <button className={"cmpbtn" + (cmp.on ? " on" : "")} onClick={() => cmp.setOn(!cmp.on)}>⇄ COMPARAR</button>
          {cmp.on && (<>
            <span className="cmplbl">contra</span>
            <select className="cselect" value={cmp.preset} onChange={(e) => cmp.setPreset(e.target.value)}>
              <option value="prev">Período anterior equivalente</option>
              <option value="yesterday">Ayer</option><option value="last_7d">Últimos 7 días</option><option value="last_14d">Últimos 14 días</option><option value="last_30d">Últimos 30 días</option><option value="last_90d">Últimos 90 días</option><option value="this_month">Este mes</option><option value="last_month">Mes pasado</option><option value="custom">Personalizado…</option>
            </select>
            {cmp.preset === "custom" && <span className="daterange"><input type="date" className="cdate" value={cmp.since} max={cmp.until || undefined} onChange={(e) => cmp.setSince(e.target.value)} /><i>→</i><input type="date" className="cdate" value={cmp.until} min={cmp.since || undefined} onChange={(e) => cmp.setUntil(e.target.value)} /></span>}
            {cmp.range && <span className="cmprange mono">{cmp.range.since} → {cmp.range.until}</span>}
            {cmp.loading && <span className="cmploading">comparando…</span>}
          </>)}
        </section>
      )}
      <section className="kpis dashk">
        {msg ? (<>
          <Kpi lab="CONVERSACIONES" val={nf.format(stats.convTotal)} mod="grn" cmp={dl(stats.convTotal, c && c.convTotal, (x) => nf.format(Math.round(x)), false)} /><Kpi lab="COSTO / CONV" val={money(stats.costoConvProm)} cmp={dl(stats.costoConvProm, c && c.costoConvProm, money, true)} /><Kpi lab="INVERSIÓN" val={short(stats.spendTotal)} sub={platSplit(stats.spendByPlat)} cmp={dl(stats.spendTotal, c && c.spendTotal, short, null)} /><Kpi lab="CREATIVOS" val={nf.format(stats.counts.Escalar + stats.counts.Mantener + stats.counts.Pausar + stats.counts["Observación"])} />
        </>) : (<>
          <Kpi lab="FACTURACIÓN" val={short(stats.revenue)} cmp={dl(stats.revenue, c && c.revenue, short, false)} /><Kpi lab="INVERSIÓN" val={short(stats.spendTotal)} sub={platSplit(stats.spendByPlat)} cmp={dl(stats.spendTotal, c && c.spendTotal, short, null)} /><Kpi lab="ROAS CUENTA" val={stats.accountRoas.toFixed(1) + "x"} mod="grn" cmp={dl(stats.accountRoas, c && c.accountRoas, (x) => x.toFixed(1) + "x", false)} /><Kpi lab="CPA PROMEDIO" val={money(stats.cpaProm)} cmp={dl(stats.cpaProm, c && c.cpaProm, money, true)} /><Kpi lab="VENTAS" val={nf.format(stats.ventasTotal)} cmp={dl(stats.ventasTotal, c && c.ventasTotal, (x) => nf.format(Math.round(x)), false)} />
        </>)}
      </section>
      <section className="sect">
        <div className="secthead"><span className="sverb" style={{ background: "#1E1812", color: "#F4C24A" }}><span className="sq" style={{ background: "#F4C24A" }} />TOP</span><span className="stitle">TOP ADS DEL MES</span><span className="scount">{msg ? "por costo/conv · spend ≥ piso" : "por ROAS · spend ≥ piso"}</span></div>
        <div className="topgrid">
          {stats.topAds.map((r, i) => { const b = BUCKETS[r.v]; const bd = r.breakdown || []; const exp = bd.length > 0; const isOpen = openCard === r.id; return (
            <div className={"topcard" + (exp ? " clickable" : "") + (isOpen ? " open" : "")} key={r.id} style={{ "--bar": b.color }} onClick={exp ? () => setOpenCard(isOpen ? null : r.id) : undefined}>
              <div className="tcardtop"><span className="trank">{String(i + 1).padStart(2, "0")}</span><span className="badge" style={{ background: b.bg, color: b.color }}><span className="sq" style={{ background: b.color }} />{r.v}</span></div>
              <div className="tname">{Object.keys(stats.spendByPlat || {}).length > 1 && <PlatTag p={r.plat} />}{r.nombre} <span className="fmt">{r.fmt}</span><TF r={r} /><Paused r={r} /><Calidad v={r.calidad} mix={r.calidadMix} /></div>{msg ? <div className="troas">{money(r.costoConv)}</div> : <div className="troas">{r.roas.toFixed(1)}<small>x</small></div>}<div className="tmeta mono">{msg ? (nf.format(r.conversaciones) + " conv · " + short(r.spend)) : (short(r.spend) + " spend · " + r.ang)}</div>
              {exp && <div className="tcardmore"><span className="tcardcaret">{isOpen ? "▾" : "▸"}</span>{isOpen ? "ocultar" : "ver"} {bd.length} conjunto{bd.length !== 1 ? "s" : ""}</div>}
              {isOpen && (
                <div className="tcardexp" onClick={(e) => e.stopPropagation()}>
                  {bd.map((bk, j) => (
                    <div className="rexline" key={j}><span className="rexcamp">{bk.campaign}</span> › <span className="rexset">{bk.adset}</span>{bk.aud ? <span className="rexaud">{bk.aud}</span> : null}<Calidad v={bk.calidad} /><Freq v={bk.freq} max={freqCap(bk.aud, u.freqMax)} /><span className="rexmeta">{short(bk.spend)} · {msg ? (nf.format(bk.conversaciones) + " conv") : (nf.format(bk.ventas) + " vtas · " + bk.roas.toFixed(1) + "x")}</span></div>
                  ))}
                </div>
              )}
            </div>); })}
        </div>
      </section>
    </>
  );
}
function Kpi({ lab, val, mod, sub, cmp }) {
  // Línea de COMPARACIÓN: delta % contra el período comparado. invert=true → bajar es bueno
  // (CPA, costo/conv); invert=null → neutro (la inversión no es buena ni mala por sí sola).
  let dline = null;
  if (cmp) {
    const { cur, prev, fmt, invert } = cmp;
    if (prev == null || !isFinite(prev)) dline = <div className="ksub">sin data comparable</div>;
    else {
      const d = prev !== 0 ? (cur - prev) / Math.abs(prev) : null;
      const cls = d == null ? "dneu" : invert == null ? "dneu" : (invert ? d < 0 : d > 0) ? "dup" : "ddown";
      dline = (
        <div className="ksub">
          {d != null && <span className={cls}>{(d >= 0 ? "▲ +" : "▼ −") + (Math.abs(d) * 100).toFixed(1).replace(".", ",") + "%"}</span>}
          {d != null ? " " : ""}vs {fmt(prev)}
        </div>
      );
    }
  }
  return <div className={"kpi" + (mod === "grn" ? " good" : "")}><div className="klab">{lab}</div><div className={"kval" + (mod === "grn" ? " grn" : "")}>{val}</div>{sub ? <div className="ksub">{sub}</div> : null}{dline}</div>;
}

// Badge de plataforma para la vista combinada (M = Meta, G = Google, TT = TikTok).
function PlatTag({ p }) {
  const l = p === "google" ? "G" : p === "tiktok" ? "TT" : "M";
  return <span className={"plt plt-" + (p || "meta")}>{l}</span>;
}
// "M $500k · G $200k" — desglose de inversión por plataforma (solo cuando hay mezcla real).
function platSplit(spendByPlat) {
  const e = Object.entries(spendByPlat || {});
  if (e.length < 2) return null;
  return e.sort((a, b) => b[1] - a[1]).map(([p, s]) => (p === "google" ? "G" : p === "tiktok" ? "TT" : "M") + " " + short(s)).join(" · ");
}

// ─────────── Vista: QUÉ HACER HOY (Parte 2) ───────────
function Hoy({ acc, u, done, toggle, total, doneCount, mantener, modo = "ventas" }) {
  const msg = modo === "mensajes";
  return (
    <>
      <div className="dayhead">
        <div><div className="daytitle">QUÉ HACER HOY</div><div className="daysub">{new Date().toLocaleDateString("es-AR")} · {acc.escalar.length} para escalar · {acc.apagar.length} para apagar/iterar · {acc.validar.length} para validar</div></div>
        <div className="progress"><div className="pbar"><span style={{ width: total ? `${(doneCount / total) * 100}%` : "0%" }} /></div><div className="pnum">{doneCount}/{total} HECHAS</div></div>
      </div>
      <Section title="ESCALÁ — SUBÍ EL CONJUNTO/CAMPAÑA" verb="Escalar" b={BUCKETS.Escalar} empty="Sin ganadores claros hoy.">
        {acc.escalar.map((r) => (<Item key={r.id} r={r} done={done.has(r.id)} toggle={toggle} c={BUCKETS.Escalar} reason={msg ? `${money(r.costoConv)}/conv · ${nf.format(r.conversaciones)} conversaciones · spend ${money(r.spend)}` : `ROAS ${r.roas.toFixed(1)}x · CPA ${money(r.cpa)} · spend ${money(r.spend)}`} act={`Subí ~+25% el budget del conjunto/campaña donde corre este creativo (o duplicalo en más conjuntos)`} />))}
      </Section>
      <Section title="PAUSÁ O ITERÁ" verb="Pausar" b={BUCKETS.Pausar} empty="Nada sangrando hoy 👌">
        {acc.apagar.map((r) => (<Item key={r.id} r={r} done={done.has(r.id)} toggle={toggle} c={BUCKETS.Pausar} reason={msg ? (r.conversaciones ? `${money(r.costoConv)}/conv — caro · spend ${money(r.spend)}` : `0 conversaciones con ${money(r.spend)} de spend`) : (u.roasMin ? `ROAS ${r.roas.toFixed(1)}x — debajo de ${u.roasMin}x · spend ${money(r.spend)}` : `CPA ${money(r.cpa)} — arriba del tope · spend ${money(r.spend)}`)} act={r.modo === "apagar" ? "Pausá el anuncio" : `Iterá: ${r.ang} no rinde — probá ${r.bestAng}`} />))}
      </Section>
      <Section title="VALIDÁ" verb="Observación" b={{ color: "#0F6E56", bg: "#DFEAE4" }} empty="Sin promesas pendientes.">
        {acc.validar.map((r) => (<Item key={r.id} r={r} done={done.has(r.id)} toggle={toggle} c={{ color: "#0F6E56", bg: "#DFEAE4" }} reason={msg ? `${money(r.costoConv)}/conv prometedor, pero solo ${money(r.spend)} (bajo el piso)` : `ROAS ${r.roas.toFixed(1)}x prometedor, pero solo ${money(r.spend)} (bajo el piso)`} act={`Dale más budget al conjunto hasta cruzar ${money(u.pisoSpend)} y reevaluar`} />))}
      </Section>
      <div className="noaction"><b>SIN ACCIÓN HOY:</b> {mantener} en <i>Mantener</i> (rentables, sostener){acc.esperar.length ? ` · ${acc.esperar.length} juntando data` : ""}. El sistema los miró y no requieren que toques nada.</div>
    </>
  );
}
function Section({ title, verb, b, empty, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : (children ? [children] : []);
  return (<section className="sect"><div className="secthead"><span className="sverb" style={{ background: b.bg, color: b.color }}><span className="sq" style={{ background: b.color }} />{verb}</span><span className="stitle">{title}</span><span className="scount">{String(items.length).padStart(2, "0")}</span></div>{items.length ? <div className="items">{items}</div> : <div className="sempty">{empty}</div>}</section>);
}
function Item({ r, done, toggle, reason, act, c }) {
  return (<div className={"item" + (done ? " done" : "")} style={{ "--bar": c.color }}><button className={"check" + (done ? " on" : "")} onClick={() => toggle(r.id)} style={{ "--c": c.color }}>{done ? "✓" : ""}</button><div className="ibody"><div className="iname">{r.nombre} <span className="fmt">{r.fmt}</span><TF r={r} /><Paused r={r} /></div><div className="ireason">{reason}</div></div><span className="act" style={{ background: c.bg, color: c.color }}>{act}</span></div>);
}

// ─────────── Vista: PANEL DE CREATIVOS (Parte 1) ───────────
function Panel({ rows, u = {}, stats, sort, setSortKey, modo = "ventas" }) {
  const msg = modo === "mensajes";
  const mix = new Set(rows.map((r) => r.plat || "meta")).size > 1; // vista combinada → badge por fila
  return (
    <>
      <section className="kpis">
        <div className="kpi"><div className="klab">SPEND TOTAL</div><div className="kval">{short(stats.spendTotal)}</div>{platSplit(stats.spendByPlat) ? <div className="ksub">{platSplit(stats.spendByPlat)}</div> : null}</div>
        {msg ? (<>
          <div className="kpi good"><div className="klab">CONVERSACIONES</div><div className="kval grn">{nf.format(stats.convTotal)}</div><div className="ksub">mensajes iniciados</div></div>
          <div className="kpi"><div className="klab">COSTO / CONV</div><div className="kval">{money(stats.costoConvProm)}</div><div className="ksub">spend ÷ conversaciones</div></div>
        </>) : (<>
          <div className="kpi flag"><div className="klab">ROAS PROMEDIO <span className="warn">⚠ INFLADO</span></div><div className="kval dim">{stats.roasSimple.toFixed(1)}x</div><div className="ksub">promedio simple de todos los creativos</div></div>
          <div className="kpi good"><div className="klab">ROAS CONFIABLE</div><div className="kval grn">{stats.roasConfiable.toFixed(1)}x</div><div className="ksub">ponderado, solo spend ≥ piso</div></div>
        </>)}
        <div className="kpi chips">{Object.entries(stats.counts).map(([k, n]) => (<div className="chip" key={k} style={{ background: BUCKETS[k].bg, color: BUCKETS[k].color }}><b>{n}</b> {k}</div>))}</div>
      </section>
      <section className="tablewrap">
        <table>
          <thead><tr>
            <Th label="Creativo" k="nombre" sort={sort} on={setSortKey} align="left" /><Th label="Ángulo (prim/sec · split)" align="left" /><Th label="Aud." align="left" />
            <Th label="Spend" k="spend" sort={sort} on={setSortKey} />{msg ? <><Th label="Conv." k="conversaciones" sort={sort} on={setSortKey} /><Th label="Costo/conv" k="costoConv" sort={sort} on={setSortKey} /></> : <><Th label="ROAS" k="roas" sort={sort} on={setSortKey} /><Th label="CPA" k="cpa" sort={sort} on={setSortKey} /></>}<Th label="Veredicto" k="veredicto" sort={sort} on={setSortKey} align="left" />
          </tr></thead>
          <tbody>
            {rows.map((r) => { const b = BUCKETS[r.v]; return (
              <tr key={r.id} style={{ "--bar": b.color }}>
                <td className="name">{mix && <PlatTag p={r.plat} />}{r.nombre} <span className="fmt">{r.fmt}</span><TF r={r} /><Paused r={r} /><RolTag r={r} /><Calidad v={r.calidad} mix={r.calidadMix} /></td>
                <td className="ang">{r.ang}{r.sec !== "—" ? <span className="sec"> / {r.sec}</span> : null}<span className="split">{r.split}</span></td>
                <td className="aud">{r.aud}</td><td className="mono num">{money(r.spend)}</td>{msg ? <><td className="mono num strong">{nf.format(r.conversaciones)}</td><td className="mono num">{money(r.costoConv)}</td></> : <><td className="mono num strong">{r.roas.toFixed(1)}x</td><td className="mono num">{money(r.cpa)}</td></>}
                <td><span className="badge" style={{ background: b.bg, color: b.color }}><span className="sq" style={{ background: b.color }} />{r.v}</span></td>
              </tr>); })}
          </tbody>
        </table>
      </section>
      <footer className="legend">{Object.entries(BUCKETS).map(([k, b]) => (<div className="leg" key={k}><span className="sq" style={{ background: b.color }} /><b style={{ color: b.color }}>{k}</b><span>{b.desc}</span></div>))}</footer>
    </>
  );
}

// ─────────── Vista: BIBLIOTECA (Parte 6) ───────────
function Biblioteca({ rows = [], hookMatch, setHookMatch }) {
  const [tab, setTab] = useState("hooks");
  const [q, setQ] = useState("");
  const [eje, setEje] = useState("Todos");
  const [cat, setCat] = useState("Todas");
  const [estado, setEstado] = useState("Todos"); // Todos | Sin probar | Probados (filtro post-análisis)
  const probados = hookMatch ? new Set(hookMatch.probados) : null; // persiste en el padre
  const byTemplate = (hookMatch && hookMatch.byTemplate) || {};
  const [openHook, setOpenHook] = useState(null); // id template expandido
  const [mLoading, setMLoading] = useState(false);
  const [mErr, setMErr] = useState("");
  const [copied, setCopied] = useState(null);
  const copy = (text, id) => { try { navigator.clipboard.writeText(text); } catch (e) {} setCopied(id); setTimeout(() => setCopied(null), 1200); };
  const ql = q.trim().toLowerCase();

  // (A) TUS GANADORES: hooks reales del cliente (texto_gancho del Sheet) ordenados por ROAS.
  const ganadores = useMemo(() => [...rows.filter((r) => r.spend > 0 && r.sheet && r.sheet.texto_gancho)].sort((a, b) => b.roas - a.roas).slice(0, 15), [rows]);
  // Hooks reales únicos con los creativos que los usaron (nombre + timeframe), indexados.
  const realHookList = useMemo(() => {
    const map = new Map();
    rows.filter((r) => r.spend > 0 && r.sheet && r.sheet.texto_gancho).forEach((r) => {
      const t = r.sheet.texto_gancho;
      if (!map.has(t)) map.set(t, []);
      map.get(t).push({ nombre: r.nombre, tf: tf(r), roas: r.roas, spend: r.spend, activa: r.activa });
    });
    return Array.from(map.entries()).slice(0, 80).map(([text, creativos], i) => ({ i, text, creativos }));
  }, [rows]);

  // (B) Mapa probado/sin-probar: matchea tus hooks reales contra la biblioteca (on-demand, IA).
  const analizar = async () => {
    setMLoading(true); setMErr(""); setOpenHook(null);
    try {
      const res = await fetch("/api/match-hooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ realHooks: realHookList.map((h) => ({ i: h.i, text: h.text })), library: HOOKS.map((h) => ({ id: h[0], text: h[1] })) }) });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      // template id -> creativos que lo probaron (con la razón del match, dedup por nombre)
      const bt = {};
      (d.matches || []).forEach((m) => {
        const cs = ((realHookList[m.i] || {}).creativos || []).map((c) => ({ ...c, razon: m.razon || "" }));
        (m.ids || []).forEach((id) => { bt[id] = (bt[id] || []).concat(cs); });
      });
      Object.keys(bt).forEach((id) => { const seen = new Set(); bt[id] = bt[id].filter((c) => !seen.has(c.nombre) && seen.add(c.nombre)); });
      setHookMatch({ probados: d.probados || [], byTemplate: bt });
    } catch (e) { setMErr("No se pudo analizar: " + e.message); } finally { setMLoading(false); }
  };

  const ejes = ["Todos", "Identidad", "Ruptura", "Pérdida", "Evidencia"];
  const ejeCount = (e) => HOOKS.filter((h) => e === "Todos" || h[3] === e).length;
  const estadoOk = (h) => !probados || estado === "Todos" || (estado === "Probados" ? probados.has(h[0]) : !probados.has(h[0]));
  const fHooks = HOOKS.filter((h) => (eje === "Todos" || h[3] === eje) && estadoOk(h) && (!ql || h[1].toLowerCase().includes(ql) || h[2].toLowerCase().includes(ql)));
  const shown = fHooks.slice(0, 80);
  const nProb = probados ? HOOKS.filter((h) => probados.has(h[0])).length : 0;
  const cats = ["Todas"].concat(Array.from(new Set(PROMPTS.map((p) => p.cat))));
  const fProm = PROMPTS.filter((p) => (cat === "Todas" || p.cat === cat) && (!ql || p.title.toLowerCase().includes(ql) || p.text.toLowerCase().includes(ql)));
  return (
    <section className="bib">
      <div className="bibtabs">
        <button className={"bibtab" + (tab === "ganadores" ? " on" : "")} onClick={() => { setTab("ganadores"); setQ(""); }}>★ TUS GANADORES <span className="bibn">{ganadores.length}</span></button>
        <button className={"bibtab" + (tab === "hooks" ? " on" : "")} onClick={() => { setTab("hooks"); setQ(""); }}>HOOKS <span className="bibn">{HOOKS.length}</span></button>
        <button className={"bibtab" + (tab === "prompts" ? " on" : "")} onClick={() => { setTab("prompts"); setQ(""); }}>PROMPTS <span className="bibn">{PROMPTS.length}</span></button>
        {tab !== "ganadores" && <input className="search" placeholder={tab === "hooks" ? "buscar hook o familia..." : "buscar prompt..."} value={q} onChange={(e) => setQ(e.target.value)} />}
      </div>
      {tab === "ganadores" ? (
        <>
          <div className="bibintro">Los hooks que <b>ya te funcionaron</b> — texto real de tus creativos top por ROAS, con su tipo, ángulo y estado. La base concreta para iterar.</div>
          {ganadores.length === 0 ? (
            <div className="anplaceholder">Elegí un cliente con cruce de Sheet para ver sus hooks ganadores reales.</div>
          ) : (
            <div className="hooklist">
              {ganadores.map((r, i) => (
                <div className="gancard" key={r.id}>
                  <span className="hnum">{String(i + 1).padStart(2, "0")}</span>
                  <div className="hmid"><span className="htext">{r.sheet.texto_gancho}</span><span className="htags"><span className="ftag">{r.sheet.tipo_gancho || "nd"}</span><span className="ftag">{r.sheet.angulo || r.ang}</span><span className="ganroas">{r.roas.toFixed(1)}x · {short(r.spend)} · {nf.format(r.ventas)} vtas</span><Paused r={r} /></span></div>
                  <button className="copybtn" onClick={() => copy(r.sheet.texto_gancho, "g" + r.id)}>{copied === "g" + r.id ? "✓" : "⧉"}</button>
                </div>))}
            </div>
          )}
        </>
      ) : tab === "hooks" ? (
        <>
          <div className="matchbar">
            <button className="matchbtn" onClick={analizar} disabled={mLoading || !realHookList.length}>{mLoading ? "● ANALIZANDO..." : probados ? "↻ RE-ANALIZAR" : "▶ ¿QUÉ YA PROBÉ?"}</button>
            {!realHookList.length && <span className="matchhint">elegí un cliente con Sheet para cruzar tus hooks reales</span>}
            {probados && <span className="matchhint"><b>{nProb}</b> probados · <b>{HOOKS.length - nProb}</b> sin probar (de {HOOKS.length}) · ~aproximado</span>}
            {mErr && <span className="matchhint" style={{ color: "#8A1C12" }}>{mErr}</span>}
          </div>
          {probados && <div className="ejefilt">{["Todos", "Sin probar", "Probados"].map((e) => <button key={e} className={"ejepill" + (estado === e ? " on" : "")} onClick={() => setEstado(e)}>{e}</button>)}</div>}
          <div className="ejefilt">
            {ejes.map((e) => (<button key={e} className={"ejepill" + (eje === e ? " on" : "")} onClick={() => setEje(e)} style={eje === e && e !== "Todos" ? { background: EJECOLOR[e], borderColor: EJECOLOR[e], color: "#F3EBD9" } : null}>{e} <b>{ejeCount(e)}</b></button>))}
          </div>
          <div className="hooklist">
            {shown.map((h) => {
              const cre = byTemplate[h[0]] || [];
              const isOpen = openHook === h[0];
              return (
              <div className="hookwrap" key={h[0]}>
                <div className={"hookcard" + (probados && !probados.has(h[0]) ? " untested" : "")} style={{ "--ec": EJECOLOR[h[3]] || "#857A66" }}>
                  <span className="hnum">{String(h[0]).padStart(3, "0")}</span>
                  <div className="hmid"><span className="htext">{h[1]}</span><span className="htags"><span className="ftag">{h[2]}</span><span className="ejetag" style={{ color: EJECOLOR[h[3]] }}>{h[3]}</span>{probados && (probados.has(h[0]) ? <button className="probtag click" onClick={() => setOpenHook(isOpen ? null : h[0])}>✓ probado{cre.length ? ` (${cre.length}) ` + (isOpen ? "▾" : "▸") : ""}</button> : <span className="sinprobtag">sin probar</span>)}</span></div>
                  <button className="copybtn" onClick={() => copy(h[1], "h" + h[0])}>{copied === "h" + h[0] ? "✓" : "⧉"}</button>
                </div>
                {isOpen && cre.length > 0 && (
                  <div className="hookexp">
                    <div className="hookexh">Probado con:</div>
                    {cre.map((c, ci) => (
                      <div className="hookexitem" key={ci}>
                        <div className="hookexline"><b>{c.nombre}</b>{c.tf ? <span className="tf">{c.tf}</span> : null} <span className="hookexkpi">{c.roas.toFixed(1)}x</span> <span className="hookexspend">{short(c.spend)} spend</span>{c.activa === false ? <span className="pausedtag">⏸ PAUSADA</span> : null}</div>
                        {c.razon ? <div className="hookexrazon">↳ {c.razon}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>);
            })}
          </div>
          <div className="bibfoot">Mostrando {shown.length} de {fHooks.length}{fHooks.length > 80 ? " — refiná con el buscador o los filtros" : ""}. Los ejemplos completos de cada hook están en biblioteca_hooks.xlsx.</div>
        </>
      ) : (
        <>
          <div className="ejefilt">{cats.map((c) => (<button key={c} className={"ejepill" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{c}</button>))}</div>
          <div className="promptlist">
            {fProm.map((p) => (
              <div className="pcard" key={p.n}>
                <div className="pcardtop"><span className="pcat">{p.cat}</span><button className="copybtn" onClick={() => copy(p.text, p.n)}>{copied === p.n ? "✓ copiado" : "⧉ copiar"}</button></div>
                <div className="ptitle">{p.n} · {p.title}</div>
                <div className="pque">{p.que}</div>
                <details className="pdet"><summary>ver texto completo</summary><pre className="ptext">{p.text}</pre></details>
              </div>))}
          </div>
        </>
      )}
    </section>
  );
}

// ─────────── Vista: GENERAR (Parte 7 · CopyLab con IA) ───────────
const FORMULAS = ["AIDA", "PAS", "BAB", "FAB", "4C", "4U", "El Testimonio", "El Disparador Nostálgico"];
const HOOKSTYLES = ["automático", "Identidad", "Ruptura", "Pérdida", "Evidencia"];
const STYLEDESC = { Identidad: "que el lector se sienta identificado ('ese soy yo')", Ruptura: "rompé el patrón: empezá normal y terminá inesperado", "Pérdida": "apuntá al dolor evitable (plata/tiempo perdido)", Evidencia: "mostrá pruebas y resultados ('mostrame')" };

// Persona compartida por todos los generadores. Trabaja SIEMPRE sobre la receta ganadora.
const GEN_PERSONA = `Sos director creativo y copywriter senior de respuesta directa para ecommerce en Argentina. Escribís en español rioplatense, tratando de "vos", con tono natural, directo y cero acartonado. Dominás Meta Ads, el scroll en mobile y la psicología de compra. Trabajás SIEMPRE sobre lo que ya le funciona a la marca (la receta ganadora que te paso), no inventás de cero.`;

const GEN_TIPOS = {
  hooks: {
    label: "Hooks (ganchos 0-3s)",
    btn: "GENERAR HOOKS",
    max: 1200,
    system: `${GEN_PERSONA}\n\nTu tarea: generar 10 HOOKS — la frase de los primeros 0-3 segundos del video, lo que frena el scroll. Tenés una biblioteca de patrones de gancho probados como referencia: usalos como inspiración ESTRUCTURAL, no los copies literal, adaptalos al producto y al ángulo ganador. Cada hook: una sola frase corta, hablada, concreta, que genere tensión o curiosidad inmediata. Nada genérico ni publicitario. Devolvé EXCLUSIVAMENTE JSON válido, sin markdown ni backticks: {"hooks":["...", "...", ... 10 items]}`,
  },
  guion: {
    label: "Guion de video",
    btn: "GENERAR GUION",
    max: 2000,
    system: `${GEN_PERSONA}\n\nTu tarea: escribir un guion de video UGC de 20-35 segundos para Reels/Meta, basado en la receta ganadora. Estructura: HOOK (0-3s) → desarrollo según el ángulo (problema, beneficio o demostración) → CTA claro al final. Para cada beat indicá el texto hablado (a cámara o voz en off) y entre [corchetes] una breve indicación visual. Ritmo rápido, creíble, conversacional. Devolvé EXCLUSIVAMENTE JSON válido, sin markdown ni backticks: {"guion":"texto completo del guion con saltos de línea \\n"}`,
  },
  copy: {
    label: "Copy del anuncio",
    btn: "GENERAR COPY",
    max: 1500,
    system: `${GEN_PERSONA}\n\nTu tarea: escribir copy de anuncio de Meta para tráfico frío, alineado a la receta ganadora. Respetá los límites de Meta: headline ≤40 caracteres, description ≤40, primary text ≤125. Variá los ángulos de entrada entre las opciones. Devolvé EXCLUSIVAMENTE JSON válido, sin markdown ni backticks: {"headlines":["h1","h2","h3","h4","h5"],"descriptions":["d1","d2","d3","d4","d5"],"primary_texts":["p1","p2","p3"]}`,
  },
  angulos: {
    label: "Ángulos nuevos",
    btn: "GENERAR ÁNGULOS",
    max: 1500,
    system: `${GEN_PERSONA}\n\nTu tarea: proponer 6 ÁNGULOS DE VENTA NUEVOS para testear, distintos a los que la marca ya usa pero coherentes con el producto y con lo que funciona. Para cada uno: un nombre corto y una explicación de 1-2 oraciones de por qué podría funcionar y cómo se ejecutaría en un creativo. Devolvé EXCLUSIVAMENTE JSON válido, sin markdown ni backticks: {"angulos":[{"nombre":"...","desc":"..."}, ... 6 items]}`,
  },
};

function Generar({ rows = [], accountName = "" }) {
  // Receta ganadora = mayor ROAS entre creativos CONFIABLES (con spend real y al menos 5 ventas,
  // para no coronar un ROAS ruidoso de poca data). Si ninguno llega a 5 ventas, cae a los que tienen spend.
  const best = useMemo(() => topWinners(rows, 1)[0] || null, [rows]);
  const recipe = {
    angulo: best?.sheet?.angulo || best?.ang || "—",
    categoria: best?.ang || "—",
    hook: best?.sheet?.tipo_gancho || best?.hook || "—",
    audiencia: best?.aud || "—",
    formato: best?.fmt || "—",
  };
  const [tipo, setTipo] = useState("hooks");
  const [modo, setModo] = useState("iterar"); // iterar (explotar) | explorar (salir de la caja)
  const [producto, setProducto] = useState(accountName);
  const [emoji, setEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(null);
  const copy = (t, id) => { try { navigator.clipboard.writeText(t); } catch (e) {} setCopied(id); setTimeout(() => setCopied(null), 1200); };

  const generar = async () => {
    setLoading(true); setErr(""); setOut(null);
    const cfg = GEN_TIPOS[tipo];
    const hookLib = tipo === "hooks" ? "\n\nBiblioteca de patrones de gancho (referencia estructural):\n" + HOOKS.slice(0, 30).map((h) => "- " + h[1]).join("\n") : "";
    const modoTxt = modo === "explorar"
      ? "MODO EXPLORAR (salir de la caja): NO repitas la receta ganadora — usala solo como contraste de lo YA probado. Proponé enfoques, ganchos y ángulos NUEVOS y bien distintos para abrir vetas no exploradas, manteniendo coherencia con el producto y la marca."
      : "MODO ITERAR (escalar lo que funciona): generá variaciones CERCANAS a la receta ganadora — mismo ángulo/gancho/formato que ya rinde, con cambios incrementales para exprimirlo más.";
    const prompt = `Marca / producto: ${producto || "(no especificado)"}

${modoTxt}

Receta ganadora actual (lo que mejor rinde):
- Ángulo de venta: ${recipe.angulo}
- Categoría: ${recipe.categoria}
- Tipo de gancho que funciona: ${recipe.hook}
- Audiencia top: ${recipe.audiencia}
- Formato: ${recipe.formato}

${emoji ? "Podés usar emojis con moderación." : "Sin emojis."}${hookLib}`;
    try {
      const res = await fetch("/api/copy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, system: cfg.system, max_tokens: cfg.max, model: "claude-sonnet-4-6" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || data.error);
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      setOut({ tipo, data: JSON.parse(clean) });
    } catch (e) {
      setErr("No se pudo generar: " + e.message);
    } finally { setLoading(false); }
  };

  const block = (title, items, limit, pre) => items && (
    <div className="genblock" key={pre}>
      <div className="genblockh">{title}{limit ? <span className="gblim">máx {limit}</span> : null}</div>
      {items.map((t, i) => { const over = limit && t.length > limit; return (
        <div className="outitem" key={pre + i}>
          <span className="outtext">{t}</span>
          {limit ? <span className={"outmeta" + (over ? " over" : "")}>{t.length}/{limit}</span> : null}
          <button className="copybtn" onClick={() => copy(t, pre + i)}>{copied === pre + i ? "✓" : "⧉"}</button>
        </div>); })}
    </div>
  );

  const render = () => {
    if (!out) return null;
    const d = out.data;
    if (out.tipo === "copy") return <>{block("HEADLINES", d.headlines, 40, "h")}{block("DESCRIPTIONS", d.descriptions, 40, "d")}{block("PRIMARY TEXTS", d.primary_texts, 125, "p")}</>;
    if (out.tipo === "hooks") return block("HOOKS", d.hooks, 0, "k");
    if (out.tipo === "angulos") return (
      <div className="genblock">
        <div className="genblockh">ÁNGULOS NUEVOS</div>
        {(d.angulos || []).map((a, i) => (
          <div className="outitem" key={"a" + i}>
            <span className="outtext"><b>{a.nombre}</b> — {a.desc}</span>
            <button className="copybtn" onClick={() => copy(a.nombre + " — " + a.desc, "a" + i)}>{copied === "a" + i ? "✓" : "⧉"}</button>
          </div>
        ))}
      </div>
    );
    if (out.tipo === "guion") return (
      <div className="genblock">
        <div className="genblockh">GUION <button className="copybtn" onClick={() => copy(d.guion || "", "g")}>{copied === "g" ? "✓" : "⧉"}</button></div>
        <pre className="genguion">{d.guion}</pre>
      </div>
    );
    return null;
  };

  return (
    <section className="gen">
      <div className="genintro">Generá con IA (Claude Sonnet 4.6) usando tu <b>receta ganadora</b>{best ? "" : " — elegí un cliente para cargarla"}. Elegí qué querés generar y dale.</div>
      <div className="reciperow">
        <span className="recipechip">ÁNGULO · {recipe.angulo}</span>
        <span className="recipechip">CATEGORÍA · {recipe.categoria}</span>
        <span className="recipechip">HOOK · {recipe.hook}</span>
        <span className="recipechip">AUDIENCIA · {recipe.audiencia}</span>
        <span className="recipechip">FORMATO · {recipe.formato}</span>
      </div>
      <div className="genmodo">
        <span className="genmodolab">MODO</span>
        <button className={"modopill" + (modo === "iterar" ? " on" : "")} onClick={() => { setModo("iterar"); setOut(null); }}>↻ Iterar ganadores</button>
        <button className={"modopill" + (modo === "explorar" ? " on" : "")} onClick={() => { setModo("explorar"); setOut(null); }}>↗ Explorar nuevo</button>
        <span className="genmodohint">{modo === "explorar" ? "salir de la caja — enfoques nuevos sin probar" : "escalar lo que ya funciona — variaciones cercanas"}</span>
      </div>
      <div className="genform">
        <label className="gfield"><span className="flab">Qué generar</span><select className="gensel" value={tipo} onChange={(e) => { setTipo(e.target.value); setOut(null); }}>{Object.entries(GEN_TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <label className="gfield"><span className="flab">Producto / marca</span><input className="gentext" value={producto} onChange={(e) => setProducto(e.target.value)} placeholder="ej: botas texanas Juanita" /></label>
        <label className="gfield"><span className="flab">Emojis</span><button className={"toggle" + (emoji ? " on" : "")} onClick={() => setEmoji(!emoji)}><span className="knob" /></button></label>
      </div>
      <button className="genbtn" onClick={generar} disabled={loading}>{loading ? "● GENERANDO..." : "▶ " + GEN_TIPOS[tipo].btn}</button>
      {err && <div className="generr">{err}</div>}
      {out && <div className="genout">{render()}</div>}
    </section>
  );
}

function Field({ label, value, onChange, prefix, suffix, step, locked }) {
  const [txt, setTxt] = useState(value == null ? "" : String(value));
  if (locked) return (<label className="field"><span className="flab">{label}</span><span className="fstatic">{value == null ? "—" : (prefix || "") + value + (suffix || "")}</span></label>);
  return (<label className="field"><span className="flab">{label}</span>
    <span className="finput">{prefix && <i>{prefix}</i>}<input type="text" inputMode="decimal" placeholder="—" value={txt} onChange={(e) => { const raw = e.target.value; setTxt(raw); if (raw.trim() === "") { onChange(null); return; } const n = parseFloat(raw.replace(",", ".")); if (!isNaN(n)) onChange(n); }} />{suffix && <i>{suffix}</i>}</span>
  </label>);
}
function Th({ label, k, sort, on, align = "right" }) {
  const active = k && sort.key === k;
  return (<th onClick={k ? () => on(k) : undefined} className={(k ? "click " : "") + (align === "left" ? "tl" : "tr")}>{label}{active ? <span className="arr">{sort.dir === "asc" ? " ▲" : " ▼"}</span> : null}</th>);
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
.root{--paper:#E9DEC8;--paper2:#F3EBD9;--ink:#1E1812;--soft:#857A66;--line:#CDBE9E;--accent:#C5362B;
  --c1:#F4C24A;--c2:#EE8A3C;--c3:#E0552E;--c4:#CF3A4B;--c5:#B83B72;--c6:#6E3E94;
  position:relative;background:var(--paper);color:var(--ink);min-height:100%;padding:24px 28px 44px;font-family:'Archivo',system-ui,sans-serif;overflow:hidden;}
.root::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:9998;background:repeating-linear-gradient(0deg,rgba(30,24,18,.045) 0px,rgba(30,24,18,.045) 1px,transparent 1px,transparent 3px);}
.root::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:.10;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
.mono{font-family:'Space Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;}.soft{color:var(--soft);}

.top{background:var(--ink);border:2px solid var(--ink);border-radius:12px;overflow:hidden;box-shadow:5px 5px 0 #1e181233;margin-bottom:18px;}
.topinner{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;color:var(--paper);}
.brand{display:flex;gap:15px;align-items:center;flex-wrap:wrap;}
.mark{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border:2px solid var(--paper);color:var(--paper);border-radius:8px;font-size:18px;}
.bname{font-family:'Anton',Impact,sans-serif;font-size:34px;letter-spacing:3px;line-height:.9;background:linear-gradient(90deg,var(--c1),var(--c2),var(--c3),var(--c4),var(--c5),var(--c6));-webkit-background-clip:text;background-clip:text;color:transparent;}
.bsub{color:#D8CDB6;font-size:11px;letter-spacing:1.5px;margin-top:5px;}
.rec{color:#FF5A4D;font-weight:700;margin-right:8px;animation:blink 1.4s steps(1) infinite;}@keyframes blink{50%{opacity:.25}}
.client{text-align:right;background:var(--paper2);border-radius:8px;padding:8px 14px;color:var(--ink);}
.clabel{font-size:9px;letter-spacing:2px;color:var(--soft);font-family:'Space Mono',monospace;}
.cname{font-family:'Anton',Impact,sans-serif;font-size:18px;letter-spacing:1.5px;line-height:1;margin-top:2px;}
.cmeta{font-size:10px;color:var(--soft);font-style:italic;margin-top:1px;}
.stripe{display:flex;height:11px;}.stripe i{flex:1;}
.stripe i:nth-child(1){background:var(--c1)}.stripe i:nth-child(2){background:var(--c2)}.stripe i:nth-child(3){background:var(--c3)}.stripe i:nth-child(4){background:var(--c4)}.stripe i:nth-child(5){background:var(--c5)}.stripe i:nth-child(6){background:var(--c6)}
.phasebar{display:flex;justify-content:space-between;background:var(--ink);color:#C7BBA2;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;padding:5px 20px;}

.rolebar{display:flex;align-items:center;gap:14px;margin:16px 0 4px;flex-wrap:wrap;}
.modobox{display:flex;align-items:center;gap:7px;}
.rolebarright{display:flex;align-items:center;gap:14px;margin-left:auto;flex-wrap:wrap;}
.modotgl{font-family:'Space Mono',monospace;font-weight:700;font-size:11px;letter-spacing:1px;color:var(--ink);background:var(--paper2);border:2px solid var(--ink);padding:5px 12px;border-radius:6px;cursor:pointer;}
.modotgl.on{background:var(--c6);color:var(--paper);border-color:var(--c6);}
.curhint{font-family:'Space Mono',monospace;font-size:10px;color:var(--soft);font-style:italic;}
.rlabel{font-family:'Anton',Impact,sans-serif;font-size:13px;letter-spacing:2px;color:var(--ink);}
.rolebtns{display:flex;gap:6px;}
.rolebtn{font-family:'Space Mono',monospace;font-weight:700;font-size:12px;letter-spacing:1px;color:var(--ink);background:var(--paper2);border:2px solid var(--ink);padding:6px 14px;border-radius:6px;cursor:pointer;box-shadow:2px 2px 0 var(--ink);}
.rolebtn.on{background:var(--c3);color:var(--paper);}
.rdesc{font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);font-style:italic;}

.nav{display:flex;gap:8px;margin:12px 0 14px;flex-wrap:wrap;}
.tab{font-family:'Anton',Impact,sans-serif;font-size:15px;letter-spacing:1.5px;color:var(--ink);background:var(--paper2);border:2px solid var(--ink);padding:9px 16px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:9px;box-shadow:3px 3px 0 var(--ink);transition:transform .08s,box-shadow .08s;}
.tab:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--ink);}
.tab.active{background:var(--ink);color:var(--paper);}.tab.active .tabn{background:var(--c1);color:var(--ink);}
.tabn{background:var(--ink);color:var(--paper);font-size:11px;min-width:19px;height:19px;border-radius:4px;display:grid;place-items:center;padding:0 5px;font-family:'Space Mono',monospace;}

.umbral{display:flex;align-items:center;gap:22px;flex-wrap:wrap;margin-bottom:22px;padding:14px 18px;background:var(--paper2);border:2px solid var(--ink);border-radius:10px;box-shadow:4px 4px 0 var(--ink);}
.ulabel{font-family:'Anton',Impact,sans-serif;font-size:13px;letter-spacing:1.5px;color:var(--ink);line-height:1.05;border-right:2px solid var(--line);padding-right:18px;}
.field{display:flex;flex-direction:column;gap:5px;}
.flab{font-size:10px;letter-spacing:1px;color:var(--soft);text-transform:uppercase;font-family:'Space Mono',monospace;}
.finput{display:flex;align-items:center;gap:3px;border:2px solid var(--ink);border-radius:7px;padding:5px 9px;background:var(--paper);}
.finput i{font-style:normal;color:var(--soft);font-size:13px;}
.finput input{width:78px;border:none;background:none;outline:none;font-family:'Anton',Impact,sans-serif;font-size:19px;letter-spacing:1px;color:var(--ink);}
.fstatic{display:inline-block;border:2px dashed var(--line);border-radius:7px;padding:5px 12px;background:var(--paper);font-family:'Anton',Impact,sans-serif;font-size:19px;letter-spacing:1px;color:var(--soft);}
.uhint{margin-left:auto;color:var(--soft);font-size:11px;font-style:italic;font-family:'Space Mono',monospace;}

/* CLIENTE */
.repbar{display:flex;justify-content:space-between;align-items:center;background:var(--paper2);border:2px solid var(--ink);border-radius:10px;padding:14px 20px;margin:12px 0 16px;box-shadow:4px 4px 0 var(--ink);}
.reptitle{font-family:'Anton',Impact,sans-serif;font-size:20px;letter-spacing:1.5px;}
.repsub{font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);margin-top:3px;}
.reptools{display:flex;align-items:center;gap:9px;}
.toggle{width:46px;height:24px;border-radius:13px;border:2px solid var(--ink);background:var(--paper);position:relative;cursor:pointer;padding:0;}
.toggle.on{background:#2E8B6B;}
.knob{position:absolute;top:1px;left:1px;width:18px;height:18px;border-radius:50%;background:var(--ink);transition:left .15s;}
.toggle.on .knob{left:23px;background:var(--paper);}
.tlab{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1px;color:var(--soft);}
.repnote{font-family:'Space Mono',monospace;font-size:10px;color:#C7BBA2;}
.kpis.repk{grid-template-columns:repeat(3,1fr);}
.winstar{color:var(--c1);font-size:18px;}
.troas.grn{color:#2E8B6B;}
.repcards{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.repcard{background:var(--paper2);border:2px solid var(--ink);border-radius:10px;padding:16px 18px;box-shadow:4px 4px 0 var(--ink);}
.repcardh{font-family:'Anton',Impact,sans-serif;font-size:14px;letter-spacing:1.5px;margin-bottom:8px;}
.repcard p{font-size:13.5px;line-height:1.6;color:#3A3128;margin:0;}
.plan{list-style:none;padding:0;margin:0;}
.plan li{font-size:13.5px;line-height:1.5;padding-left:20px;position:relative;color:#3A3128;}
.plan li::before{content:"▸";position:absolute;left:0;color:var(--c3);font-weight:700;}

/* TOP PERFORMERS */
.combo{background:var(--ink);border:2px solid var(--ink);border-radius:12px;padding:18px 22px;margin-bottom:18px;box-shadow:5px 5px 0 #1e181233;color:var(--paper);position:relative;overflow:hidden;}
.combo::before{content:"";position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,var(--c1),var(--c2),var(--c3),var(--c4),var(--c5),var(--c6));}
.combohead{display:flex;justify-content:space-between;align-items:baseline;margin-top:6px;margin-bottom:12px;}
.combotag{font-family:'Anton',Impact,sans-serif;font-size:14px;letter-spacing:2px;color:var(--c1);}
.comboname{font-family:'Space Mono',monospace;font-size:12px;color:#C7BBA2;}
.comborow{display:flex;align-items:center;gap:24px;}
.comboroas{font-family:'Anton',Impact,sans-serif;font-size:60px;line-height:.85;color:var(--c1);}.comboroas small{font-size:26px;color:var(--paper);}
.comborec{display:grid;grid-template-columns:repeat(2,auto);gap:9px 28px;}
.recchip{display:flex;flex-direction:column;gap:2px;}
.reck{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1.5px;color:#9C9079;}
.recv{font-family:'Anton',Impact,sans-serif;font-size:18px;letter-spacing:1px;color:var(--paper);}
.combonote{margin-top:14px;font-size:12px;color:#C7BBA2;font-family:'Space Mono',monospace;border-top:1px solid #3A3128;padding-top:10px;}.combonote b{color:var(--c1);}
.combomore{margin-top:14px;border-top:1px solid #3A3128;padding-top:12px;display:flex;flex-direction:column;gap:8px;}
.comboalt{display:flex;align-items:baseline;gap:10px;font-family:'Space Mono',monospace;font-size:12px;color:#E9DEC8;flex-wrap:wrap;}
.caltrank{color:#7A7259;font-size:11px;}
.caltroas{color:#F4C24A;font-weight:700;min-width:48px;}
.caltname{color:#F2EBD9;font-weight:700;}
.caltmeta{color:#9A937F;font-size:11px;}
.combostats{margin-top:10px;font-family:'Space Mono',monospace;font-size:12px;color:#F4C24A;}
.rankwrap{border-bottom:1px solid var(--line);}
.rankrow.clickable{cursor:pointer;}
.rankrow.clickable:hover{background:rgba(0,0,0,.03);}
.rcaret{color:var(--soft);font-size:11px;width:14px;display:inline-block;}
.rankrow.open{background:rgba(0,0,0,.04);}
.rexp{padding:8px 14px 14px 30px;background:rgba(0,0,0,.025);font-family:'Space Mono',monospace;}
.rexad{padding:8px 0;border-top:1px dashed var(--line);}
.rexad:first-child{border-top:none;}
.rexhead{font-size:12.5px;color:var(--ink);display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.rexkpi{color:var(--soft);font-size:11px;font-weight:400;}
.rexline{font-size:11px;color:#6B6552;margin-top:4px;padding-left:8px;display:flex;flex-wrap:wrap;gap:5px;align-items:baseline;}
.rexcamp{color:var(--ink);}
.rexset{color:#8A8268;}
.rexaud{font-size:9px;color:var(--soft);border:1px solid var(--line);border-radius:3px;padding:1px 5px;}
.rexmeta{color:var(--soft);margin-left:auto;}
.dimpills{display:flex;gap:7px;margin-bottom:12px;}
.dimpill{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:1px;color:var(--ink);background:var(--paper2);border:2px solid var(--ink);padding:6px 13px;border-radius:6px;cursor:pointer;}
.dimpill.on{background:var(--ink);color:var(--paper);}
.metricpills{display:flex;gap:6px;align-items:center;margin-bottom:14px;}
.mplabel{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:var(--soft);text-transform:uppercase;margin-right:4px;}
.metricpill{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.5px;color:var(--soft);background:transparent;border:1px solid var(--line);padding:3px 10px;border-radius:5px;cursor:pointer;}
.metricpill.on{background:#F4C24A;color:#1A1A17;border-color:#1A1A17;font-weight:700;}
.dedup{background:#F3E3C0;border:2px solid var(--ink);border-radius:8px;padding:9px 13px;font-size:11.5px;color:#5A4A2A;font-family:'Space Mono',monospace;margin-bottom:12px;}.dedup b{color:var(--ink);}
.ranklist{background:var(--paper2);border:2px solid var(--ink);border-radius:10px;padding:6px 16px;box-shadow:4px 4px 0 var(--ink);}
.rankrow{display:flex;align-items:center;gap:13px;padding:9px 0;border-bottom:1px solid var(--line);}.rankrow:last-child{border-bottom:none;}
.rrank{font-family:'Space Mono',monospace;font-size:12px;color:var(--soft);width:22px;}
.rname{font-weight:700;font-size:13.5px;width:118px;flex:none;}
.rbar{flex:1;height:14px;background:#E0D4BC;border-radius:4px;overflow:hidden;}
.rfill{display:block;height:100%;border-radius:4px;transition:width .3s;}
.rval{font-family:'Anton',Impact,sans-serif;font-size:18px;width:60px;text-align:right;}
.rmeta{font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);width:190px;text-align:right;}

/* DASHBOARD */
.goal{background:var(--ink);border:2px solid var(--ink);border-radius:12px;padding:18px 22px;margin-bottom:16px;box-shadow:5px 5px 0 #1e181233;color:var(--paper);}
.goal.light{background:var(--paper2);color:var(--ink);}
.goalhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}
.goaltitle{font-family:'Anton',Impact,sans-serif;font-size:17px;letter-spacing:2px;color:var(--paper);}
.goalsrc{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:#9A937F;margin-left:12px;border:1px solid #3A3128;border-radius:4px;padding:2px 7px;vertical-align:middle;}
.goal.light .goaltitle{color:var(--ink);}
.goaledit{display:flex;align-items:center;gap:8px;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:#C7BBA2;}
.goaledit .finput{border-color:var(--paper);background:#2A231C;}.goaledit .finput i{color:#C7BBA2;}.goaledit .finput input{color:var(--paper);width:96px;font-size:16px;}
.goalbar{height:18px;background:#2A231C;border-radius:9px;overflow:hidden;border:2px solid var(--paper);}
.goal.light .goalbar{background:#E0D4BC;border-color:var(--ink);}
.goalbar span{display:block;height:100%;background:linear-gradient(90deg,var(--c1),var(--c2),var(--c3),var(--c4),var(--c5),var(--c6));transition:width .35s;}
.goalnums{display:flex;align-items:center;gap:20px;margin-top:14px;}
.goalpct{font-family:'Anton',Impact,sans-serif;font-size:52px;line-height:.85;color:var(--c1);}.goalpct small{font-size:24px;color:var(--paper);}
.goal.light .goalpct{color:var(--c3);}.goal.light .goalpct small{color:var(--ink);}
.goalstack{font-size:14px;line-height:1.6;}.goalstack b{font-size:16px;color:var(--paper);}.goal.light .goalstack b{color:var(--ink);}

.kpis{display:grid;grid-template-columns:1fr 1.2fr 1.2fr 1.6fr;gap:14px;margin-bottom:18px;}
.kpis.dashk{grid-template-columns:repeat(5,1fr);}
.kpi{background:var(--paper2);border:2px solid var(--ink);border-radius:10px;padding:14px 16px;box-shadow:4px 4px 0 var(--ink);}
.kpi.flag{background:#F3E3C0;}.kpi.good{background:#DEEAE0;}
.klab{font-size:10px;letter-spacing:1px;color:var(--soft);font-family:'Space Mono',monospace;display:flex;gap:7px;align-items:center;}
.warn{color:#B6822A;font-size:10px;font-weight:700;}
.kval{font-family:'Anton',Impact,sans-serif;font-size:32px;letter-spacing:1px;margin-top:6px;line-height:.95;}
.kval.dim{color:#B6822A;}.kval.grn{color:#2E8B6B;}
.ksub{font-size:10.5px;color:var(--soft);margin-top:6px;font-family:'Space Mono',monospace;}
.kpi.chips{display:flex;flex-wrap:wrap;gap:7px;align-content:center;}
.chip{font-size:12px;padding:5px 11px;border-radius:5px;font-weight:700;border:2px solid currentColor;}.chip b{font-family:'Anton',Impact,sans-serif;margin-right:3px;}
.topgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start;}
.topcard{background:var(--paper2);border:2px solid var(--ink);border-left:7px solid var(--bar);border-radius:10px;padding:13px 15px;box-shadow:3px 3px 0 var(--ink);transition:transform .08s,box-shadow .08s;}
.topcard:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--ink);}
.tcardtop{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
.trank{font-family:'Anton',Impact,sans-serif;font-size:18px;color:var(--soft);letter-spacing:1px;}
.tname{font-weight:700;font-size:13.5px;line-height:1.2;}
.troas{font-family:'Anton',Impact,sans-serif;font-size:38px;line-height:1;margin-top:6px;color:var(--ink);}.troas small{font-size:18px;color:var(--soft);}
.tmeta{font-size:11px;color:var(--soft);margin-top:2px;}
.topcard.clickable{cursor:pointer;}
.topcard.open{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--ink);background:rgba(0,0,0,.04);}
.tcardmore{font-size:10px;color:var(--soft);margin-top:9px;font-family:'Space Mono',monospace;letter-spacing:.5px;display:flex;align-items:center;gap:5px;}
.tcardcaret{font-size:10px;}
.tcardexp{margin-top:8px;padding-top:8px;border-top:1px dashed var(--line);font-family:'Space Mono',monospace;cursor:default;}

/* HOY */
.dayhead{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:18px;}
.daytitle{font-family:'Anton',Impact,sans-serif;font-size:32px;letter-spacing:2px;}
.daysub{color:var(--soft);font-size:12px;margin-top:3px;font-family:'Space Mono',monospace;}
.progress{text-align:right;}
.pbar{width:190px;height:11px;background:var(--ink);border-radius:6px;overflow:hidden;border:2px solid var(--ink);}
.pbar span{display:block;height:100%;background:linear-gradient(90deg,var(--c1),var(--c2),var(--c3),var(--c4),var(--c5),var(--c6));transition:width .25s;}
.pnum{font-size:11px;color:var(--soft);margin-top:5px;font-family:'Space Mono',monospace;letter-spacing:1px;}
.sect{margin-bottom:20px;}
.secthead{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
.sverb{display:inline-flex;align-items:center;gap:7px;font-family:'Anton',Impact,sans-serif;font-size:13px;letter-spacing:1.5px;padding:5px 12px;border-radius:6px;border:2px solid currentColor;}
.stitle{font-family:'Anton',Impact,sans-serif;font-size:17px;letter-spacing:1px;}
.scount{margin-left:auto;color:var(--soft);font-size:13px;font-family:'Space Mono',monospace;}
.items{display:flex;flex-direction:column;gap:9px;}
.item{display:flex;align-items:center;gap:14px;background:var(--paper2);border:2px solid var(--ink);border-left:7px solid var(--bar);border-radius:9px;padding:12px 15px;box-shadow:3px 3px 0 var(--ink);transition:opacity .15s,transform .08s,box-shadow .08s;}
.item:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 var(--ink);}
.item.done{opacity:.4;box-shadow:none;transform:none;}.item.done .iname{text-decoration:line-through;}
.check{width:24px;height:24px;flex:none;border-radius:5px;border:2px solid var(--c);background:var(--paper);color:var(--paper);cursor:pointer;font-size:13px;font-weight:800;display:grid;place-items:center;}.check.on{background:var(--c);}
.ibody{flex:1;min-width:0;}.iname{font-weight:700;font-size:14px;}
.ireason{color:var(--soft);font-size:12px;margin-top:2px;font-family:'Space Mono',monospace;}
.act{flex:none;font-size:12px;font-weight:700;padding:7px 13px;border-radius:6px;border:2px solid currentColor;}
.sempty{color:var(--soft);font-size:13px;font-style:italic;padding:6px 4px;}
.noaction{margin-top:4px;background:var(--paper);border:2px dashed var(--ink);border-radius:9px;padding:12px 15px;font-size:12.5px;color:var(--soft);font-family:'Space Mono',monospace;}.noaction b{color:var(--ink);}

/* PANEL */
.tablewrap{background:var(--paper2);border:2px solid var(--ink);border-radius:10px;overflow:hidden;box-shadow:4px 4px 0 var(--ink);}
table{width:100%;border-collapse:collapse;font-size:13px;}
thead th{background:var(--ink);color:var(--paper);font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;text-transform:uppercase;padding:11px 12px;white-space:nowrap;}
th.tl{text-align:left;}th.tr{text-align:right;}th.click{cursor:pointer;user-select:none;}th.click:hover{color:var(--c1);}.arr{color:var(--c1);}
tbody tr{border-bottom:1px solid var(--line);box-shadow:inset 5px 0 0 var(--bar);transition:background .1s;}
tbody tr:hover{background:#EFE6D2;}tbody tr:last-child{border-bottom:none;}
td{padding:11px 12px;vertical-align:middle;}.num{text-align:right;}.name{font-weight:700;}
.fmt{font-size:9px;color:var(--soft);border:1px solid var(--line);border-radius:3px;padding:1px 5px;margin-left:6px;font-family:'Space Mono',monospace;letter-spacing:1px;}
.tf{font-size:9px;color:var(--soft);background:rgba(0,0,0,.04);border:1px solid var(--line);border-radius:3px;padding:1px 5px;margin-left:6px;font-family:'Space Mono',monospace;letter-spacing:.5px;white-space:nowrap;}
.pausedtag{font-size:9px;color:#8A1C12;background:#FBE8E6;border:1px solid #E0A59E;border-radius:3px;padding:1px 5px;margin-left:6px;font-family:'Space Mono',monospace;letter-spacing:.5px;white-space:nowrap;font-weight:700;}
.qualtag{font-size:9px;border:1px solid currentColor;border-radius:3px;padding:1px 5px;margin-left:6px;font-family:'Space Mono',monospace;letter-spacing:.5px;white-space:nowrap;font-weight:700;cursor:help;}
.metaerr{background:#FBE8E6;color:#8A1C12;border-top:2px solid #C0392B;padding:9px 22px;font-size:12.5px;line-height:1.45;font-family:'Space Mono',monospace;}
.metaerr-sample{color:#B05A50;}
.userbox{display:flex;align-items:center;gap:8px;margin-left:10px;flex-shrink:0;white-space:nowrap;}
.uname{font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);letter-spacing:.5px;white-space:nowrap;}
.logout{font-family:'Space Mono',monospace;font-size:11px;color:var(--paper);background:transparent;border:1px solid rgba(242,235,217,.4);border-radius:5px;padding:3px 9px;cursor:pointer;}
.logout:hover{background:rgba(242,235,217,.12);border-color:var(--paper);}
.tnband{background:#1A1A17;color:#F2EBD9;padding:16px 22px 16px;border:2px solid var(--ink);border-top:4px solid #C0392B;border-radius:12px;box-shadow:5px 5px 0 #1e181233;margin-bottom:18px;}
/* cargando: barras a 45° que se deslizan de fondo (barber pole), para que se note que aún no llegó la data */
.tnband.tnloading{background-image:linear-gradient(45deg,rgba(242,235,217,0.05) 25%,transparent 25%,transparent 50%,rgba(242,235,217,0.05) 50%,rgba(242,235,217,0.05) 75%,transparent 75%,transparent);background-size:42px 42px;animation:tnstripes 0.9s linear infinite;}
@keyframes tnstripes{from{background-position:0 0;}to{background-position:42px 0;}}
.tnband-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px;flex-wrap:wrap;}
.tntag{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:1.5px;color:#E9DEC8;}
.tnrange{font-family:'Space Mono',monospace;font-size:11px;color:#9A937F;margin-left:auto;}
.tncountlab{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;color:#9A937F;}
.modotgl.tng{background:transparent;color:#9A937F;border-color:#5A5447;font-size:10px;padding:4px 10px;}
.modotgl.tng.on{background:#E9DEC8;color:#1E1812;border-color:#E9DEC8;}
.tnstats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;}
@media(max-width:1000px){.tnstats{grid-template-columns:repeat(2,1fr);}}
.tnstat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:13px 15px;}
.tnstat.tnmer{background:rgba(46,139,107,.18);border-color:rgba(46,139,107,.5);}
.tnlab{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1.2px;color:#9A937F;margin-bottom:5px;}
.tnval{font-weight:700;font-size:26px;line-height:1;letter-spacing:-.5px;}
.tnsub{font-family:'Space Mono',monospace;font-size:10.5px;color:#9A937F;margin-top:6px;}
.tnnote{font-family:'Space Mono',monospace;font-size:10.5px;color:#7A7259;margin-top:11px;line-height:1.4;}
/* margen bruto %: input chico embebido en el cell de margen de contribución */
.tnmargin{width:42px;background:transparent;border:1px solid #5A5447;color:#F2EBD9;border-radius:4px;padding:1px 4px;font-family:'Space Mono',monospace;font-size:10.5px;text-align:right;-moz-appearance:textfield;}
.tnmargin::-webkit-outer-spin-button,.tnmargin::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.tnmargin:focus{outline:none;border-color:#E9DEC8;}
/* desplegable del gráfico diario */
.tnchart-toggle{display:block;margin-top:10px;background:transparent;border:1px solid #5A5447;color:#9A937F;border-radius:6px;padding:6px 12px;font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:1px;cursor:pointer;}
.tnchart-toggle:hover{color:#E9DEC8;border-color:#9A937F;}
.tnchart{margin-top:12px;}
.tnchart-wrap{position:relative;}
.tnchart svg{width:100%;height:auto;display:block;cursor:crosshair;}
.tnlegend{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;}
.tnchip{display:inline-flex;align-items:center;gap:6px;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:#9A937F;}
.tnchip i{width:10px;height:10px;border-radius:3px;display:inline-block;}
.tnax{font-family:'Space Mono',monospace;font-size:9.5px;fill:#9A937F;}
.tnaxt{letter-spacing:1.5px;fill:#7A7259;}
.tntip{position:absolute;top:8px;pointer-events:none;background:#26241F;border:1px solid #5A5447;border-radius:7px;padding:8px 10px;font-family:'Space Mono',monospace;font-size:10.5px;color:#F2EBD9;white-space:nowrap;z-index:5;box-shadow:3px 3px 0 #0006;}
.tntipf{color:#9A937F;margin-bottom:5px;}
.tntipr{display:flex;align-items:center;gap:6px;margin-top:2px;color:#C9C0AA;}
.tntipr b{color:#F2EBD9;font-weight:700;}
.tntipr i{width:8px;height:8px;border-radius:2px;display:inline-block;}
/* tabla accesible plegada bajo el gráfico */
.tntable{margin-top:8px;}
.tntable summary{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:#7A7259;cursor:pointer;}
.tntable-scroll{overflow-x:auto;margin-top:6px;}
.tntable table{border-collapse:collapse;font-family:'Space Mono',monospace;font-size:10.5px;color:#C9C0AA;}
.tntable th,.tntable td{padding:3px 12px 3px 0;text-align:right;border-bottom:1px solid rgba(242,235,217,0.08);}
.tntable th:first-child,.tntable td:first-child{text-align:left;}
.tntable th{color:#7A7259;letter-spacing:1px;font-weight:400;}
@media(max-width:760px){
  .root{padding:14px 12px 32px;}
  .topinner{flex-direction:column;align-items:stretch;gap:14px;}
  .brand{align-items:center;}
  .bname{font-size:26px;letter-spacing:2px;}
  .client{text-align:left;}
  .cselect{max-width:100%;}
  .daterange{flex-wrap:wrap;}
  .tnstats{grid-template-columns:1fr;}
  .genform{grid-template-columns:1fr;align-items:stretch;}
  .gfield{align-items:stretch;}
  .phasebar{font-size:9px;letter-spacing:1px;}
  /* filas que no entran → deslizables en vez de cortarse */
  .kpis,.kpis.dashk,.kpis.repk,.topgrid{display:flex;grid-template-columns:none;overflow-x:auto;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;padding-bottom:6px;}
  .kpis>*{flex:0 0 62%;scroll-snap-align:start;}
  .topgrid>*{flex:0 0 80%;scroll-snap-align:start;}
  .ranklist{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .tnstats{display:flex;overflow-x:auto;grid-template-columns:none;}
  .tnstats>*{flex:0 0 78%;}
}
.ang{color:var(--ink);}.sec{color:var(--soft);}
.split{font-family:'Space Mono',monospace;font-size:10px;color:var(--soft);background:var(--paper);border:1px solid var(--line);border-radius:3px;padding:1px 5px;margin-left:7px;}
.aud{color:var(--soft);font-size:12px;}.strong{font-weight:700;}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 11px;border-radius:5px;border:2px solid currentColor;}
.sq{width:8px;height:8px;border-radius:2px;display:inline-block;}
.legend{display:flex;flex-wrap:wrap;gap:18px;margin-top:16px;padding:0 4px;}
.leg{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--soft);font-family:'Space Mono',monospace;}.leg b{margin-right:2px;}
/* GENERAR */
.genintro{font-family:'Space Mono',monospace;font-size:12px;color:var(--soft);margin-bottom:14px;}
.reciperow{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;}
.genmodo{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
.genmodolab{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1.5px;color:var(--soft);}
.modopill{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:6px;padding:5px 12px;cursor:pointer;}
.modopill.on{background:var(--ink);color:var(--paper);}
.genmodohint{font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);font-style:italic;}
.recipechip{font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:.5px;color:var(--ink);background:var(--paper2);border:1px solid var(--ink);border-radius:5px;padding:4px 9px;}
.genguion{font-family:'Space Mono',monospace;font-size:12.5px;line-height:1.6;color:var(--ink);white-space:pre-wrap;margin:0;padding:4px 2px;}
.genform{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;gap:14px 18px;background:var(--paper2);border:2px solid var(--ink);border-radius:10px;padding:16px 18px;box-shadow:4px 4px 0 var(--ink);margin-bottom:16px;}
.gfield{display:flex;flex-direction:column;gap:6px;align-items:flex-start;min-width:0;}
.gfield input,.gfield select{max-width:100%;}
.gentext,.gensel{font-family:'Archivo',sans-serif;font-size:14px;border:2px solid var(--ink);border-radius:7px;padding:7px 10px;background:var(--paper);color:var(--ink);outline:none;width:100%;}
.gensel{cursor:pointer;}
.genbtn{font-family:'Anton',Impact,sans-serif;font-size:18px;letter-spacing:2px;color:var(--paper);background:var(--ink);border:2px solid var(--ink);border-radius:9px;padding:12px 26px;cursor:pointer;box-shadow:4px 4px 0 var(--c3);transition:transform .08s,box-shadow .08s;}
.genbtn:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--c3);}
.genbtn:disabled{opacity:.6;cursor:wait;box-shadow:none;transform:none;}
.generr{margin-top:14px;background:#F4DEDB;border:2px solid #C5362B;border-radius:9px;padding:12px 15px;font-family:'Space Mono',monospace;font-size:12px;color:#8a2b22;}
.genout{margin-top:18px;display:flex;flex-direction:column;gap:16px;}
.genblock{background:var(--paper2);border:2px solid var(--ink);border-radius:10px;padding:14px 16px;box-shadow:4px 4px 0 var(--ink);}
.genblockh{font-family:'Anton',Impact,sans-serif;font-size:15px;letter-spacing:1.5px;margin-bottom:10px;display:flex;align-items:center;gap:10px;}
.gblim{font-family:'Space Mono',monospace;font-size:10px;color:var(--soft);letter-spacing:0;}
.outitem{display:flex;align-items:center;gap:11px;padding:8px 0;border-bottom:1px solid var(--line);}
.outitem:last-child{border-bottom:none;}
.outtext{flex:1;font-size:13.5px;line-height:1.4;}
.outmeta{font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);white-space:nowrap;}
.outmeta.over{color:#C5362B;font-weight:700;}
.thinnote{margin-top:14px;font-family:'Space Mono',monospace;font-size:11px;line-height:1.5;color:var(--soft);font-style:italic;border-top:1px dashed var(--line);padding-top:11px;}
.cselect{font-family:'Space Mono',monospace;font-size:13px;border:2px solid var(--ink);border-radius:6px;padding:5px 9px;background:var(--paper);color:var(--ink);max-width:230px;margin:4px 0;cursor:pointer;}
.cmpbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 12px;}
.cmpbtn{font-family:'Archivo',sans-serif;font-weight:800;font-size:12px;letter-spacing:.06em;border:2px solid var(--ink);border-radius:8px;padding:7px 14px;background:var(--paper);color:var(--ink);cursor:pointer;box-shadow:2.5px 2.5px 0 var(--ink);}
.cmpbtn.on{background:var(--ink);color:var(--paper);box-shadow:none;transform:translate(2px,2px);}
.cmplbl{font-family:'Space Mono',monospace;font-size:12px;color:var(--soft);}
.cmprange{font-size:11.5px;color:var(--soft);}
.cmploading{font-family:'Space Mono',monospace;font-size:11.5px;color:var(--soft);animation:pulse 1.2s infinite;}
.dup{color:#2E8B6B;font-weight:700;}
.ddown{color:#C5362B;font-weight:700;}
.dneu{color:#857A6A;font-weight:700;}
.mixchip{display:inline-flex;align-items:center;gap:6px;font-family:'Space Mono',monospace;font-size:12px;border:2px solid var(--ink);border-radius:6px;padding:4px 8px;background:var(--ink);color:var(--paper);margin:4px 0;}
.mixchip button{border:0;background:none;color:inherit;cursor:pointer;font-size:11px;padding:0;line-height:1;opacity:.7;}
.mixchip button:hover{opacity:1;}
.plt{display:inline-block;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;border:1.5px solid currentColor;border-radius:4px;padding:0 4px;margin-right:6px;vertical-align:1px;}
.plt-meta{color:#4E97D1;}
.plt-google{color:#F4C24A;}
.plt-tiktok{color:#A97FD1;}
.an{margin-top:4px;}
.anhead{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.antitle{font-family:'Anton',Impact,sans-serif;font-size:22px;letter-spacing:1.5px;color:var(--ink);}
.ansub{font-family:'Space Mono',monospace;font-size:11.5px;color:var(--soft);margin-top:5px;max-width:560px;line-height:1.5;}
.anbtn{font-family:'Anton',Impact,sans-serif;font-size:15px;letter-spacing:1.5px;color:var(--paper);background:var(--ink);border:2px solid var(--ink);border-radius:9px;padding:11px 20px;cursor:pointer;box-shadow:4px 4px 0 var(--c6);white-space:nowrap;}
.anbtn:hover{transform:translate(-1px,-1px);}.anbtn:disabled{opacity:.6;cursor:default;}
.anplaceholder{background:var(--paper2);border:2px dashed var(--line);border-radius:12px;padding:26px;font-family:'Space Mono',monospace;font-size:13px;color:var(--soft);line-height:1.6;}
.anout{display:flex;flex-direction:column;gap:16px;}
.antop{font-family:'Anton',Impact,sans-serif;font-size:20px;letter-spacing:.5px;color:var(--ink);background:linear-gradient(90deg,var(--paper2),transparent);border-left:4px solid var(--c4);padding:12px 16px;border-radius:0 8px 8px 0;}
.andiag{font-size:14.5px;line-height:1.6;color:var(--ink);}
.anblock{background:var(--paper2);border:2px solid var(--ink);border-radius:12px;padding:14px 16px;box-shadow:4px 4px 0 var(--ink);}
.anbh{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--soft);margin-bottom:10px;}
.histsect{margin-top:22px;border-top:2px dashed var(--line);padding-top:14px;display:flex;flex-direction:column;gap:8px;}
.histtitle{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--soft);margin-bottom:4px;}
.histitem{border:2px solid var(--ink);border-radius:10px;background:var(--paper2);overflow:hidden;}
.histhead{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;cursor:pointer;padding:10px 14px;font-family:'Space Mono',monospace;font-size:12px;color:var(--ink);}
.histhead:hover{background:rgba(0,0,0,0.04);}
.histcaret{font-size:11px;color:var(--soft);}
.histdate{font-weight:700;}
.histmeta{color:var(--soft);font-size:11px;font-style:italic;}
.histbody{padding:14px;border-top:2px dashed var(--line);}
.chatbox{display:flex;flex-direction:column;gap:14px;}
.chatsugs{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.chatsugtitle{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--soft);}
.chatsug{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink);background:var(--paper2);border:2px solid var(--ink);border-radius:999px;padding:6px 14px;cursor:pointer;}
.chatsug:hover{background:var(--ink);color:var(--paper);}
.chatmsgs{display:flex;flex-direction:column;gap:10px;max-height:520px;overflow-y:auto;}
.chatmsg{display:flex;gap:10px;align-items:flex-start;}
.chatwho{font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;padding:3px 8px;border-radius:6px;border:2px solid var(--ink);background:var(--paper2);flex-shrink:0;margin-top:2px;}
.chatmsg.user .chatwho{background:var(--c6);color:var(--paper);border-color:var(--c6);}
.chattext{font-family:'Space Mono',monospace;font-size:13px;line-height:1.55;color:var(--ink);white-space:pre-wrap;background:var(--paper2);border:2px solid var(--ink);border-radius:10px;padding:10px 14px;box-shadow:3px 3px 0 var(--ink);}
.chatmsg.user .chattext{background:var(--paper);box-shadow:none;}
.chatthinking{color:var(--soft);font-style:italic;animation:pulse 1.2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
.chatrow{display:flex;gap:10px;}
.chatinput{flex:1;font-family:'Space Mono',monospace;font-size:13px;color:var(--ink);background:var(--paper2);border:2px solid var(--ink);border-radius:10px;padding:11px 14px;outline:none;}
.chatinput:focus{box-shadow:3px 3px 0 var(--ink);}
.usrok{font-family:'Space Mono',monospace;font-size:12px;color:#2E8B6B;background:#DCE9E1;border:2px solid #2E8B6B;border-radius:8px;padding:8px 12px;}
.usrlist{display:flex;flex-direction:column;gap:6px;margin-bottom:18px;}
.usrrow{display:flex;align-items:center;gap:12px;background:var(--paper2);border:2px solid var(--ink);border-radius:10px;padding:9px 14px;}
.usrname{font-family:'Space Mono',monospace;font-weight:700;font-size:13px;}
.usradmin{font-style:normal;font-size:9px;letter-spacing:1px;background:var(--c6);color:var(--paper);border-radius:5px;padding:2px 6px;margin-left:8px;}
.usrmeta{font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);margin-left:auto;}
.usrbtn{font-family:'Space Mono',monospace;font-size:11px;color:var(--ink);background:var(--paper);border:2px solid var(--ink);border-radius:7px;padding:4px 10px;cursor:pointer;}
.usrbtn:hover{background:var(--ink);color:var(--paper);}
.usrbtn.del{color:#C5362B;border-color:#C5362B;}
.usrbtn.del:hover{background:#C5362B;color:var(--paper);}
.usrenv{font-family:'Space Mono',monospace;font-size:10px;color:var(--soft);font-style:italic;margin-top:4px;}
.usrform{background:var(--paper2);border:2px solid var(--ink);border-radius:12px;padding:16px;box-shadow:4px 4px 0 var(--ink);display:flex;flex-direction:column;gap:12px;}
.usrformtitle{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--soft);}
.usrfields{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
.usrfields .chatinput{flex:1;min-width:200px;}
.usrpass{display:flex;gap:6px;flex:1;min-width:260px;}
.usrpass .chatinput{flex:1;}
.usrchk{font-family:'Space Mono',monospace;font-size:12px;display:flex;align-items:center;gap:7px;cursor:pointer;}
.usrpick{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;}
.usuariosbtn{border-style:dashed;}
.usrpickcol{display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;border:2px dashed var(--line);border-radius:10px;padding:10px 12px;}
.usrpicklab{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;color:var(--soft);}
.usractions{display:flex;gap:10px;align-items:center;}
.anaccion{display:flex;gap:11px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--line);}
.anaccion:first-of-type{border-top:none;}
.anprio{font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1px;color:#fff;border-radius:4px;padding:3px 7px;flex-shrink:0;margin-top:1px;}
.anacc{font-size:14px;font-weight:600;color:var(--ink);line-height:1.4;}
.anporque{font-family:'Space Mono',monospace;font-size:11.5px;color:var(--soft);margin-top:3px;line-height:1.45;}
.anitem{font-size:13.5px;color:var(--ink);padding:6px 0;line-height:1.5;}
.anitem.riesgo{color:#8A1C12;}
.tabai.active{background:var(--c6);border-color:var(--c6);}
.planbar{display:flex;flex-wrap:wrap;gap:14px;font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);background:var(--paper2);border:1px solid var(--line);border-radius:8px;padding:9px 14px;}
.planbar b{color:var(--ink);}
.planscenarios{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.plansc{background:var(--paper2);border:2px solid var(--ink);border-top:5px solid var(--sc);border-radius:12px;padding:14px;box-shadow:4px 4px 0 var(--ink);display:flex;flex-direction:column;gap:9px;}
.planschead{display:flex;justify-content:space-between;align-items:center;}
.planscname{font-family:'Anton',Impact,sans-serif;font-size:17px;letter-spacing:1px;color:var(--sc);}
.planscmeta{font-family:'Space Mono',monospace;font-size:10px;color:#8A1C12;border:1px solid currentColor;border-radius:4px;padding:1px 6px;}
.planscmeta.ok{color:#0F6E56;}
.planscsup{font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);line-height:1.4;min-height:30px;}
.planscnums{display:flex;gap:10px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:9px 0;}
.planscnums>div{display:flex;flex-direction:column;}
.planscnums b{font-size:14px;color:var(--ink);}
.planscnums span{font-family:'Space Mono',monospace;font-size:9px;color:var(--soft);}
.planscacc{display:flex;flex-direction:column;gap:7px;}
.planacc{display:flex;gap:8px;align-items:flex-start;}
.planaccico{font-size:13px;color:var(--sc);width:14px;flex-shrink:0;}
.planacct{font-size:12.5px;color:var(--ink);line-height:1.35;}
.planlvl{font-family:'Space Mono',monospace;font-size:8.5px;color:var(--soft);border:1px solid var(--line);border-radius:3px;padding:0 4px;}
.planba{font-family:'Space Mono',monospace;font-size:11px;color:var(--sc);}
.planaccp{font-family:'Space Mono',monospace;font-size:10.5px;color:var(--soft);margin-top:2px;line-height:1.35;}
@media(max-width:760px){.planscenarios{grid-template-columns:1fr;}}
.empty{margin-top:40px;padding:60px 24px;text-align:center;border:2px dashed var(--line);border-radius:14px;background:var(--paper2);}
.emptymark{font-size:34px;color:var(--soft);opacity:.5;margin-bottom:14px;}
.emptytitle{font-family:'Anton',Impact,sans-serif;font-size:24px;letter-spacing:1px;color:var(--ink);}
.emptysub{font-family:'Space Mono',monospace;font-size:12.5px;color:var(--soft);margin-top:10px;}
.daterange{display:inline-flex;align-items:center;gap:6px;margin:4px 0;}
.daterange i{color:var(--soft);font-style:normal;}
.cdate{font-family:'Space Mono',monospace;font-size:12px;border:2px solid var(--ink);border-radius:6px;padding:4px 7px;background:var(--paper);color:var(--ink);cursor:pointer;}

/* BIBLIOTECA */
.bibtabs{display:flex;gap:8px;align-items:center;margin-bottom:14px;}
.bibtab{font-family:'Anton',Impact,sans-serif;font-size:15px;letter-spacing:1.5px;color:var(--ink);background:var(--paper2);border:2px solid var(--ink);padding:8px 15px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:3px 3px 0 var(--ink);}
.bibtab.on{background:var(--ink);color:var(--paper);}
.bibn{font-family:'Space Mono',monospace;font-size:11px;background:var(--ink);color:var(--paper);border-radius:4px;padding:1px 6px;}
.bibtab.on .bibn{background:var(--c1);color:var(--ink);}
.search{margin-left:auto;font-family:'Space Mono',monospace;font-size:13px;border:2px solid var(--ink);border-radius:8px;padding:8px 13px;background:var(--paper);color:var(--ink);width:260px;outline:none;}
.ejefilt{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px;}
.ejepill{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink);background:var(--paper2);border:2px solid var(--ink);padding:5px 12px;border-radius:6px;cursor:pointer;}
.ejepill.on{background:var(--ink);color:var(--paper);}
.ejepill b{font-family:'Anton',Impact,sans-serif;margin-left:3px;}
.hooklist{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
.hookcard{display:flex;align-items:center;gap:11px;background:var(--paper2);border:2px solid var(--ink);border-left:6px solid var(--ec);border-radius:8px;padding:10px 13px;box-shadow:2px 2px 0 var(--ink);}
.hnum{font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);flex:none;}
.hmid{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;}
.htext{font-size:12.5px;line-height:1.35;}
.htags{display:flex;gap:8px;align-items:center;}
.ftag{font-family:'Space Mono',monospace;font-size:9.5px;color:var(--soft);border:1px solid var(--line);border-radius:3px;padding:1px 6px;}
.ejetag{font-family:'Space Mono',monospace;font-size:9.5px;font-weight:700;}
.copybtn{font-family:'Space Mono',monospace;font-size:12px;font-weight:700;background:var(--paper);border:2px solid var(--ink);border-radius:6px;padding:5px 9px;cursor:pointer;color:var(--ink);white-space:nowrap;flex:none;}
.copybtn:hover{background:var(--c1);}
.bibfoot{margin-top:12px;font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);font-style:italic;}
.bibintro{font-family:'Space Mono',monospace;font-size:12px;color:var(--soft);margin-bottom:14px;line-height:1.5;}
.gancard{display:flex;align-items:center;gap:11px;background:var(--paper2);border:2px solid var(--ink);border-left:6px solid #2E8B6B;border-radius:8px;padding:10px 13px;box-shadow:2px 2px 0 var(--ink);}
.ganroas{font-family:'Space Mono',monospace;font-size:9.5px;color:#2E8B6B;font-weight:700;}
.matchbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
.matchbtn{font-family:'Anton',Impact,sans-serif;font-size:14px;letter-spacing:1px;color:var(--paper);background:var(--ink);border:2px solid var(--ink);border-radius:8px;padding:9px 16px;cursor:pointer;box-shadow:3px 3px 0 var(--c6);}
.matchbtn:disabled{opacity:.5;cursor:default;}
.matchhint{font-family:'Space Mono',monospace;font-size:11px;color:var(--soft);}
.hookcard.untested{opacity:.55;}
.probtag{font-family:'Space Mono',monospace;font-size:9px;font-weight:700;color:#0F6E56;background:#DFEAE4;border:1px solid #9CC6B5;border-radius:3px;padding:1px 6px;}
.probtag.click{cursor:pointer;}
.sinprobtag{font-family:'Space Mono',monospace;font-size:9px;color:var(--soft);border:1px dashed var(--line);border-radius:3px;padding:1px 6px;}
.hookwrap{display:flex;flex-direction:column;}
.hookexp{background:var(--paper2);border:2px solid var(--ink);border-top:none;border-radius:0 0 8px 8px;margin:-4px 0 0 6px;padding:8px 13px 10px;font-family:'Space Mono',monospace;}
.hookexh{font-size:9px;letter-spacing:1.5px;color:var(--soft);margin-bottom:6px;}
.hookexitem{padding:5px 0;border-top:1px dashed var(--line);}
.hookexitem:first-of-type{border-top:none;}
.hookexline{font-size:12px;color:var(--ink);display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.hookexkpi{color:#2E8B6B;font-weight:700;}
.hookexspend{color:var(--soft);font-size:11px;}
.hookexrazon{font-size:11px;color:var(--soft);margin-top:2px;padding-left:4px;line-height:1.4;}
.promptlist{display:flex;flex-direction:column;gap:10px;}
.pcard{background:var(--paper2);border:2px solid var(--ink);border-radius:9px;padding:13px 16px;box-shadow:3px 3px 0 var(--ink);}
.pcardtop{display:flex;justify-content:space-between;align-items:center;}
.pcat{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1px;color:var(--paper);background:var(--c6);border-radius:4px;padding:2px 9px;}
.ptitle{font-family:'Anton',Impact,sans-serif;font-size:16px;letter-spacing:.5px;margin-top:8px;}
.pque{font-size:12.5px;color:#3A3128;margin-top:4px;}
.pdet{margin-top:8px;}
.pdet summary{font-family:'Space Mono',monospace;font-size:11px;color:var(--c3);cursor:pointer;}
.ptext{white-space:pre-wrap;font-family:'Space Mono',monospace;font-size:11.5px;line-height:1.5;color:#3A3128;background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:11px 13px;margin-top:8px;overflow-x:auto;}

`;
