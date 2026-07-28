"use client";

// Capa de datos: usa Supabase cuando está configurado y hay sesión;
// si no, guarda todo en localStorage (modo local, un solo usuario).

import { getSupabase } from "./supabase";
import {
  AccessStatus,
  Activity,
  AdminUserRow,
  BodyComp,
  DEFAULT_PROFILE,
  DEFAULT_ROUTINE,
  Drink,
  Meal,
  MeasurementEntry,
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
  try {
    localStorage.setItem(LS + key, JSON.stringify(value));
  } catch {
    // Cuota de localStorage excedida (p. ej. muchas miniaturas de comidas):
    // no rompemos la app, solo no persistimos ese dato en modo local.
  }
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
  drinks: Drink[];
  activity: Activity | null;
  workout: WorkoutState | null;
  sleep: SleepState | null;
  bodyComp: BodyComp | null;
  routine: Routine;
  weights: WeightEntry[];
  measurements: MeasurementEntry[];
}

export async function loadAll(date: string): Promise<AllData> {
  const sb = getSupabase();
  const uid = await userId();
  if (!sb || !uid) return loadLocal(date);

  const since = new Date();
  since.setDate(since.getDate() - 45);
  const sinceISO = since.toISOString().slice(0, 10);

  const [profileQ, mealsQ, drinksQ, activityQ, workoutQ, sleepQ, bodyQ, routineQ, weightsQ, measurementsQ] =
    await Promise.all([
      sb.from("profiles").select("*").eq("id", uid).maybeSingle(),
      sb.from("meals").select("*").eq("user_id", uid).eq("fecha", date),
      sb.from("drinks").select("*").eq("user_id", uid).eq("fecha", date).order("creado"),
      sb.from("activity_logs").select("*").eq("user_id", uid).eq("fecha", date).maybeSingle(),
      sb.from("workouts").select("*").eq("user_id", uid).eq("fecha", date).maybeSingle(),
      sb.from("sleep_logs").select("*").eq("user_id", uid).eq("fecha", date).maybeSingle(),
      sb.from("body_composition").select("*").eq("user_id", uid).order("fecha", { ascending: false }).limit(1).maybeSingle(),
      sb.from("routines").select("*").eq("user_id", uid),
      sb.from("weight_logs").select("*").eq("user_id", uid).gte("fecha", sinceISO).order("fecha"),
      sb.from("measurements_logs").select("*").eq("user_id", uid).order("fecha"),
    ]);

  const p = profileQ.data;
  if (profileQ.error) {
    // No lo tapamos: si algo salió mal leyendo el perfil, mejor saberlo
    // en consola que caer en silencio a un perfil "aprobado" por defecto.
    console.error("Error cargando perfil:", profileQ.error);
  }
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
        // Fila existente sin este campo (no debería pasar tras la
        // migración) → se asume aprobada, igual que el resto de columnas
        // nuevas con "??" arriba.
        status: (p.status as AccessStatus) ?? "approved",
        isAdmin: p.is_admin ?? false,
        onboarded: p.onboarded ?? true,
        exercisePlan: p.plan_ejercicio ?? "",
        goalMotivation: p.motivo ?? "",
        foodCulture: p.cultura_alimentaria ?? "",
      }
    : // OJO: con Supabase configurado, si la fila de "profiles" no llegó
      // (aún no la crea el trigger, un error de RLS, lo que sea) NUNCA se
      // debe asumir "aprobado" — eso dejaría entrar a cualquiera que se
      // registre antes de que exista su fila. DEFAULT_PROFILE (aprobado)
      // es solo para el modo 100% local sin Supabase.
      { ...DEFAULT_PROFILE, status: "pending", onboarded: false };

  // Sesión válida pero sin fila de perfil: pasa si el admin eliminó a esa
  // persona del panel. Sin recrearla quedaría invisible para el admin (no
  // aparece en ninguna lista) y atrapada para siempre en "en revisión".
  // La recreamos pendiente — el trigger de la BD garantiza que nazca así.
  if (!p && !profileQ.error) {
    const { data: sess } = await sb.auth.getSession();
    const u = sess.session?.user;
    await sb.from("profiles").insert({
      id: uid,
      email: u?.email ?? null,
      nombre: (u?.user_metadata as { nombre?: string } | undefined)?.nombre ?? "",
    });
  }

  const meals: Meal[] = (mealsQ.data ?? []).map((m) => ({
    id: m.id,
    date: m.fecha,
    time: m.tiempo,
    desc: m.descripcion,
    kcal: m.kcal,
    p: m.proteina,
    c: m.carbos,
    f: m.grasa,
    photo: m.foto_url ?? null,
  }));

  const drinks: Drink[] = (drinksQ.data ?? []).map((d) => ({
    id: d.id,
    date: d.fecha,
    ml: d.ml,
    label: d.nombre ?? "Agua",
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

  const measurements: MeasurementEntry[] = (measurementsQ.data ?? []).map((x) => ({
    date: x.fecha,
    armCm: x.brazo_cm != null ? Number(x.brazo_cm) : undefined,
    waistCm: x.cintura_cm != null ? Number(x.cintura_cm) : undefined,
    chestCm: x.pecho_cm != null ? Number(x.pecho_cm) : undefined,
    legCm: x.pierna_cm != null ? Number(x.pierna_cm) : undefined,
    gluteCm: x.gluteos_cm != null ? Number(x.gluteos_cm) : undefined,
  }));

  return {
    profile,
    meals,
    drinks,
    activity,
    workout,
    sleep,
    bodyComp,
    routine,
    weights,
    measurements,
  };
}

function loadLocal(date: string): AllData {
  const meals = lsGet<Meal[]>("meals", []).filter((m) => m.date === date);
  const drinks = lsGet<Drink[]>("drinks", []).filter((d) => d.date === date);
  return {
    profile: lsGet<Profile>("profile", DEFAULT_PROFILE),
    meals,
    drinks,
    activity: lsGet<Record<string, Activity>>("activity", {})[date] ?? null,
    workout: lsGet<Record<string, WorkoutState>>("workout", {})[date] ?? null,
    sleep: lsGet<Record<string, SleepState>>("sleep", {})[date] ?? null,
    bodyComp: lsGet<BodyComp | null>("bodyComp", null),
    routine: lsGet<Routine>("routine", DEFAULT_ROUTINE),
    weights: lsGet<WeightEntry[]>("weights", []),
    measurements: lsGet<MeasurementEntry[]>("measurements", []),
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
      photo: m.foto_url ?? null,
    }));
  }
  return lsGet<Meal[]>("meals", []).filter((m) => m.date === date);
}

