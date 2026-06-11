import { cookies } from "next/headers";
import { getAds, getAdsetBudgets } from "@/lib/meta";
import { getStoreRevenue } from "@/lib/tiendanube";
import { convertMonto } from "@/lib/fx";
import { presetToRange } from "@/lib/dates";
import { SESSION_COOKIE, verifySession, authDisabled, canSeeAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SYSTEM = `Sos un media buyer senior y planificador de presupuestos para ecommerce en Argentina. Hablás en español rioplatense (vos), directo. Te paso un resumen YA CALCULADO del MES EN CURSO de una cuenta de META: la meta de facturación, lo facturado hasta hoy (MTD), la inversión en Meta, el MER, los días que faltan, y las UNIDADES DE PRESUPUESTO reales (cada una es un adset si la campaña es ABO, o una campaña si es CBO) con su budget diario actual, spend del mes, ROAS, ventas y estado.

CONTEXTO CLAVE SOBRE EL MER — NO LO USES PARA PROYECTAR:
La facturación de la tienda la empujan VARIOS canales (Meta, Google, TikTok, orgánico, recompra). Acá solo ves la inversión de META, así que el MER (facturación total ÷ inversión Meta) NO es el retorno de Meta: está inflado por los otros canales. Si proyectás "facturación extra = inversión extra × MER" estás asumiendo que Meta genera todo, y eso es FALSO. El MER te sirve solo como contexto de salud general y para detectar tendencia, nunca como multiplicador.

CÓMO PROYECTAR (en su lugar): usá la data ATRIBUIDA por la plataforma a nivel unidad — el ROAS y las ventas de cada unidad son lo que Meta efectivamente atribuye a esa plata. Facturación incremental esperada ≈ Σ (inversión extra en la unidad × ROAS esperado de esa unidad en el escenario). El ROAS esperado NUNCA es el actual al escalar: aplicale decaimiento por saturación según el escenario y el tamaño del salto de budget (saltos chicos ~10-20% degradan poco; duplicar budget degrada mucho).

Tu tarea: armar un plan para llegar a la meta, en TRES escenarios — PESIMISTA, NORMAL y OPTIMISTA — que se diferencian por cuánto asumís que decae el ROAS de cada unidad al escalar:
- Pesimista: decaimiento fuerte (auction saturada, fatiga creativa). Escalar rinde bastante menos que el ROAS actual.
- Normal: decaimiento moderado, el esperable al subir budget con creativos sanos.
- Optimista: las unidades top tienen margen real y el ROAS casi aguanta.

REGLAS DURAS:
- Usá SOLO los números del resumen. No inventes. Cada acción se apoya en un número (citalo: ROAS, budget, spend).
- Proyectá SIEMPRE desde el ROAS por unidad con decaimiento, NUNCA desde el MER (ver arriba). La facturacion_proyectada del escenario = facturado MTD + ritmo actual por los días restantes + el incremental de tus acciones.
- Concentrá la inversión en las unidades más eficientes CON margen; recomendá DESINVERTIR/reasignar lo que sangra (ROAS bajo, mucho spend). Mové budget de lo malo a lo bueno antes de pedir plata nueva.
- Para cada acción decí la unidad, su nivel (ABO/CBO), y el budget diario de→a (o pausar). Recordá que faltan N días: la inversión extra total = extra diario × días restantes.
- Si ni el escenario optimista llega a la meta CON la inversión de Meta sola, decilo con honestidad y aclará que el resto debe venir de otros canales (Google/TikTok/orgánico) que acá no ves.
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
  const accCur = (searchParams.get("accCur") || "").toUpperCase(); // moneda de la cuenta de Meta (USD/ARS)
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
    // Conversión de moneda: si la cuenta de Meta está en USD, pasamos TODA la plata de Meta
    // (inversión, budgets, spend, costo/conv) a pesos (o a la moneda de la tienda si difiere),
    // igual que el resto del panel. Aplica CON o SIN tienda y en ambos modos — si no, el plan
    // razonaría en otra moneda que la app. Los ratios (ROAS) y conteos no se tocan.
    const tCur = String((tienda && tienda.moneda) || "ARS").toUpperCase();
    let rate = null;
    if (accCur && accCur !== tCur) {
      try { const c = await convertMonto(1, accCur, tCur); if (c.rate) rate = c.monto; } catch { /* sin cotización: seguimos sin convertir */ }
    }
    const conv = (x) => (rate && x != null ? Math.round(x * rate) : x); // monto USD → pesos
    const convF = (x) => (rate && x != null ? x * rate : x); // sin redondear (costo/conv chico)

    const inversionConv = conv(inversion);
    const facturacion = tienda ? tienda.facturacion : conv(Math.round(revenueMeta));
    const mer = inversionConv ? +(facturacion / inversionConv).toFixed(2) : null;
    const proyeccion = diasTrans ? Math.round(facturacion / diasTrans * diasMes) : facturacion;

    const unidades = Object.values(units)
      .map((u) => ({ nombre: u.nombre, nivel: u.nivel, campania: u.campania, budget_diario: conv(u.budget_diario), spend_mtd: conv(Math.round(u.spend)), activa: u.activa, ...(msg ? { conversaciones: Math.round(u.conversaciones), costo_conv: u.conversaciones ? +convF(u.spend / u.conversaciones).toFixed(2) : 0 } : { roas: u.spend ? +(u.revenue / u.spend).toFixed(1) : 0, ventas: Math.round(u.ventas) }) }))
      .sort((a, b) => b.spend_mtd - a.spend_mtd).slice(0, 25);

    const snapshot = msg ? {
      modo, dias_transcurridos: diasTrans, dias_del_mes: diasMes, dias_restantes: diasRestan,
      conversaciones_mtd: convTotal, inversion_mtd: inversionConv, costo_conv: convTotal ? +convF(inversion / convTotal).toFixed(2) : 0,
      ...(rate ? { moneda: tCur, nota_moneda: `inversión y budgets convertidos de ${accCur} a ${tCur} al dólar oficial ($${Math.round(rate)})` } : {}),
      proyeccion_conversaciones: diasTrans ? Math.round(convTotal / diasTrans * diasMes) : convTotal,
      unidades,
    } : {
      modo, meta: goal, facturacion_mtd: facturacion, inversion_mtd: inversionConv, mer,
      fuente_facturacion: tienda ? "tienda" : "meta (pixel)",
      ...(rate ? { moneda: tCur, nota_moneda: `inversión y budgets convertidos de ${accCur} a ${tCur} al dólar oficial ($${Math.round(rate)})` } : {}),
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
