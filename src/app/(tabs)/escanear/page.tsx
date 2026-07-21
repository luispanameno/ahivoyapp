"use client";

// Escanear comida: captura → vista previa + contexto → analizando (Gemini) →
// aclarar (si la IA aún tiene dudas) → confirmar tiempo → guardar.

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Pressable from "@/components/Pressable";
import { analyze, fileToDataURL, FoodResult } from "@/lib/analyze";
import { resizeDataURL } from "@/lib/img";
import { useApp, currentMealTime } from "@/lib/store";
import { MealTime } from "@/lib/types";

type Step = "capture" | "preview" | "analyzing" | "clarify" | "confirm";

const MEAL_TIMES: MealTime[] = ["Desayuno", "Almuerzo", "Cena", "Snack"];

export default function Escanear() {
  const router = useRouter();
  const { addMeal, showToast } = useApp();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Todo el flujo (tomar/elegir foto → contexto → analizar) vive en ESTA
  // sola pantalla, sin ningún cambio de ruta de por medio: así nunca se
  // pierde la foto en tránsito ni se vuelve a pedir dos veces.
  const [step, setStep] = useState<Step>("capture");
  const [photo, setPhoto] = useState<string | null>(null);
  const [context, setContext] = useState(""); // contexto que el usuario escribe ANTES de analizar
  const [result, setResult] = useState<FoodResult | null>(null);
  const [clarifyText, setClarifyText] = useState(""); // aclaración que pide la IA DESPUÉS de analizar
  const [mealTime, setMealTime] = useState<MealTime>(currentMealTime());
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async (dataUrl: string, textoContexto?: string) => {
    setStep("analyzing");
    setError(null);
    try {
      const res = await analyze<FoodResult>({
        mode: "food",
        image: dataUrl,
        text: textoContexto || undefined,
      });
      setResult(res);
      if (res.pregunta && !textoContexto) {
        setStep("clarify");
      } else {
        setStep("confirm");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar la foto");
      setStep("preview");
    }
  };

  // Entrada de respaldo (si el usuario llega aquí sin pasar por la tab bar):
  // un solo input SIN "capture" → el SO abre su selector nativo con
  // "Tomar foto" / "Elegir de la galería" en Android e iOS por igual.
  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    const url = await fileToDataURL(file);
    setPhoto(url);
    setContext("");
    setStep("preview");
  };

  // El "Filtro de Precisión": la foto NUNCA se envía sola. Se manda junto
  // con el contexto que el usuario haya escrito (puede ir vacío).
  const startAnalysis = () => {
    if (!photo) return;
    runAnalysis(photo, context.trim() || undefined);
  };

  const save = async () => {
    if (!result) return;
    // Guardamos una miniatura de la foto para verla luego en el historial.
    let thumb: string | null = null;
    if (photo) {
      try {
        thumb = await resizeDataURL(photo);
      } catch {
        thumb = null; // si falla el redimensionado, guardamos sin foto
      }
    }
    await addMeal({
      time: mealTime,
      desc: result.descripcion,
      kcal: Math.round(result.kcal),
      p: Math.round(result.proteina),
      c: Math.round(result.carbos),
      f: Math.round(result.grasa),
      photo: thumb,
    });
    showToast(`¡Agregado! ${Math.round(result.kcal)} kcal`);
    router.push("/hoy");
  };

  // ---------- Captura (entrada de respaldo) ----------
  if (step === "capture") {
    return (
      <div style={{ height: "100dvh", position: "relative", background: "#08090a" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "repeating-linear-gradient(45deg,#14161a,#14161a 10px,#101214 10px,#101214 20px)",
            opacity: 0.6,
          }}
        />
        <div
          onClick={() => router.push("/hoy")}
          style={{ position: "absolute", top: "calc(24px + env(safe-area-inset-top))", left: 20, zIndex: 2, fontSize: 13, fontWeight: 700, color: "rgba(244,243,238,.7)", cursor: "pointer" }}
        >
          ‹ Volver
        </div>
        <div style={{ position: "absolute", top: "calc(24px + env(safe-area-inset-top))", left: 0, right: 0, textAlign: "center", fontSize: 12, fontWeight: 600, color: "rgba(244,243,238,.7)" }}>
          Toca para tomar o elegir la foto de tu plato
        </div>
        {error && (
          <div
            style={{
              position: "absolute",
              top: 56,
              left: 32,
              right: 32,
              zIndex: 2,
              background: "rgba(230,120,60,.15)",
              border: "1px solid rgba(230,120,60,.35)",
              borderRadius: 14,
              padding: "10px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: "oklch(78% 0.15 50)",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
        {/* Zona ilustrativa + dos botones claros. Damos las dos opciones por
            separado porque Android a veces manda el input directo a la galería
            y no ofrece la cámara; con capture="environment" la forzamos. */}
        <div
          style={{
            position: "absolute",
            left: 32,
            right: 32,
            top: 110,
            bottom: 150,
            borderRadius: 24,
            border: "1.5px dashed rgba(255,255,255,.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "#f4f3ee",
              border: "4px solid rgba(244,243,238,.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
            }}
          >
            📷
          </div>
        </div>
        <div style={{ position: "absolute", left: 32, right: 32, bottom: 40, display: "flex", flexDirection: "column", gap: 10 }}>
          <Pressable
            onClick={() => cameraInputRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "#c7f27a",
              color: "#10240a",
              borderRadius: 16,
              padding: "15px 18px",
              fontWeight: 800,
              fontSize: 14.5,
              cursor: "pointer",
              boxShadow: "0 0 16px rgba(199,242,122,.4)",
            }}
          >
            <span style={{ fontSize: 20 }}>📷</span> Tomar foto
          </Pressable>
          <Pressable
            onClick={() => galleryInputRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "#1b1e21",
              color: "#f4f3ee",
              borderRadius: 16,
              padding: "15px 18px",
              fontWeight: 700,
              fontSize: 14.5,
              cursor: "pointer",
              border: "1px solid rgba(255,255,255,.1)",
            }}
          >
            <span style={{ fontSize: 20 }}>🖼️</span> Elegir de la galería
          </Pressable>
        </div>
        {/* Cámara (fuerza cámara en Android) + galería, cada uno su input. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  // ---------- Vista previa + contexto obligatorio ("Filtro de Precisión") ----------
  if (step === "preview") {
    return (
      <div style={{ height: "100dvh", boxSizing: "border-box", padding: "calc(24px + env(safe-area-inset-top)) 20px 24px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="font-sora" style={{ fontSize: 18, fontWeight: 700 }}>Antes de analizar</div>
          <div
            onClick={() => {
              setPhoto(null);
              setContext("");
              setError(null);
              setStep("capture");
            }}
            style={{ fontSize: 12, fontWeight: 700, color: "rgba(244,243,238,.5)", cursor: "pointer" }}
          >
            Cambiar foto
          </div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>
          Agrega contexto para que el cálculo sea más preciso (opcional)
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              background: "rgba(230,120,60,.15)",
              border: "1px solid rgba(230,120,60,.35)",
              borderRadius: 14,
              padding: "10px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: "oklch(78% 0.15 50)",
            }}
          >
            {error}
          </div>
        )}

        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt="Tu plato"
            style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 20, marginTop: 16 }}
          />
        )}

        <div style={{ marginTop: 18, fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".03em" }}>
          CONTEXTO ADICIONAL
        </div>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="¿Algún detalle extra? (Ej: Usé 1 cucharada de aceite, dejé la mitad...)"
          style={{
            marginTop: 8,
            background: "#1b1e21",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 14,
            padding: "12px 14px",
            color: "#f4f3ee",
            fontSize: 13,
            resize: "none",
            height: 90,
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        <div style={{ flex: 1 }} />
        <Pressable
          onClick={startAnalysis}
          style={{
            background: "#c7f27a",
            color: "#10240a",
            textAlign: "center",
            padding: 16,
            borderRadius: 18,
            fontWeight: 800,
            fontSize: 14,
            marginTop: 16,
            cursor: "pointer",
            boxShadow: "0 0 20px rgba(199,242,122,.5)",
          }}
        >
          Analizar Comida
        </Pressable>
      </div>
    );
  }

  // ---------- Analizando ----------
  if (step === "analyzing") {
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
        <div style={{ fontWeight: 700, fontSize: 14 }}>Analizando tu plato…</div>
        <div style={{ fontSize: 12, color: "rgba(244,243,238,.45)", animation: "pulse 1.4s ease-in-out infinite" }}>
          Estimando porciones y macros
        </div>
      </div>
    );
  }

  // ---------- Aclaración (la IA aún tiene una duda) ----------
  if (step === "clarify") {
    return (
      <div style={{ height: "100dvh", boxSizing: "border-box", padding: "calc(40px + env(safe-area-inset-top)) 24px 24px", display: "flex", flexDirection: "column" }}>
        <div className="font-sora" style={{ fontSize: 18, fontWeight: 700 }}>Una pregunta rápida</div>
        <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 4 }}>Para afinar el cálculo de macros</div>
        <div style={{ marginTop: 20, fontSize: 14, fontWeight: 600 }}>{result?.pregunta}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>RESPONDE O ACLARA</div>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
        </div>
        <textarea
          value={clarifyText}
          onChange={(e) => setClarifyText(e.target.value)}
          placeholder="Ej. era blanco, la porción era doble, el pollo estaba frito…"
          style={{
            marginTop: 14,
            background: "#1b1e21",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 14,
            padding: "12px 14px",
            color: "#f4f3ee",
            fontSize: 13,
            resize: "none",
            height: 72,
            boxSizing: "border-box",
            outline: "none",
          }}
        />

        <div style={{ flex: 1 }} />
        <Pressable
          onClick={() => {
            if (clarifyText.trim() && photo) {
              runAnalysis(photo, clarifyText.trim());
            } else {
              setStep("confirm");
            }
          }}
          style={{
            background: "#c7f27a",
            color: "#10240a",
            textAlign: "center",
            padding: 15,
            borderRadius: 18,
            fontWeight: 800,
            fontSize: 13.5,
            marginBottom: 10,
            cursor: "pointer",
            boxShadow: "0 0 20px rgba(199,242,122,.5)",
          }}
        >
          Continuar
        </Pressable>
      </div>
    );
  }

  // ---------- Confirmar ----------
  return (
    <div style={{ minHeight: "100dvh", boxSizing: "border-box", padding: "calc(40px + env(safe-area-inset-top)) 20px 0", display: "flex", flexDirection: "column" }}>
      <div className="font-sora" style={{ fontSize: 18, fontWeight: 700 }}>Confirma tu comida</div>
      <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>
        Detectado por foto · ajusta si algo no cuadra
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {MEAL_TIMES.map((t) => (
          <div
            key={t}
            onClick={() => setMealTime(t)}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "9px 0",
              borderRadius: 100,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
              background: t === mealTime ? "#c7f27a" : "#1b1e21",
              color: t === mealTime ? "#10240a" : "rgba(244,243,238,.6)",
              boxShadow: t === mealTime ? "0 0 14px rgba(199,242,122,.55)" : "none",
            }}
          >
            {t}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, background: "#1b1e21", borderRadius: 18, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: photo
              ? `center/cover no-repeat url(${photo})`
              : "repeating-linear-gradient(45deg,#2a2d30,#2a2d30 4px,#232527 4px,#232527 8px)",
            flex: "none",
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{result?.descripcion}</div>
          {result?.gramos ? (
            <div style={{ fontSize: 11.5, color: "rgba(244,243,238,.45)", marginTop: 4 }}>
              ≈ {result.gramos}g estimados por análisis visual
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 14 }}>
        {[
          { v: Math.round(result?.kcal ?? 0), l: "kcal", color: "#f4f3ee" },
          { v: `${Math.round(result?.carbos ?? 0)}g`, l: "carbs", color: "oklch(78% 0.15 85)" },
          { v: `${Math.round(result?.proteina ?? 0)}g`, l: "prote", color: "oklch(72% 0.15 250)" },
          { v: `${Math.round(result?.grasa ?? 0)}g`, l: "grasa", color: "oklch(72% 0.15 40)" },
        ].map((x) => (
          <div key={x.l} style={{ background: "#1b1e21", borderRadius: 14, padding: 10, textAlign: "center" }}>
            <div className="font-sora" style={{ fontSize: 15, fontWeight: 800, color: x.color }}>{x.v}</div>
            <div style={{ fontSize: 10, color: "rgba(244,243,238,.45)", marginTop: 2 }}>{x.l}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />
      <Pressable
        onClick={save}
        style={{
          background: "#c7f27a",
          color: "#10240a",
          textAlign: "center",
          padding: 16,
          borderRadius: 18,
          fontWeight: 800,
          fontSize: 14,
          margin: "16px 0 20px",
          cursor: "pointer",
          boxShadow: "0 0 20px rgba(199,242,122,.5)",
        }}
      >
        Agregar al tablero
      </Pressable>
    </div>
  );
}
