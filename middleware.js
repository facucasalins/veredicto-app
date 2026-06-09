import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession, authDisabled } from "@/lib/auth";

// Protege las páginas. Las rutas /api hacen su propia verificación y filtrado (devuelven JSON 401),
// por eso quedan fuera del matcher: si las redirigiéramos a /login romperíamos los fetch.
export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};

export async function middleware(req) {
  if (authDisabled()) return NextResponse.next(); // sin APP_USERS => acceso abierto (comportamiento actual)
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await verifySession(token))) return NextResponse.next();
  const url = new URL("/login", req.url);
  return NextResponse.redirect(url);
}