export async function drinksFor(date: string): Promise<Drink[]> {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    const { data } = await sb.from("drinks").select("*").eq("user_id", uid).eq("fecha", date).order("creado");
    return (data ?? []).map((d) => ({ id: d.id, date: d.fecha, ml: d.ml, label: d.nombre ?? "Agua" }));
  }
  return lsGet<Drink[]>("drinks", []).filter((d) => d.date === date);
}

export async function activityFor(date: string): Promise<Activity | null> {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    const { data: a } = await sb.from("activity_logs").select("*").eq("user_id", uid).eq("fecha", date).maybeSingle();
    return a
      ? {
          steps: a.pasos,
          activeMin: a.min_activos,
          activityKcal: a.kcal_activas,
          totalKcal: a.kcal_totales,
          distance: Number(a.distancia_km),
          synced: true,
        }
      : null;
  }
  return lsGet<Record<string, Activity>>("activity", {})[date] ?? null;
}

export async function workoutFor(date: string): Promise<WorkoutState | null> {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    const { data: w } = await sb.from("workouts").select("*").eq("user_id", uid).eq("fecha", date).maybeSingle();
    return w ? { day: w.dia, done: w.completado, kcal: w.kcal_quemadas, name: w.nombre ?? "", notes: w.notas ?? "" } : null;
  }
  return lsGet<Record<string, WorkoutState>>("workout", {})[date] ?? null;
}

