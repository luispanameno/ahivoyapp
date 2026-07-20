"use client";

// Editar rutina Push/Pull/Legs: ejercicios y sets editables por usuario.

import { useRouter } from "next/navigation";
import { useState } from "react";
import Pressable from "@/components/Pressable";
import { useApp } from "@/lib/store";
import { Routine, RoutineDay } from "@/lib/types";

const DAYS: RoutineDay[] = ["Push", "Pull", "Legs"];

export default function RutinaEdit() {
  const router = useRouter();
  const { routine, saveRoutine, showToast } = useApp();
  const [draft, setDraft] = useState<Routine>(() => JSON.parse(JSON.stringify(routine)));
  const [day, setDay] = useState<RoutineDay>("Push");

  const update = (i: number, field: "name" | "sets", value: string) => {
    setDraft((prev) => {
      const next = { ...prev, [day]: prev[day].map((ex, x) => (x === i ? { ...ex, [field]: value } : ex)) };
      return next;
    });
  };

  const remove = (i: number) => {
    setDraft((prev) => ({ ...prev, [day]: prev[day].filter((_, x) => x !== i) }));
  };

  const add = () => {
    setDraft((prev) => ({ ...prev, [day]: [...prev[day], { name: "Nuevo ejercicio", sets: "3x10" }] }));
  };

  const save = async () => {
    await saveRoutine(draft);
    showToast("Rutina guardada");
    router.push("/entrenamiento");
  };

  return (
    <div style={{ minHeight: "100dvh", boxSizing: "border-box", padding: "24px 20px 24px", display: "flex", flexDirection: "column" }}>
      <div className="font-sora" style={{ fontSize: 20, fontWeight: 700 }}>Editar rutina</div>
      <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>
        Cada usuario tiene la suya — cambia días y ejercicios
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        {DAYS.map((d) => (
          <div
            key={d}
            onClick={() => setDay(d)}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "9px 0",
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              background: day === d ? "#c7f27a" : "#1b1e21",
              color: day === d ? "#10240a" : "rgba(244,243,238,.6)",
              boxShadow: day === d ? "0 0 14px rgba(199,242,122,.5)" : "none",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {draft[day].map((ex, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#1b1e21", borderRadius: 14, padding: "10px 12px" }}>
            <input
              value={ex.name}
              onChange={(e) => update(i, "name", e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#f4f3ee",
                fontSize: 13,
                fontWeight: 600,
                minWidth: 0,
              }}
            />
            <input
              value={ex.sets}
              onChange={(e) => update(i, "sets", e.target.value)}
              style={{
                width: 52,
                background: "rgba(255,255,255,.06)",
                border: "none",
                outline: "none",
                borderRadius: 8,
                padding: "6px 8px",
                color: "rgba(244,243,238,.7)",
                fontSize: 12,
                textAlign: "center",
              }}
            />
            <div
              onClick={() => remove(i)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "oklch(72% 0.18 25)",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              ×
            </div>
          </div>
        ))}
      </div>
      <Pressable
        onClick={add}
        style={{
          marginTop: 10,
          textAlign: "center",
          padding: 12,
          borderRadius: 14,
          border: "1px dashed rgba(255,255,255,.2)",
          fontSize: 12.5,
          fontWeight: 700,
          color: "rgba(244,243,238,.6)",
          cursor: "pointer",
        }}
      >
        + Agregar ejercicio
      </Pressable>

      <div style={{ flex: 1 }} />
      <Pressable
        onClick={save}
        style={{
          background: "#c7f27a",
          color: "#10240a",
          textAlign: "center",
          padding: 15,
          borderRadius: 18,
          fontWeight: 800,
          fontSize: 13.5,
          marginTop: 16,
          cursor: "pointer",
          boxShadow: "0 0 20px rgba(199,242,122,.5)",
        }}
      >
        Guardar rutina
      </Pressable>
    </div>
  );
}
