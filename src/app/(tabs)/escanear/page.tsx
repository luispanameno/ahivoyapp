"use client";

// Escanear comida: captura → analizando (Gemini) → aclarar → confirmar tiempo → guardar.

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { analyze, fileToDataURL, FoodResult } from "@/lib/analyze";
import { useApp, currentMealTime } from "@/lib/store";
import { MealTime } from "@/lib/types";

type Step = "capture" | "analyzing" | "clarify" | "confirm";

const MEAL_TIMES: MealTime[] = ["Desayuno", "Almuerzo", "Cena", "Snack"];

export default function Escanear() {
  const router = useRouter();
  const { addMeal, showToast } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("capture");
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<FoodResult | null>(null);
  const [clarifyText, setClarifyText] = useState("");
  const [mealTime, setMealTime] = useState<MealTime>(currentMealTime());
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async (dataUrl: string, clarification?: string) => {
    setStep("analyzing");
    setError(null);
    try {
      const res = await analyze<FoodResult>({
        mode: "food",
        image: dataUrl,
        text: clarification || undefined,
      });
      setResult(res);
      if (res.pregunta && !clarification) {
        setStep("clarify");
      } else {
        setStep("confirm");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar la foto");
      setStep("capture");
    }
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    const url = await fileToDataURL(file);
    setPhoto(url);
    runAnalysis(url);
  };

  const save = async () => {
    if (!result) return;
    await addMeal({
      time: mealTime,
      desc: result.descripcion,
      kcal: Math.round(result.kcal),
      p: Math.round(result.proteina),
      c: Math.round(result.carbos),
      f: Math.round(result.grasa),
    });
    showToast(`¡Agregado! ${Math.round(result.kcal)} kcal`);
    router.push("/hoy");
  };

  // ---------- Captura ----------
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
          style={{ position: "absolute", top: 24, left: 20, zIndex: 2, fontSize: 13, fontWeight: 700, color: "rgba(244,243,238,.7)", cursor: "pointer" }}
        >
          ‹ Volver
        </div>
        <div style={{ position: "absolute", top: 24, left: 0, right: 0, textAlign: "center", fontSize: 12, fontWeight: 600, color: "rgba(244,243,238,.7)" }}>
          Encuadra tu plato o elige una foto
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
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            position: "absolute",
            left: 32,
            right: 32,
            top: 110,
            bottom: 180,
            borderRadius: 24,
            overflow: "hidden",
            border: "1.5px dashed rgba(255,255,255,.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            background: photo ? `center/cover no-repeat url(${photo})` : "transparent",
          }}
        >
          {!photo && (
            <div style={{ fontSize: 13, color: "rgba(244,243,238,.5)", fontWeight: 600, textAlign: "center", padding: "0 24px" }}>
              Toca aquí o el botón para tomar
              <br />o elegir la foto de tu plato 📸
            </div>
          )}
        </div>
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            position: "absolute",
            bottom: 56,
            left: "50%",
            transform: "translateX(-50%)",
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "#f4f3ee",
            border: "4px solid rgba(244,243,238,.4)",
            cursor: "pointer",
          }}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
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

  // ---------- Aclaración ----------
  if (step === "clarify") {
    return (
      <div style={{ height: "100dvh", boxSizing: "border-box", padding: "40px 24px 24px", display: "flex", flexDirection: "column" }}>
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
        <div
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
        </div>
      </div>
    );
  }

  // ---------- Confirmar ----------
  return (
    <div style={{ minHeight: "100dvh", boxSizing: "border-box", padding: "40px 20px 0", display: "flex", flexDirection: "column" }}>
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
      <div
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
      </div>
    </div>
  );
}
