// Helpers para la vista COMBINADA (varias cuentas de ads a la vez, ej. Meta + Google de la misma
// marca). Resuelven spend total y día por día para cualquier cuenta según su prefijo, y parsean
// los params multi-cuenta que manda el front. Los ids llevan ":" (g:, tt:) → las listas van en
// params PARALELOS (accounts=a,b + curs=USD,ARS), nunca "id:cur" pegado.
import { getAccountSpend, getAccountSpendDaily } from "@/lib/meta";
import { isTikTok, ttId, getAccountSpend as ttGetAccountSpend } from "@/lib/tiktok";
import { isGoogle, gId, getAccountSpend as gGetAccountSpend } from "@/lib/google";

export const platformOf = (id) => (isTikTok(id) ? "TikTok" : isGoogle(id) ? "Google" : "Meta");

// [{ id, cur }] desde los query params. `accounts`+`curs` (paralelos) si vienen; si no, cae a
// `account`+`accCur` (una sola cuenta, como siempre). Sin cuentas devuelve [].
export function parseAccounts(searchParams) {
  const multi = searchParams.get("accounts");
  if (multi) {
    const ids = multi.split(",").filter(Boolean);
    const curs = String(searchParams.get("curs") || "").split(",");
    return ids.map((id, i) => ({ id, cur: (curs[i] || "ARS").toUpperCase() }));
  }
  const id = searchParams.get("account");
  return id ? [{ id, cur: (searchParams.get("accCur") || "ARS").toUpperCase() }] : [];
}

// Spend/ventas a nivel cuenta en el rango, para cualquier plataforma (mismo contrato que
// meta.getAccountSpend: { spend, roasMeta, ventasMeta }).
export async function spendOf(id, since, until) {
  if (isTikTok(id)) return ttGetAccountSpend(ttId(id), since, until);
  if (isGoogle(id)) return gGetAccountSpend(gId(id), since, until);
  return getAccountSpend(id, since, until);
}

// Serie día por día ({ fecha, spend, ventas, visitas? }) para cualquier plataforma. Solo Meta
// trae visitas (LPV del pixel); Google/TikTok degradan sin visitas.
export async function spendDailyOf(id, since, until) {
  if (isTikTok(id)) return ttGetAccountSpend(ttId(id), since, until, true);
  if (isGoogle(id)) return gGetAccountSpend(gId(id), since, until, true);
  return getAccountSpendDaily(id, since, until);
}