// OJO: nunca manda "status" ni "is_admin" — esos solo los cambia un admin
// desde el panel (setUserStatus), y además la base de datos los protege con
// un trigger aunque este código intentara enviarlos.
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
      onboarded: profile.onboarded,
      plan_ejercicio: profile.exercisePlan,
      motivo: profile.goalMotivation,
      cultura_alimentaria: profile.foodCulture,
    });
  } else {
    lsSet("profile", profile);
  }
}

// ---- Panel de administración (aprobar / rechazar cuentas nuevas) ----

export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("profiles")
    .select("id,nombre,email,status,creado")
    .order("creado", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre || "(sin nombre)",
    email: r.email || "—",
    status: (r.status as AccessStatus) ?? "approved",
    creado: r.creado,
  }));
}

export async function setUserStatus(userId: string, status: AccessStatus) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("profiles").update({ status }).eq("id", userId);
}

// Quita a alguien de la lista del panel. OJO: borra su fila de "profiles",
// no su cuenta de acceso (eso solo se puede desde el dashboard de Supabase).
// Si esa persona vuelve a entrar, la app le recrea la fila como PENDIENTE y
// reaparece en el panel para que decidas de nuevo.
export async function deleteUserProfile(userId: string) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("profiles").delete().eq("id", userId);
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
      foto_url: meal.photo ?? null,
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

export async function addDrink(d: Drink) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("drinks").insert({
      id: d.id,
      user_id: uid,
      fecha: d.date,
      ml: d.ml,
      nombre: d.label,
    });
  } else {
    const all = lsGet<Drink[]>("drinks", []);
    lsSet("drinks", [...all, d]);
  }
}

export async function updateDrink(d: Drink) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("drinks").update({ ml: d.ml, nombre: d.label }).eq("id", d.id).eq("user_id", uid);
  } else {
    const all = lsGet<Drink[]>("drinks", []);
    lsSet("drinks", all.map((x) => (x.id === d.id ? d : x)));
  }
}

export async function deleteDrink(id: string) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    await sb.from("drinks").delete().eq("id", id).eq("user_id", uid);
  } else {
    const all = lsGet<Drink[]>("drinks", []);
    lsSet("drinks", all.filter((d) => d.id !== id));
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

// Medidas corporales: SIEMPRE se combinan con lo que ya había ese mismo día
// (el formulario deja completar solo alguna medida) — sin este merge, subir
// solo el brazo hoy borraría la cintura que ya se había guardado hoy mismo.
export async function addMeasurement(entry: MeasurementEntry) {
  const sb = getSupabase();
  const uid = await userId();
  if (sb && uid) {
    const { data: existing } = await sb
      .from("measurements_logs")
      .select("*")
      .eq("user_id", uid)
      .eq("fecha", entry.date)
      .maybeSingle();
    await sb.from("measurements_logs").upsert(
      {
        user_id: uid,
        fecha: entry.date,
        brazo_cm: entry.armCm ?? existing?.brazo_cm ?? null,
        cintura_cm: entry.waistCm ?? existing?.cintura_cm ?? null,
        pecho_cm: entry.chestCm ?? existing?.pecho_cm ?? null,
        pierna_cm: entry.legCm ?? existing?.pierna_cm ?? null,
        gluteos_cm: entry.gluteCm ?? existing?.gluteos_cm ?? null,
      },
      { onConflict: "user_id,fecha" }
    );
  } else {
    const all = lsGet<MeasurementEntry[]>("measurements", []);
    const existing = all.find((m) => m.date === entry.date);
    const merged: MeasurementEntry = {
      date: entry.date,
      armCm: entry.armCm ?? existing?.armCm,
      waistCm: entry.waistCm ?? existing?.waistCm,
      chestCm: entry.chestCm ?? existing?.chestCm,
      legCm: entry.legCm ?? existing?.legCm,
      gluteCm: entry.gluteCm ?? existing?.gluteCm,
    };
    lsSet(
      "measurements",
      [...all.filter((m) => m.date !== entry.date), merged].sort((a, b) => a.date.localeCompare(b.date))
    );
  }
}

export { todayISO };
