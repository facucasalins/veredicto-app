# VEREDICTO

Panel de creativos sobre tus cuentas de Meta. Elegís un cliente de tu Facebook y el panel se llena solo: veredicto por creativo (escalar / mantener / pausar), top performers con piso de spend, y generador de copy con IA.

Corre en Next.js, se deploya en Vercel. Usa un **token de Sistema** de Meta (camino interno, sin App Review).

---

## 1. Token de Meta (una sola vez)

1. Entrá a **developers.facebook.com** → creá una app tipo **Business** (no necesitás App Review para tus propias cuentas).
2. Andá a **business.facebook.com** → **Configuración del negocio** → **Usuarios → Usuarios del sistema** → creá uno (rol Admin).
3. Tocá **Generar token** → elegí la app del paso 1 → marcá el permiso **`ads_read`** (sumá `ads_management` solo si más adelante querés pausar/activar desde la app) → generá un token **sin caducidad** y copialo.
4. En ese mismo usuario del sistema → **Activos asignados → Cuentas publicitarias** → asigná todas las cuentas de tus clientes.

## 2. API key de Anthropic (para el generador de copy)

En **console.anthropic.com** → API Keys → creá una y copiala.

## 3. Deploy en Vercel

1. Subí esta carpeta a un repo de **GitHub**.
2. En **vercel.com** → **New Project** → importá el repo.
3. En **Settings → Environment Variables** agregá:

   | Variable | Valor |
   |---|---|
   | `META_SYSTEM_TOKEN` | el token del paso 1 |
   | `META_API_VERSION` | `v21.0` |
   | `ANTHROPIC_API_KEY` | la key del paso 2 |
   | `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` |

4. **Deploy**. Abrís la URL, en el header elegís el cliente → datos en vivo.

## Correr local

```bash
cp .env.example .env.local   # completá las variables
npm install
npm run dev                  # http://localhost:3000
```

---

## Cómo lee tus datos

- `lib/meta.js` llama a la Marketing API (`/me/adaccounts` para listar, `act_{id}/insights` a nivel anuncio).
- `lib/nomenclatura.js` parsea el nombre del anuncio (`fecha - VID - Concepto - Categoría - pts - (timestamp) - cliente`), agrupa el **mismo creativo** que corre en varios conjuntos (por el timestamp) y arma las filas del panel.
- El veredicto y el ranking se calculan en el front con tu umbral editable (ROAS mín, CPA máx, piso de spend).

## Pendientes conocidos (próximas iteraciones)

- La **audiencia** no está en el nombre del anuncio (vive en el conjunto): falta tirar a nivel ad-set para esa dimensión.
- El **catálogo dinámico** (DPA) entra como ángulo "Catálogo" (no tiene nomenclatura de creativo).
- Enriquecer con tu **Sheet de Gemini** (split primaria/secundaria, hook eje) cruzando por nomenclatura.
- Acceso por cliente (cada cliente ve solo lo suyo) requiere auth — pendiente para la fase multi-usuario.
