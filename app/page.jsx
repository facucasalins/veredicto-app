"use client";
import { useState, useMemo, useEffect, useRef } from "react";

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

const HOOKS = [[1, "¿Tienes problemas con (punto complicado)?", "Pregunta / curiosidad", "Ruptura"], [2, "¿Cómo reaccionarías si (una situación improbable)?", "Pregunta / curiosidad", "Ruptura"], [3, "¿Alguna vez has pensado que (diseño inesperado)?", "Pregunta / curiosidad", "Ruptura"], [4, "¿Qué pasaría si te dijera que hay una manera fácil de (resultado deseado)?", "Pregunta / curiosidad", "Ruptura"], [5, "¿Por qué nadie habla de (relacionado con tu negocio o nicho)?", "Pregunta / curiosidad", "Ruptura"], [6, "¿Qué pasaría si pudieras (resultado deseado)?", "Pregunta / curiosidad", "Ruptura"], [7, "Imagina si pudieras (resultado deseado)", "Pregunta / curiosidad", "Ruptura"], [8, "¿Y si (resultados deseados) estuvieran a solo un paso?", "Pregunta / curiosidad", "Ruptura"], [9, "¿Soy solo yo, o (acción)?", "Pregunta / curiosidad", "Ruptura"], [10, "¿Cuál sería tu reacción si (situación inesperada)?", "Pregunta / curiosidad", "Ruptura"], [11, "No necesitas [cosa/acción en tu nicho]", "Negación / contrarian", "Ruptura"], [12, "Olvida todo lo que sabes sobre [tema en tu nicho]", "Negación / contrarian", "Ruptura"], [13, "Deja de [acción común]", "Negación / contrarian", "Ruptura"], [14, "[Número] errores que debes evitar si quieres [objetivo]", "Error / advertencia", "Pérdida"], [15, "Cómo perdí [estadística en tu nicho]", "Transformación / proceso", "Identidad"], [16, "¿Por qué nadie habla de...?", "Pregunta / curiosidad", "Ruptura"], [17, "Este es el peor [elemento en tu nicho]", "Opinión controvertida", "Ruptura"], [18, "El secreto para [objetivo en tu nicho]", "Secreto / revelación", "Ruptura"], [19, "Odio [elemento popular]", "Opinión controvertida", "Ruptura"], [20, "Me vas a odiar por decir esto", "Opinión controvertida", "Ruptura"], [21, "Esto debería ser ilegal...", "Opinión controvertida", "Ruptura"], [22, "Aquí hay un truco para [objetivo]", "Secreto / revelación", "Ruptura"], [23, "[Tendencia en tu nicho] está muerta, aquí está el por qué", "Opinión controvertida", "Ruptura"], [24, "Va a ser controversial, pero [cuestionando opiniones mayoritarias]", "Opinión controvertida", "Ruptura"], [25, "No estarás de acuerdo conmigo, pero...", "Opinión controvertida", "Ruptura"], [26, "La verdad sobre [tema controversial]", "Opinión controvertida", "Ruptura"], [27, "¿Qué haces para [objetivo]?", "Pregunta / curiosidad", "Ruptura"], [28, "¿Quieres saber [objetivo]?", "Pregunta / curiosidad", "Ruptura"], [29, "Aquí está por qué [problema en tu nicho]", "Secreto / revelación", "Ruptura"], [30, "Cómo pasé de [X resultado] a [X resultado] en [tiempo establecido]", "Transformación / proceso", "Identidad"], [31, "Este video es solo para [audiencia objetivo]", "Filtro de audiencia", "Identidad"], [32, "¿Qué harías si...?", "Pregunta / curiosidad", "Ruptura"], [33, "¿Por qué el 99% de (problema de la audiencia) no (conexión con la audiencia)?", "Dato / estadística", "Evidencia"], [34, "X% de (audiencia) son (problemático)", "Dato / estadística", "Evidencia"], [35, "Es por eso que X% de (audiencia) fallan después de (tiempo)", "Dato / estadística", "Evidencia"], [36, "Este error te costará millones...", "Error / advertencia", "Pérdida"], [37, "Probé cada (consejo, método), para que tú no tengas que hacerlo", "Prueba social / viralidad", "Evidencia"], [38, "(Consejo) que me hubiera gustado saber antes", "Secreto / revelación", "Ruptura"], [39, "¿Qué pasa cuando (resultado esperado)?", "Pregunta / curiosidad", "Ruptura"], [40, "Descubramos por qué (problema de tu objetivo)", "Secreto / revelación", "Ruptura"], [41, "Aquí está cómo (resultado esperado)", "Solución / facilidad", "Pérdida"], [42, "Revelo mi secreto para (resultado esperado)", "Secreto / revelación", "Ruptura"], [43, "Cómo conseguir (resultado esperado) en (duración)", "Solución / facilidad", "Pérdida"], [44, "Aquí está por qué tu (acción) no da resultados", "Diagnóstico oculto", "Pérdida"], [45, "No me odies, pero aquí va (una verdad)", "Opinión controvertida", "Ruptura"], [46, "Todo lo que pensabas saber sobre (relacionado con tu objetivo) está 100% equivocado", "Mito vs realidad", "Ruptura"], [47, "Esto es lo único que necesitas saber sobre (relacionado con tu objetivo)", "Secreto / revelación", "Ruptura"], [48, "¿Sabías que (dato)?", "Dato / estadística", "Evidencia"], [49, "La cosa más loca acaba de suceder en (lugar); no lo vas a creer", "Dato / estadística", "Evidencia"], [50, "Dato curioso: (dato curioso)", "Dato / estadística", "Evidencia"], [51, "Esto va a cambiar la forma en que usas (relacionado con el objetivo)", "Secreto / revelación", "Ruptura"], [52, "Deja de hacer (objetivo) si quieres (resultado)", "Negación / contrarian", "Ruptura"], [53, "El mayor secreto sobre (resultado) que nadie te ha contado", "Secreto / revelación", "Ruptura"], [54, "Estos 3 (consejos) parecen ilegales de saber", "Lista / número", "Evidencia"], [55, "Este (problema) podría destruir (resultado) en 5 segundos", "Error / advertencia", "Pérdida"], [56, "Este (relacionado con el objetivo) es el país más peligroso en (lugar)", "Dato / estadística", "Evidencia"], [57, "Deja de hacer (problemático) ahora mismo. En su lugar, (resultado)", "Negación / contrarian", "Ruptura"], [58, "El oscuro secreto detrás de (relacionado con el objetivo)", "Secreto / revelación", "Ruptura"], [59, "Nadie te ha contado esto aún, pero (relacionado con el objetivo) están desactualizados", "Secreto / revelación", "Ruptura"], [60, "Ahorra tiempo y dinero con [producto]", "Solución / facilidad", "Pérdida"], [61, "Ahorra tiempo y dinero en [tarea]", "Solución / facilidad", "Pérdida"], [62, "¿Vale la pena [producto]? ¡Vamos a ver!", "UGC / producto", "Evidencia"], [63, "¿Qué hay en [producto]?", "UGC / producto", "Evidencia"], [64, "Preguntas que me hacen sobre [producto]", "UGC / producto", "Evidencia"], [65, "Ahora puedes obtener X entregado en tu puerta", "UGC / producto", "Evidencia"], [66, "Antes de probar [tipo de producto], mira esto:", "UGC / producto", "Evidencia"], [67, "¿Odiando [la peor alternativa]? Prueba esto:", "Solución / facilidad", "Pérdida"], [68, "En lugar de hacer [peor alternativa], prueba esto:", "Solución / facilidad", "Pérdida"], [69, "Chicos, está aquí...", "UGC / producto", "Evidencia"], [70, "Lo que pedí vs. lo que recibí", "UGC / producto", "Evidencia"], [71, "Unboxing de [producto]", "UGC / producto", "Evidencia"], [72, "TikTok me hizo probar [producto]", "UGC / producto", "Evidencia"], [73, "Cosas que TikTok me hizo probar #13", "UGC / producto", "Evidencia"], [74, "Este [tipo de producto] se está volviendo viral en [plataforma de redes sociales]", "Prueba social / viralidad", "Evidencia"], [75, "Probé el [tipo de producto] viral para ver si cumple con las expectativas", "UGC / producto", "Evidencia"], [76, "Este [tipo de producto] tiene más de 5,000 reseñas... veamos si vale la pena", "Prueba social / viralidad", "Evidencia"], [77, "[Publicación] no deja de hablar de nosotros", "Prueba social / viralidad", "Evidencia"], [78, "Tan bueno que se agotó en una semana", "Prueba social / viralidad", "Evidencia"], [79, "¿Estás [logrando el objetivo de manera óptima]?", "Pregunta / curiosidad", "Ruptura"], [80, "Truco de vida: Prueba [producto] para [punto de dolor]", "Solución / facilidad", "Pérdida"], [81, "Mi [producto] favorito para [punto de dolor]", "UGC / producto", "Evidencia"], [82, "Cómo hacer [tarea] fácilmente", "Solución / facilidad", "Pérdida"], [83, "[Tarea] nunca ha sido más fácil que con [producto]", "Solución / facilidad", "Pérdida"], [84, "Mi [producto] favorito para hacer [tarea difícil] más fácil", "Solución / facilidad", "Pérdida"], [85, "Aquí está mi producto favorito para [tarea]", "UGC / producto", "Evidencia"], [86, "¿Luchando por hacer [tarea]?", "Pregunta / curiosidad", "Ruptura"], [87, "Entonces, he estado luchando con [tarea], pero [producto] realmente me ha ayudado", "Solución / facilidad", "Pérdida"], [88, "¿La manera más fácil de hacer [tarea]?", "Solución / facilidad", "Pérdida"], [89, "Haz tu semana más fácil", "Solución / facilidad", "Pérdida"], [90, "Por qué los adultos evitan [tarea]... [producto] lo hace fácil", "Solución / facilidad", "Pérdida"], [91, "[Producto] hizo [tarea] mucho más fácil. ¡Tienes que probarlo!", "Solución / facilidad", "Pérdida"], [92, "Cuando uso [producto], es una cosa menos de la que preocuparme", "Solución / facilidad", "Pérdida"], [93, "5 maneras en que [producto] ayuda a [punto de dolor]", "Lista / número", "Evidencia"], [94, "3 razones para comprar [producto]", "Lista / número", "Evidencia"], [95, "3 razones para probar [servicio]", "Lista / número", "Evidencia"], [96, "Obtén [propuesta de valor] en 3 pasos", "Lista / número", "Evidencia"], [97, "El #1 en internet [tipo de producto]", "Prueba social / viralidad", "Evidencia"], [98, "La mejor manera de [lograr el objetivo del producto]", "Solución / facilidad", "Pérdida"], [99, "¿Qué hace que [el tipo de producto] sea el mejor?", "Pregunta / curiosidad", "Ruptura"], [100, "Hey, [tipo de cliente], tienes que probar esto", "Filtro de audiencia", "Identidad"], [101, "Personas buscando [categoría de producto], dejen de desplazarse", "Filtro de audiencia", "Identidad"], [102, "Espera, ¿has probado X?", "UGC / producto", "Evidencia"], [103, "PSA: [declaración sobre categoría de producto]", "Dato / estadística", "Evidencia"], [104, "¿Sabías? [hecho sobre categoría de producto]", "Dato / estadística", "Evidencia"], [105, "Acabo de descubrir [hecho sobre categoría de producto]", "Dato / estadística", "Evidencia"], [106, "El perfecto (x) no existe", "Mito vs realidad", "Ruptura"], [107, "Los mejores hallazgos de compras en TikTok", "UGC / producto", "Evidencia"], [108, "Las meriendas nocturnas pegan diferente con este (x)...", "UGC / producto", "Evidencia"], [109, "Compré esto para mi (x) para (x) vacaciones/ocasión", "UGC / producto", "Evidencia"], [110, "Un producto que uso TODOS los días sin falta es...(x)", "UGC / producto", "Evidencia"], [111, "Mis principales hallazgos de compras sin los que ahora no puedo vivir", "UGC / producto", "Evidencia"], [112, "Esto es lo que pedí y esto es lo que recibí mientras muestra la página web en gancho", "UGC / producto", "Evidencia"], [113, "Quién más quiere (x resultado) sin (x punto de dolor)", "Pregunta / curiosidad", "Ruptura"], [114, "Deshazte De (x Problema) Con (x solución/producto)", "Solución / facilidad", "Pérdida"], [115, "Formas poco conocidas también (x obtener resultado/solucionar problema)", "Secreto / revelación", "Ruptura"], [116, "¡Ojalá hubiera sabido de esta marca antes!", "UGC / producto", "Evidencia"], [117, "Este es el mayor error que comete la gente cuando (x solución al problema)", "Error / advertencia", "Pérdida"], [118, "5 cosas que desearía haber sabido antes de (probar todas estas otras x soluciones)", "Lista / número", "Evidencia"], [119, "Llamando a todos los (público objetivo) que están cansados de (x problema)", "Filtro de audiencia", "Identidad"], [120, "Muy bien, voy a compartir mi secreto sobre cómo (uso x producto/solución)", "Secreto / revelación", "Ruptura"], [121, "El perfecto (x) no existe", "Mito vs realidad", "Ruptura"], [122, "Un/Una [objeto mundano específico] [en ubicación cotidiana] cambió cómo [resultado profesional]", "Objeto mundano revelador", "Ruptura"], [123, "Encontré la respuesta a [problema del nicho] en [objeto inesperado pero específico]", "Objeto mundano revelador", "Ruptura"], [124, "El/La [objeto roto/gastado específico] me enseñó más sobre [concepto del nicho] que [fuente obvia de aprendizaje]", "Objeto mundano revelador", "Ruptura"], [125, "Sigo [acción compulsiva del nicho] cada [frecuencia absurda] aunque sé que [verdad incómoda]", "Confesión / experimento", "Identidad"], [126, "Todavía [hábito anticuado del nicho]. No debería funcionar. Funciona.", "Verdad contraintuitiva", "Ruptura"], [127, "Confieso que a veces [práctica 'prohibida' del nicho]. Y a veces [resultado contradictorio].", "Confesión / experimento", "Identidad"], [128, "El/La mejor [elemento del nicho] es el/la que [contradicción aparente]. Déjame explicar.", "Verdad contraintuitiva", "Ruptura"], [129, "Deberías [acción contraintuitiva con elemento sagrado del nicho]. Al menos [condición que lo resuelve].", "Verdad contraintuitiva", "Ruptura"], [130, "Los/Las [elemento 'malo' del nicho] [resultado positivo]. Pero no por las razones que piensas.", "Verdad contraintuitiva", "Ruptura"], [131, "Gasté [cantidad específica] en [decisión arriesgada sin protocolo]. Esto es lo que aprendí.", "Confesión / experimento", "Identidad"], [132, "Lancé/Hice [cantidad] de [elemento] sin [requisito 'obligatorio']. [Consecuencia temida]. [Métrica que lo redimió].", "Confesión / experimento", "Identidad"], [133, "Ignoré [best practice sagrada] por [período]. [Consecuencia temida que no pasó]. [Métrica que mejoró].", "Confesión / experimento", "Identidad"], [134, "El [porcentaje no redondo]% de tu [recurso] probablemente se está yendo en [período/lugar específico]", "Auditoría con números", "Evidencia"], [135, "Revisé [número impar alto] [elementos del nicho]. Solo [número bajo] tenían [cosa específica] bien.", "Auditoría con números", "Evidencia"], [136, "Tardé [número impar de días] en darme cuenta de que el problema no era [sospechoso obvio]", "Reframe del problema", "Pérdida"], [137, "Eran las [hora tardía]. [Situación mundana dramática]. Faltaban [cantidad/métrica] en algún lugar entre [punto A técnico] y [punto B técnico].", "Escena / narrativa", "Identidad"], [138, "Abrí [herramienta mundana]. [Cantidad abrumadora]. Una de ellas escondía [el origen de un problema grave].", "Escena / narrativa", "Identidad"], [139, "El cliente preguntó [pregunta incómoda]. Yo tenía [cantidad] de [evidencia de investigación] y [conclusión que genera tensión].", "Escena / narrativa", "Identidad"], [140, "Hay algo profundamente [emoción fuerte] en ver que tu [apuesta 'segura' del nicho] tiene [métrica decepcionante]", "Emoción / vulnerabilidad", "Identidad"], [141, "Sentí un/una [emoción inesperada] cuando finalmente [acción difícil del nicho] que [expectativa no cumplida en comillas]", "Emoción / vulnerabilidad", "Identidad"], [142, "Hay [emoción inesperada] en [métrica/logro específico] que [limitación de comprensión externa]", "Emoción / vulnerabilidad", "Identidad"], [143, "Esto es solo para los que ya [inversión/esfuerzo específico] y siguen sin [resultado esperado]", "Filtro de audiencia", "Identidad"], [144, "Si todavía [comportamiento de principiante], esto no es para ti", "Filtro de audiencia", "Identidad"], [145, "Para los que han [acción exhaustiva del nicho] y aún así sienten que [sensación de incertidumbre]", "Filtro de audiencia", "Identidad"], [146, "Antes de que me juzgues: sí, [práctica cuestionable]. Y [resultado que la justifica].", "Anticipa la objeción", "Ruptura"], [147, "Antes de que [acción de rechazo]: no voy a [expectativa del nicho]. Voy a [giro inesperado].", "Anticipa la objeción", "Ruptura"], [148, "Antes de que pienses que [juicio negativo]: este/esta [cosa desordenada/imperfecta] [supera a] mis [versiones 'correctas']", "Anticipa la objeción", "Ruptura"], [149, "[Proceso del nicho] funciona exactamente como [proceso doméstico/universal]. [Conexión específica del error común].", "Analogía", "Ruptura"], [150, "Tu [sistema del nicho] se comporta como [situación cotidiana reconocible]: [insight específico del comportamiento]", "Analogía", "Ruptura"], [151, "[Tarea del nicho] es como [actividad con interdependencias]: [consecuencia no obvia de ajustes aislados]", "Analogía", "Ruptura"], [152, "—y eso fue antes de [acción de descubrimiento]. Lo que encontré después [magnitud del cambio].", "Escena / narrativa", "Identidad"], [153, "—que es exactamente por qué dejé de [práctica común del nicho].", "Escena / narrativa", "Identidad"], [154, "—pero nadie te dice [parte oculta del proceso]. Solo te muestran [resultado visible].", "Verdad contraintuitiva", "Ruptura"], [155, "La configuración por defecto de [plataforma/herramienta] está diseñada para [beneficio de la plataforma], no para [beneficio del usuario]", "Trampa de plataforma", "Pérdida"], [156, "Ese [función atractiva y fácil] es [descripción de trampa] con [elemento engañosamente atractivo]", "Trampa de plataforma", "Pérdida"], [157, "Los/Las [elementos 'mejorados/simplificados'] esconden exactamente [lo que el usuario necesita]", "Trampa de plataforma", "Pérdida"], [158, "El verdadero culpable de tu [problema del nicho] es [elemento específico de interfaz/proceso] que nunca [acción omitida]", "Diagnóstico oculto", "Pérdida"], [159, "El/La [lugar común de feedback] donde [acción que parece útil] te está costando [recurso real]", "Trampa de plataforma", "Pérdida"], [160, "El/La [configuración pequeña ignorada] está [acción perjudicial silenciosa] a [destino inesperado]", "Trampa de plataforma", "Pérdida"], [161, "La mayoría de [grupo respetado del nicho] no saben [cosa que deberían saber por definición]", "Verdad contraintuitiva", "Ruptura"], [162, "A veces [resultado contradictorio] porque [audiencia] está [estado de saturación] de [lo que se supone que funciona]", "Verdad contraintuitiva", "Ruptura"], [163, "El [elemento de venta/prueba social] que te mostraron probablemente [limitación no mencionada]. Y ellos lo saben.", "Verdad contraintuitiva", "Ruptura"], [164, "Probé [experimento extremo con números específicos] para ver qué pasaba. No hagas esto.", "Confesión / experimento", "Identidad"], [165, "Usé [cantidad absurda] de [elemento] en [lugar] porque '[lógica simplista]'. Spoiler: no lo es.", "Confesión / experimento", "Identidad"], [166, "Dejé [acción pasiva] por [período largo] esperando que [esperanza común en comillas]. [Resultado irónico].", "Confesión / experimento", "Identidad"], [167, "No estás [síntoma negativo]. Estás [causa real más profunda y específica].", "Reframe del problema", "Pérdida"], [168, "Tu problema no es falta de [recurso obvio]. Es falta de [elemento de proceso más profundo].", "Reframe del problema", "Pérdida"], [169, "No te falta [recurso escaso obvio]. Te falta saber [diagnóstico específico].", "Reframe del problema", "Pérdida"], [170, "Hay un momento exacto cuando [situación específica] y piensas '[pensamiento de rendición común]'. Ese momento tiene [solución/nombre].", "Emoción / vulnerabilidad", "Identidad"], [171, "Le llamo '[nombre inventado]': cuando [momento técnico específico] y [consecuencia emocional] empieza", "Escena / narrativa", "Identidad"], [172, "Existe un limbo entre '[expectativa]' y '[desesperación técnica]'. La mayoría [acción de rendición] ahí.", "Emoción / vulnerabilidad", "Identidad"], [173, "Nadie te dice que [proceso] no es [expectativa]. [Acción] no [resultado proporcional]. Esto es lo que pasa en medio.", "Verdad contraintuitiva", "Ruptura"], [174, "Los [fuentes de aprendizaje] te muestran [parte visible del proceso]. No te muestran [parte emocional/difícil oculta].", "Verdad contraintuitiva", "Ruptura"], [175, "Todo el mundo habla de [resultado impresionante]. Nadie menciona [el costo real/proceso oculto] antes de llegar ahí.", "Verdad contraintuitiva", "Ruptura"], [176, "Este error de [elemento pequeño específico] me costó $[cantidad exacta] en [período específico]. Aquí está [la prueba].", "Auditoría con números", "Evidencia"], [177, "Dejé [configuración específica] activado sin saber qué hacía. $[cantidad] después, aprendí.", "Confesión / experimento", "Identidad"], [178, "Confié en [feature/recomendación de plataforma] por [período]. Mi [métrica] [empeoró] [porcentaje]. Esta es [la prueba].", "Auditoría con números", "Evidencia"], [179, "Conoces ese [sonido/sensación específica del nicho]? Después de [período de ausencia/cambio], [experiencia alterada].", "Escena / narrativa", "Identidad"], [180, "El/La [acción repetitiva del nicho] a las [hora tardía] tiene [cualidad diferente] cuando [condición de fracaso].", "Escena / narrativa", "Identidad"], [181, "Hay [sensación/sonido específico] cuando finalmente [momento de descubrimiento]. [Reacción física del alivio].", "Emoción / vulnerabilidad", "Identidad"], [182, "No existe tal cosa como '[creencia/frase común]' si [condición que la invalida]", "Mito vs realidad", "Ruptura"], [183, "El 'mejor [elemento universal]' no existe. Existe [versión contextualizada y real].", "Mito vs realidad", "Ruptura"], [184, "Más [recurso/opciones] no significa mejor [resultado]. Usualmente significa más [consecuencia negativa].", "Verdad contraintuitiva", "Ruptura"], [185, "Entre '[punto de inicio atractivo]' y '[resultado final impresionante]' hay [cantidad] de [trabajo invisible] que nadie te muestra", "Verdad contraintuitiva", "Ruptura"], [186, "El [fuente de éxito] dice '[versión resumida]'. Lo que no dice: [lista de acciones reales, feas y múltiples].", "Verdad contraintuitiva", "Ruptura"], [187, "De [métrica mala] a [métrica buena] suena limpio. Fueron [período] de [proceso tedioso] hasta que [momento de quiebre poco glamoroso].", "Antes / después", "Evidencia"], [188, "Ese [reacción física exagerada] cuando [acción de chequeo rutinario] después de [período de ausencia] y [métrica empeoró dramáticamente]", "Emoción / vulnerabilidad", "Identidad"], [189, "El terror silencioso de que [persona con autoridad] [haga algo] antes que tú [puedas hacer algo]", "Emoción / vulnerabilidad", "Identidad"], [190, "También te da [emoción incómoda] [hacer acción lógica del nicho] que está funcionando 'por si acaso'?", "Emoción / vulnerabilidad", "Identidad"], [191, "Esperaba: [lógica aparente]. Realidad: [resultado contradictorio + razón].", "Mito vs realidad", "Ruptura"], [192, "Lo que pensé: [opción 'correcta'] > [opción 'inferior']. Lo que pasó: [métrica] [magnitud] mayor en [opción 'inferior'].", "Mito vs realidad", "Ruptura"], [193, "Plan: [plan ordenado con números]. Realidad: [elemento inesperado] [resultado extremo] y tuve que [ajuste forzado].", "Mito vs realidad", "Ruptura"], [194, "Deja de [acción que parece necesaria]. En serio. [Instrucción específica contraintuitiva] y [siguiente paso].", "Verdad contraintuitiva", "Ruptura"], [195, "[Acción que suena extrema] antes de que [consecuencia peor]. Suena loco pero [razón de peso].", "Verdad contraintuitiva", "Ruptura"], [196, "Borra [elemento que parece valioso] de tu [lugar]. [Resultado contraintuitivo].", "Verdad contraintuitiva", "Ruptura"], [197, "Deja de [acción bien intencionada pero contraproducente]. Estás [consecuencia oculta negativa].", "Verdad contraintuitiva", "Ruptura"], [198, "[Categoría de problema] no se arregla con [solución obvia que todos intentan]. Se arregla con [solución no obvia].", "Reframe del problema", "Pérdida"], [199, "Cada vez que [acción correctiva común], [consecuencia contraproducente oculta].", "Verdad contraintuitiva", "Ruptura"], [200, "El síntoma es [lo visible]. El problema es [lo oculto]. Deja de [tratar síntoma].", "Diagnóstico oculto", "Pérdida"], [201, "La incertidumbre después de [decisión común del nicho] es tan paralizante como [problema original]. Al menos [acción recomendada] te da [beneficio concreto].", "Emoción / vulnerabilidad", "Identidad"], [202, "Dejé de [búsqueda infinita común] cuando me di cuenta de que [verdad práctica].", "Confesión / experimento", "Identidad"], [203, "[Decisión común del nicho] casi siempre esconde [verdadero problema] que es más incómodo de resolver.", "Reframe del problema", "Pérdida"], [204, "Esta hoja de cálculo fea me ha ahorrado $[cantidad] en [tipo de pérdida evitada].", "Solución simple / humilde", "Evidencia"], [205, "No tengo [sistema/herramienta sofisticada]. Tengo [solución simple vergonzosamente efectiva].", "Solución simple / humilde", "Evidencia"], [206, "Mi [proceso clave del nicho] es [descripción intencionalmente simple] y funciona mejor que [alternativa compleja].", "Solución simple / humilde", "Evidencia"], [207, "Cada hora que paso [actividad que parece productiva] es una hora que no paso [actividad realmente productiva].", "Vanidad vs negocio", "Pérdida"], [208, "[Proceso largo/complejo] es [táctica de procrastinación] disfrazada de [virtud profesional].", "Vanidad vs negocio", "Pérdida"], [209, "Medí cuántas horas paso en [actividad que parece trabajo]. El número fue [número incómodo].", "Auditoría con números", "Evidencia"], [210, "Estaba [acción abrumadora] cuando debería haber estado [acción simple más efectiva].", "Vanidad vs negocio", "Pérdida"], [211, "[Fuente de inspiración del nicho] te da [ilusión positiva]. No te da [lo que realmente necesitas].", "Vanidad vs negocio", "Pérdida"], [212, "Cada [elemento creativo/técnico] en tu [canal/producto] que no [acción deseada del cliente] es [distracción/obstáculo].", "Reframe del problema", "Pérdida"], [213, "[Señal que parece positiva] usualmente significa [problema oculto más serio].", "Diagnóstico oculto", "Pérdida"], [214, "Dejé de [preocuparme por elemento] cuando empecé a [medir elemento más importante].", "Vanidad vs negocio", "Pérdida"], [215, "[Recurso visible] es vanidad. [Métrica oculta] es negocio. Yo solo miro [métrica oculta].", "Vanidad vs negocio", "Pérdida"], [216, "[Plataforma/fuente] me manda [cantidad impresionante de métrica de vanidad]. Pero [otra fuente menos sexy] me manda el [porcentaje alto] de [métrica de negocio].", "Vanidad vs negocio", "Pérdida"], [217, "Dejé de [perseguir métrica de vanidad] y empecé a [optimizar métrica real]. [Resultado temporal negativo]. [Resultado final positivo].", "Vanidad vs negocio", "Pérdida"], [218, "Si [situación preocupante] pero [métrica de negocio está bien], [solución contraintuitiva].", "Verdad contraintuitiva", "Ruptura"], [219, "[Opción sofisticada/cara] rara vez supera a [opción simple/barata] bien [ejecutada].", "Solución simple / humilde", "Evidencia"], [220, "La [herramienta/sistema popular] que todos usan tiene un problema: [limitación crítica para el contexto].", "Trampa de plataforma", "Pérdida"], [221, "[Inversión grande] no compensa [fundamento faltante].", "Solución simple / humilde", "Evidencia"], [222, "Gasté $[cantidad] en [solución sofisticada]. Un [solución simple de bajo costo] hubiera hecho lo mismo.", "Solución simple / humilde", "Evidencia"], [223, "Antes de [compra/decisión grande], [acción de validación simple] que cuesta [poco o nada].", "Solución simple / humilde", "Evidencia"], [224, "[Cosa con la que estás luchando] tiene [solución sorprendentemente simple] pero nadie te la dice porque [razón de incentivos].", "Solución simple / humilde", "Evidencia"], [225, "[Analogía de peso físico] para [carga mental/operativa]", "Analogía", "Ruptura"], [226, "[Analogía de batería/energía] para [recurso de atención/decisión]", "Analogía", "Ruptura"], [227, "[Analogía de digestión] para [capacidad de procesamiento]", "Analogía", "Ruptura"], [228, "[Reacción física] indica [estado de negocio/decisión]. Si sientes [síntoma], probablemente [diagnóstico].", "Diagnóstico oculto", "Pérdida"], [229, "[Concepto técnico/negocio] es como [proceso biológico]: [conexión que ilumina].", "Analogía", "Ruptura"], [230, "Tu [área del negocio] te está mandando [señal tipo dolor físico]. Ignorarla tiene el mismo resultado que [ignorar síntoma físico].", "Analogía", "Ruptura"], [231, "[Persona/rol] que [acción repetitiva visible] es como [animal con comportamiento característico]. Parece [adjetivo] pero es [explicación estratégica].", "Analogía", "Ruptura"], [232, "Tenemos [comportamiento disfuncional del nicho] con [concepto]. Nos aferramos a [cosa que no funciona] como [comportamiento animal].", "Analogía", "Ruptura"], [233, "La [lógica simplista del nicho] ignora que [realidad compleja]. Es como [analogía animal absurda].", "Analogía", "Ruptura"], [234, "[Tendencia observable en muchos ejemplos]. Lo noté después de [cantidad] de [experiencias].", "Auditoría con números", "Evidencia"], [235, "Hay un patrón en [grupo específico]: [observación específica]. [Cantidad]% hacen [comportamiento] que [consecuencia].", "Auditoría con números", "Evidencia"], [236, "Estudié [cantidad] de [elementos] por [período]. [El hallazgo más sorprendente] fue [descubrimiento].", "Auditoría con números", "Evidencia"], [237, "Este screenshot vale más que [cantidad de información alternativa]. [Descripción de lo que muestra].", "Auditoría con números", "Evidencia"], [238, "[Señalar elemento específico] en esta imagen. Eso es [la causa oculta del problema/éxito].", "Auditoría con números", "Evidencia"], [239, "Una imagen de [elemento mundano específico] me enseñó más sobre [tema] que [fuente obvia de aprendizaje].", "Objeto mundano revelador", "Ruptura"], [240, "[Práctica/creencia aceptada en el nicho] suena lógico hasta que [dato o ejemplo que lo contradice].", "Mito vs realidad", "Ruptura"], [241, "Lo opuesto de [consejo común del nicho] es cierto cuando [condición específica].", "Mito vs realidad", "Ruptura"], [242, "Todo el mundo dice [consejo popular]. Pero [la excepción importante] que nadie menciona.", "Mito vs realidad", "Ruptura"], [243, "Pensé que [logro/métrica] era mi mayor momento. Era la señal de [problema serio que venía].", "Reframe del problema", "Pérdida"], [244, "[Dato/resultado que parece éxito] me tenía ciega ante [problema real que causaba].", "Reframe del problema", "Pérdida"], [245, "El día que [momento de éxito aparente] fue el mismo día que [comienzo de problema serio].", "Reframe del problema", "Pérdida"], [246, "La frase exacta que hizo que [cliente/audiencia] [acción deseada] fue \"[frase específica simple]\".", "La frase exacta", "Evidencia"], [247, "Cambié \"[frase débil]\" por \"[frase fuerte]\". [Resultado medible].", "La frase exacta", "Evidencia"], [248, "El [tipo de cliente] que [acción de compra] respondió a \"[frase específica]\", no a [intento anterior].", "La frase exacta", "Evidencia"], [249, "[Línea 1]. [Línea 2]. [Línea 3 con resultado].", "Escena / narrativa", "Identidad"], [250, "Problema: [situación inicial]. Cambio: [una acción específica]. Resultado: [métrica].", "Antes / después", "Evidencia"], [251, "[Cantidad] de [tiempo]. [Una acción]. [Resultado que parece desproporcionado].", "Antes / después", "Evidencia"], [252, "Por favor no [acción dañina específica]. Lo hice y [consecuencia concreta].", "Confesión / experimento", "Identidad"], [253, "Si estás a punto de [decisión tentadora], [advertencia específica basada en experiencia].", "Confesión / experimento", "Identidad"], [254, "[Te imploro/suplico] que evites [error específico] hasta que [condición de madurez].", "Confesión / experimento", "Identidad"], [255, "[Frase conocida del nicho] pero reemplazando [palabra débil] por [palabra más precisa/fuerte].", "La frase exacta", "Evidencia"], [256, "[Frase cliché] es mentira. [Versión mejorada con una palabra cambiada] es verdad.", "Mito vs realidad", "Ruptura"], [257, "[Verbo aburrido] no alcanza. Necesitas [verbo más específico y visceral].", "La frase exacta", "Evidencia"], [258, "Esto parece insignificante, pero [detalle pequeño específico] es la diferencia entre [resultado mediocre] y [resultado excelente].", "Diagnóstico oculto", "Pérdida"], [259, "[Detalle técnico/operativo] suena aburrido hasta que te das cuenta de que [impacto en dinero/tiempo].", "Diagnóstico oculto", "Pérdida"], [260, "El [elemento que otros ignoran] de tu [sistema/producto] está haciendo [trabajo pesado oculto].", "Diagnóstico oculto", "Pérdida"], [261, "Nadie es inmune a [verdad humana que aplica a todos en el nicho]. Ni tú, ni yo, ni [figura aspiracional].", "Emoción / vulnerabilidad", "Identidad"], [262, "[Comportamiento universal] no es debilidad. Es [nombre más preciso que normaliza].", "Emoción / vulnerabilidad", "Identidad"], [263, "[Experiencia incómoda común] le pasa a todo el mundo. [La diferencia entre éxito y fracaso] está en [acción específica después].", "Emoción / vulnerabilidad", "Identidad"], [264, "[Concepto abstracto] es básicamente [versión física/tangible].", "Analogía", "Ruptura"], [265, "Piensa en [concepto del nicho] como [objeto/espacio físico]. Cada [elemento que agregas] es [carga física].", "Analogía", "Ruptura"], [266, "[Tarea mental/abstracta] es tan agotadora como [actividad física equivalente]. Por eso [consecuencia/recomendación].", "Analogía", "Ruptura"], [267, "Si tuviera que empezar de cero mañana, [la primera acción específica] sería [acción específica], no [lo que la mayoría haría].", "Si empezara de cero", "Identidad"], [268, "Con $[cantidad pequeña] y [tiempo corto], haría [acción 1], [acción 2], y [acción 3]. En ese orden.", "Si empezara de cero", "Identidad"], [269, "Lo que haría diferente: menos [cosa que parece importante] y más [cosa que realmente importa].", "Si empezara de cero", "Identidad"], [270, "Tu [métrica preocupante] probablemente tiene más que ver con [causa no obvia] que con [causa obvia que culpas].", "Diagnóstico oculto", "Pérdida"], [271, "El test de [algo] te mintió porque [condición que invalida el resultado]. En realidad, [lo que deberías estar mirando].", "Mito vs realidad", "Ruptura"]];
const PROMPTS = [{"n": "P1", "title": "Imagen UGC del producto desde referencia", "cat": "Producción / Imagen", "que": "Genera una imagen del producto en uso, copiando pose/encuadre/luz de una imagen de referencia.", "text": "Quiero una imagen de mi [PRODUCTO] con el estilo de la imagen de referencia: misma pose, encuadre y luz natural tipo UGC. Sin textos ni placeholders. Solo el producto en uso."}, {"n": "P2", "title": "Investigación de competidores en Meta Ads", "cat": "Investigación", "que": "Lista competidores activos en Meta para modelar sus ofertas, hooks y creatividades.", "text": "Quiero que me identifiques competidores activos y relevantes en Meta Ads para analizar y modelar sus estrategias publicitarias, ofertas, hooks y creatividades.\n\nInformación de mi negocio:\n- Industria/Nicho: [especificar]\n- Producto o servicio: [especificar]\n- Público objetivo: [edad, género, ubicación, intereses]\n- Modelo de negocio: [e-commerce, leads, SaaS, info-producto, etc.]\n- Precio promedio: [especificar]\n- Diferenciales principales frente a la competencia: [especificar]\n\nQué quiero que hagas:\n- Buscar y listar competidores relevantes en el país/mercado donde quiero anunciarme.\n- Incluir: nombre de la marca, enlace al sitio, enlace a Instagram/Facebook, breve descripción de su oferta y ángulo de posicionamiento.\n- Identificar si están activos en Meta Ads (o si tienen presencia relevante en redes).\n- Sugerirme qué hooks, ángulos o tipos de creatividades utilizan que podría considerar.\n\nCuando te envíe este prompt completado, realizá la investigación y entregame un listado claro y accionable para planificar mis Ads en Meta."}, {"n": "P3", "title": "15 hooks de alta conversión (con investigación)", "cat": "Hooks", "que": "Investiga reseñas/foros/social y genera 15 hooks como titulares de ads + justificación psicológica.", "text": "Eres un copywriter de respuesta directa y estratega de marketing de clase mundial. Te especializas en crear hooks publicitarios de alta conversión mediante investigación profunda de tendencias, disparadores psicológicos y ángulos probados.\n\nInformación de producto y avatar:\n#descripciónproducto\n#descripciónavatar\n\nInvestiga en anuncios de alto rendimiento, reseñas, foros (Reddit, Quora), social (comentarios YouTube/TikTok/Twitter) y ejemplos de eCommerce.\n\nTarea:\n- Identificar disparadores emocionales clave, deseos no satisfechos o problemas urgentes del mercado objetivo.\n- Modelar estilos de hooks de alto rendimiento (preguntas, afirmaciones atrevidas, curiosidad, controversia, prueba social, desafío).\n- Escribir 15 hooks como titulares (máx. 150 caracteres c/u), que capten atención en 1.5 s.\n- Para cada hook, 1 frase de justificación según la investigación.\n- (Opcional) Sugerir 3 ángulos para duplicar esfuerzos si escalás a audiencias frías.\n\nEtiquetá las secciones: Resumen de Investigación · 15 Hooks de Alta Conversión · Psicología de Cada Hook · Ángulos Publicitarios.\nSé conciso pero profundo. Prioriza impacto emocional/psicológico probado. Evita relleno genérico."}, {"n": "P6", "title": "Hooks que subvierten patrones narrativos", "cat": "Hooks", "que": "Identifica patrones narrativos familiares y los rompe entre la palabra 5 y 8 (codificación predictiva).", "text": "Necesito un hook para [producto/servicio] que use estructuras de historias conocidas pero las subvierta de forma inesperada.\n\nActúa como copywriter experto en psicología narrativa. Primero identifica 3 patrones narrativos comunes que mi audiencia [descripción] reconozca al instante en [industria].\n\nPara cada patrón:\n- Crea 2 hooks que empiecen con ese patrón familiar pero introduzcan una sorpresa entre la palabra 5 y 8.\n- Que la sorpresa se conecte con el beneficio principal del producto.\n- Intelectualmente intrigantes y emocionalmente resonantes. Menos de 20 palabras.\n\nPara cada hook explica: qué patrón interrumpís, qué tensión psicológica genera, cómo esa tensión despierta curiosidad, por qué sería efectivo con esta audiencia.\n\nAntes de generar, hazme preguntas específicas sobre producto, audiencia, beneficio principal, industria y tono de marca."}, {"n": "P7", "title": "10 hooks que detienen el scroll", "cat": "Hooks", "que": "10 hooks que desafían una creencia común, cada uno con un disparador psicológico distinto.", "text": "Eres un copywriter especializado en hooks que interrumpen patrones y detienen el scroll. Necesito hooks para [producto/servicio] que conecten con [descripción detallada de la audiencia].\n\nLos hooks deben: desafiar una creencia común de esta audiencia, generar curiosidad inmediata, usar patrones de lenguaje que resuenen, tener menos de 15 palabras siempre que sea posible.\n\nGenera 10 hooks distintos, cada uno usando un disparador psicológico diferente (escasez, prueba social, identidad, etc.) y explica por qué funcionaría con esta audiencia.\n\nAntes de generar, hazme preguntas específicas sobre producto, audiencia, sus creencias y tono de marca."}, {"n": "P4", "title": "Ángulos de Identidad", "cat": "Ángulos Publicitarios", "que": "Posicionan el producto como algo que refuerza/eleva la identidad del comprador (pertenencia, estatus, buen gusto).", "text": "Estoy creando textos publicitarios y necesito ayuda con ángulos de identidad para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [su identidad, cómo se ven, a quién aspiran parecerse, con qué grupos se identifican]\n\nLos ángulos de identidad posicionan el producto como algo que refuerza o eleva la identidad del comprador. Les hace sentir que pertenecen, que están un paso adelante o que tienen buen gusto.\n\n- Entendé a qué grupo quiere pertenecer el comprador.\n- Escribí 5 ángulos que hagan que alguien se sienta visto, con estilo, seguro o en control.\n- Evitá la descripción técnica. Enfocate en confianza, estilo de vida, estatus.\n\nEjemplos de formato:\n- \"No solo me importa el bienestar — me gusta que se note sin esfuerzo\"\n- \"Todas las It Girls que sigo lo usan, así que tuve que probarlo\""}, {"n": "P5", "title": "Ángulos Críticos", "cat": "Ángulos Publicitarios", "que": "Para gente racional, enfocada en resultados: ahorro de dinero/tiempo, simplicidad, lógica. Sin hype.", "text": "Estoy escribiendo copys y necesito ayuda con ángulos críticos para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [prácticos, valoran eficiencia, ahorro, escépticos]\n\nLos ángulos críticos apelan a personas racionales, enfocadas en resultados. Resaltan ahorro de dinero, tiempo, simplicidad y lógica. Son directos.\n\n- Identificá cómo el producto ahorra tiempo, dinero o complicaciones.\n- Escribí 5 ángulos que suenen inteligentes, directos y sin exageraciones.\n- Evitá el hype. Apuntá a la lógica y el valor por el dinero.\n\nEjemplos de formato:\n- \"Más barato que una sola visita al salón — y actúa más rápido\"\n- \"¿Para qué complicarlo? Esto funciona. Punto.\""}, {"n": "P11", "title": "Ángulos Emocionales", "cat": "Ángulos Publicitarios", "que": "Apelan a sentimientos y transformaciones, con forma de testimonio/reseña (especialmente impacto en alguien querido).", "text": "Necesito ayuda para crear ángulos emocionales para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [edad, estilo de vida, valores, dolores emocionales, a quién cuidan]\n\nLos ángulos emocionales apelan a sentimientos, deseos, luchas o transformaciones — especialmente cuando impacta a alguien que quieren (pareja, padre/madre, hijx o su \"yo\" del pasado). Deben tener forma de historia y generar empatía.\n\n- Leé la página del producto y entendé los resultados emocionales que promete.\n- Escribí 5 ángulos emocionales que suenen a testimonios reales o reseñas de TikTok.\n- Evitá describir funciones; enfocate en cambios de vida, alivio y conexión emocional.\n\nEjemplos de formato:\n- \"Tenía miedo de salir sin maquillaje. Ahora ni me acuerdo de usarlo.\"\n- \"Se lo compré a mi mamá y me dijo que se sentía 10 años más joven.\""}, {"n": "P12", "title": "Ángulos Prácticos", "cat": "Ángulos Publicitarios", "que": "Se centran en problemas concretos que el producto resuelve y los resultados. Parten de la utilidad.", "text": "Necesito ayuda para generar ángulos prácticos para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [edad, hábitos, estilo de vida, casos típicos de uso]\n\nLos ángulos prácticos se centran en problemas concretos que el producto resuelve y los resultados que entrega. Apelan a la lógica; podés insinuar emociones, pero partí de la utilidad.\n\n- Identificá los principales dolores y soluciones de la página del producto.\n- Escribí 5 ángulos prácticos que expliquen qué hace el producto y por qué funciona.\n- Cada uno corto, enfocado en el beneficio, fácil de entender.\n\nEjemplos de formato:\n- \"Elimina el acné en 10 minutos al día, sin turnos ni clínicas\"\n- \"Diseñado para piel sensible. Efectivo desde el tercer uso\""}, {"n": "P8", "title": "Anuncios FB/IG con límites de caracteres", "cat": "Copy / Anuncios", "que": "Genera ads de tráfico frío en 6 formatos, respetando límites estrictos (Headline 40 / Description 40 / Primary Text 125).", "text": "Eres un copywriter senior de respuesta directa especializado en copy para anuncios de Facebook e Instagram para ecommerce. Genera anuncios de alta conversión para tráfico frío.\n\nInputs:\n- Nombre y descripción del producto: #PRODUCTNAME\n- Detalles de la oferta: #OFFER\n- Avatar del cliente: #AUDIENCE\n- Formato(s) preferido(s): #ADFORMAT\n- Voz de marca: #BRANDVOICE\n\nLímites: Headline máx 40 · Description máx 40 · Primary Text máx 125 caracteres.\n\nFormatos a elegir: 1) Problem-Solution · 2) Benefit-Focused · 3) Social Proof · 4) Story-Driven · 5) List-Style · 6) Urgency/Scarcity.\n\nReglas: asumir tráfico frío; estructura Hook → Dolor → Solución → Transformación → CTA; beneficios emocionales y prácticos; viñetas en List-Style; terminar con CTA claro; adaptar voz de marca; entregar solo el copy, sin explicaciones; múltiples variaciones; respetar límites de caracteres por bloque."}, {"n": "P9", "title": "Anuncio estilo historia", "cat": "Copy / Anuncios", "que": "Mini-relato (inicio/conflicto/solución/desenlace) que funciona como publicidad.", "text": "Eres un narrador creativo con experiencia en marketing. Redacta un anuncio para Facebook/Instagram que cuente una historia breve alrededor de [producto/servicio] para [público objetivo]. Estructura narrativa (inicio, conflicto, solución, desenlace) que a la vez sirva como publicidad.\n\nIncluí:\n- Título de la historia (ej. \"El día que [Nombre] descubrió [Producto]\").\n- Introducción: presentá al protagonista y su situación inicial; enganchá.\n- Conflicto/Desafío: el problema o frustración; que el lector se identifique. Breve pero emotivo.\n- Nudo: introducí [Producto] de forma natural; cómo lo prueba.\n- Clímax y Resolución: el resultado positivo; sentimientos de alivio/felicidad/logro.\n- Cierre con CTA narrativo: invitá al lector a ser el próximo protagonista.\n\nBreve pero completa (2-3 párrafos). Lenguaje emocional y cercano, como un testimonio sincero. Tono: [inspirador, amistoso, etc.]."}, {"n": "P10", "title": "Reescribir copy de un Canva (mismo conteo de caracteres)", "cat": "Copy / Anuncios", "que": "Detecta jerarquías de texto en un diseño de Canva y genera copys de reemplazo del mismo largo, sin romper el diseño.", "text": "Actúa como AI Copywriter experto en performance ads. Analiza la imagen de Canva que te envío y detectá:\n- Jerarquías de texto: Headline, Subheadline, Bullets/beneficios, Botón/CTA, Texto secundario, Disclaimer.\n- El tono (formal, casual, premium, motivacional, etc.).\n- El tipo de estructura (comparativo, testimonial, informativo, emocional, etc.).\n\nLuego generá NUEVOS COPYS de reemplazo alineados a MI PRODUCTO:\n- Exactamente la misma cantidad de caracteres (±5) por bloque, para no deformar el diseño.\n- Misma estructura, jerarquías y longitud aproximada. Lenguaje claro y persuasivo. CTA coherente.\n- De cada texto detectado, 4 variantes (todas dentro del rango de caracteres).\n\nTe entregaré: Nombre del producto · Público objetivo · Beneficios clave (3-5) · Problemas que resuelve · Tono · Imagen/descripción del Canva.\n\nOutput: por cada bloque, 4 variantes con conteo de caracteres; sugerencia de CTA y emojis si el tono lo permite; adaptación a comparativo/testimonial/informativo; listo para copiar/pegar en Canva."}];
const EJECOLOR = { Identidad:"#2E8B6B", Ruptura:"#6E3E94", "Pérdida":"#C5362B", Evidencia:"#C2861F" };

