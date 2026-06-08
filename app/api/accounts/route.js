import { getAccounts } from "@/lib/meta";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const accounts = await getAccounts(); return Response.json({ accounts }); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
