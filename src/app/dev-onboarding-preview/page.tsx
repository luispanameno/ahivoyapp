"use client";

// Ruta SOLO para revisar visualmente el asistente de bienvenida sin tener
// que crear+aprobar una cuenta cada vez. No aparece en ningún menú y se
// desactiva sola en producción (NODE_ENV) para no dejar una puerta suelta
// en la app real.
//
// OJO: las capturas (báscula/comida/reloj) SÍ van a fallar aquí con "Inicia
// sesión" — es correcto, no es un bug: /api/analyze exige una sesión real
// de Supabase a propósito (si no, cualquiera sin cuenta podría gastar la
// cuota de Gemini). Todo lo demás del asistente (preguntas, cálculo de
// metas, guardado) se puede probar completo sin sesión.

import { useEffect, useState } from "react";
import { AppProvider, useApp } from "@/lib/store";
import OnboardingWizard from "@/components/OnboardingWizard";

function PreviewInner() {
  const { profile } = useApp();
  const [done, setDone] = useState(false);

  // Arranca siempre limpio, sin importar si quedó algo guardado de una
  // prueba anterior en este mismo navegador.
  useEffect(() => {
    localStorage.removeItem("ahivoy:profile");
    localStorage.removeItem("ahivoy:bodyComp");
  }, []);

  if (done) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <div className="font-sora" style={{ fontSize: 18, fontWeight: 800 }}>
          ¡Guardado, {profile.name || "listo"}!
        </div>
        <div style={{ fontSize: 13, color: "rgba(244,243,238,.6)", maxWidth: 320, lineHeight: 1.5 }}>
          Esto es solo la vista previa — en la app real, aquí ya entrarías directo a Hoy y no volverías a ver este
          asistente. Recarga esta página para probarlo de nuevo desde el inicio.
        </div>
      </div>
    );
  }

  return <OnboardingWizard onFinished={() => setDone(true)} />;
}

export default function DevOnboardingPreview() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <AppProvider>
      <PreviewInner />
    </AppProvider>
  );
}
