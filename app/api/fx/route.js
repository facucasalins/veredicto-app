import { getDolarOficial } from "@/lib/fx";

export const dynamic = "force-dynamic";

// Cotización del dólar oficial (promedio compra/venta) para que el front convierta a pesos toda la
// data de Meta cuando la cuenta está en USD. Si no se puede cotizar, devuelve error y el front
// degrada mostrando los montos sin convertir.
export async function GET() {
  try {
    const d = await getDolarOficial();
    return Response.json({ rate: d.rate, compra: d.compra, venta: d.venta, fuente: d.fuente, fecha: d.fecha });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
