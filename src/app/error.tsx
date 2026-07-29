"use client";

// Pantalla de error genérica: si cualquier página truena en producción, esto
// reemplaza la pantalla fea por defecto de Next.js por algo con la marca de
// la app y un botón para reintentar. No usa useApp() porque un error puede
// ocurrir en cualquier punto del árbol, incluso antes de que AppProvider
// termine de montar — se apoya en el mismo respaldo de idioma que login.

import { useEffect } from "react";
import { readLocalLang, translate } from "@/lib/i18n";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = readLocalLang();
  const t = (key: string) => translate(lang, key);

  useEffect(() => {
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "0 32px",
        textAlign: "center",
        boxSizing: "border-box",
        background: "radial-gradient(130% 70% at 50% 10%, #12341f 0%, #0c1a12 48%, #060a08 100%)",
        color: "#f4f3ee",
      }}
    >
      <div style={{ fontSize: 40 }}>🐢</div>
      <div className="font-sora" style={{ fontWeight: 800, fontSize: 18 }}>
        {t("errorPage.title")}
      </div>
      <div style={{ fontSize: 13, color: "rgba(244,243,238,.6)", lineHeight: 1.5 }}>{t("errorPage.body")}</div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <div
          onClick={() => reset()}
          style={{
            background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
            color: "#08160e",
            padding: "13px 20px",
            borderRadius: 22,
            fontWeight: 800,
            fontSize: 13.5,
            cursor: "pointer",
            boxShadow: "0 0 20px rgba(199,242,122,.4)",
          }}
        >
          {t("errorPage.retry")}
        </div>
        <div
          onClick={() => (window.location.href = "/hoy")}
          style={{
            background: "#1b1e21",
            color: "rgba(244,243,238,.7)",
            padding: "13px 20px",
            borderRadius: 22,
            fontWeight: 700,
            fontSize: 13.5,
            cursor: "pointer",
          }}
        >
          {t("errorPage.goHome")}
        </div>
      </div>
    </div>
  );
}
