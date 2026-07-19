"use client";

// Editar / eliminar una comida registrada.

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  background: "#1b1e21",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 12,
  padding: "12px 14px",
  color: "#f4f3ee",
  fontSize: 13,
  boxSizing: "border-box",
  outline: "none",
};

export default function EditarComida() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { meals, updateMeal, deleteMeal, showToast } = useApp();

  const meal = meals.find((m) => m.id === params.id);
  const [desc, setDesc] = useState(meal?.desc ?? "");
  const [kcal, setKcal] = useState(String(meal?.kcal ?? 0));
  const [p, setP] = useState(String(meal?.p ?? 0));
  const [c, setC] = useState(String(meal?.c ?? 0));
  const [f, setF] = useState(String(meal?.f ?? 0));

  if (!meal) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center", color: "rgba(244,243,238,.5)", fontSize: 13 }}>
        Registro no encontrado.
        <div onClick={() => router.push("/historial")} style={{ marginTop: 16, color: "#c7f27a", fontWeight: 700, cursor: "pointer" }}>
          ‹ Volver al historial
        </div>
      </div>
    );
  }

  const save = async () => {
    await updateMeal({ ...meal, desc, kcal: Number(kcal) || 0, p: Number(p) || 0, c: Number(c) || 0, f: Number(f) || 0 });
    showToast("Comida actualizada");
    router.push("/historial");
  };

  const remove = async () => {
    await deleteMeal(meal.id);
    showToast("Registro eliminado");
    router.push("/historial");
  };

  return (
    <div style={{ minHeight: "100dvh", boxSizing: "border-box", padding: "24px 20px", display: "flex", flexDirection: "column" }}>
      <div className="font-sora" style={{ fontSize: 18, fontWeight: 700 }}>Editar comida</div>
      <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>{meal.time}</div>

      <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)" }}>DESCRIPCIÓN</div>
      <input value={desc} onChange={(e) => setDesc(e.target.value)} style={fieldStyle} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        {[
          { label: "CALORÍAS", val: kcal, set: setKcal },
          { label: "PROTEÍNA (g)", val: p, set: setP },
          { label: "CARBS (g)", val: c, set: setC },
          { label: "GRASAS (g)", val: f, set: setF },
        ].map((x) => (
          <div key={x.label}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)" }}>{x.label}</div>
            <input type="number" inputMode="numeric" value={x.val} onChange={(e) => x.set(e.target.value)} style={fieldStyle} />
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
          padding: 15,
          borderRadius: 18,
          fontWeight: 800,
          fontSize: 13.5,
          marginTop: 20,
          cursor: "pointer",
          boxShadow: "0 0 20px rgba(199,242,122,.5)",
        }}
      >
        Guardar cambios
      </div>
      <div
        onClick={remove}
        style={{
          textAlign: "center",
          padding: 14,
          borderRadius: 18,
          fontWeight: 700,
          fontSize: 13,
          marginTop: 10,
          cursor: "pointer",
          color: "oklch(72% 0.18 25)",
          border: "1px solid oklch(72% 0.18 25 / 0.4)",
        }}
      >
        Eliminar registro
      </div>
    </div>
  );
}
