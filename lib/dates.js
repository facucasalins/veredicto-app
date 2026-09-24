// lib/dates.js
// Convierte un date_preset de Meta a un rango concreto { since, until } (YYYY-MM-DD).
// Lo usamos para pedirle a Tienda Nube y a Meta el MISMO rango exacto, así facturación e inversión
// quedan comparables (mismo período de los dos lados), sin depender de cómo interpreta Meta cada preset.

const ymd = (d) => d.toISOString().slice(0, 10);

// "Hoy" en hora de Argentina como medianoche UTC de ese día (así el resto opera en UTC sin
// corrimientos). Antes era el día UTC: después de las 21 h el panel ya pedía "mañana".
const TZ = "America/Argentina/Buenos_Aires";
const hoyAR = (now = new Date()) => new Date(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now) + "T00:00:00Z");

export function presetToRange(preset, now = new Date()) {
  const end = hoyAR(now);
  const start = new Date(end);
  // last_Nd = los N días COMPLETOS anteriores, SIN hoy — igual que el date_preset de Meta
  // (antes incluía hoy: Tienda Nube/GA4 miraban un día más reciente que los anuncios de Meta).
  const lastN = (n) => { start.setUTCDate(end.getUTCDate() - n); end.setUTCDate(end.getUTCDate() - 1); };
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

// "Hoy" y rangos relativos ya resueltos en la zona horaria de Argentina, para el chat: el modelo
// NO calcula fechas (erraba: "hoy" salía en UTC y después de las 21 h ya era mañana). Semana =
// lunes a domingo. `now` inyectable para testear.
export function fechasAR(now = new Date()) {
  const hoy = hoyAR(now);
  const hoyStr = ymd(hoy);
  const add = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
  const dow = (hoy.getUTCDay() + 6) % 7; // 0 = lunes
  const mesPasadoIni = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1));
  const mesPasadoFin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 0));
  const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  return {
    hoy: hoyStr,
    dia: DIAS[dow],
    rangos: [
      { label: "ayer", since: ymd(add(hoy, -1)), until: ymd(add(hoy, -1)) },
      { label: "últimos 7 días (sin hoy)", since: ymd(add(hoy, -7)), until: ymd(add(hoy, -1)) },
      { label: "últimos 30 días (sin hoy)", since: ymd(add(hoy, -30)), until: ymd(add(hoy, -1)) },
      { label: "esta semana (lunes a hoy)", since: ymd(add(hoy, -dow)), until: hoyStr },
      { label: "mes pasado", since: ymd(mesPasadoIni), until: ymd(mesPasadoFin) },
    ],
  };
}
