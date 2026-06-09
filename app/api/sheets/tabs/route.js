import { listTabs } from "../../../../lib/sheet";

export async function GET() {
  try {
    return Response.json({ tabs: await listTabs() });
  } catch (e) {
    return Response.json({ tabs: [], error: e.message }); // si falla, dropdown vacío y el panel anda igual
  }
}
