// lib/dates.js
// Convierte un date_preset de Meta a un rango concreto { since, until } (YYYY-MM-DD).
// Lo usamos para pedirle a Tienda Nube y a Meta el MISMO rango exacto, así facturación e inversión
// quedan comparables (mismo período de los dos lados), sin depender de cómo interpreta Meta cada preset.

const ymd = (d) => d.toISOString().slice(0, 10);

export function presetToRange(preset) {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  const lastN = (n) => start.setUTCDate(end.getUTCDate() - (n - 1));
  switch (preset) {
    case "today": break;
    case "yesterday": start.setUTCDate(end.getUTCDate() - 1); end.setUTCDate(end.getUTCDate() - 1); break;
    case "last_7d": lastN(7); break;
    case "last_14d": lastN(14); break;
    case "last_30d": lastN(30); break;
    case "last_90d": lastN(90); break;
    case "this_month": start.setUTCDate(1); break;
    case "last_month":
      start.setUTCMonth(end.getUTCMonth() - 1, 1);
      end.setUTCDate(0); // último día del mes anterior
      break;
    case "maximum": start.setUTCFullYear(end.getUTCFullYear() - 3); break; // ~3 años hacia atrás
    default: lastN(30);
  }
  return { since: ymd(start), until: ymd(end) };
}
