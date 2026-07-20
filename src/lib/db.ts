"use client";

// Capa de datos: usa Supabase cuando está configurado y hay sesión;
// si no, guarda todo en localStorage (modo local, un solo usuario).

import { getSupabase } from "./supabase";
import {
  Activity,
  BodyComp,
  DEFAULT_PROFILE,
  DEFAULT_ROUTINE,
  Meal,
  Profile,
  Routine,
  SleepState,
  WeightEntry,
  WorkoutState,
  todayISO,
} from "./types";

const LS = "ahivoy:";

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(LS + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS + key, JSON.stringify(value));
}

async function userId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

export interface AllData {
  profile: Profile;
  meals: Meal[];
  water: number;
  activity: Activity | null;
  workout: WorkoutState | null;
  sleep: SleepState | null;
  bodyComp: BodyComp | null;
  routine: Routine;
  weights: WeightEntry[];
}

const EMPTY: AllData = {
  profile: DEFAULT_PROFILE,
  meals: [],
  water: 0,
  activity: null,
  workout: null,
  sleep: null,
  bodyComp: null,
  routine: DEFAULT_ROUTINE,
  weights: [],
};

export async function loadAll(date: string): Promise<AllData> {
  const sb = getSupabase();
  const uid = await userId();
  if (!sb || !uid) return loadLocal(date);

  const since = new Date();
  since.setDate(since.getDate() - 45);
  const sinceISO = since.toISOString().slice(0, 10);

  const [profileQ, mealsQ, waterQ, activityQ, workoutQ, sleepQ, bodyQ, routineQ, weightsQ] =
    await Promise.all([
      sb.from("profiles").select("*").eq("id", uid).maybeSingle(),
      sb.from("meals").select("*").eq("user_id", uid).eq("fecha", date),
      sb.from("water_logs").select("ml").eq("user_id", uid).eq("fecha", date).maybeSingle(),
      sb.from("activity_logs").select("*").eq("user_id", uid).eq("fecha", date).maybeSingle(),
      sb.from("workouts").select("*").eq("user_id", uid).eq("fecha", date).maybeSingle(),
      sb.from("sleep_logs").select("*").eq("user_id", uid).eq("fecha", date).maybeSingle(),
      sb.from("body_composition").select("*").eq("user_id", uid).order("fecha", { ascending: false }).limit(1).maybeSingle(),
      sb.from("routines").select("*").eq("user_id", uid),
      sb.from("weight_logs").select("*").eq("user_id", uid).gte("fecha", sinceISO).order("fecha"),
    ]);

  const p = profileQ.data;
  const profile: Profile = p
    ? {
        name: p.nombre ?? "",
        photo: p.foto ?? null,
        sex: p.sexo === "F" ? "F" : "M",
        activityLevel:
          p.nivel_actividad === "sedentario" || p.nivel_actividad === "activo"
            ? p.nivel_actividad
            : "ligero",
        age: p.edad ?? DEFAULT_PROFILE.age,
        height: p.altura ?? DEFAULT_PROFILE.height,
        weight: Number(p.peso ?? DEFAULT_PROFILE.weight),
        weightGoal: Number(p.meta_peso ?? DEFAULT_PROFILE.weightGoal),
        metaKcal: p.meta_kcal ?? 2000,
        metaProtein: p.meta_proteina ?? 115,
        metaCarbs: p.meta_carbos ?? 220,
        metaFat: p.meta_grasa ?? 70,
        metaWater: p.meta_agua ?? 3000,
      }
    : DEFAULT_PROFILE;

  const meals: Meal[] = (mealsQ.data ?? []).map((m) => ({
    id: m.id,
    date: m.fecha,
    time: m.tiempo,
    desc: m.descripcion,
    kcal: m.kcal,
    p: m.proteina,
    c: m.carbos,
    f: m.grasa,
  }));

  const a = activityQ.data;
  const activity: Activity | null = a
    ? {
        steps: a.pasos,
        activeMin: a.min_activos,
        activityKcal: a.kcal_activas,
        totalKcal: a.kcal_totales,
        distance: Number(a.distancia_km),
        synced: true,
      }
    : null;

  const w = workoutQ.data;
  const workout: WorkoutState | null = w
    ? { day: w.dia, done: w.completado, kcal: w.kcal_quemadas, name: w.nombre ?? "", notes: w.notas ?? "" }
    : null;

  const s = sleepQ.data;
  const sleep: SleepState | null = s ? { minutes: s.minutos, phases: s.fases ?? null } : null;

  const b = bodyQ.data;
  const bodyComp: BodyComp | null = b
    ? {
        score: b.score,
        build: b.complexion,
        bmi: Number(b.imc),
        fatPct: Number(b.grasa_pct),
        waterPct: Number(b.agua_pct),
        proteinPct: Number(b.proteina_pct),
        bmr: b.bmr,
        visceralFat: Number(b.grasa_visceral),
        muscle: Number(b.musculo_lb),
        boneMass: Number(b.masa_osea_lb),
        date: b.fecha,
      }
    : null;

  const routine: Routine = { ...DEFAULT_ROUTINE };
  for (const r of routineQ.data ?? []) {
    if (r.dia === "Push" || r.dia === "Pull" || r.dia === "Legs") {
      routine[r.dia as keyof Routine] = r.ejercicios;
    }
  }

  const weights: WeightEntry[] = (weightsQ.data ?? []).map((x) => ({
    date: x.fecha,
    lb: Number(x.peso_lb),
  }));

  return {
    profile,
    meals,
    water: waterQ.data?.ml ?? 0,
    activity,
    workout,
    sleep,
    bodyComp,
    routine,
    weights,
  };
}

