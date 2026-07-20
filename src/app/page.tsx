"use client";

// Pantalla de bienvenida (screenshots/00-bienvenida.png)

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Pressable from "@/components/Pressable";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export default function Welcome() {
  const router = useRouter();

  // Si ya hay sesión, directo al tablero — no se pide login otra vez.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSupabase()!
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace("/hoy");
      });
  }, [router]);

  const start = () => {
    router.push(isSupabaseConfigured ? "/login" : "/hoy");
  };

  return (
    <div
      style={{
        height: "100dvh",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        padding: "env(safe-area-inset-top) 28px 40px",
        overflow: "hidden",
        background:
          "radial-gradient(130% 70% at 50% 22%, #12341f 0%, #0c1a12 48%, #060a08 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 120,
          left: "50%",
          transform: "translateX(-50%)",
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(90,220,150,.18), transparent 68%)",
          filter: "blur(14px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 26,
          bottom: 150,
          width: 14,
          height: 14,
          background: "radial-gradient(circle,#c7f27a,transparent 65%)",
          filter: "blur(1px)",
        }}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 172,
            height: 172,
            borderRadius: 34,
            overflow: "hidden",
            filter: "drop-shadow(0 0 26px rgba(90,220,150,.45))",
          }}
        >
          <Image
            src="/assets/ahivoyapp-logo-transparente.png"
            alt="AHIVOYAPP"
            width={172}
            height={172}
            priority
            unoptimized
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div
          className="font-sora"
          style={{
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: ".01em",
            marginTop: 22,
            background: "linear-gradient(180deg,#b7f06a,#39c9a3)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          AHIVOYAPP
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: ".22em",
            color: "rgba(244,243,238,.65)",
            marginTop: 8,
          }}
        >
          AI METABOLIC SCANNER
        </div>
      </div>

      <Pressable
        onClick={start}
        style={{
          background: "linear-gradient(135deg,#a6f06a,#39c9a3)",
          color: "#08160e",
          textAlign: "center",
          padding: 17,
          borderRadius: 20,
          fontWeight: 800,
          fontSize: 15,
          cursor: "pointer",
          boxShadow: "0 0 30px rgba(90,220,150,.5)",
        }}
      >
        Empezar
      </Pressable>
      <div
        onClick={start}
        style={{
          textAlign: "center",
          fontSize: 11,
          color: "rgba(244,243,238,.4)",
          marginTop: 14,
          cursor: "pointer",
        }}
      >
        Ya tengo cuenta · Iniciar sesión
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 16 }}>
        By <span style={{ fontWeight: 800, color: "#f4f3ee" }}>PanaApp</span>
      </div>
    </div>
  );
}
