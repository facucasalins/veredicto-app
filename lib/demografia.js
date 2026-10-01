// Demografía y ubicación: performance de la cuenta POR CORTE (edad, género, zona, ubicación). Lo
// comparten la pestaña DEMOGRAFÍA (/api/demografia) y la tool meta_demografia del chat, así los dos
// muestran exactamente los mismos números. Todas las métricas derivadas se calculan ACÁ, en código
// (CTR, CPM, CPC, CPA, ROAS, costo por conversación, hook rate) — el modelo no divide nada.
import { getBreakdown, CORTES } from "@/lib/meta";
import { platformOf } from "@/lib/multi";

export { CORTES };

const r2 = (x) => Math.round(x * 100) / 100;

// Tasas sobre las sumas de un segmento. null = no se puede calcular (división por cero), nunca 0
// inventado: un CPA "0" se leería como gratis.
function metricas(s, spendTotal) {
  return {
    segmento: s.segmento,
    spend: Math.round(s.spend),
    pct_spend: spendTotal ? r2((s.spend / spendTotal) * 100) : null,
    impresiones: Math.round(s.impresiones),
    clics: Math.round(s.clics),
    ctr: s.impresiones ? r2((s.clics / s.impresiones) * 100) : null, // %
    cpm: s.impresiones ? Math.round((s.spend / s.impresiones) * 1000) : null,
    cpc: s.clics ? r2(s.spend / s.clics) : null,
    ventas: Math.round(s.ventas),
    cpa: s.ventas ? Math.round(s.spend / s.ventas) : null,
    ingresos: Math.round(s.ingresos),
    roas: s.spend ? r2(s.ingresos / s.spend) : null,
    conversaciones: Math.round(s.conversaciones),
    costo_conv: s.conversaciones ? r2(s.spend / s.conversaciones) : null,
    video_3s: Math.round(s.video3s),
    hook_rate: s.impresiones ? r2((s.video3s / s.impresiones) * 100) : null, // %
  };
}

// cuentas = [{ id, cur }], rateOf(cur) → factor a pesos. Solo Meta tiene estos cortes: las cuentas
// de Google/TikTok de la vista se informan en `omitidas`, no se mezclan. Si TODAS las de Meta
// fallan, tira el error (la ruta/tool lo devuelve como {error}); si falla alguna, va en `errores`.
export async function demografia({ cuentas, corte, since, until, filtro = {}, rateOf = () => 1 }) {
  if (!CORTES[corte]) throw new Error(`Corte inválido: ${corte} (usá ${Object.keys(CORTES).join(", ")})`);
  const meta = cuentas.filter((c) => platformOf(c.id) === "Meta");
  const omitidas = cuentas.filter((c) => platformOf(c.id) !== "Meta").map((c) => platformOf(c.id));
  if (!meta.length) throw new Error("Los cortes por edad, género, zona y ubicación solo están disponibles para cuentas de Meta.");

  const res = await Promise.all(meta.map((c) => getBreakdown(c.id, corte, since, until, filtro)
    .then((segs) => ({ c, segs }), (e) => ({ c, error: e.message }))));
  const errores = res.filter((x) => x.error).map((x) => x.error);
  if (errores.length === res.length) throw new Error(errores.join(" · "));

  // suma por segmento entre cuentas, con la plata ya en pesos
  const acc = {};
  for (const { c, segs } of res.filter((x) => !x.error)) {
    const rf = rateOf(c.cur);
    for (const s of segs) {
      const a = acc[s.segmento] || (acc[s.segmento] = { segmento: s.segmento, spend: 0, impresiones: 0, clics: 0, ventas: 0, ingresos: 0, conversaciones: 0, video3s: 0 });
      a.spend += s.spend * rf; a.ingresos += s.ingresos * rf;
      a.impresiones += s.impresiones; a.clics += s.clics; a.ventas += s.ventas; a.conversaciones += s.conversaciones; a.video3s += s.video3s;
    }
  }
  const lista = Object.values(acc);
  const tot = lista.reduce((t, s) => { for (const k of ["spend", "impresiones", "clics", "ventas", "ingresos", "conversaciones", "video3s"]) t[k] += s[k]; return t; },
    { segmento: "TOTAL", spend: 0, impresiones: 0, clics: 0, ventas: 0, ingresos: 0, conversaciones: 0, video3s: 0 });
  return {
    since, until, corte, moneda: "ARS",
    ...(filtro.campania || filtro.creativo ? { filtro } : {}),
    segmentos: lista.filter((s) => s.spend > 0 || s.impresiones > 0).map((s) => metricas(s, tot.spend)).sort((a, b) => b.spend - a.spend),
    total: metricas(tot, tot.spend),
    ...(errores.length ? { errores } : {}),
    ...(omitidas.length ? { omitidas: [...new Set(omitidas)] } : {}),
  };
}