function loadLocal(date: string): AllData {
  const meals = lsGet<Meal[]>("meals", []).filter((m) => m.date === date);
  return {
    profile: lsGet<Profile>("profile", DEFAULT_PROFILE),
    meals,
    water: lsGet<Record<string, number>>("water", {})[date] ?? 0,
    activity: lsGet<Record<string, Activity>>("activity", {})[date] ?? null,
    workout: lsGet<Record<string, WorkoutState>>("workout", {})[date] ?? null,
    sleep: lsGet<Record<string, SleepState>>("sleep", {})[date] ?? null,
    bodyComp: lsGet<BodyComp | null>("bodyComp", null),
    routine: lsGet<Routine>("routine", DEFAULT_ROUTINE),
    weights: lsGet<WeightEntry[]>("weights", []),
  };
}

// ---- Helpers para operar sobre CUALQUIER día (los usa el Coach IA) ----

export async function mealsFor(date: string): Promise<Meal[]> {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    const { data } = await sb.from("meals").select("*").eq("user_id", uid).eq("fecha", date);
    return (data ?? []).map((m) => ({
      id: m.id,
      date: m.fecha,
      time: m.tiempo,
      desc: m.descripcion,
      kcal: m.kcal,
      p: m.proteina,
      c: m.carbos,
      f: m.grasa,
    }));
  }
  return lsGet<Meal[]>("meals", []).filter((m) => m.date === date);
}

export async function waterFor(date: string): Promise<number> {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    const { data } = await sb.from("water_logs").select("ml").eq("user_id", uid).eq("fecha", date).maybeSingle();
    return data?.ml ?? 0;
  }
  return lsGet<Record<string, number>>("water", {})[date] ?? 0;
}

export async function saveProfile(profile: Profile) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("profiles").upsert({
      id: uid,
      nombre: profile.name,
      foto: profile.photo,
      sexo: profile.sex,
      nivel_actividad: profile.activityLevel,
      edad: profile.age,
      altura: profile.height,
      peso: profile.weight,
      meta_peso: profile.weightGoal,
      meta_kcal: profile.metaKcal,
      meta_proteina: profile.metaProtein,
      meta_carbos: profile.metaCarbs,
      meta_grasa: profile.metaFat,
      meta_agua: profile.metaWater,
    });
  } else {
    lsSet("profile", profile);
  }
}

