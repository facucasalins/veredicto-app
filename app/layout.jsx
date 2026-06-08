export const metadata = { title: "NUSA APP", description: "Panel de creativos - motor de decision" };
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#E9DEC8" }}>{children}</body>
    </html>
  );
}
