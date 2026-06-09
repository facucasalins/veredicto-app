"use client";
import { useState } from "react";

export default function Login() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, pass }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "No se pudo iniciar sesión"); return; }
      window.location.href = "/";
    } catch {
      setErr("Error de conexión");
    } finally { setLoading(false); }
  }

  return (
    <div className="wrap">
      <form className="card" onSubmit={submit}>
        <div className="mark">◆</div>
        <div className="bname">NUSA APP</div>
        <div className="bsub">PANEL DE CREATIVOS · ACCESO</div>
        <input className="inp" placeholder="usuario" value={user} onChange={(e) => setUser(e.target.value)} autoFocus autoComplete="username" />
        <input className="inp" type="password" placeholder="contraseña" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={loading}>{loading ? "entrando…" : "Entrar"}</button>
      </form>
      <style>{`
        .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#E9DEC8;font-family:'Space Mono',ui-monospace,monospace;padding:24px;}
        .card{background:#F2EBD9;border:2px solid #1A1A17;border-radius:14px;box-shadow:6px 6px 0 #1A1A17;padding:34px 30px;width:100%;max-width:340px;display:flex;flex-direction:column;gap:12px;}
        .mark{font-size:26px;color:#C0392B;}
        .bname{font-weight:700;font-size:22px;letter-spacing:1px;color:#1A1A17;}
        .bsub{font-size:11px;letter-spacing:1.5px;color:#7A7259;margin-bottom:10px;}
        .inp{font-family:inherit;font-size:14px;border:2px solid #1A1A17;border-radius:7px;padding:10px 12px;background:#E9DEC8;color:#1A1A17;outline:none;}
        .inp:focus{border-color:#2563eb;}
        .err{color:#8A1C12;font-size:12px;}
        .btn{font-family:inherit;font-weight:700;font-size:14px;border:2px solid #1A1A17;border-radius:7px;padding:11px;background:#1A1A17;color:#F2EBD9;cursor:pointer;margin-top:4px;}
        .btn:disabled{opacity:.5;cursor:default;}
      `}</style>
    </div>
  );
}
