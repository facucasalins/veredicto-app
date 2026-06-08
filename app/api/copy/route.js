export const dynamic = "force-dynamic";
export async function POST(req) {
  const { prompt } = await req.json();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
    });
    return Response.json(await r.json());
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
