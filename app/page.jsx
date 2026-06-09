"use client";
import { useState, useMemo, useEffect } from "react";

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

function veredicto(r, u) {
  if (r.spend < u.pisoSpend) return "Observación";
  if (r.roas >= u.roasMin && r.cpa <= u.cpaMax) return "Escalar";
  if (r.roas >= u.roasMin * 0.85 && r.cpa <= u.cpaMax * 1.4) return "Mantener";
  return "Pausar";
}

function aggregate(rows, dim) {
  const m = {};
  const add = (key, w, r) => {
    if (!key || key === "—") return;
    if (!m[key]) m[key] = { key, spend: 0, revenue: 0, ventas: 0, n: 0 };
    m[key].spend += r.spend * w; m[key].revenue += r.spend * r.roas * w; m[key].ventas += r.ventas * w; m[key].n += 1;
  };
  rows.forEach((r) => {
    if (dim === "ang") {
      const [p, s] = (r.split || "100/0").split("/").map(Number);
      add(r.ang, p / 100, r); if (r.sec && r.sec !== "—") add(r.sec, s / 100, r);
    } else add(dim === "aud" ? r.aud : dim === "hook" ? r.hook : r.fmt, 1, r);
  });
  return Object.values(m).map((g) => ({ ...g, roas: g.spend ? g.revenue / g.spend : 0 })).sort((a, b) => b.roas - a.roas);
}

const nf = new Intl.NumberFormat("es-AR");
const money = (n) => "$" + nf.format(Math.round(n));
const short = (n) => { n = Math.round(n); if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(1).replace(".0", "") + "M"; if (Math.abs(n) >= 1e3) return "$" + Math.round(n / 1e3) + "k"; return "$" + nf.format(n); };
// Fingerprint de tiempo (HH.MM.SS) que identifica cada creativo. Vive en row.id ("concepto (HH.MM.SS)").
const tf = (r) => { const m = String(r?.id || "").match(/\((\d{1,2}\.\d{2}\.\d{2})\)/); return m ? m[1] : null; };
const TF = ({ r }) => tf(r) ? <span className="tf">{tf(r)}</span> : null;

const ROLES = { vos: "control total · todo editable", equipo: "ejecución del día · umbral bloqueado", cliente: "reporte limpio para compartir" };

