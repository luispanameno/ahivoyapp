"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AppProvider, useApp } from "@/lib/store";
import TabBar from "@/components/TabBar";
import Toast from "@/components/Toast";
import OnboardingWizard from "@/components/OnboardingWizard";

// Rutas donde el prototipo oculta la barra de navegación
const HIDE_NAV = ["/escanear", "/rutina", "/comida", "/bebida"];

function CenteredMessage({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 32px", textAlign: "center", boxSizing: "border-box" }}>
      <div style={{ fontSize: 40 }}>{icon}</div>
      <div className="font-sora" style={{ fontWeight: 800, fontSize: 18 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "rgba(244,243,238,.6)", lineHeight: 1.5 }}>{body}</div>
      {action}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, profile, signOut } = useApp();
  const hideNav = HIDE_NAV.some((r) => pathname.startsWith(r));

  if (!ready) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            border: "4px solid rgba(199,242,122,.2)",
            borderTopColor: "#c7f27a",
            animation: "spin 1s linear infinite",
          }}
        />
        <div style={{ fontWeight: 700, fontSize: 13, color: "rgba(244,243,238,.6)" }}>Cargando tus datos…</div>
      </div>
    );
  }

  // Control de acceso: cuentas nuevas esperan aprobación manual del admin
  // antes de poder usar la app (ver supabase/schema.sql).
  if (profile.status === "pending") {
    return (
      <CenteredMessage
        icon="⏳"
        title="Tu cuenta está en revisión"
        body="El equipo de AHIVOYAPP está revisando tu solicitud. En cuanto te aprobemos vas a tener acceso completo — no debería tardar mucho."
        action={
          <div onClick={signOut} style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "rgba(244,243,238,.5)", textDecoration: "underline", cursor: "pointer" }}>
            Cerrar sesión
          </div>
        }
      />
    );
  }
  if (profile.status === "rejected") {
    return (
      <CenteredMessage
        icon="🚫"
        title="Acceso no autorizado"
        body="Esta cuenta no fue aprobada para usar AHIVOYAPP."
        action={
          <div onClick={signOut} style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "rgba(244,243,238,.5)", textDecoration: "underline", cursor: "pointer" }}>
            Cerrar sesión
          </div>
        }
      />
    );
  }

  // Primera vez que un usuario aprobado entra: arma su perfil nutricional
  // antes de dejarlo pasar al resto de la app.
  if (!profile.onboarded) {
    return <OnboardingWizard />;
  }

  return (
    <>
      <Toast />
      <div
        style={{
          minHeight: "100dvh",
          // Respeta el notch / Dynamic Island de iPhone y la barra inferior
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: hideNav ? 0 : 88,
          boxSizing: "border-box",
        }}
      >
        {/* Transición suave entre pantallas: desvanecimiento sin cortes bruscos */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
      {!hideNav && <TabBar />}
    </>
  );
}

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
