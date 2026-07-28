"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Pressable from "@/components/Pressable";
import PasswordField, { authInputStyle as inputStyle } from "@/components/PasswordField";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { readLocalLang, translate } from "@/lib/i18n";

// Validación de forma (no de existencia real): exige algo@algo.algo, para
// atrapar errores obvios como "hola@jdkf" antes de mandarlo a Supabase.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const router = useRouter();
  // Sin sesión todavía: no hay profile.language que leer. Se usa el
  // respaldo en localStorage que el store mantiene al día (ver i18n.ts).
  const [lang] = useState(() => readLocalLang());
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const [mode, setMode] = useState<"signin" | "signup" | "recover">("signin");
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
        <div className="font-sora" style={{ fontSize: 20, fontWeight: 700 }}>{t("login.localModeTitle")}</div>
        <div style={{ fontSize: 13, color: "rgba(244,243,238,.6)", marginTop: 10, lineHeight: 1.5 }}>
          {t("login.localModeBody")}
        </div>
        <div
          onClick={() => router.push("/hoy")}
          style={{ background: "#c7f27a", color: "#10240a", textAlign: "center", padding: 15, borderRadius: 22, fontWeight: 800, fontSize: 13.5, marginTop: 24, cursor: "pointer", boxShadow: "0 0 20px rgba(199,242,122,.5)" }}
        >
          {t("login.localModeCta")}
        </div>
      </div>
    );
  }

  // Recuperar contraseña: solo pide el correo y manda el enlace por
  // Supabase — no valida la contraseña porque acá no se toca ninguna.
  const submitRecover = async () => {
    if (busy) return;
    setError(null);
    setInfo(null);
    if (!email) {
      setError(t("login.errEmailOnly"));
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError(t("login.errEmailInvalid"));
      return;
    }
    setBusy(true);
    try {
      const sb = getSupabase()!;
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setInfo(t("login.infoRecoverSent"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.errRecoverFailed"));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    if (mode === "recover") return submitRecover();
    setError(null);
    setInfo(null);
    if (mode === "signup" && !name.trim()) {
      setError(t("login.errName"));
      return;
    }
    if (!email || !password) {
      setError(t("login.errEmailPassword"));
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError(t("login.errEmailInvalid"));
      return;
    }
    if (mode === "signup") {
      if (password.length < 6) {
        setError(t("login.errPasswordShort"));
        return;
      }
      if (password !== confirmPassword) {
        setError(t("login.errPasswordMismatch"));
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
          setInfo(t("login.infoConfirmEmail"));
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/hoy");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.errAuth"));
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
          {mode === "signin"
            ? t("login.signinTitle")
            : mode === "signup"
            ? t("login.signupTitle")
            : t("login.recoverTitle")}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mode === "signup" && (
          <input style={inputStyle} placeholder={t("login.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input
          style={inputStyle}
          placeholder={t("login.emailPlaceholder")}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && mode === "recover" && submit()}
        />
        {mode !== "recover" && (
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder={t("login.passwordPlaceholder")}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            onEnter={mode === "signin" ? submit : undefined}
          />
        )}
        {mode === "signup" && (
          <PasswordField
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder={t("login.confirmPasswordPlaceholder")}
            autoComplete="new-password"
            onEnter={submit}
          />
        )}
      </div>

      {mode === "signin" && (
        <div
          onClick={() => {
            setMode("recover");
            setError(null);
            setInfo(null);
          }}
          style={{ textAlign: "right", fontSize: 11.5, color: "rgba(244,243,238,.5)", marginTop: 10, cursor: "pointer", fontWeight: 600 }}
        >
          {t("login.forgotPassword")}
        </div>
      )}

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
          borderRadius: 22,
          fontWeight: 800,
          fontSize: 14,
          marginTop: 18,
          cursor: "pointer",
          opacity: busy ? 0.6 : 1,
          boxShadow: "0 0 26px rgba(90,220,150,.45)",
        }}
      >
        {busy ? t("login.busy") : mode === "signin" ? t("login.signIn") : mode === "signup" ? t("login.createAccount") : t("login.sendLink")}
      </Pressable>

      <div
        onClick={() => {
          setMode(mode === "recover" ? "signin" : mode === "signin" ? "signup" : "signin");
          setError(null);
          setInfo(null);
        }}
        style={{ textAlign: "center", fontSize: 12, color: "rgba(244,243,238,.55)", marginTop: 16, cursor: "pointer", fontWeight: 600 }}
      >
        {mode === "signin" ? t("login.toSignup") : mode === "signup" ? t("login.toSignin") : t("login.toSigninFromRecover")}
      </div>

      <div style={{ textAlign: "center", fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 24 }}>
        By <span style={{ fontWeight: 800, color: "#f4f3ee" }}>PanaApp</span>
      </div>
    </div>
  );
}
