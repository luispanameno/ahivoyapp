"use client";

import { usePathname } from "next/navigation";
import { AppProvider, useApp } from "@/lib/store";
import TabBar from "@/components/TabBar";
import Toast from "@/components/Toast";

// Rutas donde el prototipo oculta la barra de navegación
const HIDE_NAV = ["/escanear", "/rutina", "/bascula", "/comida"];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready } = useApp();
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
        {children}
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
