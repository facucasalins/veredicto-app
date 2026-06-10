import { cookies } from "next/headers";
import { getAds, getAdsetBudgets } from "@/lib/meta";
import { getStoreRevenue } from "@/lib/tiendanube";
import { presetToRange } from "@/lib/dates";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SYSTEM = `Sos un media buyer senior y planificador de presupuestos para ecommerce en Argentina. Hablás en español rioplatense (vos), directo. Te paso un resumen YA CALCULADO del MES EN CURSO de una cuenta: la meta de facturación, lo facturado hasta hoy (MTD), la inversión, el MER (facturación ÷ inversión), los días que faltan, y las UNIDADES DE PRESUPUESTO reales (cada una es un adset si la campaña es ABO, o una campaña si es CBO) con su budget diario actual, spend del mes, ROAS, ventas y estado.

Tu tarea: armar un plan para llegar a la meta, en TRES escenarios — PESIMISTA, NORMAL y OPTIMISTA — que se diferencian por cómo asumís que se comporta la EFICIENCIA al escalar:
- Pesimista: el MER/ROAS cae al meter más plata (saturación). Necesitás invertir más para el mismo retorno.
- Normal: la eficiencia se mantiene parecida.
- Optimista: hay margen y la eficiencia aguanta o mejora.

REGLAS DURAS:
- Usá SOLO los números del resumen. No inventes. Cada acción se apoya en un número (citalo: ROAS, budget, spend).
- El puente para proyectar es el MER: facturación extra ≈ inversión extra × MER (ajustá el MER por escenario). NO seas lineal ni naíf ("ROAS 20, meté 30% más"): pensá en qué unidades tienen margen real, cuáles ya están saturadas, y la mezcla.
- Concentrá la inversión en las unidades más eficientes con margen; recomendá DESINVERTIR/reasignar lo que sangra (ROAS bajo, mucho spend).
- Para cada acción decí la unidad, su nivel (ABO/CBO), y el budget diario de→a (o pausar). Recordá que faltan N días: la inversión extra total = extra diario × días restantes.
- Si ni el escenario optimista llega a la meta, decilo con honestidad.
- SÉ CONCISO: máximo 5 acciones por escenario (las de mayor impacto), "porque" en una frase corta. Máximo 4 ítems en desinversión.

SI modo="mensajes" (campañas de mensajería): NO hay facturación, ROAS ni meta de plata. El resultado son CONVERSACIONES y la eficiencia es el COSTO POR CONVERSACIÓN (menor = mejor). El plan es de OPTIMIZACIÓN: cómo escalar conversaciones manteniendo o bajando el costo por conversación. Los 3 escenarios se diferencian por cómo asumís que se comporta el costo por conversación al escalar (sube por saturación / se mantiene / baja). Concentrá budget en las unidades con costo por conversación más bajo y margen; desinvertí las de costo alto o sin conversaciones. En vez de "facturacion_proyectada" y "alcanza_meta", devolvé "conversaciones_proyectadas" (cuántas conversaciones proyectás al cierre del mes en ese escenario).

Devolvé EXCLUSIVAMENTE JSON válido sin markdown ni backticks.
- modo ventas: {"resumen":"...","escenarios":[{"nombre":"Pesimista","supuesto":"breve","inversion_extra_diaria":N,"inversion_extra_total":N,"facturacion_proyectada":N,"alcanza_meta":true|false,"acciones":[{"unidad":"nombre","nivel":"ABO|CBO","accion":"subir|bajar|pausar|mantener","de":N,"a":N,"porque":"breve, con número"}]},{"nombre":"Normal",...},{"nombre":"Optimista",...}],"desinversion":["..."]}
- modo mensajes: igual pero cada escenario con "conversaciones_proyectadas":N en vez de "facturacion_proyectada" y "alcanza_meta".`;

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get("account");
  const store = searchParams.get("store");
  const goal = +(searchParams.get("goal") || 0);
  const modo = searchParams.get("modo") || "ventas";
  const msg = modo === "mensajes";
  if (!account) return Response.json({ error: "falta account" }, { status: 400 });
  if (!msg && !goal) return Response.json({ error: "definí la meta del mes primero" }, { status: 400 });

  const sess = authDisabled() ? { admin: true } : await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!sess) return Response.json({ error: "No autorizado" }, { status: 401 });
  if (!canSeeAccount(sess, account)) return Response.json({ error: "Sin acceso a esta cuenta" }, { status: 403 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });

  const { since, until } = presetToRange("this_month");
  const now = new Date();
  const diasMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const diasTrans = now.getDate();
  const diasRestan = Math.max(0, diasMes - diasTrans);

  try {
    const [ads, budgets, tienda] = await Promise.all([
      getAds(account, "this_month", { since, until }),
      getAdsetBudgets(account).catch(() => ({})),
      store ? getStoreRevenue(store, since, until).catch(() => null) : Promise.resolve(null),
    ]);

    // agregamos por unidad de presupuesto (adset si ABO, campaña si CBO). En mensajes solo contamos
    // unidades de campañas de mensajería (optimization_goal CONVERSATIONS / destino mensajería).
    const isMsg = (a) => { const b = budgets[a.adset_id]; return b && b.tipo === "mensajes"; };
    const units = {};
    let inversion = 0, revenueMeta = 0, convTotal = 0;
    for (const a of ads) {
      const b = budgets[a.adset_id];
      const esMsg = b && b.tipo === "mensajes";
      if (msg ? !esMsg : esMsg) continue; // filtramos por modo
      inversion += a.spend; revenueMeta += a.spend * a.roas; convTotal += (a.conversaciones || 0);
      const key2 = b ? b.unidad : "adset:" + a.adset_id;
      if (!units[key2]) units[key2] = { nombre: (b && b.unidad_nombre) || a.adset || "?", nivel: (b && b.nivel) || "?", campania: (b && b.campaign) || a.campaign || "", budget_diario: b ? b.budget_diario : null, spend: 0, revenue: 0, ventas: 0, conversaciones: 0, activa: false };
      const u = units[key2];
      u.spend += a.spend; u.revenue += a.spend * a.roas; u.ventas += a.ventas; u.conversaciones += (a.conversaciones || 0);
      if (b && b.status === "ACTIVE") u.activa = true;
    }
    const facturacion = tienda ? tienda.facturacion : Math.round(revenueMeta);
    const mer = inversion ? +(facturacion / inversion).toFixed(2) : null;
    const proyeccion = diasTrans ? Math.round(facturacion / diasTrans * diasMes) : facturacion;

    const unidades = Object.values(units)
      .map((u) => ({ nombre: u.nombre, nivel: u.nivel, campania: u.campania, budget_diario: u.budget_diario, spend_mtd: Math.round(u.spend), activa: u.activa, ...(msg ? { conversaciones: Math.round(u.conversaciones), costo_conv: u.conversaciones ? Math.round(u.spend / u.conversaciones) : 0 } : { roas: u.spend ? +(u.revenue / u.spend).toFixed(1) : 0, ventas: Math.round(u.ventas) }) }))
      .sort((a, b) => b.spend_mtd - a.spend_mtd).slice(0, 25);

    const snapshot = msg ? {
      modo, dias_transcurridos: diasTrans, dias_del_mes: diasMes, dias_restantes: diasRestan,
      conversaciones_mtd: convTotal, inversion_mtd: Math.round(inversion), costo_conv: convTotal ? Math.round(inversion / convTotal) : 0,
      proyeccion_conversaciones: diasTrans ? Math.round(convTotal / diasTrans * diasMes) : convTotal,
      unidades,
    } : {
      modo, meta: goal, facturacion_mtd: facturacion, inversion_mtd: Math.round(inversion), mer,
      fuente_facturacion: tienda ? "tienda" : "meta (pixel)",
      dias_transcurridos: diasTrans, dias_del_mes: diasMes, dias_restantes: diasRestan,
      proyeccion_sin_cambios: proyeccion, gap_vs_meta: Math.round(goal - proyeccion),
      unidades,
    };

    const prompt = "Resumen del mes en curso (JSON):\n" + JSON.stringify(snapshot, null, 1) + "\n\nArmá el plan en los 3 escenarios.";
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 4500, system: SYSTEM, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await r.json();
    if (data.error) return Response.json({ error: data.error.message || "Error de Claude" }, { status: 500 });
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const plan = JSON.parse(text.replace(/```json|```/g, "").trim());
    return Response.json({ plan, snapshot });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
