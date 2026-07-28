"use client";

// Perfil · Vista "Ajustes": datos personales, nivel de actividad, metas
// diarias, control de acceso y cerrar sesión. El contexto para el Coach
// (motivo, cultura alimentaria, plan de ejercicio) se recoge una sola vez en
// el asistente de bienvenida y ya no se repite aquí; el registro de
// reloj/sueño/báscula/rutina vive en /perfil/sincronizacion.

import { useRouter } from "next/navigation";
import { useState } from "react";
import Pressable from "@/components/Pressable";
import Icon from "@/components/Icon";
import {
  getActivityOptions,
  ProfileFooter,
  ProfileHeader,
  ProfileTabs,
  cardStyle,
  labelStyle,
  numInput,
  sectionTitle,
} from "@/components/profileUi";
import { useApp } from "@/lib/store";
import { ACTIVITY_FACTORS } from "@/lib/types";
import { macrosForKcal } from "@/lib/nutrition";

export default function PerfilAjustes() {
  const router = useRouter();
  const app = useApp();
  const { profile, saveProfile, showToast, userEmail, signOut, t } = app;

  // Borrador de datos personales: se guardan solo al tocar "Guardar"
  const [draft, setDraft] = useState({
    age: String(profile.age),
    height: String(profile.height),
    weight: String(profile.weight),
    weightGoal: String(profile.weightGoal),
  });
  const dirty =
    Number(draft.age) !== profile.age ||
    Number(draft.height) !== profile.height ||
    Number(draft.weight) !== profile.weight ||
    Number(draft.weightGoal) !== profile.weightGoal;

  const saveDatos = async () => {
    const age = Number(draft.age) || profile.age;
    const height = Number(draft.height) || profile.height;
    const weight = Number(draft.weight) || profile.weight;
    const weightGoal = Number(draft.weightGoal) || profile.weightGoal;
    await saveProfile({ ...profile, age, height, weightGoal });
    if (weight !== profile.weight && weight > 0) await app.setWeight(weight);
    showToast("Datos guardados ✓");
  };

  // Los campos de metas son "no controlados" (defaultValue): al recalcularlos
  // por código hay que remontarlos con una key nueva para que muestren el
  // valor nuevo en vez del que el usuario tenía escrito.
  const [metasVersion, setMetasVersion] = useState(0);

  const setField = (field: keyof typeof profile, value: string | number) => {
    saveProfile({ ...profile, [field]: value });
  };

  const setNumField = (field: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value);
    if (Number.isNaN(n)) return;
    // Al cambiar las calorías a mano, los macros se reparten de nuevo sobre
    // ese total: si bajas las kcal y la grasa/carbos se quedan igual, el
    // reparto deja de cuadrar (sumarían más de lo que puedes comer).
    if (field === "metaKcal" && n > 0) {
      saveProfile({ ...profile, metaKcal: n, ...macrosForKcal(n, profile.weightGoal) });
      setMetasVersion((v) => v + 1);
      showToast("Metas ajustadas a tus nuevas calorías");
      return;
    }
    setField(field, n);
  };

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 0" }}>
      <ProfileHeader />
      <ProfileTabs />

      {/* Idioma de la app: cambia interfaz + Coach IA */}
      <div style={{ ...sectionTitle, marginTop: 22 }}>{t("perfil.languageTitle")}</div>
      <div style={{ background: "#1b1e21", borderRadius: 20, padding: 14 }}>
        <div style={{ fontSize: 11.5, color: "rgba(244,243,238,.5)", marginBottom: 10 }}>{t("perfil.languageSubtitle")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {(
            [
              { value: "es" as const, label: t("perfil.languageEs") },
              { value: "en" as const, label: t("perfil.languageEn") },
            ]
          ).map((opt) => (
            <Pressable
              key={opt.value}
              onClick={() => saveProfile({ ...profile, language: opt.value })}
              style={{
                flex: 1,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
                borderRadius: 100,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                background: profile.language === opt.value ? "#c7f27a" : "rgba(255,255,255,.06)",
                color: profile.language === opt.value ? "#10240a" : "rgba(244,243,238,.6)",
              }}
            >
              {opt.label}
            </Pressable>
          ))}
        </div>
      </div>

      {/* Datos personales */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.4)", letterSpacing: ".04em" }}>DATOS PERSONALES</div>
        <Pressable
          onClick={saveDatos}
          tapScale={0.9}
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: "10px 18px",
            borderRadius: 100,
            cursor: "pointer",
            background: dirty ? "#c7f27a" : "rgba(255,255,255,.08)",
            color: dirty ? "#10240a" : "rgba(244,243,238,.5)",
            boxShadow: dirty ? "0 0 12px rgba(199,242,122,.5)" : "none",
          }}
        >
          Guardar
        </Pressable>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>EDAD</div>
          <input type="number" inputMode="numeric" value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} style={numInput} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>ALTURA (cm)</div>
          <input type="number" inputMode="numeric" value={draft.height} onChange={(e) => setDraft({ ...draft, height: e.target.value })} style={numInput} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>PESO ACTUAL (lb)</div>
          <input type="number" inputMode="decimal" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} style={numInput} />
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>PESO META (lb)</div>
          <input type="number" inputMode="decimal" value={draft.weightGoal} onChange={(e) => setDraft({ ...draft, weightGoal: e.target.value })} style={numInput} />
        </div>
        <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
          <div style={labelStyle}>SEXO (para calcular tu metabolismo)</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {(
              [
                { value: "M", label: "Hombre" },
                { value: "F", label: "Mujer" },
              ] as const
            ).map((s) => (
              <Pressable
                key={s.value}
                onClick={() => saveProfile({ ...profile, sex: s.value })}
                style={{
                  flex: 1,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: profile.sex === s.value ? "#c7f27a" : "rgba(255,255,255,.06)",
                  color: profile.sex === s.value ? "#10240a" : "rgba(244,243,238,.6)",
                }}
              >
                {s.label}
              </Pressable>
            ))}
          </div>
        </div>
      </div>

      {/* Nivel de actividad diaria (para el TDEE) */}
      <div style={sectionTitle}>NIVEL DE ACTIVIDAD DIARIA</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {getActivityOptions(t).map((opt) => {
          const active = profile.activityLevel === opt.value;
          return (
            <Pressable
              key={opt.value}
              onClick={() => saveProfile({ ...profile, activityLevel: opt.value })}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: active ? "rgba(199,242,122,.12)" : "#1b1e21",
                border: active ? "1px solid rgba(199,242,122,.45)" : "1px solid rgba(255,255,255,.06)",
                borderRadius: 18,
                padding: "12px 14px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  flex: "none",
                  borderRadius: "50%",
                  border: active ? "5px solid #c7f27a" : "2px solid rgba(244,243,238,.3)",
                  boxSizing: "border-box",
                  boxShadow: active ? "0 0 10px rgba(199,242,122,.5)" : "none",
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: active ? "#c7f27a" : "#f4f3ee" }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: "rgba(244,243,238,.5)", marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(244,243,238,.35)", flex: "none" }}>
                ×{ACTIVITY_FACTORS[opt.value]}
              </div>
            </Pressable>
          );
        })}
      </div>

      {/* Metas diarias */}
      <div style={sectionTitle}>METAS DIARIAS (EDITABLES)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(
          [
            { label: "Calorías", field: "metaKcal", suffix: " kcal" },
            { label: "Proteína mínima", field: "metaProtein", suffix: "g" },
            { label: "Carbs máximo", field: "metaCarbs", suffix: "g" },
            { label: "Grasas máximo", field: "metaFat", suffix: "g" },
            { label: "Agua", field: "metaWater", suffix: " ml" },
          ] as const
        ).map((m) => (
          <div
            key={m.field}
            style={{
              display: "flex",
              flexWrap: "nowrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              background: "#1b1e21",
              borderRadius: 18,
              padding: "12px 14px",
              minHeight: 44,
              boxSizing: "border-box",
            }}
          >
            <span style={{ fontSize: 13, color: "rgba(244,243,238,.6)", flex: "none", whiteSpace: "nowrap" }}>{m.label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, justifyContent: "flex-end", minWidth: 0 }}>
              <input
                key={`${m.field}-${metasVersion}`}
                type="number"
                inputMode="numeric"
                defaultValue={profile[m.field]}
                onBlur={setNumField(m.field)}
                style={{ ...numInput, width: 56, minWidth: 0, textAlign: "right", marginTop: 0, fontSize: 13, flex: "none" }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, flex: "none", whiteSpace: "nowrap" }}>{m.suffix}</span>
            </div>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", background: "#1b1e21", borderRadius: 18, padding: "12px 14px" }}>
          <span style={{ fontSize: 13, color: "rgba(244,243,238,.6)" }}>Sueño</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>7–8 h</span>
        </div>
        {/* Antes había un botón "Recalcular con mis datos" — se quitó: un
            toque sin querer sobrescribía metas que el usuario había puesto
            a mano, sin avisar ni pedir confirmación. Esto es solo lectura. */}
        <div
          style={{
            background: "rgba(199,242,122,.06)",
            border: "1px solid rgba(199,242,122,.18)",
            borderRadius: 18,
            padding: "12px 14px",
            fontSize: 11.5,
            color: "rgba(244,243,238,.55)",
            lineHeight: 1.5,
          }}
        >
          Estos datos están calculados según tu edad, altura, peso, meta de peso y nivel de actividad — y con tu báscula
          inteligente, si la has subido. Puedes editarlos arriba cuando quieras; no se recalculan solos.
        </div>
      </div>

      {/* Control de acceso (solo admin) */}
      {profile.isAdmin && (
        <Pressable
          onClick={() => router.push("/admin")}
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(199,242,122,.08)",
            border: "1px solid rgba(199,242,122,.25)",
            borderRadius: 20,
            padding: "14px 16px",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#c7f27a" }}>
            <Icon name="premium" size={18} /> Control de acceso
          </span>
          <span style={{ fontSize: 11, color: "rgba(244,243,238,.4)" }}>Aprobar usuarios ›</span>
        </Pressable>
      )}

      {/* Cerrar sesión */}
      {userEmail && (
        <Pressable
          onClick={signOut}
          style={{
            marginTop: 24,
            textAlign: "center",
            padding: 14,
            borderRadius: 20,
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            color: "oklch(72% 0.18 25)",
            border: "1px solid oklch(72% 0.18 25 / 0.4)",
          }}
        >
          Cerrar sesión
        </Pressable>
      )}

      <ProfileFooter />
    </div>
  );
}
