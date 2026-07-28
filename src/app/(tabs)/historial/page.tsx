"use client";

// Historial: comidas del día agrupadas por tiempo; tocar para editar/borrar.

import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import MascotIllustration from "@/components/MascotIllustration";
import Pressable from "@/components/Pressable";
import { useApp } from "@/lib/store";
import { MealTime } from "@/lib/types";
import { MEAL_TIME_LABEL, MONTHS_SHORT, WEEKDAYS_LONG } from "@/lib/i18n";

const ORDER: MealTime[] = ["Desayuno", "Almuerzo", "Cena", "Snack"];

export default function Historial() {
  const router = useRouter();
  const { meals, drinks, kcalEaten, water, lang, t } = useApp();

  const now = new Date();
  const subtitle = `${WEEKDAYS_LONG[lang][now.getDay()]}, ${now.getDate()} ${MONTHS_SHORT[lang][now.getMonth()]} · ${kcalEaten.toLocaleString()} ${t("historial.kcalTotal")}`;

  const groups = ORDER.map((time) => ({
    label: MEAL_TIME_LABEL[lang][time].toUpperCase(),
    items: meals.filter((m) => m.time === time),
  })).filter((g) => g.items.length);

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 0" }}>
      <div className="font-sora" style={{ fontSize: 20, fontWeight: 700 }}>{t("historial.title")}</div>
      <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>{subtitle}</div>

      {groups.length === 0 && drinks.length === 0 && (
        <div style={{ marginTop: 24, textAlign: "center", color: "rgba(244,243,238,.45)", fontSize: 13, lineHeight: 1.6 }}>
          {t("historial.emptyLine1")}
          <br />
          {t("historial.emptyLine2")}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 18, paddingBottom: 20 }}>
        {drinks.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em", marginBottom: 8 }}>
              {t("historial.drinks")} · {water}ml
            </div>
            {drinks.map((d) => (
              <Pressable
                key={d.id}
                onClick={() => router.push(`/bebida/${d.id}`)}
                hoverScale={1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#1b1e21",
                  borderRadius: 18,
                  padding: "10px 12px",
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: "rgba(255,255,255,.06)",
                    flex: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                  }}
                >
                  <Icon name="water-amount" size={22} />
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
              </Pressable>
            ))}
          </div>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em", marginBottom: 8 }}>
              {group.label}
            </div>
            {group.items.map((meal) => (
              <Pressable
                key={meal.id}
                onClick={() => router.push(`/comida/${meal.id}`)}
                hoverScale={1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#1b1e21",
                  borderRadius: 18,
                  padding: "10px 12px",
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
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
                  {meal.photo ? null : <Icon name="food" size={22} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{meal.desc}</div>
                  <div style={{ fontSize: 11, color: "rgba(244,243,238,.45)" }}>
                    {t("historial.macrosShort", { p: meal.p, c: meal.c, f: meal.f })}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{meal.kcal} kcal</div>
              </Pressable>
            ))}
          </div>
        ))}
      </div>

      {/* La tortuga va SIEMPRE al final, después de la lista: acompaña sin
          quitarle sitio al historial, que es lo que se viene a leer. */}
      <MascotIllustration art="historial-vacia" height={165} style={{ marginTop: 8, marginBottom: 12 }} />
    </div>
  );
}