const PRESETS = [{ v: "today", l: "Hoy" }, { v: "last_7d", l: "Últimos 7 días" }, { v: "last_14d", l: "Últimos 14 días" }, { v: "last_30d", l: "Últimos 30 días" }, { v: "last_90d", l: "Últimos 90 días" }, { v: "this_month", l: "Este mes" }, { v: "last_month", l: "Mes pasado" }, { v: "maximum", l: "Máximo" }];

export default function App() {
  const [u, setU] = useState({ roasMin: 20, cpaMax: 3000, pisoSpend: 50000, costoMax: null });
  const [modo, setModo] = useState("ventas"); // ventas | mensajes
  const [goal, setGoal] = useState(0);
  const [sort, setSort] = useState({ key: "veredicto", dir: "asc" });
  const [view, setView] = useState("dash");
  const [role, setRole] = useState("vos");
  const [done, setDone] = useState(() => new Set());
  const toggle = (id) => setDone((d) => { const n = new Set(d); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState("");
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
  // la lectura del analista queda obsoleta si cambia el cliente/período/tienda → la limpiamos
  useEffect(() => { setAnalysis(null); setHookMatch(null); }, [account, preset, tnStore, cSince, cUntil, accCur]);
  useEffect(() => { setPlan(null); }, [account, tnStore, goal, accCur, tnCount]); // el plan depende de la meta, el mes, la moneda y el criterio de venta
  useEffect(() => { fetch("/api/fx").then((r) => r.json()).then((j) => setFx(j && j.rate ? j : null)).catch(() => setFx(null)); }, []);
  useEffect(() => { fetch("/api/sheets/tabs").then((r) => r.json()).then((j) => setSheetTabs(j.tabs || [])).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/tiendanube/stores").then((r) => r.json()).then((j) => setTnStores(j.stores || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (!tnStore) { setTnSummary(null); return; }
    let cancelled = false;
    setTnLoading(true);
    fetch("/api/tiendanube/summary?store=" + encodeURIComponent(tnStore) + "&preset=" + preset + "&count=" + tnCount + (account ? "&account=" + account + "&accCur=" + accCur : "") + customRange)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setTnSummary(j.error ? null : j); })
      .catch(() => { if (!cancelled) setTnSummary(null); })
      .finally(() => { if (!cancelled) setTnLoading(false); });
    return () => { cancelled = true; };
  }, [tnStore, account, preset, customRange, accCur, tnCount]);
  useEffect(() => {
    if (!account) { setData([]); setAudiencias([]); setErr(""); return; }
    if (preset === "custom" && !(cSince && cUntil)) return; // esperá a que cargue las dos fechas
    let cancelled = false;
    setLoading(true); setErr("");
    fetch("/api/ads?account=" + account + "&preset=" + preset + (sheetTab ? "&tab=" + encodeURIComponent(sheetTab) : "") + customRange)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) throw new Error(j.error);
        setData(j.rows || []);
        setAudiencias(j.audiencias || []);
        if (!j.rows || !j.rows.length) setErr("sin datos en el rango");
      })
      .catch((e) => { if (!cancelled) setErr(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [account, preset, sheetTab, customRange]);

  // Umbral EFECTIVO: un umbral vacío (null) deja de ser condición. roasMin→0 (sin mínimo),
  // cpaMax→∞ (sin tope), pisoSpend→0 (sin piso). Así filtrás solo por los que cargaste.
  const ueff = useMemo(() => ({
    roasMin: u.roasMin == null ? 0 : u.roasMin,
    cpaMax: u.cpaMax == null ? Infinity : u.cpaMax,
    pisoSpend: u.pisoSpend == null ? 0 : u.pisoSpend,
    costoMax: u.costoMax == null ? Infinity : u.costoMax,
  }), [u]);
  // Conversión a pesos: multiplicamos los montos de Meta (spend, cpa, costo/conv) por el dólar.
  // ROAS (ratio), ventas y conversaciones (conteos) no se tocan. Todo lo de abajo (stats, top,
  // dash, panel, cerebro) hereda pesos automáticamente sin más cambios.
  const dataConv = useMemo(() => fxRate === 1 ? data : data.map((r) => ({
    ...r,
    spend: r.spend * fxRate,
    cpa: r.cpa ? r.cpa * fxRate : r.cpa,
    costoConv: r.costoConv ? r.costoConv * fxRate : r.costoConv,
    breakdown: (r.breakdown || []).map((b) => ({ ...b, spend: b.spend * fxRate })),
  })), [data, fxRate]);
  // Las audiencias (ranking por targeting real) también traen plata de Meta → mismo factor.
  const audConv = useMemo(() => fxRate === 1 ? audiencias : audiencias.map((g) => ({
    ...g, spend: g.spend * fxRate, revenue: g.revenue * fxRate,
  })), [audiencias, fxRate]);
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
    withV.forEach((r) => {
      counts[r.v]++; spendTotal += r.spend; simpleSum += r.roas; revenue += r.spend * r.roas; ventasTotal += r.ventas; convTotal += (r.conversaciones || 0);
      if (r.spend >= ueff.pisoSpend) { wSpend += r.spend; wRoas += r.spend * r.roas; }
    });
    const topAds = [...withV].filter((r) => r.spend >= ueff.pisoSpend).sort((a, b) => modo === "mensajes" ? (a.costoConv || 9e12) - (b.costoConv || 9e12) : b.roas - a.roas).slice(0, 6);
    return { counts, spendTotal, revenue, ventasTotal, convTotal, costoConvProm: convTotal ? spendTotal / convTotal : 0, roasSimple: withV.length ? simpleSum / withV.length : 0, roasConfiable: wSpend ? wRoas / wSpend : 0, cpaProm: ventasTotal ? spendTotal / ventasTotal : 0, accountRoas: spendTotal ? revenue / spendTotal : 0, topAds };
  }, [withV, ueff.pisoSpend, modo]);

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
          <div className="client"><div className="clabel">▦ CLIENTE</div><select className="cselect" value={account} onChange={(e) => setAccount(e.target.value)}><option value="">— elegí un cliente —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}</select><select className="cselect" value={sheetTab} onChange={(e) => setSheetTab(e.target.value)}><option value="">— pestaña sheet —</option>{sheetTabs.map((t) => <option key={t.gid} value={t.title}>{t.title}</option>)}</select><select className="cselect" value={preset} onChange={(e) => setPreset(e.target.value)}><option value="today">Hoy</option><option value="yesterday">Ayer</option><option value="last_7d">Últimos 7 días</option><option value="last_14d">Últimos 14 días</option><option value="last_30d">Últimos 30 días</option><option value="last_90d">Últimos 90 días</option><option value="this_month">Este mes</option><option value="last_month">Mes pasado</option><option value="maximum">Máximo</option><option value="custom">Personalizado…</option></select>{preset === "custom" && <span className="daterange"><input type="date" className="cdate" value={cSince} max={cUntil || undefined} onChange={(e) => setCSince(e.target.value)} /><i>→</i><input type="date" className="cdate" value={cUntil} min={cSince || undefined} onChange={(e) => setCUntil(e.target.value)} /></span>}{tnStores.length > 0 &&<select className="cselect" value={tnStore} onChange={(e) => setTnStore(e.target.value)}><option value="">— sin tienda nube —</option>{tnStores.map((s) => <option key={s.name} value={s.name}>🛒 {s.name}</option>)}</select>}<div className="cmeta">{loading ? "cargando…" : err ? err : account ? ("● data en vivo · " + data.length + " creativos") : "— elegí un cliente —"}</div></div>
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
                <div className="tnstat"><div className="tnlab">INVERSIÓN META</div><div className="tnval">{account ? money(tnSummary.fx && !tnSummary.fx.error ? tnSummary.inversionConv : tnSummary.inversion) : "—"}</div><div className="tnsub">{!account ? "elegí el cliente de Meta" : tnSummary.fx && !tnSummary.fx.error ? ("USD " + money(tnSummary.inversion) + " · " + tnSummary.fx.fuente + " $" + nf.format(Math.round(tnSummary.fx.rate))) : tnSummary.fx && tnSummary.fx.error ? ("⚠ no pude cotizar el dólar — MER sin convertir") : ("ROAS pixel " + (tnSummary.roasMeta || 0).toFixed(1) + "x")}</div></div>
                <div className="tnstat tnmer"><div className="tnlab">MER (FACT / INV)</div><div className="tnval">{tnSummary.mer != null ? tnSummary.mer.toFixed(2) + "x" : "—"}</div><div className="tnsub">{tnSummary.criterio === "no_canceladas" ? ("pagadas: " + money(tnSummary.facturacionPagada) + " (" + tnSummary.ordersPagadas + ") · pendientes: " + money(tnSummary.facturacionPendiente) + " (" + tnSummary.ordersPendientes + ")") : tnSummary.ordersPendientes ? ("+ " + money(tnSummary.facturacionPendiente) + " pendientes (" + tnSummary.ordersPendientes + " órd.) sin contar") : "facturación / inversión"}</div></div>
              </div>
              <div className="tnnote">{tnSummary.criterio === "no_canceladas"
                ? "MER = facturación de TODAS las órdenes no canceladas (pagadas + pendientes de pago, sin las de pago anulado — criterio interno del cliente) dividida la inversión en Meta, mismo período. Mide la eficiencia global del marketing, no solo lo atribuido al pixel."
                : "MER = facturación COBRADA de la tienda (órdenes pagadas, igual que Tienda Nube) dividida la inversión en Meta, mismo período. Las pendientes de pago no suman al titular. Mide la eficiencia global del marketing, no solo lo atribuido al pixel."}</div>
            </>
          )}
        </section>
      )}

      <div className="rolebar">
        <span className="rlabel">▶ VISTA</span>
        <div className="rolebtns">
          {Object.keys(ROLES).map((k) => <button key={k} className={"rolebtn" + (role === k ? " on" : "")} onClick={() => setRole(k)}>{k.toUpperCase()}</button>)}
        </div>
        <span className="rdesc">{ROLES[role]}</span>
        <div className="rolebarright">
          <div className="modobox"><span className="rlabel">◉ MEDIR</span><button className={"modotgl" + (modo === "ventas" ? " on" : "")} onClick={() => setModo("ventas")}>VENTAS</button><button className={"modotgl" + (modo === "mensajes" ? " on" : "")} onClick={() => setModo("mensajes")}>MENSAJES</button></div>
          {account && modo === "ventas" && (
            <div className="modobox"><span className="rlabel">$ MONEDA CUENTA</span>
              <button className={"modotgl" + (accCur === "ARS" ? " on" : "")} onClick={() => setCurForce("ARS")}>PESOS</button>
              <button className={"modotgl" + (accCur === "USD" ? " on" : "")} onClick={() => setCurForce("USD")}>USD</button>
              <span className="curhint">{(curForce ? "manual" : (curDetected ? "auto · Meta " + curDetected : "auto")) + (accCur === "USD" ? (convirtiendo ? " · todo en $ARS @ $" + nf.format(Math.round(fxRate)) : " · ⚠ sin cotización") : "")}</span>
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
            <button className={"tab" + (effView === "top" ? " active" : "")} onClick={() => setView("top")}>TOP PERFORMERS</button>
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
              <div className="uhint">{locked ? "🔒 definido por la cuenta · no editable" : "cambiá los valores · todo recalcula en vivo"}</div>
            </section>
          )}

          {effView === "an" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Analisis withV={withV} stats={stats} audiencias={audConv} tnSummary={tnSummary} u={ueff} accountName={(accounts.find((a) => a.id === account) || {}).name || ""} periodo={preset === "custom" && cSince && cUntil ? cSince + " → " + cUntil : preset} analysis={analysis} setAnalysis={setAnalysis} modo={modo} account={account} />)}
          {effView === "plan" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Plan account={account} store={tnStore} goal={goal} plan={plan} setPlan={setPlan} modo={modo} accCur={accCur} count={tnCount} />)}
          {effView === "dash" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Dash stats={stats} goal={goal} setGoal={setGoal} factTienda={tnSummary ? tnSummary.facturacion : null} tnStore={tnStore} modo={modo} />)}
          {effView === "hoy" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Hoy acc={acciones} u={ueff} done={done} toggle={toggle} total={totalTasks} doneCount={doneCount} mantener={stats.counts.Mantener} modo={modo} />)}
          {effView === "top" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Top withV={withV} u={ueff} audData={audConv} modo={modo} />)}
          {effView === "panel" && (!withV.length ? <EmptyState account={account} loading={loading} err={err} /> : <Panel rows={rows} stats={stats} sort={sort} setSortKey={setSortKey} modo={modo} />)}
          {effView === "bib" && <Biblioteca rows={withV} hookMatch={hookMatch} setHookMatch={setHookMatch} />}
          {effView === "gen" && <Generar rows={withV} accountName={(accounts.find((a) => a.id === account) || {}).name || ""} />}
          {effView === "chat" && (!account ? <EmptyState account={account} loading={loading} err={err} /> : <Chat account={account} accountName={(accounts.find((a) => a.id === account) || {}).name || ""} store={tnStore} tab={sheetTab} accCur={accCur} criterio={tnCount} />)}
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
                      <div className="rexhead"><b>{m.nombre}</b><TF r={m} /><Paused r={m} /> <span className="rexkpi">{msg ? (money(m.costoConv) + "/conv · " + short(m.spend) + " · " + nf.format(m.conversaciones) + " conv") : (m.roas.toFixed(1) + "x · " + short(m.spend) + " · " + nf.format(m.ventas) + " vtas")}</span></div>
                      {(m.breakdown || []).map((b, j) => (
                        <div className="rexline" key={j}><span className="rexcamp">{b.campaign}</span> › <span className="rexset">{b.adset}</span>{b.aud ? <span className="rexaud">{b.aud}</span> : null}<span className="rexmeta">{short(b.spend)} · {msg ? (nf.format(b.ventas) + " vtas") : (nf.format(b.ventas) + " vtas · " + b.roas.toFixed(1) + "x")}</span></div>
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

// ─────────── Vista: PREGUNTAR (chat capado a los datos de la cuenta) ───────────
// Preguntas en lenguaje natural sobre la cuenta (Meta + Tienda Nube + planilla). El backend
// (/api/chat) corre tool-use con herramientas read-only scopeadas a esta cuenta: no puede
// responder nada que no salga de esos datos. Historial por cliente en localStorage.
const CHAT_SUGS = [
  "¿Cuánto consume por día toda la cuenta?",
  "Listame los anuncios que más consumieron",
  "Top 10 productos más vendidos en los últimos 60 días",
  "¿Qué familia de hooks rinde mejor según la planilla?",
];
function Chat({ account, accountName, store, tab, accCur, criterio = "" }) {
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
        body: JSON.stringify({ account, accountName, store, tab, accCur, criterio, messages: next.slice(-12) }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      saveMsgs([...next, { role: "assistant", content: d.text }].slice(-30));
    } catch (e) { setErr("No se pudo responder: " + e.message); } finally { setLoading(false); }
  };
  const limpiar = () => saveMsgs([]);

  return (
    <section className="an">
      <div className="anhead">
        <div><div className="antitle">▸ PREGUNTALE A LA CUENTA</div><div className="ansub">Preguntas en lenguaje natural sobre {accountName || "la cuenta"}: Meta{store ? " + 🛒 " + store : ""}{tab ? " + planilla " + tab : ""}. Solo contesta sobre estos datos — nada más.</div></div>
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
function Analisis({ withV, stats, audiencias, tnSummary, u, accountName, periodo, analysis, setAnalysis, modo = "ventas", account = "" }) {
  const out = analysis; // persiste en el padre: no se borra al cambiar de pestaña
  const setOut = setAnalysis;
  const msg = modo === "mensajes";
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

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
    return {
      modo, cuenta: accountName || "—", periodo,
      inversion: stats.spendTotal,
      ...(msg
        ? { conversaciones: stats.convTotal, costo_conv_prom: +stats.costoConvProm.toFixed(2) }
        : { ventas: stats.ventasTotal, cpa: Math.round(stats.cpaProm), roas_cuenta: +stats.accountRoas.toFixed(1), tienda: tnSummary ? { facturacion: tnSummary.facturacion, mer: tnSummary.mer, roas_pixel: +(tnSummary.roasMeta || 0).toFixed(1) } : null }),
      veredictos: stats.counts,
      umbral: msg ? { costo_conv_max: u.costoMax === Infinity ? null : u.costoMax, piso_spend: u.pisoSpend || null } : { roas_min: u.roasMin || null, cpa_max: u.cpaMax === Infinity ? null : u.cpaMax, piso_spend: u.pisoSpend || null },
      ranking: { angulo_venta: top("ang"), categoria: top("cat"), hook: top("hook"), audiencia: aud, formato: top("fmt") },
      sangrando: sangrado,
      top_activos: topActivos,
      receta_ganadora: b ? { angulo: b.sheet?.angulo || b.ang, categoria: b.ang, hook: b.sheet?.tipo_gancho || b.hook, audiencia: b.aud, formato: b.fmt, ...(msg ? { costo_conv: b.costoConv, conversaciones: b.conversaciones } : { roas: b.roas, ventas: b.ventas }), spend: b.spend, activa: b.activa !== false } : null,
    };
  }, [withV, stats, audiencias, tnSummary, u, accountName, periodo, msg, modo]);

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
function Plan({ account, store, goal, plan, setPlan, modo = "ventas", accCur = "ARS", count = "" }) {
  const msg = modo === "mensajes";
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  // Historial por cliente: localStorage + Upstash si está conectado (compartido entre máquinas)
  const [hist, saveHist] = useHistSync("hist_plan", account);
  const pedir = async () => {
    setLoading(true); setErr("");
    try {
      const qs = "account=" + account + (store ? "&store=" + encodeURIComponent(store) + "&count=" + count : "") + "&goal=" + goal + "&modo=" + modo + "&accCur=" + accCur;
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
function Dash({ stats, goal, setGoal, factTienda, tnStore, modo = "ventas" }) {
  const msg = modo === "mensajes";
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
      <section className="kpis dashk">
        {msg ? (<>
          <Kpi lab="CONVERSACIONES" val={nf.format(stats.convTotal)} mod="grn" /><Kpi lab="COSTO / CONV" val={money(stats.costoConvProm)} /><Kpi lab="INVERSIÓN" val={short(stats.spendTotal)} /><Kpi lab="CREATIVOS" val={nf.format(stats.counts.Escalar + stats.counts.Mantener + stats.counts.Pausar + stats.counts["Observación"])} />
        </>) : (<>
          <Kpi lab="FACTURACIÓN" val={short(stats.revenue)} /><Kpi lab="INVERSIÓN" val={short(stats.spendTotal)} /><Kpi lab="ROAS CUENTA" val={stats.accountRoas.toFixed(1) + "x"} mod="grn" /><Kpi lab="CPA PROMEDIO" val={money(stats.cpaProm)} /><Kpi lab="VENTAS" val={nf.format(stats.ventasTotal)} />
        </>)}
      </section>
      <section className="sect">
        <div className="secthead"><span className="sverb" style={{ background: "#1E1812", color: "#F4C24A" }}><span className="sq" style={{ background: "#F4C24A" }} />TOP</span><span className="stitle">TOP ADS DEL MES</span><span className="scount">{msg ? "por costo/conv · spend ≥ piso" : "por ROAS · spend ≥ piso"}</span></div>
        <div className="topgrid">
          {stats.topAds.map((r, i) => { const b = BUCKETS[r.v]; return (
            <div className="topcard" key={r.id} style={{ "--bar": b.color }}>
              <div className="tcardtop"><span className="trank">{String(i + 1).padStart(2, "0")}</span><span className="badge" style={{ background: b.bg, color: b.color }}><span className="sq" style={{ background: b.color }} />{r.v}</span></div>
              <div className="tname">{r.nombre} <span className="fmt">{r.fmt}</span><TF r={r} /><Paused r={r} /></div>{msg ? <div className="troas">{money(r.costoConv)}</div> : <div className="troas">{r.roas.toFixed(1)}<small>x</small></div>}<div className="tmeta mono">{msg ? (nf.format(r.conversaciones) + " conv · " + short(r.spend)) : (short(r.spend) + " spend · " + r.ang)}</div>
            </div>); })}
        </div>
      </section>
    </>
  );
}
function Kpi({ lab, val, mod }) { return <div className={"kpi" + (mod === "grn" ? " good" : "")}><div className="klab">{lab}</div><div className={"kval" + (mod === "grn" ? " grn" : "")}>{val}</div></div>; }

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
function Panel({ rows, stats, sort, setSortKey, modo = "ventas" }) {
  const msg = modo === "mensajes";
  return (
    <>
      <section className="kpis">
        <div className="kpi"><div className="klab">SPEND TOTAL</div><div className="kval">{short(stats.spendTotal)}</div></div>
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
                <td className="name">{r.nombre} <span className="fmt">{r.fmt}</span><TF r={r} /><Paused r={r} /></td>
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
.topgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.topcard{background:var(--paper2);border:2px solid var(--ink);border-left:7px solid var(--bar);border-radius:10px;padding:13px 15px;box-shadow:3px 3px 0 var(--ink);transition:transform .08s,box-shadow .08s;}
.topcard:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--ink);}
.tcardtop{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
.trank{font-family:'Anton',Impact,sans-serif;font-size:18px;color:var(--soft);letter-spacing:1px;}
.tname{font-weight:700;font-size:13.5px;line-height:1.2;}
.troas{font-family:'Anton',Impact,sans-serif;font-size:38px;line-height:1;margin-top:6px;color:var(--ink);}.troas small{font-size:18px;color:var(--soft);}
.tmeta{font-size:11px;color:var(--soft);margin-top:2px;}

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
.tnstats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.tnstat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:13px 15px;}
.tnstat.tnmer{background:rgba(46,139,107,.18);border-color:rgba(46,139,107,.5);}
.tnlab{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1.2px;color:#9A937F;margin-bottom:5px;}
.tnval{font-weight:700;font-size:26px;line-height:1;letter-spacing:-.5px;}
.tnsub{font-family:'Space Mono',monospace;font-size:10.5px;color:#9A937F;margin-top:6px;}
.tnnote{font-family:'Space Mono',monospace;font-size:10.5px;color:#7A7259;margin-top:11px;line-height:1.4;}
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