const HOOKS = [[1, "¿Tienes problemas con (punto complicado)?", "Pregunta / curiosidad", "Ruptura"], [2, "¿Cómo reaccionarías si (una situación improbable)?", "Pregunta / curiosidad", "Ruptura"], [3, "¿Alguna vez has pensado que (diseño inesperado)?", "Pregunta / curiosidad", "Ruptura"], [4, "¿Qué pasaría si te dijera que hay una manera fácil de (resultado deseado)?", "Pregunta / curiosidad", "Ruptura"], [5, "¿Por qué nadie habla de (relacionado con tu negocio o nicho)?", "Pregunta / curiosidad", "Ruptura"], [6, "¿Qué pasaría si pudieras (resultado deseado)?", "Pregunta / curiosidad", "Ruptura"], [7, "Imagina si pudieras (resultado deseado)", "Pregunta / curiosidad", "Ruptura"], [8, "¿Y si (resultados deseados) estuvieran a solo un paso?", "Pregunta / curiosidad", "Ruptura"], [9, "¿Soy solo yo, o (acción)?", "Pregunta / curiosidad", "Ruptura"], [10, "¿Cuál sería tu reacción si (situación inesperada)?", "Pregunta / curiosidad", "Ruptura"], [11, "No necesitas [cosa/acción en tu nicho]", "Negación / contrarian", "Ruptura"], [12, "Olvida todo lo que sabes sobre [tema en tu nicho]", "Negación / contrarian", "Ruptura"], [13, "Deja de [acción común]", "Negación / contrarian", "Ruptura"], [14, "[Número] errores que debes evitar si quieres [objetivo]", "Error / advertencia", "Pérdida"], [15, "Cómo perdí [estadística en tu nicho]", "Transformación / proceso", "Identidad"], [16, "¿Por qué nadie habla de...?", "Pregunta / curiosidad", "Ruptura"], [17, "Este es el peor [elemento en tu nicho]", "Opinión controvertida", "Ruptura"], [18, "El secreto para [objetivo en tu nicho]", "Secreto / revelación", "Ruptura"], [19, "Odio [elemento popular]", "Opinión controvertida", "Ruptura"], [20, "Me vas a odiar por decir esto", "Opinión controvertida", "Ruptura"], [21, "Esto debería ser ilegal...", "Opinión controvertida", "Ruptura"], [22, "Aquí hay un truco para [objetivo]", "Secreto / revelación", "Ruptura"], [23, "[Tendencia en tu nicho] está muerta, aquí está el por qué", "Opinión controvertida", "Ruptura"], [24, "Va a ser controversial, pero [cuestionando opiniones mayoritarias]", "Opinión controvertida", "Ruptura"], [25, "No estarás de acuerdo conmigo, pero...", "Opinión controvertida", "Ruptura"], [26, "La verdad sobre [tema controversial]", "Opinión controvertida", "Ruptura"], [27, "¿Qué haces para [objetivo]?", "Pregunta / curiosidad", "Ruptura"], [28, "¿Quieres saber [objetivo]?", "Pregunta / curiosidad", "Ruptura"], [29, "Aquí está por qué [problema en tu nicho]", "Secreto / revelación", "Ruptura"], [30, "Cómo pasé de [X resultado] a [X resultado] en [tiempo establecido]", "Transformación / proceso", "Identidad"], [31, "Este video es solo para [audiencia objetivo]", "Filtro de audiencia", "Identidad"], [32, "¿Qué harías si...?", "Pregunta / curiosidad", "Ruptura"], [33, "¿Por qué el 99% de (problema de la audiencia) no (conexión con la audiencia)?", "Dato / estadística", "Evidencia"], [34, "X% de (audiencia) son (problemático)", "Dato / estadística", "Evidencia"], [35, "Es por eso que X% de (audiencia) fallan después de (tiempo)", "Dato / estadística", "Evidencia"], [36, "Este error te costará millones...", "Error / advertencia", "Pérdida"], [37, "Probé cada (consejo, método), para que tú no tengas que hacerlo", "Prueba social / viralidad", "Evidencia"], [38, "(Consejo) que me hubiera gustado saber antes", "Secreto / revelación", "Ruptura"], [39, "¿Qué pasa cuando (resultado esperado)?", "Pregunta / curiosidad", "Ruptura"], [40, "Descubramos por qué (problema de tu objetivo)", "Secreto / revelación", "Ruptura"], [41, "Aquí está cómo (resultado esperado)", "Solución / facilidad", "Pérdida"], [42, "Revelo mi secreto para (resultado esperado)", "Secreto / revelación", "Ruptura"], [43, "Cómo conseguir (resultado esperado) en (duración)", "Solución / facilidad", "Pérdida"], [44, "Aquí está por qué tu (acción) no da resultados", "Diagnóstico oculto", "Pérdida"], [45, "No me odies, pero aquí va (una verdad)", "Opinión controvertida", "Ruptura"], [46, "Todo lo que pensabas saber sobre (relacionado con tu objetivo) está 100% equivocado", "Mito vs realidad", "Ruptura"], [47, "Esto es lo único que necesitas saber sobre (relacionado con tu objetivo)", "Secreto / revelación", "Ruptura"], [48, "¿Sabías que (dato)?", "Dato / estadística", "Evidencia"], [49, "La cosa más loca acaba de suceder en (lugar); no lo vas a creer", "Dato / estadística", "Evidencia"], [50, "Dato curioso: (dato curioso)", "Dato / estadística", "Evidencia"], [51, "Esto va a cambiar la forma en que usas (relacionado con el objetivo)", "Secreto / revelación", "Ruptura"], [52, "Deja de hacer (objetivo) si quieres (resultado)", "Negación / contrarian", "Ruptura"], [53, "El mayor secreto sobre (resultado) que nadie te ha contado", "Secreto / revelación", "Ruptura"], [54, "Estos 3 (consejos) parecen ilegales de saber", "Lista / número", "Evidencia"], [55, "Este (problema) podría destruir (resultado) en 5 segundos", "Error / advertencia", "Pérdida"], [56, "Este (relacionado con el objetivo) es el país más peligroso en (lugar)", "Dato / estadística", "Evidencia"], [57, "Deja de hacer (problemático) ahora mismo. En su lugar, (resultado)", "Negación / contrarian", "Ruptura"], [58, "El oscuro secreto detrás de (relacionado con el objetivo)", "Secreto / revelación", "Ruptura"], [59, "Nadie te ha contado esto aún, pero (relacionado con el objetivo) están desactualizados", "Secreto / revelación", "Ruptura"], [60, "Ahorra tiempo y dinero con [producto]", "Solución / facilidad", "Pérdida"], [61, "Ahorra tiempo y dinero en [tarea]", "Solución / facilidad", "Pérdida"], [62, "¿Vale la pena [producto]? ¡Vamos a ver!", "UGC / producto", "Evidencia"], [63, "¿Qué hay en [producto]?", "UGC / producto", "Evidencia"], [64, "Preguntas que me hacen sobre [producto]", "UGC / producto", "Evidencia"], [65, "Ahora puedes obtener X entregado en tu puerta", "UGC / producto", "Evidencia"], [66, "Antes de probar [tipo de producto], mira esto:", "UGC / producto", "Evidencia"], [67, "¿Odiando [la peor alternativa]? Prueba esto:", "Solución / facilidad", "Pérdida"], [68, "En lugar de hacer [peor alternativa], prueba esto:", "Solución / facilidad", "Pérdida"], [69, "Chicos, está aquí...", "UGC / producto", "Evidencia"], [70, "Lo que pedí vs. lo que recibí", "UGC / producto", "Evidencia"], [71, "Unboxing de [producto]", "UGC / producto", "Evidencia"], [72, "TikTok me hizo probar [producto]", "UGC / producto", "Evidencia"], [73, "Cosas que TikTok me hizo probar #13", "UGC / producto", "Evidencia"], [74, "Este [tipo de producto] se está volviendo viral en [plataforma de redes sociales]", "Prueba social / viralidad", "Evidencia"], [75, "Probé el [tipo de producto] viral para ver si cumple con las expectativas", "UGC / producto", "Evidencia"], [76, "Este [tipo de producto] tiene más de 5,000 reseñas... veamos si vale la pena", "Prueba social / viralidad", "Evidencia"], [77, "[Publicación] no deja de hablar de nosotros", "Prueba social / viralidad", "Evidencia"], [78, "Tan bueno que se agotó en una semana", "Prueba social / viralidad", "Evidencia"], [79, "¿Estás [logrando el objetivo de manera óptima]?", "Pregunta / curiosidad", "Ruptura"], [80, "Truco de vida: Prueba [producto] para [punto de dolor]", "Solución / facilidad", "Pérdida"], [81, "Mi [producto] favorito para [punto de dolor]", "UGC / producto", "Evidencia"], [82, "Cómo hacer [tarea] fácilmente", "Solución / facilidad", "Pérdida"], [83, "[Tarea] nunca ha sido más fácil que con [producto]", "Solución / facilidad", "Pérdida"], [84, "Mi [producto] favorito para hacer [tarea difícil] más fácil", "Solución / facilidad", "Pérdida"], [85, "Aquí está mi producto favorito para [tarea]", "UGC / producto", "Evidencia"], [86, "¿Luchando por hacer [tarea]?", "Pregunta / curiosidad", "Ruptura"], [87, "Entonces, he estado luchando con [tarea], pero [producto] realmente me ha ayudado", "Solución / facilidad", "Pérdida"], [88, "¿La manera más fácil de hacer [tarea]?", "Solución / facilidad", "Pérdida"], [89, "Haz tu semana más fácil", "Solución / facilidad", "Pérdida"], [90, "Por qué los adultos evitan [tarea]... [producto] lo hace fácil", "Solución / facilidad", "Pérdida"], [91, "[Producto] hizo [tarea] mucho más fácil. ¡Tienes que probarlo!", "Solución / facilidad", "Pérdida"], [92, "Cuando uso [producto], es una cosa menos de la que preocuparme", "Solución / facilidad", "Pérdida"], [93, "5 maneras en que [producto] ayuda a [punto de dolor]", "Lista / número", "Evidencia"], [94, "3 razones para comprar [producto]", "Lista / número", "Evidencia"], [95, "3 razones para probar [servicio]", "Lista / número", "Evidencia"], [96, "Obtén [propuesta de valor] en 3 pasos", "Lista / número", "Evidencia"], [97, "El #1 en internet [tipo de producto]", "Prueba social / viralidad", "Evidencia"], [98, "La mejor manera de [lograr el objetivo del producto]", "Solución / facilidad", "Pérdida"], [99, "¿Qué hace que [el tipo de producto] sea el mejor?", "Pregunta / curiosidad", "Ruptura"], [100, "Hey, [tipo de cliente], tienes que probar esto", "Filtro de audiencia", "Identidad"], [101, "Personas buscando [categoría de producto], dejen de desplazarse", "Filtro de audiencia", "Identidad"], [102, "Espera, ¿has probado X?", "UGC / producto", "Evidencia"], [103, "PSA: [declaración sobre categoría de producto]", "Dato / estadística", "Evidencia"], [104, "¿Sabías? [hecho sobre categoría de producto]", "Dato / estadística", "Evidencia"], [105, "Acabo de descubrir [hecho sobre categoría de producto]", "Dato / estadística", "Evidencia"], [106, "El perfecto (x) no existe", "Mito vs realidad", "Ruptura"], [107, "Los mejores hallazgos de compras en TikTok", "UGC / producto", "Evidencia"], [108, "Las meriendas nocturnas pegan diferente con este (x)...", "UGC / producto", "Evidencia"], [109, "Compré esto para mi (x) para (x) vacaciones/ocasión", "UGC / producto", "Evidencia"], [110, "Un producto que uso TODOS los días sin falta es...(x)", "UGC / producto", "Evidencia"], [111, "Mis principales hallazgos de compras sin los que ahora no puedo vivir", "UGC / producto", "Evidencia"], [112, "Esto es lo que pedí y esto es lo que recibí mientras muestra la página web en gancho", "UGC / producto", "Evidencia"], [113, "Quién más quiere (x resultado) sin (x punto de dolor)", "Pregunta / curiosidad", "Ruptura"], [114, "Deshazte De (x Problema) Con (x solución/producto)", "Solución / facilidad", "Pérdida"], [115, "Formas poco conocidas también (x obtener resultado/solucionar problema)", "Secreto / revelación", "Ruptura"], [116, "¡Ojalá hubiera sabido de esta marca antes!", "UGC / producto", "Evidencia"], [117, "Este es el mayor error que comete la gente cuando (x solución al problema)", "Error / advertencia", "Pérdida"], [118, "5 cosas que desearía haber sabido antes de (probar todas estas otras x soluciones)", "Lista / número", "Evidencia"], [119, "Llamando a todos los (público objetivo) que están cansados de (x problema)", "Filtro de audiencia", "Identidad"], [120, "Muy bien, voy a compartir mi secreto sobre cómo (uso x producto/solución)", "Secreto / revelación", "Ruptura"], [121, "El perfecto (x) no existe", "Mito vs realidad", "Ruptura"], [122, "Un/Una [objeto mundano específico] [en ubicación cotidiana] cambió cómo [resultado profesional]", "Objeto mundano revelador", "Ruptura"], [123, "Encontré la respuesta a [problema del nicho] en [objeto inesperado pero específico]", "Objeto mundano revelador", "Ruptura"], [124, "El/La [objeto roto/gastado específico] me enseñó más sobre [concepto del nicho] que [fuente obvia de aprendizaje]", "Objeto mundano revelador", "Ruptura"], [125, "Sigo [acción compulsiva del nicho] cada [frecuencia absurda] aunque sé que [verdad incómoda]", "Confesión / experimento", "Identidad"], [126, "Todavía [hábito anticuado del nicho]. No debería funcionar. Funciona.", "Verdad contraintuitiva", "Ruptura"], [127, "Confieso que a veces [práctica 'prohibida' del nicho]. Y a veces [resultado contradictorio].", "Confesión / experimento", "Identidad"], [128, "El/La mejor [elemento del nicho] es el/la que [contradicción aparente]. Déjame explicar.", "Verdad contraintuitiva", "Ruptura"], [129, "Deberías [acción contraintuitiva con elemento sagrado del nicho]. Al menos [condición que lo resuelve].", "Verdad contraintuitiva", "Ruptura"], [130, "Los/Las [elemento 'malo' del nicho] [resultado positivo]. Pero no por las razones que piensas.", "Verdad contraintuitiva", "Ruptura"], [131, "Gasté [cantidad específica] en [decisión arriesgada sin protocolo]. Esto es lo que aprendí.", "Confesión / experimento", "Identidad"], [132, "Lancé/Hice [cantidad] de [elemento] sin [requisito 'obligatorio']. [Consecuencia temida]. [Métrica que lo redimió].", "Confesión / experimento", "Identidad"], [133, "Ignoré [best practice sagrada] por [período]. [Consecuencia temida que no pasó]. [Métrica que mejoró].", "Confesión / experimento", "Identidad"], [134, "El [porcentaje no redondo]% de tu [recurso] probablemente se está yendo en [período/lugar específico]", "Auditoría con números", "Evidencia"], [135, "Revisé [número impar alto] [elementos del nicho]. Solo [número bajo] tenían [cosa específica] bien.", "Auditoría con números", "Evidencia"], [136, "Tardé [número impar de días] en darme cuenta de que el problema no era [sospechoso obvio]", "Reframe del problema", "Pérdida"], [137, "Eran las [hora tardía]. [Situación mundana dramática]. Faltaban [cantidad/métrica] en algún lugar entre [punto A técnico] y [punto B técnico].", "Escena / narrativa", "Identidad"], [138, "Abrí [herramienta mundana]. [Cantidad abrumadora]. Una de ellas escondía [el origen de un problema grave].", "Escena / narrativa", "Identidad"], [139, "El cliente preguntó [pregunta incómoda]. Yo tenía [cantidad] de [evidencia de investigación] y [conclusión que genera tensión].", "Escena / narrativa", "Identidad"], [140, "Hay algo profundamente [emoción fuerte] en ver que tu [apuesta 'segura' del nicho] tiene [métrica decepcionante]", "Emoción / vulnerabilidad", "Identidad"], [141, "Sentí un/una [emoción inesperada] cuando finalmente [acción difícil del nicho] que [expectativa no cumplida en comillas]", "Emoción / vulnerabilidad", "Identidad"], [142, "Hay [emoción inesperada] en [métrica/logro específico] que [limitación de comprensión externa]", "Emoción / vulnerabilidad", "Identidad"], [143, "Esto es solo para los que ya [inversión/esfuerzo específico] y siguen sin [resultado esperado]", "Filtro de audiencia", "Identidad"], [144, "Si todavía [comportamiento de principiante], esto no es para ti", "Filtro de audiencia", "Identidad"], [145, "Para los que han [acción exhaustiva del nicho] y aún así sienten que [sensación de incertidumbre]", "Filtro de audiencia", "Identidad"], [146, "Antes de que me juzgues: sí, [práctica cuestionable]. Y [resultado que la justifica].", "Anticipa la objeción", "Ruptura"], [147, "Antes de que [acción de rechazo]: no voy a [expectativa del nicho]. Voy a [giro inesperado].", "Anticipa la objeción", "Ruptura"], [148, "Antes de que pienses que [juicio negativo]: este/esta [cosa desordenada/imperfecta] [supera a] mis [versiones 'correctas']", "Anticipa la objeción", "Ruptura"], [149, "[Proceso del nicho] funciona exactamente como [proceso doméstico/universal]. [Conexión específica del error común].", "Analogía", "Ruptura"], [150, "Tu [sistema del nicho] se comporta como [situación cotidiana reconocible]: [insight específico del comportamiento]", "Analogía", "Ruptura"], [151, "[Tarea del nicho] es como [actividad con interdependencias]: [consecuencia no obvia de ajustes aislados]", "Analogía", "Ruptura"], [152, "—y eso fue antes de [acción de descubrimiento]. Lo que encontré después [magnitud del cambio].", "Escena / narrativa", "Identidad"], [153, "—que es exactamente por qué dejé de [práctica común del nicho].", "Escena / narrativa", "Identidad"], [154, "—pero nadie te dice [parte oculta del proceso]. Solo te muestran [resultado visible].", "Verdad contraintuitiva", "Ruptura"], [155, "La configuración por defecto de [plataforma/herramienta] está diseñada para [beneficio de la plataforma], no para [beneficio del usuario]", "Trampa de plataforma", "Pérdida"], [156, "Ese [función atractiva y fácil] es [descripción de trampa] con [elemento engañosamente atractivo]", "Trampa de plataforma", "Pérdida"], [157, "Los/Las [elementos 'mejorados/simplificados'] esconden exactamente [lo que el usuario necesita]", "Trampa de plataforma", "Pérdida"], [158, "El verdadero culpable de tu [problema del nicho] es [elemento específico de interfaz/proceso] que nunca [acción omitida]", "Diagnóstico oculto", "Pérdida"], [159, "El/La [lugar común de feedback] donde [acción que parece útil] te está costando [recurso real]", "Trampa de plataforma", "Pérdida"], [160, "El/La [configuración pequeña ignorada] está [acción perjudicial silenciosa] a [destino inesperado]", "Trampa de plataforma", "Pérdida"], [161, "La mayoría de [grupo respetado del nicho] no saben [cosa que deberían saber por definición]", "Verdad contraintuitiva", "Ruptura"], [162, "A veces [resultado contradictorio] porque [audiencia] está [estado de saturación] de [lo que se supone que funciona]", "Verdad contraintuitiva", "Ruptura"], [163, "El [elemento de venta/prueba social] que te mostraron probablemente [limitación no mencionada]. Y ellos lo saben.", "Verdad contraintuitiva", "Ruptura"], [164, "Probé [experimento extremo con números específicos] para ver qué pasaba. No hagas esto.", "Confesión / experimento", "Identidad"], [165, "Usé [cantidad absurda] de [elemento] en [lugar] porque '[lógica simplista]'. Spoiler: no lo es.", "Confesión / experimento", "Identidad"], [166, "Dejé [acción pasiva] por [período largo] esperando que [esperanza común en comillas]. [Resultado irónico].", "Confesión / experimento", "Identidad"], [167, "No estás [síntoma negativo]. Estás [causa real más profunda y específica].", "Reframe del problema", "Pérdida"], [168, "Tu problema no es falta de [recurso obvio]. Es falta de [elemento de proceso más profundo].", "Reframe del problema", "Pérdida"], [169, "No te falta [recurso escaso obvio]. Te falta saber [diagnóstico específico].", "Reframe del problema", "Pérdida"], [170, "Hay un momento exacto cuando [situación específica] y piensas '[pensamiento de rendición común]'. Ese momento tiene [solución/nombre].", "Emoción / vulnerabilidad", "Identidad"], [171, "Le llamo '[nombre inventado]': cuando [momento técnico específico] y [consecuencia emocional] empieza", "Escena / narrativa", "Identidad"], [172, "Existe un limbo entre '[expectativa]' y '[desesperación técnica]'. La mayoría [acción de rendición] ahí.", "Emoción / vulnerabilidad", "Identidad"], [173, "Nadie te dice que [proceso] no es [expectativa]. [Acción] no [resultado proporcional]. Esto es lo que pasa en medio.", "Verdad contraintuitiva", "Ruptura"], [174, "Los [fuentes de aprendizaje] te muestran [parte visible del proceso]. No te muestran [parte emocional/difícil oculta].", "Verdad contraintuitiva", "Ruptura"], [175, "Todo el mundo habla de [resultado impresionante]. Nadie menciona [el costo real/proceso oculto] antes de llegar ahí.", "Verdad contraintuitiva", "Ruptura"], [176, "Este error de [elemento pequeño específico] me costó $[cantidad exacta] en [período específico]. Aquí está [la prueba].", "Auditoría con números", "Evidencia"], [177, "Dejé [configuración específica] activado sin saber qué hacía. $[cantidad] después, aprendí.", "Confesión / experimento", "Identidad"], [178, "Confié en [feature/recomendación de plataforma] por [período]. Mi [métrica] [empeoró] [porcentaje]. Esta es [la prueba].", "Auditoría con números", "Evidencia"], [179, "Conoces ese [sonido/sensación específica del nicho]? Después de [período de ausencia/cambio], [experiencia alterada].", "Escena / narrativa", "Identidad"], [180, "El/La [acción repetitiva del nicho] a las [hora tardía] tiene [cualidad diferente] cuando [condición de fracaso].", "Escena / narrativa", "Identidad"], [181, "Hay [sensación/sonido específico] cuando finalmente [momento de descubrimiento]. [Reacción física del alivio].", "Emoción / vulnerabilidad", "Identidad"], [182, "No existe tal cosa como '[creencia/frase común]' si [condición que la invalida]", "Mito vs realidad", "Ruptura"], [183, "El 'mejor [elemento universal]' no existe. Existe [versión contextualizada y real].", "Mito vs realidad", "Ruptura"], [184, "Más [recurso/opciones] no significa mejor [resultado]. Usualmente significa más [consecuencia negativa].", "Verdad contraintuitiva", "Ruptura"], [185, "Entre '[punto de inicio atractivo]' y '[resultado final impresionante]' hay [cantidad] de [trabajo invisible] que nadie te muestra", "Verdad contraintuitiva", "Ruptura"], [186, "El [fuente de éxito] dice '[versión resumida]'. Lo que no dice: [lista de acciones reales, feas y múltiples].", "Verdad contraintuitiva", "Ruptura"], [187, "De [métrica mala] a [métrica buena] suena limpio. Fueron [período] de [proceso tedioso] hasta que [momento de quiebre poco glamoroso].", "Antes / después", "Evidencia"], [188, "Ese [reacción física exagerada] cuando [acción de chequeo rutinario] después de [período de ausencia] y [métrica empeoró dramáticamente]", "Emoción / vulnerabilidad", "Identidad"], [189, "El terror silencioso de que [persona con autoridad] [haga algo] antes que tú [puedas hacer algo]", "Emoción / vulnerabilidad", "Identidad"], [190, "También te da [emoción incómoda] [hacer acción lógica del nicho] que está funcionando 'por si acaso'?", "Emoción / vulnerabilidad", "Identidad"], [191, "Esperaba: [lógica aparente]. Realidad: [resultado contradictorio + razón].", "Mito vs realidad", "Ruptura"], [192, "Lo que pensé: [opción 'correcta'] > [opción 'inferior']. Lo que pasó: [métrica] [magnitud] mayor en [opción 'inferior'].", "Mito vs realidad", "Ruptura"], [193, "Plan: [plan ordenado con números]. Realidad: [elemento inesperado] [resultado extremo] y tuve que [ajuste forzado].", "Mito vs realidad", "Ruptura"], [194, "Deja de [acción que parece necesaria]. En serio. [Instrucción específica contraintuitiva] y [siguiente paso].", "Verdad contraintuitiva", "Ruptura"], [195, "[Acción que suena extrema] antes de que [consecuencia peor]. Suena loco pero [razón de peso].", "Verdad contraintuitiva", "Ruptura"], [196, "Borra [elemento que parece valioso] de tu [lugar]. [Resultado contraintuitivo].", "Verdad contraintuitiva", "Ruptura"], [197, "Deja de [acción bien intencionada pero contraproducente]. Estás [consecuencia oculta negativa].", "Verdad contraintuitiva", "Ruptura"], [198, "[Categoría de problema] no se arregla con [solución obvia que todos intentan]. Se arregla con [solución no obvia].", "Reframe del problema", "Pérdida"], [199, "Cada vez que [acción correctiva común], [consecuencia contraproducente oculta].", "Verdad contraintuitiva", "Ruptura"], [200, "El síntoma es [lo visible]. El problema es [lo oculto]. Deja de [tratar síntoma].", "Diagnóstico oculto", "Pérdida"], [201, "La incertidumbre después de [decisión común del nicho] es tan paralizante como [problema original]. Al menos [acción recomendada] te da [beneficio concreto].", "Emoción / vulnerabilidad", "Identidad"], [202, "Dejé de [búsqueda infinita común] cuando me di cuenta de que [verdad práctica].", "Confesión / experimento", "Identidad"], [203, "[Decisión común del nicho] casi siempre esconde [verdadero problema] que es más incómodo de resolver.", "Reframe del problema", "Pérdida"], [204, "Esta hoja de cálculo fea me ha ahorrado $[cantidad] en [tipo de pérdida evitada].", "Solución simple / humilde", "Evidencia"], [205, "No tengo [sistema/herramienta sofisticada]. Tengo [solución simple vergonzosamente efectiva].", "Solución simple / humilde", "Evidencia"], [206, "Mi [proceso clave del nicho] es [descripción intencionalmente simple] y funciona mejor que [alternativa compleja].", "Solución simple / humilde", "Evidencia"], [207, "Cada hora que paso [actividad que parece productiva] es una hora que no paso [actividad realmente productiva].", "Vanidad vs negocio", "Pérdida"], [208, "[Proceso largo/complejo] es [táctica de procrastinación] disfrazada de [virtud profesional].", "Vanidad vs negocio", "Pérdida"], [209, "Medí cuántas horas paso en [actividad que parece trabajo]. El número fue [número incómodo].", "Auditoría con números", "Evidencia"], [210, "Estaba [acción abrumadora] cuando debería haber estado [acción simple más efectiva].", "Vanidad vs negocio", "Pérdida"], [211, "[Fuente de inspiración del nicho] te da [ilusión positiva]. No te da [lo que realmente necesitas].", "Vanidad vs negocio", "Pérdida"], [212, "Cada [elemento creativo/técnico] en tu [canal/producto] que no [acción deseada del cliente] es [distracción/obstáculo].", "Reframe del problema", "Pérdida"], [213, "[Señal que parece positiva] usualmente significa [problema oculto más serio].", "Diagnóstico oculto", "Pérdida"], [214, "Dejé de [preocuparme por elemento] cuando empecé a [medir elemento más importante].", "Vanidad vs negocio", "Pérdida"], [215, "[Recurso visible] es vanidad. [Métrica oculta] es negocio. Yo solo miro [métrica oculta].", "Vanidad vs negocio", "Pérdida"], [216, "[Plataforma/fuente] me manda [cantidad impresionante de métrica de vanidad]. Pero [otra fuente menos sexy] me manda el [porcentaje alto] de [métrica de negocio].", "Vanidad vs negocio", "Pérdida"], [217, "Dejé de [perseguir métrica de vanidad] y empecé a [optimizar métrica real]. [Resultado temporal negativo]. [Resultado final positivo].", "Vanidad vs negocio", "Pérdida"], [218, "Si [situación preocupante] pero [métrica de negocio está bien], [solución contraintuitiva].", "Verdad contraintuitiva", "Ruptura"], [219, "[Opción sofisticada/cara] rara vez supera a [opción simple/barata] bien [ejecutada].", "Solución simple / humilde", "Evidencia"], [220, "La [herramienta/sistema popular] que todos usan tiene un problema: [limitación crítica para el contexto].", "Trampa de plataforma", "Pérdida"], [221, "[Inversión grande] no compensa [fundamento faltante].", "Solución simple / humilde", "Evidencia"], [222, "Gasté $[cantidad] en [solución sofisticada]. Un [solución simple de bajo costo] hubiera hecho lo mismo.", "Solución simple / humilde", "Evidencia"], [223, "Antes de [compra/decisión grande], [acción de validación simple] que cuesta [poco o nada].", "Solución simple / humilde", "Evidencia"], [224, "[Cosa con la que estás luchando] tiene [solución sorprendentemente simple] pero nadie te la dice porque [razón de incentivos].", "Solución simple / humilde", "Evidencia"], [225, "[Analogía de peso físico] para [carga mental/operativa]", "Analogía", "Ruptura"], [226, "[Analogía de batería/energía] para [recurso de atención/decisión]", "Analogía", "Ruptura"], [227, "[Analogía de digestión] para [capacidad de procesamiento]", "Analogía", "Ruptura"], [228, "[Reacción física] indica [estado de negocio/decisión]. Si sientes [síntoma], probablemente [diagnóstico].", "Diagnóstico oculto", "Pérdida"], [229, "[Concepto técnico/negocio] es como [proceso biológico]: [conexión que ilumina].", "Analogía", "Ruptura"], [230, "Tu [área del negocio] te está mandando [señal tipo dolor físico]. Ignorarla tiene el mismo resultado que [ignorar síntoma físico].", "Analogía", "Ruptura"], [231, "[Persona/rol] que [acción repetitiva visible] es como [animal con comportamiento característico]. Parece [adjetivo] pero es [explicación estratégica].", "Analogía", "Ruptura"], [232, "Tenemos [comportamiento disfuncional del nicho] con [concepto]. Nos aferramos a [cosa que no funciona] como [comportamiento animal].", "Analogía", "Ruptura"], [233, "La [lógica simplista del nicho] ignora que [realidad compleja]. Es como [analogía animal absurda].", "Analogía", "Ruptura"], [234, "[Tendencia observable en muchos ejemplos]. Lo noté después de [cantidad] de [experiencias].", "Auditoría con números", "Evidencia"], [235, "Hay un patrón en [grupo específico]: [observación específica]. [Cantidad]% hacen [comportamiento] que [consecuencia].", "Auditoría con números", "Evidencia"], [236, "Estudié [cantidad] de [elementos] por [período]. [El hallazgo más sorprendente] fue [descubrimiento].", "Auditoría con números", "Evidencia"], [237, "Este screenshot vale más que [cantidad de información alternativa]. [Descripción de lo que muestra].", "Auditoría con números", "Evidencia"], [238, "[Señalar elemento específico] en esta imagen. Eso es [la causa oculta del problema/éxito].", "Auditoría con números", "Evidencia"], [239, "Una imagen de [elemento mundano específico] me enseñó más sobre [tema] que [fuente obvia de aprendizaje].", "Objeto mundano revelador", "Ruptura"], [240, "[Práctica/creencia aceptada en el nicho] suena lógico hasta que [dato o ejemplo que lo contradice].", "Mito vs realidad", "Ruptura"], [241, "Lo opuesto de [consejo común del nicho] es cierto cuando [condición específica].", "Mito vs realidad", "Ruptura"], [242, "Todo el mundo dice [consejo popular]. Pero [la excepción importante] que nadie menciona.", "Mito vs realidad", "Ruptura"], [243, "Pensé que [logro/métrica] era mi mayor momento. Era la señal de [problema serio que venía].", "Reframe del problema", "Pérdida"], [244, "[Dato/resultado que parece éxito] me tenía ciega ante [problema real que causaba].", "Reframe del problema", "Pérdida"], [245, "El día que [momento de éxito aparente] fue el mismo día que [comienzo de problema serio].", "Reframe del problema", "Pérdida"], [246, "La frase exacta que hizo que [cliente/audiencia] [acción deseada] fue \"[frase específica simple]\".", "La frase exacta", "Evidencia"], [247, "Cambié \"[frase débil]\" por \"[frase fuerte]\". [Resultado medible].", "La frase exacta", "Evidencia"], [248, "El [tipo de cliente] que [acción de compra] respondió a \"[frase específica]\", no a [intento anterior].", "La frase exacta", "Evidencia"], [249, "[Línea 1]. [Línea 2]. [Línea 3 con resultado].", "Escena / narrativa", "Identidad"], [250, "Problema: [situación inicial]. Cambio: [una acción específica]. Resultado: [métrica].", "Antes / después", "Evidencia"], [251, "[Cantidad] de [tiempo]. [Una acción]. [Resultado que parece desproporcionado].", "Antes / después", "Evidencia"], [252, "Por favor no [acción dañina específica]. Lo hice y [consecuencia concreta].", "Confesión / experimento", "Identidad"], [253, "Si estás a punto de [decisión tentadora], [advertencia específica basada en experiencia].", "Confesión / experimento", "Identidad"], [254, "[Te imploro/suplico] que evites [error específico] hasta que [condición de madurez].", "Confesión / experimento", "Identidad"], [255, "[Frase conocida del nicho] pero reemplazando [palabra débil] por [palabra más precisa/fuerte].", "La frase exacta", "Evidencia"], [256, "[Frase cliché] es mentira. [Versión mejorada con una palabra cambiada] es verdad.", "Mito vs realidad", "Ruptura"], [257, "[Verbo aburrido] no alcanza. Necesitas [verbo más específico y visceral].", "La frase exacta", "Evidencia"], [258, "Esto parece insignificante, pero [detalle pequeño específico] es la diferencia entre [resultado mediocre] y [resultado excelente].", "Diagnóstico oculto", "Pérdida"], [259, "[Detalle técnico/operativo] suena aburrido hasta que te das cuenta de que [impacto en dinero/tiempo].", "Diagnóstico oculto", "Pérdida"], [260, "El [elemento que otros ignoran] de tu [sistema/producto] está haciendo [trabajo pesado oculto].", "Diagnóstico oculto", "Pérdida"], [261, "Nadie es inmune a [verdad humana que aplica a todos en el nicho]. Ni tú, ni yo, ni [figura aspiracional].", "Emoción / vulnerabilidad", "Identidad"], [262, "[Comportamiento universal] no es debilidad. Es [nombre más preciso que normaliza].", "Emoción / vulnerabilidad", "Identidad"], [263, "[Experiencia incómoda común] le pasa a todo el mundo. [La diferencia entre éxito y fracaso] está en [acción específica después].", "Emoción / vulnerabilidad", "Identidad"], [264, "[Concepto abstracto] es básicamente [versión física/tangible].", "Analogía", "Ruptura"], [265, "Piensa en [concepto del nicho] como [objeto/espacio físico]. Cada [elemento que agregas] es [carga física].", "Analogía", "Ruptura"], [266, "[Tarea mental/abstracta] es tan agotadora como [actividad física equivalente]. Por eso [consecuencia/recomendación].", "Analogía", "Ruptura"], [267, "Si tuviera que empezar de cero mañana, [la primera acción específica] sería [acción específica], no [lo que la mayoría haría].", "Si empezara de cero", "Identidad"], [268, "Con $[cantidad pequeña] y [tiempo corto], haría [acción 1], [acción 2], y [acción 3]. En ese orden.", "Si empezara de cero", "Identidad"], [269, "Lo que haría diferente: menos [cosa que parece importante] y más [cosa que realmente importa].", "Si empezara de cero", "Identidad"], [270, "Tu [métrica preocupante] probablemente tiene más que ver con [causa no obvia] que con [causa obvia que culpas].", "Diagnóstico oculto", "Pérdida"], [271, "El test de [algo] te mintió porque [condición que invalida el resultado]. En realidad, [lo que deberías estar mirando].", "Mito vs realidad", "Ruptura"]];
const PROMPTS = [{"n": "P1", "title": "Imagen UGC del producto desde referencia", "cat": "Producción / Imagen", "que": "Genera una imagen del producto en uso, copiando pose/encuadre/luz de una imagen de referencia.", "text": "Quiero una imagen de mi [PRODUCTO] con el estilo de la imagen de referencia: misma pose, encuadre y luz natural tipo UGC. Sin textos ni placeholders. Solo el producto en uso."}, {"n": "P2", "title": "Investigación de competidores en Meta Ads", "cat": "Investigación", "que": "Lista competidores activos en Meta para modelar sus ofertas, hooks y creatividades.", "text": "Quiero que me identifiques competidores activos y relevantes en Meta Ads para analizar y modelar sus estrategias publicitarias, ofertas, hooks y creatividades.\n\nInformación de mi negocio:\n- Industria/Nicho: [especificar]\n- Producto o servicio: [especificar]\n- Público objetivo: [edad, género, ubicación, intereses]\n- Modelo de negocio: [e-commerce, leads, SaaS, info-producto, etc.]\n- Precio promedio: [especificar]\n- Diferenciales principales frente a la competencia: [especificar]\n\nQué quiero que hagas:\n- Buscar y listar competidores relevantes en el país/mercado donde quiero anunciarme.\n- Incluir: nombre de la marca, enlace al sitio, enlace a Instagram/Facebook, breve descripción de su oferta y ángulo de posicionamiento.\n- Identificar si están activos en Meta Ads (o si tienen presencia relevante en redes).\n- Sugerirme qué hooks, ángulos o tipos de creatividades utilizan que podría considerar.\n\nCuando te envíe este prompt completado, realizá la investigación y entregame un listado claro y accionable para planificar mis Ads en Meta."}, {"n": "P3", "title": "15 hooks de alta conversión (con investigación)", "cat": "Hooks", "que": "Investiga reseñas/foros/social y genera 15 hooks como titulares de ads + justificación psicológica.", "text": "Eres un copywriter de respuesta directa y estratega de marketing de clase mundial. Te especializas en crear hooks publicitarios de alta conversión mediante investigación profunda de tendencias, disparadores psicológicos y ángulos probados.\n\nInformación de producto y avatar:\n#descripciónproducto\n#descripciónavatar\n\nInvestiga en anuncios de alto rendimiento, reseñas, foros (Reddit, Quora), social (comentarios YouTube/TikTok/Twitter) y ejemplos de eCommerce.\n\nTarea:\n- Identificar disparadores emocionales clave, deseos no satisfechos o problemas urgentes del mercado objetivo.\n- Modelar estilos de hooks de alto rendimiento (preguntas, afirmaciones atrevidas, curiosidad, controversia, prueba social, desafío).\n- Escribir 15 hooks como titulares (máx. 150 caracteres c/u), que capten atención en 1.5 s.\n- Para cada hook, 1 frase de justificación según la investigación.\n- (Opcional) Sugerir 3 ángulos para duplicar esfuerzos si escalás a audiencias frías.\n\nEtiquetá las secciones: Resumen de Investigación · 15 Hooks de Alta Conversión · Psicología de Cada Hook · Ángulos Publicitarios.\nSé conciso pero profundo. Prioriza impacto emocional/psicológico probado. Evita relleno genérico."}, {"n": "P6", "title": "Hooks que subvierten patrones narrativos", "cat": "Hooks", "que": "Identifica patrones narrativos familiares y los rompe entre la palabra 5 y 8 (codificación predictiva).", "text": "Necesito un hook para [producto/servicio] que use estructuras de historias conocidas pero las subvierta de forma inesperada.\n\nActúa como copywriter experto en psicología narrativa. Primero identifica 3 patrones narrativos comunes que mi audiencia [descripción] reconozca al instante en [industria].\n\nPara cada patrón:\n- Crea 2 hooks que empiecen con ese patrón familiar pero introduzcan una sorpresa entre la palabra 5 y 8.\n- Que la sorpresa se conecte con el beneficio principal del producto.\n- Intelectualmente intrigantes y emocionalmente resonantes. Menos de 20 palabras.\n\nPara cada hook explica: qué patrón interrumpís, qué tensión psicológica genera, cómo esa tensión despierta curiosidad, por qué sería efectivo con esta audiencia.\n\nAntes de generar, hazme preguntas específicas sobre producto, audiencia, beneficio principal, industria y tono de marca."}, {"n": "P7", "title": "10 hooks que detienen el scroll", "cat": "Hooks", "que": "10 hooks que desafían una creencia común, cada uno con un disparador psicológico distinto.", "text": "Eres un copywriter especializado en hooks que interrumpen patrones y detienen el scroll. Necesito hooks para [producto/servicio] que conecten con [descripción detallada de la audiencia].\n\nLos hooks deben: desafiar una creencia común de esta audiencia, generar curiosidad inmediata, usar patrones de lenguaje que resuenen, tener menos de 15 palabras siempre que sea posible.\n\nGenera 10 hooks distintos, cada uno usando un disparador psicológico diferente (escasez, prueba social, identidad, etc.) y explica por qué funcionaría con esta audiencia.\n\nAntes de generar, hazme preguntas específicas sobre producto, audiencia, sus creencias y tono de marca."}, {"n": "P4", "title": "Ángulos de Identidad", "cat": "Ángulos Publicitarios", "que": "Posicionan el producto como algo que refuerza/eleva la identidad del comprador (pertenencia, estatus, buen gusto).", "text": "Estoy creando textos publicitarios y necesito ayuda con ángulos de identidad para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [su identidad, cómo se ven, a quién aspiran parecerse, con qué grupos se identifican]\n\nLos ángulos de identidad posicionan el producto como algo que refuerza o eleva la identidad del comprador. Les hace sentir que pertenecen, que están un paso adelante o que tienen buen gusto.\n\n- Entendé a qué grupo quiere pertenecer el comprador.\n- Escribí 5 ángulos que hagan que alguien se sienta visto, con estilo, seguro o en control.\n- Evitá la descripción técnica. Enfocate en confianza, estilo de vida, estatus.\n\nEjemplos de formato:\n- \"No solo me importa el bienestar — me gusta que se note sin esfuerzo\"\n- \"Todas las It Girls que sigo lo usan, así que tuve que probarlo\""}, {"n": "P5", "title": "Ángulos Críticos", "cat": "Ángulos Publicitarios", "que": "Para gente racional, enfocada en resultados: ahorro de dinero/tiempo, simplicidad, lógica. Sin hype.", "text": "Estoy escribiendo copys y necesito ayuda con ángulos críticos para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [prácticos, valoran eficiencia, ahorro, escépticos]\n\nLos ángulos críticos apelan a personas racionales, enfocadas en resultados. Resaltan ahorro de dinero, tiempo, simplicidad y lógica. Son directos.\n\n- Identificá cómo el producto ahorra tiempo, dinero o complicaciones.\n- Escribí 5 ángulos que suenen inteligentes, directos y sin exageraciones.\n- Evitá el hype. Apuntá a la lógica y el valor por el dinero.\n\nEjemplos de formato:\n- \"Más barato que una sola visita al salón — y actúa más rápido\"\n- \"¿Para qué complicarlo? Esto funciona. Punto.\""}, {"n": "P11", "title": "Ángulos Emocionales", "cat": "Ángulos Publicitarios", "que": "Apelan a sentimientos y transformaciones, con forma de testimonio/reseña (especialmente impacto en alguien querido).", "text": "Necesito ayuda para crear ángulos emocionales para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [edad, estilo de vida, valores, dolores emocionales, a quién cuidan]\n\nLos ángulos emocionales apelan a sentimientos, deseos, luchas o transformaciones — especialmente cuando impacta a alguien que quieren (pareja, padre/madre, hijx o su \"yo\" del pasado). Deben tener forma de historia y generar empatía.\n\n- Leé la página del producto y entendé los resultados emocionales que promete.\n- Escribí 5 ángulos emocionales que suenen a testimonios reales o reseñas de TikTok.\n- Evitá describir funciones; enfocate en cambios de vida, alivio y conexión emocional.\n\nEjemplos de formato:\n- \"Tenía miedo de salir sin maquillaje. Ahora ni me acuerdo de usarlo.\"\n- \"Se lo compré a mi mamá y me dijo que se sentía 10 años más joven.\""}, {"n": "P12", "title": "Ángulos Prácticos", "cat": "Ángulos Publicitarios", "que": "Se centran en problemas concretos que el producto resuelve y los resultados. Parten de la utilidad.", "text": "Necesito ayuda para generar ángulos prácticos para este producto: [LINK DEL PRODUCTO]\n\nPúblico objetivo: [edad, hábitos, estilo de vida, casos típicos de uso]\n\nLos ángulos prácticos se centran en problemas concretos que el producto resuelve y los resultados que entrega. Apelan a la lógica; podés insinuar emociones, pero partí de la utilidad.\n\n- Identificá los principales dolores y soluciones de la página del producto.\n- Escribí 5 ángulos prácticos que expliquen qué hace el producto y por qué funciona.\n- Cada uno corto, enfocado en el beneficio, fácil de entender.\n\nEjemplos de formato:\n- \"Elimina el acné en 10 minutos al día, sin turnos ni clínicas\"\n- \"Diseñado para piel sensible. Efectivo desde el tercer uso\""}, {"n": "P8", "title": "Anuncios FB/IG con límites de caracteres", "cat": "Copy / Anuncios", "que": "Genera ads de tráfico frío en 6 formatos, respetando límites estrictos (Headline 40 / Description 40 / Primary Text 125).", "text": "Eres un copywriter senior de respuesta directa especializado en copy para anuncios de Facebook e Instagram para ecommerce. Genera anuncios de alta conversión para tráfico frío.\n\nInputs:\n- Nombre y descripción del producto: #PRODUCTNAME\n- Detalles de la oferta: #OFFER\n- Avatar del cliente: #AUDIENCE\n- Formato(s) preferido(s): #ADFORMAT\n- Voz de marca: #BRANDVOICE\n\nLímites: Headline máx 40 · Description máx 40 · Primary Text máx 125 caracteres.\n\nFormatos a elegir: 1) Problem-Solution · 2) Benefit-Focused · 3) Social Proof · 4) Story-Driven · 5) List-Style · 6) Urgency/Scarcity.\n\nReglas: asumir tráfico frío; estructura Hook → Dolor → Solución → Transformación → CTA; beneficios emocionales y prácticos; viñetas en List-Style; terminar con CTA claro; adaptar voz de marca; entregar solo el copy, sin explicaciones; múltiples variaciones; respetar límites de caracteres por bloque."}, {"n": "P9", "title": "Anuncio estilo historia", "cat": "Copy / Anuncios", "que": "Mini-relato (inicio/conflicto/solución/desenlace) que funciona como publicidad.", "text": "Eres un narrador creativo con experiencia en marketing. Redacta un anuncio para Facebook/Instagram que cuente una historia breve alrededor de [producto/servicio] para [público objetivo]. Estructura narrativa (inicio, conflicto, solución, desenlace) que a la vez sirva como publicidad.\n\nIncluí:\n- Título de la historia (ej. \"El día que [Nombre] descubrió [Producto]\").\n- Introducción: presentá al protagonista y su situación inicial; enganchá.\n- Conflicto/Desafío: el problema o frustración; que el lector se identifique. Breve pero emotivo.\n- Nudo: introducí [Producto] de forma natural; cómo lo prueba.\n- Clímax y Resolución: el resultado positivo; sentimientos de alivio/felicidad/logro.\n- Cierre con CTA narrativo: invitá al lector a ser el próximo protagonista.\n\nBreve pero completa (2-3 párrafos). Lenguaje emocional y cercano, como un testimonio sincero. Tono: [inspirador, amistoso, etc.]."}, {"n": "P10", "title": "Reescribir copy de un Canva (mismo conteo de caracteres)", "cat": "Copy / Anuncios", "que": "Detecta jerarquías de texto en un diseño de Canva y genera copys de reemplazo del mismo largo, sin romper el diseño.", "text": "Actúa como AI Copywriter experto en performance ads. Analiza la imagen de Canva que te envío y detectá:\n- Jerarquías de texto: Headline, Subheadline, Bullets/beneficios, Botón/CTA, Texto secundario, Disclaimer.\n- El tono (formal, casual, premium, motivacional, etc.).\n- El tipo de estructura (comparativo, testimonial, informativo, emocional, etc.).\n\nLuego generá NUEVOS COPYS de reemplazo alineados a MI PRODUCTO:\n- Exactamente la misma cantidad de caracteres (±5) por bloque, para no deformar el diseño.\n- Misma estructura, jerarquías y longitud aproximada. Lenguaje claro y persuasivo. CTA coherente.\n- De cada texto detectado, 4 variantes (todas dentro del rango de caracteres).\n\nTe entregaré: Nombre del producto · Público objetivo · Beneficios clave (3-5) · Problemas que resuelve · Tono · Imagen/descripción del Canva.\n\nOutput: por cada bloque, 4 variantes con conteo de caracteres; sugerencia de CTA y emojis si el tono lo permite; adaptación a comparativo/testimonial/informativo; listo para copiar/pegar en Canva."}];
const EJECOLOR = { Identidad:"#2E8B6B", Ruptura:"#6E3E94", "Pérdida":"#C5362B", Evidencia:"#C2861F" };

