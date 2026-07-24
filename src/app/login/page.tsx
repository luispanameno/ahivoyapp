"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Pressable from "@/components/Pressable";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#1b1e21",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 14,
  padding: "14px 16px",
  color: "#f4f3ee",
  fontSize: 14,
  fontWeight: 600,
  outline: "none",
  boxSizing: "border-box",
};

// Validación de forma (no de existencia real): exige algo@algo.algo, para
// atrapar errores obvios como "hola@jdkf" antes de mandarlo a Supabase.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EyeIcon({ open, size = 18 }: { open: boolean; size?: number }) {
  return open ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a18.5 18.5 0 015.06-5.94M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// Campo de contraseña con botón de ojito para mostrar/ocultar.
function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  onEnter?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        style={{ ...inputStyle, paddingRight: 44 }}
        placeholder={placeholder}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      />
      <div
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: "rgba(244,243,238,.5)",
          cursor: "pointer",
          display: "flex",
        }}
      >
        <EyeIcon open={visible} />
      </div>
    </div>
  );
}

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSupabase()!
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace("/hoy");
      });
  }, [router]);

  if (!isSupabaseConfigured) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", padding: 28, boxSizing: "border-box" }}>
        <div className="font-sora" style={{ fontSize: 20, fontWeight: 700 }}>Cuentas aún no activadas</div>
        <div style={{ fontSize: 13, color: "rgba(244,243,238,.6)", marginTop: 10, lineHeight: 1.5 }}>
          Falta configurar Supabase (SUPABASE_URL y ANON_KEY en .env.local). Mientras tanto puedes usar la app en modo
          local: tus datos se guardan solo en este dispositivo.
        </div>
        <div
          onClick={() => router.push("/hoy")}
          style={{ background: "#c7f27a", color: "#10240a", textAlign: "center", padding: 15, borderRadius: 18, fontWeight: 800, fontSize: 13.5, marginTop: 24, cursor: "pointer", boxShadow: "0 0 20px rgba(199,242,122,.5)" }}
        >
          Continuar en modo local
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (busy) return;
    setError(null);
    setInfo(null);
    if (!email || !password) {
      setError("Escribe tu correo y contraseña.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Ese correo no parece válido — revisa que tenga la forma nombre@dominio.com.");
      return;
    }
    if (mode === "signup") {
      if (password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
    }
    setBusy(true);
    const sb = getSupabase()!;
    try {
      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { nombre: name } },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/hoy");
        } else {
          setInfo("Revisa tu correo para confirmar la cuenta. Después, alguien debe aprobar tu acceso antes de que puedas entrar.");
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/hoy");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de autenticación");
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
        <div style={{ fontSize: 12, color: "rgba(244,243,238,.55)", marginTop: 4 }}>
          {mode === "signin" ? "Inicia sesión con tu cuenta" : "Crea tu cuenta — tus datos son solo tuyos"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mode === "signup" && (
          <input style={inputStyle} placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input
          style={inputStyle}
          placeholder="Correo"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Contraseña"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          onEnter={mode === "signin" ? submit : undefined}
        />
        {mode === "signup" && (
          <PasswordField
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirma tu contraseña"
            autoComplete="new-password"
            onEnter={submit}
          />
        )}
      </div>

      {error && (
        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "oklch(72% 0.18 25)" }}>{error}</div>
      )}
      {info && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "#c7f27a" }}>{info}</div>}

      <Pressable
        onClick={submit}
        style={{
          background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
          color: "#08160e",
          textAlign: "center",
          padding: 16,
          borderRadius: 18,
          fontWeight: 800,
          fontSize: 14,
          marginTop: 18,
          cursor: "pointer",
          opacity: busy ? 0.6 : 1,
          boxShadow: "0 0 26px rgba(90,220,150,.45)",
        }}
      >
        {busy ? "Un momento…" : mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
      </Pressable>

      <div
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setInfo(null);
        }}
        style={{ textAlign: "center", fontSize: 12, color: "rgba(244,243,238,.55)", marginTop: 16, cursor: "pointer", fontWeight: 600 }}
      >
        {mode === "signin" ? "¿No tienes cuenta? Crear una nueva" : "Ya tengo cuenta · Iniciar sesión"}
      </div>

      <div style={{ textAlign: "center", fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 24 }}>
        By <span style={{ fontWeight: 800, color: "#f4f3ee" }}>PanaApp</span>
      </div>
    </div>
  );
}
