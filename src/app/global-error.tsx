"use client";

// Igual que error.tsx, pero para cuando el que truena es el layout raíz
// mismo (mucho más raro). Next.js exige que este archivo traiga su propio
// <html>/<body> porque en ese caso el layout raíz ya no está disponible.

import { useEffect } from "react";
import { readLocalLang, translate } from "@/lib/i18n";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = readLocalLang();
  const t = (key: string) => translate(lang, key);

  useEffect(() => {
    console.error("Unhandled root error:", error);
  }, [error]);

  return (
    <html lang={lang}>
      <body style={{ margin: 0 }}>
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
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 40 }}>🐢</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{t("errorPage.title")}</div>
          <div style={{ fontSize: 13, color: "rgba(244,243,238,.6)", lineHeight: 1.5 }}>{t("errorPage.body")}</div>
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
              marginTop: 10,
            }}
          >
            {t("errorPage.retry")}
          </div>
        </div>
      </body>
    </html>
  );
}