const PRESETS = [{ v: "today", l: "Hoy" }, { v: "last_7d", l: "Últimos 7 días" }, { v: "last_14d", l: "Últimos 14 días" }, { v: "last_30d", l: "Últimos 30 días" }, { v: "last_90d", l: "Últimos 90 días" }, { v: "this_month", l: "Este mes" }, { v: "last_month", l: "Mes pasado" }, { v: "maximum", l: "Máximo" }];

export default function App() {
  const [u, setU] = useState({ roasMin: 20, cpaMax: 3000, pisoSpend: 50000 });
  const [goal, setGoal] = useState(42000000);
  const [sort, setSort] = useState({ key: "veredicto", dir: "asc" });
  const [view, setView] = useState("panel");
  const [role, setRole] = useState("vos");
  const [done, setDone] = useState(() => new Set());
  const toggle = (id) => setDone((d) => { const n = new Set(d); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState("");
  const [preset, setPreset] = useState("last_30d");
  const [sheetTabs, setSheetTabs] = useState([]);
  const [sheetTab, setSheetTab] = useState("");
  const [data, setData] = useState(SAMPLE);
  const [audiencias, setAudiencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { fetch("/api/accounts").then((r) => r.json()).then((j) => setAccounts(j.accounts || [])).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/sheets/tabs").then((r) => r.json()).then((j) => setSheetTabs(j.tabs || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (!account) { setData(SAMPLE); setAudiencias([]); setErr(""); return; }
    let cancelled = false;
    setLoading(true); setErr("");
    fetch("/api/ads?account=" + account + "&preset=" + preset + (sheetTab ? "&tab=" + encodeURIComponent(sheetTab) : ""))
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) throw new Error(j.error);
        setData(j.rows && j.rows.length ? j.rows : SAMPLE);
        setAudiencias(j.audiencias || []);
        if (!j.rows || !j.rows.length) setErr("sin datos en el rango");
      })
      .catch((e) => { if (!cancelled) setErr(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [account, preset, sheetTab]);

  const withV = useMemo(() => data.map((r) => ({ ...r, v: veredicto(r, u) })), [data, u]);

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
    let spendTotal = 0, simpleSum = 0, wSpend = 0, wRoas = 0, revenue = 0, ventasTotal = 0;
    withV.forEach((r) => {
      counts[r.v]++; spendTotal += r.spend; simpleSum += r.roas; revenue += r.spend * r.roas; ventasTotal += r.ventas;
      if (r.spend >= u.pisoSpend) { wSpend += r.spend; wRoas += r.spend * r.roas; }
    });
    const topAds = [...withV].filter((r) => r.spend >= u.pisoSpend).sort((a, b) => b.roas - a.roas).slice(0, 6);
    return { counts, spendTotal, revenue, ventasTotal, roasSimple: simpleSum / withV.length, roasConfiable: wSpend ? wRoas / wSpend : 0, cpaProm: ventasTotal ? spendTotal / ventasTotal : 0, accountRoas: spendTotal ? revenue / spendTotal : 0, topAds };
  }, [withV, u.pisoSpend]);

  const acciones = useMemo(() => {
    const escalar = [], apagar = [], validar = [], esperar = [];
    const bestAng = [...withV].filter((r) => r.v === "Escalar").sort((a, b) => b.roas - a.roas)[0]?.ang || "Reseña";
    withV.forEach((r) => {
      if (r.v === "Escalar") escalar.push({ ...r, nuevo: r.spend * 1.25 });
      else if (r.v === "Pausar") apagar.push({ ...r, modo: r.roas / u.roasMin < 0.5 ? "apagar" : "iterar", bestAng });
      else if (r.v === "Observación" && r.roas >= u.roasMin) validar.push(r);
      else if (r.v === "Observación") esperar.push(r);
    });
    escalar.sort((a, b) => b.spend - a.spend); apagar.sort((a, b) => b.spend - a.spend);
    return { escalar, apagar, validar, esperar };
  }, [withV, u.roasMin]);

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
            <div><div className="bname">NUSA APP</div><div className="bsub"><span className="rec">● REC</span> PANEL DE CREATIVOS · MOTOR DE DECISIÓN</div></div>
          </div>
          <div className="client"><div className="clabel">▦ CLIENTE</div><select className="cselect" value={account} onChange={(e) => setAccount(e.target.value)}><option value="">— elegí un cliente —</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}</select><select className="cselect" value={sheetTab} onChange={(e) => setSheetTab(e.target.value)}><option value="">— pestaña sheet —</option>{sheetTabs.map((t) => <option key={t.gid} value={t.title}>{t.title}</option>)}</select><select className="cselect" value={preset} onChange={(e) => setPreset(e.target.value)}><option value="today">Hoy</option><option value="yesterday">Ayer</option><option value="last_7d">Últimos 7 días</option><option value="last_14d">Últimos 14 días</option><option value="last_30d">Últimos 30 días</option><option value="last_90d">Últimos 90 días</option><option value="this_month">Este mes</option><option value="last_month">Mes pasado</option><option value="maximum">Máximo</option></select><div className="cmeta">{loading ? "cargando…" : err ? err : account ? ("● data en vivo · " + data.length + " creativos") : "data de muestra"}</div></div>
        </div>
        <div className="stripe"><i/><i/><i/><i/><i/><i/></div>
        <div className="phasebar"><span>FASE 01 — HIGH GRADE</span><span>HQ ▮▮▮</span></div>
      </header>

      <div className="rolebar">
        <span className="rlabel">▶ VISTA</span>
        <div className="rolebtns">
          {Object.keys(ROLES).map((k) => <button key={k} className={"rolebtn" + (role === k ? " on" : "")} onClick={() => setRole(k)}>{k.toUpperCase()}</button>)}
        </div>
        <span className="rdesc">{ROLES[role]}</span>
      </div>

      {role === "cliente" ? <Cliente withV={withV} u={u} stats={stats} goal={goal} /> : (
        <>
          <nav className="nav">
            {role === "vos" && <button className={"tab" + (effView === "dash" ? " active" : "")} onClick={() => setView("dash")}>DASHBOARD</button>}
            <button className={"tab" + (effView === "hoy" ? " active" : "")} onClick={() => setView("hoy")}>QUÉ HACER HOY {totalTasks ? <span className="tabn">{totalTasks}</span> : null}</button>
            <button className={"tab" + (effView === "top" ? " active" : "")} onClick={() => setView("top")}>TOP PERFORMERS</button>
            <button className={"tab" + (effView === "panel" ? " active" : "")} onClick={() => setView("panel")}>PANEL</button>
            <button className={"tab" + (effView === "bib" ? " active" : "")} onClick={() => setView("bib")}>BIBLIOTECA</button>
            <button className={"tab" + (effView === "gen" ? " active" : "")} onClick={() => setView("gen")}>GENERAR</button>
          </nav>

          <section className="umbral">
            <div className="ulabel">UMBRAL<br/>DEL CLIENTE</div>
            <Field label="ROAS mínimo" suffix="x" value={u.roasMin} step={0.5} locked={locked} onChange={(v) => setU({ ...u, roasMin: v })} />
            <Field label="CPA máximo" prefix="$" value={u.cpaMax} step={100} locked={locked} onChange={(v) => setU({ ...u, cpaMax: v })} />
            <Field label="Piso de spend" prefix="$" value={u.pisoSpend} step={5000} locked={locked} onChange={(v) => setU({ ...u, pisoSpend: v })} />
            <div className="uhint">{locked ? "🔒 definido por la cuenta · no editable" : "cambiá los valores · todo recalcula en vivo"}</div>
          </section>

          {effView === "dash" && <Dash stats={stats} goal={goal} setGoal={setGoal} />}
          {effView === "hoy" && <Hoy acc={acciones} u={u} done={done} toggle={toggle} total={totalTasks} doneCount={doneCount} mantener={stats.counts.Mantener} />}
          {effView === "top" && <Top withV={withV} u={u} audData={audiencias} />}
          {effView === "panel" && <Panel rows={rows} stats={stats} sort={sort} setSortKey={setSortKey} />}
          {effView === "bib" && <Biblioteca />}
          {effView === "gen" && <Generar />}
        </>
      )}
    </div>
  );
}

