"use client";

// Página a la que llega el enlace del correo de "olvidé mi contraseña"
// (ver /login → resetPasswordForEmail). Supabase deja la sesión lista sola
// apenas carga esta página (lee el token del propio link), así que solo
// hace falta esperar esa sesión y pedir la contraseña nueva.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Pressable from "@/components/Pressable";
import PasswordField from "@/components/PasswordField";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export default function ResetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState(() => !isSupabaseConfigured);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase()!;
    // El evento PASSWORD_RECOVERY puede tardar un instante en llegar (el
    // cliente todavía está leyendo el token del URL) — por eso se escucha
    // el cambio en vez de mirar getSession() una sola vez.
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setHasSession(true);
        setReady(true);
      }
    });
    sb.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const sb = getSupabase()!;
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => router.replace("/hoy"), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la contraseña");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "calc(28px + env(safe-area-inset-top)) 28px 28px",
        boxSizing: "border-box",
        background: "radial-gradient(130% 70% at 50% 10%, #12341f 0%, #0c1a12 48%, #060a08 100%)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26 }}>
        <div style={{ width: 96, height: 96, borderRadius: 22, overflow: "hidden", filter: "drop-shadow(0 0 20px rgba(90,220,150,.45))" }}>
          <Image src="/assets/ahivoyapp-logo-transparente.png" alt="AHIVOYAPP" width={96} height={96} unoptimized style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div
          className="font-sora"
          style={{
            fontSize: 26,
            fontWeight: 800,
            marginTop: 14,
            background: "linear-gradient(180deg,#b7f06a,#39c9a3)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          AHIVOYAPP
        </div>
        <div style={{ fontSize: 12, color: "rgba(244,243,238,.55)", marginTop: 4, textAlign: "center" }}>
          Pon tu contraseña nueva
        </div>
      </div>

      {!ready ? (
        <div style={{ textAlign: "center", fontSize: 13, color: "rgba(244,243,238,.55)" }}>Un momento…</div>
      ) : !hasSession ? (
        <>
          <div style={{ fontSize: 13, color: "rgba(244,243,238,.7)", lineHeight: 1.5, textAlign: "center" }}>
            Este enlace ya venció o no es válido. Pide uno nuevo desde la pantalla de inicio de sesión.
          </div>
          <Pressable
            onClick={() => router.replace("/login")}
            style={{
              background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
              color: "#08160e",
              textAlign: "center",
              padding: 16,
              borderRadius: 22,
              fontWeight: 800,
              fontSize: 14,
              marginTop: 18,
              cursor: "pointer",
              boxShadow: "0 0 26px rgba(90,220,150,.45)",
            }}
          >
            Ir a iniciar sesión
          </Pressable>
        </>
      ) : done ? (
        <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "#c7f27a" }}>
          Contraseña actualizada. Te llevamos a la app…
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <PasswordField
              value={password}
              onChange={setPassword}
              placeholder="Contraseña nueva"
              autoComplete="new-password"
            />
            <PasswordField
              value={confirm}
              onChange={setConfirm}
              placeholder="Confirma la contraseña nueva"
              autoComplete="new-password"
              onEnter={submit}
            />
          </div>
          {error && (
            <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "oklch(72% 0.18 25)" }}>{error}</div>
          )}
          <Pressable
            onClick={submit}
            style={{
              background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
              color: "#08160e",
              textAlign: "center",
              padding: 16,
              borderRadius: 22,
              fontWeight: 800,
              fontSize: 14,
              marginTop: 18,
              cursor: "pointer",
              opacity: busy ? 0.6 : 1,
              boxShadow: "0 0 26px rgba(90,220,150,.45)",
            }}
          >
            {busy ? "Un momento…" : "Guardar contraseña"}
          </Pressable>
        </>
      )}
    </div>
  );
}
