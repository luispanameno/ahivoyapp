"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AppProvider, useApp } from "@/lib/store";
import TabBar from "@/components/TabBar";
import Toast from "@/components/Toast";
import OnboardingWizard from "@/components/OnboardingWizard";
import HomeSkeleton from "@/components/Skeleton";
import Pressable from "@/components/Pressable";

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
      {icon.startsWith("/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" width={56} height={56} style={{ display: "block" }} />
      ) : (
        <div style={{ fontSize: 40 }}>{icon}</div>
      )}
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
  const reduce = useReducedMotion();
  const hideNav = HIDE_NAV.some((r) => pathname.startsWith(r));

  // Mientras cargan los datos mostramos el esqueleto de la pantalla, no un
  // texto de "Cargando…": ocupa el mismo espacio que el contenido real, así
  // la transición se siente continua y sin salto de layout.
  if (!ready) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: "easeOut" }}>
        <HomeSkeleton />
      </motion.div>
    );
  }

  // Control de acceso: cuentas nuevas esperan aprobación manual del admin
  // antes de poder usar la app (ver supabase/schema.sql).
  if (profile.status === "pending") {
    return (
      <CenteredMessage
        icon="/icons/glyphs/pending.png"
        title="Tu cuenta está en revisión"
        body="El equipo de AHIVOYAPP está revisando tu solicitud. En cuanto te aprobemos vas a tener acceso completo — no debería tardar mucho."
        action={
          <Pressable
            onClick={signOut}
            style={{ marginTop: 10, minHeight: 44, display: "flex", alignItems: "center", padding: "0 12px", fontSize: 12.5, fontWeight: 700, color: "rgba(244,243,238,.5)", textDecoration: "underline", cursor: "pointer" }}
          >
            Cerrar sesión
          </Pressable>
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
          <Pressable
            onClick={signOut}
            style={{ marginTop: 10, minHeight: 44, display: "flex", alignItems: "center", padding: "0 12px", fontSize: 12.5, fontWeight: 700, color: "rgba(244,243,238,.5)", textDecoration: "underline", cursor: "pointer" }}
          >
            Cerrar sesión
          </Pressable>
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
        {/* Transición entre pantallas: desvanecimiento rápido, sin textos de
            carga. La salida es más corta que la entrada — así se siente ágil
            en vez de lenta. Con "reducir movimiento" el cambio es directo. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={pathname}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
            transition={{ duration: 0.2, ease: "easeOut" }}
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
