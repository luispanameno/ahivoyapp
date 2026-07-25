"use client";

// Ruta SOLO para revisar visualmente el asistente de bienvenida sin tener
// que crear+aprobar una cuenta cada vez. No aparece en ningún menú y se
// desactiva sola en producción (NODE_ENV) para no dejar una puerta suelta
// en la app real.

import { AppProvider } from "@/lib/store";
import OnboardingWizard from "@/components/OnboardingWizard";

export default function DevOnboardingPreview() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <AppProvider>
      <OnboardingWizard />
    </AppProvider>
  );
}
