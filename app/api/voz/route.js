import { leerVoz, guardarVoz, nuevoItem, extraerVoz, cruzarVoz, VOZ_TIPOS, VOZ_FUENTES } from "@/lib/voz";
import { storeEnabled } from "@/lib/store";
import { autorizar } from "../conciencia/_auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Voz de las clientas (inventario por pestaña del Sheet). Todo por POST con `action`:
//   listar               → { voz: [...], cache }
//   extraer {texto}      → { propuestas: [...] } (no guarda)
//   guardar {items:[{...propuesta, aceptar:true}]} → crea o suma veces_visto (mismo_que) → { voz }
//   manual {item}        → alta de a uno → { voz }
//   editar {id, cambios} / borrar {id} → { voz }
//   cruzar {motivadores:[{motivador,...}], voz?} → { cruce: {vozId → motivador|null} } (cacheado)
export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch {}
  const auth = await autorizar(body);
  if (auth.error) return auth.error;
  const tab = String(body.tab);
  try {
    const voz = await leerVoz(tab);
    switch (body.action) {
      case "listar": return Response.json({ voz, cache: storeEnabled() });
      case "extraer": {
        if (!body.texto || String(body.texto).trim().length < 20) return Response.json({ error: "Pegá texto (al menos unas líneas)" }, { status: 400 });
        return Response.json({ propuestas: await extraerVoz(String(body.texto), voz) });
      }
      case "guardar": {
        const items = (Array.isArray(body.items) ? body.items : []).filter((x) => x && x.aceptar !== false && x.frase_literal);
        const lista = [...voz];
        for (const it of items) {
          const ex = it.mismo_que && lista.find((v) => v.id === it.mismo_que);
          if (ex) { ex.veces_visto = (ex.veces_visto || 1) + (Math.max(1, parseInt(it.veces_visto, 10) || 1)); ex.fecha = new Date().toISOString().slice(0, 10); continue; }
          lista.push(nuevoItem({ ...it, fuente: VOZ_FUENTES.includes(body.fuente) ? body.fuente : it.fuente }));
        }
        await guardarVoz(tab, lista);
        return Response.json({ voz: lista, agregados: items.length });
      }
      case "manual": {
        if (!body.item || !body.item.frase_literal) return Response.json({ error: "Falta la frase" }, { status: 400 });
        const lista = [...voz, nuevoItem({ ...body.item, fuente: "manual" })];
        await guardarVoz(tab, lista); return Response.json({ voz: lista });
      }
      case "editar": {
        const lista = voz.map((v) => (v.id === body.id ? { ...v, tipo: VOZ_TIPOS.includes(body.cambios?.tipo) ? body.cambios.tipo : v.tipo, resumen: body.cambios?.resumen != null ? String(body.cambios.resumen).slice(0, 120) : v.resumen, frase_literal: body.cambios?.frase_literal != null ? String(body.cambios.frase_literal).slice(0, 240) : v.frase_literal } : v));
        await guardarVoz(tab, lista); return Response.json({ voz: lista });
      }
      case "borrar": { const lista = voz.filter((v) => v.id !== body.id); await guardarVoz(tab, lista); return Response.json({ voz: lista }); }
      case "cruzar": {
        const lista = Array.isArray(body.voz) && body.voz.length ? body.voz : voz; // sin Upstash el front manda su lista
        return Response.json({ cruce: await cruzarVoz(tab, lista, Array.isArray(body.motivadores) ? body.motivadores : []) });
      }
      default: return Response.json({ error: "action inválida" }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.code === 409 ? 409 : 500 });
  }
}