// ─────────── Vista: CLIENTE (Parte 5) ───────────
function Cliente({ withV, u, stats, goal }) {
  const [tono, setTono] = useState(true);
  const reliable = useMemo(() => withV.filter((r) => r.spend >= u.pisoSpend), [withV, u.pisoSpend]);
  const topAng = aggregate(reliable, "ang")[0]?.key || "—";
  const wins = [...reliable].sort((a, b) => b.roas - a.roas).slice(0, 4);
  const pct = goal ? Math.min(100, (stats.revenue / goal) * 100) : 0;
  const resumen = tono
    ? `Mes sólido. La cuenta facturó ${short(stats.revenue)} con un ROAS de ${stats.accountRoas.toFixed(1)}x y ${nf.format(stats.ventasTotal)} ventas — al ${pct.toFixed(0)}% del objetivo del mes. El ángulo ${topAng} y los catálogos dinámicos lideraron el rendimiento, con varios anuncios listos para escalar en julio.`
    : `En junio la cuenta facturó ${short(stats.revenue)} con un ROAS de ${stats.accountRoas.toFixed(1)}x y ${nf.format(stats.ventasTotal)} ventas (${pct.toFixed(0)}% del objetivo). Mayor aporte: el ángulo ${topAng} y los catálogos. Quedan oportunidades de optimización para el próximo mes.`;
  return (
    <>
      <div className="repbar">
        <div><div className="reptitle">REPORTE MENSUAL · JUNIO 2026</div><div className="repsub">JUANITA SHOES · preparado por tu agencia</div></div>
        <div className="reptools">
          <button className={"toggle" + (tono ? " on" : "")} onClick={() => setTono(!tono)}><span className="knob" /></button>
          <span className="tlab">TONO POSITIVO</span>
        </div>
      </div>

      <section className="goal light">
        <div className="goalhead"><span className="goaltitle">OBJETIVO DEL MES</span><span className="repnote">→ exportable a PDF en la Parte 10</span></div>
        <div className="goalbar"><span style={{ width: pct + "%" }} /></div>
        <div className="goalnums"><div className="goalpct">{pct.toFixed(0)}<small>%</small></div><div className="goalstack"><div><b className="mono">{short(stats.revenue)}</b> <span className="soft">facturado de {short(goal)}</span></div></div></div>
      </section>

      <section className="kpis repk">
        <Kpi lab="FACTURACIÓN" val={short(stats.revenue)} mod="grn" />
        <Kpi lab="ROAS" val={stats.accountRoas.toFixed(1) + "x"} mod="grn" />
        <Kpi lab="VENTAS" val={nf.format(stats.ventasTotal)} />
      </section>

      <section className="sect">
        <div className="secthead"><span className="sverb" style={{ background: "#1E1812", color: "#F4C24A" }}><span className="sq" style={{ background: "#F4C24A" }} />★</span><span className="stitle">ANUNCIOS DESTACADOS</span></div>
        <div className="topgrid">
          {wins.map((r, i) => (
            <div className="topcard" key={r.id} style={{ "--bar": "#2E8B6B" }}>
              <div className="tcardtop"><span className="trank">{String(i + 1).padStart(2, "0")}</span><span className="winstar">★</span></div>
              <div className="tname">{r.nombre} <span className="fmt">{r.fmt}</span><TF r={r} /></div>
              <div className="troas grn">{r.roas.toFixed(1)}<small>x</small></div>
              <div className="tmeta mono">{r.ang} · {r.aud}</div>
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
function Top({ withV, u, audData }) {
  const [dim, setDim] = useState("ang");
  const reliable = useMemo(() => withV.filter((r) => r.spend >= u.pisoSpend), [withV, u.pisoSpend]);
  const MINV = 5;
  const data = useMemo(() => {
    if (dim === "aud" && audData && audData.length) return audData.map((g) => ({ ...g, roas: g.spend ? g.revenue / g.spend : 0 }));
    return aggregate(reliable, dim);
  }, [reliable, dim, audData]);
  const rankable = (g) => g.spend >= u.pisoSpend && g.ventas >= MINV;
  const ranked = data.filter(rankable);
  const thin = data.filter((g) => !rankable(g));
  const best = useMemo(() => { const ok = reliable.filter((r) => r.ventas >= MINV); return (ok.length ? ok : reliable).sort((a, b) => b.roas - a.roas)[0]; }, [reliable]);
  const max = Math.max(...ranked.map((d) => d.roas), 1);
  const colorFor = (roas) => roas >= u.roasMin ? BUCKETS.Escalar.color : roas >= u.roasMin * 0.85 ? BUCKETS.Mantener.color : BUCKETS.Pausar.color;
  const dims = [["ang", "Ángulo"], ["aud", "Audiencia"], ["hook", "Hook"], ["fmt", "Formato"]];
  return (
    <>
      {best && (
        <section className="combo">
          <div className="combohead"><span className="combotag">★ TU MEJOR COMBINACIÓN</span><span className="comboname">{best.nombre}</span><TF r={best} /></div>
          <div className="comborow">
            <div className="comboroas">{best.roas.toFixed(1)}<small>x</small></div>
            <div className="comborec"><Rec k="ÁNGULO" v={best.ang} /><Rec k="AUDIENCIA" v={best.aud} /><Rec k="HOOK" v={best.hook} /><Rec k="FORMATO" v={best.fmt} /></div>
          </div>
          <div className="combonote">Tu receta más rentable. Es la base ideal para el próximo creativo → la cableamos al generador en la <b>Parte 7</b>.</div>
        </section>
      )}
      <section className="sect">
        <div className="secthead"><span className="sverb" style={{ background: "#1E1812", color: "#F4C24A" }}><span className="sq" style={{ background: "#F4C24A" }} />RANK</span><span className="stitle">TOP PERFORMERS</span><span className="scount">spend ≥ piso</span></div>
        <div className="dimpills">{dims.map(([k, l]) => <button key={k} className={"dimpill" + (dim === k ? " on" : "")} onClick={() => setDim(k)}>{l}</button>)}</div>
        {dim === "ang" && <div className="dedup">▦ Ponderado por <b>split</b> (primaria/secundaria) — sin doble conteo. Un anuncio 70/30 suma 70% a su ángulo principal y 30% al secundario, no el total a cada uno.</div>}
        {dim === "aud" && audData && audData.length > 0 && <div className="dedup">▦ Audiencia tomada del nombre del conjunto (RMKT, LAL, Advantage+, etc.) y agregada a nivel anuncio — el mismo creativo corre en varias audiencias.</div>}
        {dim === "aud" && (!audData || !audData.length) && <div className="dedup">▦ La audiencia vive en el conjunto, no en el nombre del anuncio. Con datos en vivo se completa automáticamente.</div>}
        <div className="ranklist">
          {ranked.map((d, i) => (
            <div className="rankrow" key={d.key}>
              <span className="rrank">{String(i + 1).padStart(2, "0")}</span><span className="rname">{d.key}</span>
              <div className="rbar"><span className="rfill" style={{ width: (d.roas / max) * 100 + "%", background: colorFor(d.roas) }} /></div>
              <span className="rval" style={{ color: colorFor(d.roas) }}>{d.roas.toFixed(1)}x</span>
              <span className="rmeta">{short(d.spend)} · {nf.format(Math.round(d.ventas))} vtas · {d.n} ad{d.n !== 1 ? "s" : ""}</span>
            </div>))}
        </div>
        {thin.length > 0 && <div className="thinnote">⚠ Datos insuficientes para rankear ({"<"} {short(u.pisoSpend)} de spend ó {"<"} {MINV} ventas): {thin.map((g) => g.key).join(", ")}. Necesitan más inversión antes de declararlos ganadores o perdedores — no los muestro arriba para que el ranking tenga sentido.</div>}
      </section>
    </>
  );
}
function Rec({ k, v }) { return <div className="recchip"><span className="reck">{k}</span><span className="recv">{v}</span></div>; }

// ─────────── Vista: DASHBOARD (Parte 3) ───────────
function Dash({ stats, goal, setGoal }) {
  const pct = goal ? Math.min(100, (stats.revenue / goal) * 100) : 0;
  const falta = Math.max(0, goal - stats.revenue);
  return (
    <>
      <section className="goal">
        <div className="goalhead"><span className="goaltitle">OBJETIVO DEL MES · JUNIO</span><label className="goaledit">META<span className="finput"><i>$</i><input type="text" inputMode="numeric" value={goal} onChange={(e) => { const n = parseInt(String(e.target.value).replace(/[^\d]/g, ""), 10); setGoal(isNaN(n) ? 0 : n); }} /></span></label></div>
        <div className="goalbar"><span style={{ width: pct + "%" }} /></div>
        <div className="goalnums"><div className="goalpct">{pct.toFixed(0)}<small>%</small></div><div className="goalstack"><div><b className="mono">{short(stats.revenue)}</b> <span className="soft">facturado de {short(goal)}</span></div><div className="soft mono">faltan {short(falta)} · quedan 23 días</div></div></div>
      </section>
      <section className="kpis dashk">
        <Kpi lab="FACTURACIÓN" val={short(stats.revenue)} /><Kpi lab="INVERSIÓN" val={short(stats.spendTotal)} /><Kpi lab="ROAS CUENTA" val={stats.accountRoas.toFixed(1) + "x"} mod="grn" /><Kpi lab="CPA PROMEDIO" val={money(stats.cpaProm)} /><Kpi lab="VENTAS" val={nf.format(stats.ventasTotal)} />
      </section>
      <section className="sect">
        <div className="secthead"><span className="sverb" style={{ background: "#1E1812", color: "#F4C24A" }}><span className="sq" style={{ background: "#F4C24A" }} />TOP</span><span className="stitle">TOP ADS DEL MES</span><span className="scount">por ROAS · spend ≥ piso</span></div>
        <div className="topgrid">
          {stats.topAds.map((r, i) => { const b = BUCKETS[r.v]; return (
            <div className="topcard" key={r.id} style={{ "--bar": b.color }}>
              <div className="tcardtop"><span className="trank">{String(i + 1).padStart(2, "0")}</span><span className="badge" style={{ background: b.bg, color: b.color }}><span className="sq" style={{ background: b.color }} />{r.v}</span></div>
              <div className="tname">{r.nombre} <span className="fmt">{r.fmt}</span><TF r={r} /></div><div className="troas">{r.roas.toFixed(1)}<small>x</small></div><div className="tmeta mono">{short(r.spend)} spend · {r.ang}</div>
            </div>); })}
        </div>
      </section>
    </>
  );
}
function Kpi({ lab, val, mod }) { return <div className={"kpi" + (mod === "grn" ? " good" : "")}><div className="klab">{lab}</div><div className={"kval" + (mod === "grn" ? " grn" : "")}>{val}</div></div>; }

// ─────────── Vista: QUÉ HACER HOY (Parte 2) ───────────
function Hoy({ acc, u, done, toggle, total, doneCount, mantener }) {
  return (
    <>
      <div className="dayhead">
        <div><div className="daytitle">QUÉ HACER HOY</div><div className="daysub">07-06-26 · {acc.escalar.length} para escalar · {acc.apagar.length} para apagar/iterar · {acc.validar.length} para validar</div></div>
        <div className="progress"><div className="pbar"><span style={{ width: total ? `${(doneCount / total) * 100}%` : "0%" }} /></div><div className="pnum">{doneCount}/{total} HECHAS</div></div>
      </div>
      <Section title="ESCALÁ — SUBÍ EL CONJUNTO/CAMPAÑA" verb="Escalar" b={BUCKETS.Escalar} empty="Sin ganadores claros hoy.">
        {acc.escalar.map((r) => (<Item key={r.id} r={r} done={done.has(r.id)} toggle={toggle} c={BUCKETS.Escalar} reason={`ROAS ${r.roas.toFixed(1)}x · CPA ${money(r.cpa)} · spend ${money(r.spend)}`} act={`Subí ~+25% el budget del conjunto/campaña donde corre este creativo (o duplicalo en más conjuntos)`} />))}
      </Section>
      <Section title="PAUSÁ O ITERÁ" verb="Pausar" b={BUCKETS.Pausar} empty="Nada sangrando hoy 👌">
        {acc.apagar.map((r) => (<Item key={r.id} r={r} done={done.has(r.id)} toggle={toggle} c={BUCKETS.Pausar} reason={`ROAS ${r.roas.toFixed(1)}x — debajo de ${u.roasMin}x · spend ${money(r.spend)}`} act={r.modo === "apagar" ? "Pausá el anuncio" : `Iterá: ${r.ang} no rinde — probá ${r.bestAng}`} />))}
      </Section>
      <Section title="VALIDÁ" verb="Observación" b={{ color: "#0F6E56", bg: "#DFEAE4" }} empty="Sin promesas pendientes.">
        {acc.validar.map((r) => (<Item key={r.id} r={r} done={done.has(r.id)} toggle={toggle} c={{ color: "#0F6E56", bg: "#DFEAE4" }} reason={`ROAS ${r.roas.toFixed(1)}x prometedor, pero solo ${money(r.spend)} (bajo el piso)`} act={`Dale más budget al conjunto hasta cruzar ${money(u.pisoSpend)} y reevaluar`} />))}
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
  return (<div className={"item" + (done ? " done" : "")} style={{ "--bar": c.color }}><button className={"check" + (done ? " on" : "")} onClick={() => toggle(r.id)} style={{ "--c": c.color }}>{done ? "✓" : ""}</button><div className="ibody"><div className="iname">{r.nombre} <span className="fmt">{r.fmt}</span><TF r={r} /></div><div className="ireason">{reason}</div></div><span className="act" style={{ background: c.bg, color: c.color }}>{act}</span></div>);
}

// ─────────── Vista: PANEL DE CREATIVOS (Parte 1) ───────────
function Panel({ rows, stats, sort, setSortKey }) {
  return (
    <>
      <section className="kpis">
        <div className="kpi"><div className="klab">SPEND TOTAL</div><div className="kval">{short(stats.spendTotal)}</div></div>
        <div className="kpi flag"><div className="klab">ROAS PROMEDIO <span className="warn">⚠ INFLADO</span></div><div className="kval dim">{stats.roasSimple.toFixed(1)}x</div><div className="ksub">promedio simple de todos los creativos</div></div>
        <div className="kpi good"><div className="klab">ROAS CONFIABLE</div><div className="kval grn">{stats.roasConfiable.toFixed(1)}x</div><div className="ksub">ponderado, solo spend ≥ piso</div></div>
        <div className="kpi chips">{Object.entries(stats.counts).map(([k, n]) => (<div className="chip" key={k} style={{ background: BUCKETS[k].bg, color: BUCKETS[k].color }}><b>{n}</b> {k}</div>))}</div>
      </section>
      <section className="tablewrap">
        <table>
          <thead><tr>
            <Th label="Creativo" k="nombre" sort={sort} on={setSortKey} align="left" /><Th label="Ángulo (prim/sec · split)" align="left" /><Th label="Aud." align="left" />
            <Th label="Spend" k="spend" sort={sort} on={setSortKey} /><Th label="ROAS" k="roas" sort={sort} on={setSortKey} /><Th label="CPA" k="cpa" sort={sort} on={setSortKey} /><Th label="Veredicto" k="veredicto" sort={sort} on={setSortKey} align="left" />
          </tr></thead>
          <tbody>
            {rows.map((r) => { const b = BUCKETS[r.v]; return (
              <tr key={r.id} style={{ "--bar": b.color }}>
                <td className="name">{r.nombre} <span className="fmt">{r.fmt}</span><TF r={r} /></td>
                <td className="ang">{r.ang}{r.sec !== "—" ? <span className="sec"> / {r.sec}</span> : null}<span className="split">{r.split}</span></td>
                <td className="aud">{r.aud}</td><td className="mono num">{money(r.spend)}</td><td className="mono num strong">{r.roas.toFixed(1)}x</td><td className="mono num">{money(r.cpa)}</td>
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
function Biblioteca() {
  const [tab, setTab] = useState("hooks");
  const [q, setQ] = useState("");
  const [eje, setEje] = useState("Todos");
  const [cat, setCat] = useState("Todas");
  const [copied, setCopied] = useState(null);
  const copy = (text, id) => { try { navigator.clipboard.writeText(text); } catch (e) {} setCopied(id); setTimeout(() => setCopied(null), 1200); };
  const ql = q.trim().toLowerCase();
  const ejes = ["Todos", "Identidad", "Ruptura", "Pérdida", "Evidencia"];
  const ejeCount = (e) => HOOKS.filter((h) => e === "Todos" || h[3] === e).length;
  const fHooks = HOOKS.filter((h) => (eje === "Todos" || h[3] === eje) && (!ql || h[1].toLowerCase().includes(ql) || h[2].toLowerCase().includes(ql)));
  const shown = fHooks.slice(0, 80);
  const cats = ["Todas"].concat(Array.from(new Set(PROMPTS.map((p) => p.cat))));
  const fProm = PROMPTS.filter((p) => (cat === "Todas" || p.cat === cat) && (!ql || p.title.toLowerCase().includes(ql) || p.text.toLowerCase().includes(ql)));
  return (
    <section className="bib">
      <div className="bibtabs">
        <button className={"bibtab" + (tab === "hooks" ? " on" : "")} onClick={() => { setTab("hooks"); setQ(""); }}>HOOKS <span className="bibn">{HOOKS.length}</span></button>
        <button className={"bibtab" + (tab === "prompts" ? " on" : "")} onClick={() => { setTab("prompts"); setQ(""); }}>PROMPTS <span className="bibn">{PROMPTS.length}</span></button>
        <input className="search" placeholder={tab === "hooks" ? "buscar hook o familia..." : "buscar prompt..."} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {tab === "hooks" ? (
        <>
          <div className="ejefilt">
            {ejes.map((e) => (<button key={e} className={"ejepill" + (eje === e ? " on" : "")} onClick={() => setEje(e)} style={eje === e && e !== "Todos" ? { background: EJECOLOR[e], borderColor: EJECOLOR[e], color: "#F3EBD9" } : null}>{e} <b>{ejeCount(e)}</b></button>))}
          </div>
          <div className="hooklist">
            {shown.map((h) => (
              <div className="hookcard" key={h[0]} style={{ "--ec": EJECOLOR[h[3]] || "#857A66" }}>
                <span className="hnum">{String(h[0]).padStart(3, "0")}</span>
                <div className="hmid"><span className="htext">{h[1]}</span><span className="htags"><span className="ftag">{h[2]}</span><span className="ejetag" style={{ color: EJECOLOR[h[3]] }}>{h[3]}</span></span></div>
                <button className="copybtn" onClick={() => copy(h[1], "h" + h[0])}>{copied === "h" + h[0] ? "✓" : "⧉"}</button>
              </div>))}
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

function Generar() {
  const angles = Array.from(new Set(SAMPLE.map((r) => r.ang)));
  const auds = Array.from(new Set(SAMPLE.map((r) => r.aud)));
  const [f, setF] = useState({ producto: "Botas texanas", angulo: "Reseña", audiencia: "Retargeting", hookStyle: "Evidencia", formula: "AIDA", emoji: false });
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(null);
  const copy = (t, id) => { try { navigator.clipboard.writeText(t); } catch (e) {} setCopied(id); setTimeout(() => setCopied(null), 1200); };

  const generar = async () => {
    setLoading(true); setErr(""); setOut(null);
    const estilo = f.hookStyle === "automático" ? "el que mejor funcione para este ángulo" : f.hookStyle + " — " + STYLEDESC[f.hookStyle];
    const prompt = `Sos un copywriter senior de respuesta directa para Meta Ads de ecommerce en Argentina (tono porteño, tratá de "vos"). Generá copy de alto rendimiento para tráfico frío.

Producto: ${f.producto}
Ángulo publicitario: ${f.angulo}
Audiencia: ${f.audiencia}
Estilo de hook: ${estilo}
Fórmula de copy: ${f.formula}
Emojis: ${f.emoji ? "usá emojis con moderación" : "sin emojis"}

Respetá los límites de Meta: Headline máx 40 caracteres, Description máx 40, Primary Text máx 125.
Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin explicaciones, sin backticks) con esta forma exacta:
{"headlines":["h1","h2","h3","h4","h5"],"descriptions":["d1","d2","d3","d4","d5"],"primary_texts":["p1","p2","p3"]}`;
    try {
      const res = await fetch("/api/copy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      setOut(JSON.parse(clean));
    } catch (e) {
      setErr("No se pudo generar. El generador usa IA y corre dentro de la app de Claude — probalo desde ahí. (" + e.message + ")");
    } finally { setLoading(false); }
  };

  const block = (title, items, limit, pre) => items && (
    <div className="genblock" key={pre}>
      <div className="genblockh">{title} <span className="gblim">máx {limit}</span></div>
      {items.map((t, i) => { const over = t.length > limit; return (
        <div className="outitem" key={pre + i}>
          <span className="outtext">{t}</span>
          <span className={"outmeta" + (over ? " over" : "")}>{t.length}/{limit}</span>
          <button className="copybtn" onClick={() => copy(t, pre + i)}>{copied === pre + i ? "✓" : "⧉"}</button>
        </div>); })}
    </div>
  );

  const sel = (key, opts) => (<select className="gensel" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>);

  return (
    <section className="gen">
      <div className="genintro">Generá copy con IA usando lo que ya te funciona. Viene cargado con tu mejor combinación; ajustá y dale a generar.</div>
      <div className="genform">
        <label className="gfield"><span className="flab">Producto</span><input className="gentext" value={f.producto} onChange={(e) => setF({ ...f, producto: e.target.value })} /></label>
        <label className="gfield"><span className="flab">Ángulo</span>{sel("angulo", angles)}</label>
        <label className="gfield"><span className="flab">Audiencia</span>{sel("audiencia", auds)}</label>
        <label className="gfield"><span className="flab">Estilo de hook</span>{sel("hookStyle", HOOKSTYLES)}</label>
        <label className="gfield"><span className="flab">Fórmula</span>{sel("formula", FORMULAS)}</label>
        <label className="gfield"><span className="flab">Emojis</span><button className={"toggle" + (f.emoji ? " on" : "")} onClick={() => setF({ ...f, emoji: !f.emoji })}><span className="knob" /></button></label>
      </div>
      <button className="genbtn" onClick={generar} disabled={loading}>{loading ? "● GENERANDO..." : "▶ GENERAR COPY"}</button>
      {err && <div className="generr">{err}</div>}
      {out && <div className="genout">{block("HEADLINES", out.headlines, 40, "h")}{block("DESCRIPTIONS", out.descriptions, 40, "d")}{block("PRIMARY TEXTS", out.primary_texts, 125, "p")}</div>}
    </section>
  );
}

function Field({ label, value, onChange, prefix, suffix, step, locked }) {
  const [txt, setTxt] = useState(String(value));
  if (locked) return (<label className="field"><span className="flab">{label}</span><span className="fstatic">{prefix || ""}{value}{suffix || ""}</span></label>);
  return (<label className="field"><span className="flab">{label}</span>
    <span className="finput">{prefix && <i>{prefix}</i>}<input type="text" inputMode="decimal" value={txt} onChange={(e) => { const raw = e.target.value; setTxt(raw); const n = parseFloat(raw.replace(",", ".")); if (!isNaN(n)) onChange(n); }} />{suffix && <i>{suffix}</i>}</span>
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

.top{background:var(--ink);border:2px solid var(--ink);border-radius:12px;overflow:hidden;box-shadow:5px 5px 0 #1e181233;}
.topinner{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;color:var(--paper);}
.brand{display:flex;gap:15px;align-items:center;}
.mark{width:42px;height:42px;display:grid;place-items:center;border:2px solid var(--paper);color:var(--paper);border-radius:8px;font-size:18px;}
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

.rolebar{display:flex;align-items:center;gap:14px;margin:16px 0 4px;}
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
.dimpills{display:flex;gap:7px;margin-bottom:12px;}
.dimpill{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:1px;color:var(--ink);background:var(--paper2);border:2px solid var(--ink);padding:6px 13px;border-radius:6px;cursor:pointer;}
.dimpill.on{background:var(--ink);color:var(--paper);}
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
.ang{color:var(--ink);}.sec{color:var(--soft);}
.split{font-family:'Space Mono',monospace;font-size:10px;color:var(--soft);background:var(--paper);border:1px solid var(--line);border-radius:3px;padding:1px 5px;margin-left:7px;}
.aud{color:var(--soft);font-size:12px;}.strong{font-weight:700;}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:4px 11px;border-radius:5px;border:2px solid currentColor;}
.sq{width:8px;height:8px;border-radius:2px;display:inline-block;}
.legend{display:flex;flex-wrap:wrap;gap:18px;margin-top:16px;padding:0 4px;}
.leg{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--soft);font-family:'Space Mono',monospace;}.leg b{margin-right:2px;}
/* GENERAR */
.genintro{font-family:'Space Mono',monospace;font-size:12px;color:var(--soft);margin-bottom:14px;}
.genform{display:grid;grid-template-columns:repeat(3,1fr);gap:14px 16px;background:var(--paper2);border:2px solid var(--ink);border-radius:10px;padding:16px 18px;box-shadow:4px 4px 0 var(--ink);margin-bottom:16px;}
.gfield{display:flex;flex-direction:column;gap:6px;align-items:flex-start;}
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
