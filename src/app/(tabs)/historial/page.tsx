"use client";

// Historial: comidas del día agrupadas por tiempo; tocar para editar/borrar.

import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { MealTime } from "@/lib/types";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ORDER: MealTime[] = ["Desayuno", "Almuerzo", "Cena", "Snack"];

export default function Historial() {
  const router = useRouter();
  const { meals, drinks, kcalEaten, water } = useApp();

  const now = new Date();
  const subtitle = `${DIAS[now.getDay()]}, ${now.getDate()} ${MESES[now.getMonth()]} · ${kcalEaten.toLocaleString()} kcal totales`;

  const groups = ORDER.map((t) => ({
    label: t.toUpperCase(),
    items: meals.filter((m) => m.time === t),
  })).filter((g) => g.items.length);

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 0" }}>
      <div className="font-sora" style={{ fontSize: 20, fontWeight: 700 }}>Historial</div>
      <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>{subtitle}</div>

      {groups.length === 0 && drinks.length === 0 && (
        <div style={{ marginTop: 40, textAlign: "center", color: "rgba(244,243,238,.45)", fontSize: 13, lineHeight: 1.6 }}>
          Aún no registras comidas hoy.
          <br />
          Usa el botón central para escanear tu plato 📸
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18, paddingBottom: 20 }}>
        {drinks.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em", marginBottom: 8 }}>
              BEBIDAS · {water}ml
            </div>
            {drinks.map((d) => (
              <div
                key={d.id}
                onClick={() => router.push(`/bebida/${d.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#1b1e21",
                  borderRadius: 14,
                  padding: "10px 12px",
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(255,255,255,.06)",
                    flex: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                  }}
                >
                  💧
                </div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{d.label}</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: d.ml < 0 ? "oklch(65% 0.19 25)" : "#f4f3ee",
                  }}
                >
                  {d.ml > 0 ? "+" : ""}
                  {d.ml}ml
                </div>
              </div>
            ))}
          </div>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em", marginBottom: 8 }}>
              {group.label}
            </div>
            {group.items.map((meal) => (
              <div
                key={meal.id}
                onClick={() => router.push(`/comida/${meal.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#1b1e21",
                  borderRadius: 14,
                  padding: "10px 12px",
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: meal.photo
                      ? `center/cover no-repeat url(${meal.photo})`
                      : "repeating-linear-gradient(45deg,#2a2d30,#2a2d30 4px,#232527 4px,#232527 8px)",
                    flex: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                  }}
                >
                  {meal.photo ? "" : "🍽️"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{meal.desc}</div>
                  <div style={{ fontSize: 11, color: "rgba(244,243,238,.45)" }}>
                    P {meal.p}g · C {meal.c}g · G {meal.f}g
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{meal.kcal} kcal</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