export async function addMeal(meal: Meal) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("meals").insert({
      id: meal.id,
      user_id: uid,
      fecha: meal.date,
      tiempo: meal.time,
      descripcion: meal.desc,
      kcal: meal.kcal,
      proteina: meal.p,
      carbos: meal.c,
      grasa: meal.f,
    });
  } else {
    const all = lsGet<Meal[]>("meals", []);
    lsSet("meals", [...all, meal]);
  }
}

export async function updateMeal(meal: Meal) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb
      .from("meals")
      .update({
        tiempo: meal.time,
        descripcion: meal.desc,
        kcal: meal.kcal,
        proteina: meal.p,
        carbos: meal.c,
        grasa: meal.f,
      })
      .eq("id", meal.id)
      .eq("user_id", uid);
  } else {
    const all = lsGet<Meal[]>("meals", []);
    lsSet("meals", all.map((m) => (m.id === meal.id ? meal : m)));
  }
}

export async function deleteMeal(id: string) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("meals").delete().eq("id", id).eq("user_id", uid);
  } else {
    const all = lsGet<Meal[]>("meals", []);
    lsSet("meals", all.filter((m) => m.id !== id));
  }
}

export async function setWater(date: string, ml: number) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("water_logs").upsert({ user_id: uid, fecha: date, ml }, { onConflict: "user_id,fecha" });
  } else {
    const all = lsGet<Record<string, number>>("water", {});
    all[date] = ml;
    lsSet("water", all);
  }
}

export async function setActivity(date: string, a: Activity) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("activity_logs").upsert(
      {
        user_id: uid,
        fecha: date,
        pasos: a.steps,
        min_activos: a.activeMin,
        kcal_activas: a.activityKcal,
        kcal_totales: a.totalKcal,
        distancia_km: a.distance,
      },
      { onConflict: "user_id,fecha" }
    );
  } else {
    const all = lsGet<Record<string, Activity>>("activity", {});
    all[date] = a;
    lsSet("activity", all);
  }
}

export async function setWorkout(date: string, w: WorkoutState) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("workouts").upsert(
      {
        user_id: uid,
        fecha: date,
        dia: w.day,
        completado: w.done,
        kcal_quemadas: w.kcal,
        nombre: w.name,
        notas: w.notes,
      },
      { onConflict: "user_id,fecha" }
    );
  } else {
    const all = lsGet<Record<string, WorkoutState>>("workout", {});
    all[date] = w;
    lsSet("workout", all);
  }
}

export async function setSleep(date: string, s: SleepState) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("sleep_logs").upsert(
      { user_id: uid, fecha: date, minutos: s.minutes, fases: s.phases },
      { onConflict: "user_id,fecha" }
    );
  } else {
    const all = lsGet<Record<string, SleepState>>("sleep", {});
    all[date] = s;
    lsSet("sleep", all);
  }
}

export async function addBodyComp(b: BodyComp) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("body_composition").insert({
      user_id: uid,
      fecha: b.date,
      score: b.score,
      complexion: b.build,
      imc: b.bmi,
      grasa_pct: b.fatPct,
      agua_pct: b.waterPct,
      proteina_pct: b.proteinPct,
      bmr: b.bmr,
      grasa_visceral: b.visceralFat,
      musculo_lb: b.muscle,
      masa_osea_lb: b.boneMass,
    });
  } else {
    lsSet("bodyComp", b);
  }
}

export async function saveRoutine(routine: Routine) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("routines").upsert(
      (["Push", "Pull", "Legs"] as const).map((dia) => ({
        user_id: uid,
        dia,
        ejercicios: routine[dia],
      })),
      { onConflict: "user_id,dia" }
    );
  } else {
    lsSet("routine", routine);
  }
}

export async function addWeight(entry: WeightEntry) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("weight_logs").upsert(
      { user_id: uid, fecha: entry.date, peso_lb: entry.lb },
      { onConflict: "user_id,fecha" }
    );
  } else {
    const all = lsGet<WeightEntry[]>("weights", []).filter((w) => w.date !== entry.date);
    lsSet("weights", [...all, entry].sort((a, b) => a.date.localeCompare(b.date)));
  }
}

export { todayISO };
