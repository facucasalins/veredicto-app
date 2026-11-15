// lib/tiendas.js
// Datos FIJOS de cada tienda de Tienda Nube (nada secreto: el store_id es público en las URLs de imágenes
// de la tienda y el id de Meta no da acceso a nada). El TOKEN no va acá: va en Vercel, una variable por
// marca llamada TN_TOKEN_<slug> (ej. TN_TOKEN_FLINT) con el token pelado como valor. Ver tnStores() en
// lib/tiendanube.js.
//
//   name     → etiqueta EXACTA (la usan el front, n8n y los reportes; no cambiarla sin avisar)
//   slug     → sufijo de la env var del token: TN_TOKEN_<slug>
//   store_id → id de la tienda en Tienda Nube
//   account  → id de la cuenta de Meta asociada (scopeo de usuarios cliente + cruce sugerido)
//   ventas   → criterio de venta default: "pagadas" | "no_canceladas"
//
// Sumar una tienda nueva = agregar una línea acá + crear TN_TOKEN_<slug> en Vercel + redeploy.
// (Sin tocar código también se puede con TN_STORE_<MARCA> = JSON completo, ver tnStores().)

export const TIENDAS = [
  { name: "Shark",         slug: "SHARK",         store_id: "1511342", account: "3760543477605079",  ventas: "pagadas" },
  { name: "MoraShop",      slug: "MORASHOP",      store_id: "2268228", account: "2028992124272684",  ventas: "no_canceladas" },
  { name: "Antonia",       slug: "ANTONIA",       store_id: "5181517", account: "1045477532829472",  ventas: "pagadas" },
  { name: "Juanita Shoes", slug: "JUANITA_SHOES", store_id: "469424",  account: "1097898049077633",  ventas: "pagadas" },
  { name: "Flint",         slug: "FLINT",         store_id: "6007424", account: "24394644686862918", ventas: "pagadas" },
];
