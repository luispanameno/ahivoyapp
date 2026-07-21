"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";

const OFF = "rgba(244,243,238,.3)";
const ON = "#c7f27a";

// El botón central SOLO navega a /escanear: ahí mismo (sin cambiar de
// página de nuevo) viven los botones "Tomar foto" / "Elegir de galería".
// Antes la foto se recogía aquí y viajaba por contexto hasta /escanear;
// ese traspaso entre páginas resultó frágil (Android e iPhone podían
// perderlo y la app volvía a pedir la foto). Todo en una sola pantalla
// elimina ese riesgo por completo.
export default function TabBar() {
  const pathname = usePathname();
  const router = useRouter();

  const c = (route: string) => (pathname === route ? ON : OFF);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        margin: "0 auto",
        maxWidth: 480,
        height: 88,
        background: "rgba(18,20,22,.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        boxSizing: "border-box",
        zIndex: 50,
      }}
    >
      <div
        onClick={() => router.push("/hoy")}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}
      >
        <div style={{ width: 20, height: 20, borderRadius: 5, background: c("/hoy") }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: c("/hoy") }}>Hoy</div>
      </div>
      <div
        onClick={() => router.push("/historial")}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}
      >
        <div style={{ width: 20, height: 15, border: `2.5px solid ${c("/historial")}`, borderRadius: 3 }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: c("/historial") }}>Historial</div>
      </div>

      <motion.div
        onClick={() => router.push("/escanear")}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: "#c7f27a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: -24,
          boxShadow: "0 0 22px rgba(199,242,122,.6)",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 20,
            height: 15,
            border: "2.5px solid #10240a",
            borderRadius: 4,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ position: "absolute", top: -4, left: 5, width: 7, height: 3, background: "#10240a", borderRadius: 1 }} />
          <div style={{ width: 8, height: 8, border: "1.8px solid #10240a", borderRadius: "50%" }} />
        </div>
      </motion.div>

      <div
        onClick={() => router.push("/coach")}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}
      >
        <div style={{ width: 20, height: 15, border: `2.5px solid ${c("/coach")}`, borderRadius: "6px 6px 6px 2px" }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: c("/coach") }}>Coach</div>
      </div>
      <div
        onClick={() => router.push("/perfil")}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}
      >
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: c("/perfil") }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: c("/perfil") }}>Perfil</div>
      </div>
    </div>
  );
}
