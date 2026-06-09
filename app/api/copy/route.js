export const dynamic = "force-dynamic";
export async function POST(req) {
  const { prompt, system, max_tokens, model } = await req.json();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "Falta ANTHROPIC_API_KEY" }, { status: 500 });
  try {
    const body = {
      model: model || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: max_tokens || 1500,
      messages: [{ role: "user", content: prompt }],
    };
    if (system) body.system = system;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    return Response.json(await r.json());
  } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
