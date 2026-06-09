import { listStores } from "@/lib/tiendanube";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return Response.json({ stores: listStores() }); }
  catch (e) { return Response.json({ stores: [], error: e.message }); } // degradación: dropdown vacío, panel anda igual
}
