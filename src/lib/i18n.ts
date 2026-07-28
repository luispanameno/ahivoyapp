// Diccionario de traducción de toda la interfaz. Las claves se organizan por
// pantalla/componente (ej. "tabbar.hoy", "login.title") para poder ubicarlas
// rápido. El Coach IA (las respuestas del chat) NO usa este diccionario —
// responde en el idioma elegido directamente desde el prompt del servidor
// (ver buildCoachPrompt en /api/analyze/route.ts).

export type Lang = "es" | "en";

type Dict = Record<string, string>;

export const I18N: Record<Lang, Dict> = {
  es: {
    // Barra de navegación
    "tabbar.hoy": "Hoy",
    "tabbar.historial": "Historial",
    "tabbar.coach": "Coach",
    "tabbar.perfil": "Perfil",

    // Login
    "login.signinTitle": "Inicia sesión con tu cuenta",
    "login.signupTitle": "Crea tu cuenta — tus datos son solo tuyos",
    "login.recoverTitle": "Te mandamos un enlace para poner una contraseña nueva",
    "login.namePlaceholder": "Tu nombre",
    "login.emailPlaceholder": "Correo",
    "login.passwordPlaceholder": "Contraseña",
    "login.confirmPasswordPlaceholder": "Confirma tu contraseña",
    "login.forgotPassword": "¿Olvidaste tu contraseña?",
    "login.busy": "Un momento…",
    "login.signIn": "Iniciar sesión",
    "login.createAccount": "Crear cuenta",
    "login.sendLink": "Enviar enlace",
    "login.toSignup": "¿No tienes cuenta? Crear una nueva",
    "login.toSignin": "Ya tengo cuenta · Iniciar sesión",
    "login.toSigninFromRecover": "‹ Volver a iniciar sesión",
    "login.localModeTitle": "Cuentas aún no activadas",
    "login.localModeBody":
      "Falta configurar Supabase (SUPABASE_URL y ANON_KEY en .env.local). Mientras tanto puedes usar la app en modo local: tus datos se guardan solo en este dispositivo.",
    "login.localModeCta": "Continuar en modo local",
    "login.errEmailOnly": "Escribe tu correo.",
    "login.errEmailInvalid": "Ese correo no parece válido — revisa que tenga la forma nombre@dominio.com.",
    "login.infoRecoverSent": "Si ese correo tiene una cuenta, te llegó un enlace para poner una contraseña nueva. Revisa también spam.",
    "login.errRecoverFailed": "No se pudo enviar el enlace",
    "login.errName": "Escribe tu nombre.",
    "login.errEmailPassword": "Escribe tu correo y contraseña.",
    "login.errPasswordShort": "La contraseña debe tener al menos 6 caracteres.",
    "login.errPasswordMismatch": "Las contraseñas no coinciden.",
    "login.infoConfirmEmail": "Revisa tu correo para confirmar la cuenta. Después, alguien debe aprobar tu acceso antes de que puedas entrar.",
    "login.errAuth": "Error de autenticación",

    // Hoy
    "hoy.syncPrompt": "Sube la captura de tu reloj en Perfil",
    "hoy.macrosTitle": "MACRONUTRIENTES HOY",
    "hoy.calories": "CALORÍAS",
    "hoy.carbs": "CARBS",
    "hoy.protein": "PROTEÍNA",
    "hoy.fat": "GRASAS",
    "hoy.hydrationTitle": "SEGUIMIENTO DE HIDRATACIÓN",
    "hoy.sleepTitle": "SUEÑO",
    "hoy.sleepWithinGoal": "Dentro de tu meta",
    "hoy.sleepBelowGoal": "Bajo tu meta de 7–8h",
    "hoy.sleepNoPhases": "Sin datos de fases — solo duración",
    "hoy.sleepTapToLog": "Toca para anotar tus horas",
    "hoy.summaryTitle": "Resumen del día",
    "hoy.summarySubtitle": "Barras de macros y cómo te fue",
    "hoy.viewMore": "Ver ›",
    "hoy.activityTitle": "ACTIVIDAD DE HOY",
    "hoy.viewDetail": "Ver detalle ›",
    "hoy.steps": "Pasos",
    "hoy.activeTime": "Tiempo de actividad",
    "hoy.activityCalories": "Calorías de actividad",
    "hoy.totalBurned": "Total quemadas",
    "hoy.distance": "Distancia",

    // Coach (chat)
    "coach.title": "Coach IA",
    "coach.subtitle": "Con tus datos de hoy en tiempo real",
    "coach.clear": "Limpiar",
    "coach.kcalFree": "KCAL LIBRES",
    "coach.kcalOver": "KCAL DE MÁS",
    "coach.carbsLeft": "CARBS FALTAN",
    "coach.carbsOver": "CARBS DE MÁS",
    "coach.proteinLeft": "PROTEÍNA FALTA",
    "coach.proteinOver": "PROTEÍNA DE MÁS",
    "coach.fatLeft": "GRASAS FALTAN",
    "coach.fatOver": "GRASAS DE MÁS",
    "coach.waterLeft": "AGUA FALTA",
    "coach.waterOver": "AGUA DE MÁS",
    "coach.placeholderListening": "Escuchando…",
    "coach.placeholderPhoto": "Agrega contexto a tu foto…",
    "coach.placeholderDefault": "Pregúntale o sube una foto…",
    "coach.photoReady": "Foto lista 📸 — escribe contexto si quieres (ej. \"dejé la mitad\") y presiona enviar",

    // Reset de contraseña
    "reset.title": "Pon tu contraseña nueva",
    "reset.wait": "Un momento…",
    "reset.invalidLink": "Este enlace ya venció o no es válido. Pide uno nuevo desde la pantalla de inicio de sesión.",
    "reset.goToLogin": "Ir a iniciar sesión",
    "reset.done": "Contraseña actualizada. Te llevamos a la app…",
    "reset.newPassword": "Contraseña nueva",
    "reset.confirmNewPassword": "Confirma la contraseña nueva",
    "reset.errPasswordShort": "La contraseña debe tener al menos 6 caracteres.",
    "reset.errPasswordMismatch": "Las contraseñas no coinciden.",
    "reset.errFailed": "No se pudo actualizar la contraseña",
    "reset.save": "Guardar contraseña",

    // Perfil / Ajustes
    "perfil.languageTitle": "IDIOMA DE LA APP",
    "perfil.languageSubtitle": "Cambia toda la interfaz y el Coach IA",
    "perfil.languageEs": "Español",
    "perfil.languageEn": "English",

    // Historial
    "historial.title": "Historial",
    "historial.kcalTotal": "kcal totales",
    "historial.emptyLine1": "Aún no registras comidas hoy.",
    "historial.emptyLine2": "Usa el botón central para escanear tu plato.",
    "historial.drinks": "BEBIDAS",
    "historial.macrosShort": "P {{p}}g · C {{c}}g · G {{f}}g",

    // Perfil (tabs compartidas + Mi progreso)
    "perfil.tabProgress": "Mi progreso",
    "perfil.tabSync": "Sincronización",
    "perfil.tabSettings": "Ajustes",
    "perfil.changePhoto": "Cambiar tu foto de perfil",
    "perfil.yourPhoto": "Tu foto",
    "perfil.namePlaceholder": "Tu nombre",
    "perfil.editHint": "Toca tu nombre para editarlo · toca la foto para cambiarla",
    "perfil.photoUpdated": "Foto de perfil actualizada",
    "perfil.photoLoadError": "No se pudo cargar esa foto",
    "perfil.metabolismTitle": "TU METABOLISMO",
    "perfil.whatIs": "Qué es el {{term}}",
    "perfil.bmrTitle": "¿Qué es el BMR?",
    "perfil.bmrBody":
      "Es tu Tasa Metabólica Basal: las calorías que tu cuerpo quema en reposo total — solo por respirar, pensar y mantener tus órganos funcionando. Se calcula con tu peso, altura, edad y sexo (o viene directo de tu báscula inteligente). Aunque no te muevas en todo el día, tu cuerpo gasta esto.",
    "perfil.tdeeTitle": "¿Qué es el TDEE?",
    "perfil.tdeeBody":
      "Es tu Gasto Energético Total Diario: el BMR multiplicado por tu nivel de actividad (caminar, trabajar, entrenar). Representa todas las calorías que quemas en un día normal. Para bajar de peso hay que comer por debajo del TDEE (déficit); para mantenerte, igual al TDEE.",
    "perfil.weightHistoryTitle": "HISTORIAL DE PESO",
    "perfil.days": "Días",
    "perfil.weeks": "Semanas",
    "perfil.weightTrendWeek": "esta semana",
    "perfil.weightTrendPeriod": "en este periodo",
    "perfil.weightTrendNoData": "Registra tu peso para ver tendencia",
    "perfil.weightEmpty": "Sube tu peso (en Ajustes o con la báscula) y verás tu progreso.",
    "perfil.measurementsTitle": "HISTORIAL DE MEDIDAS",
    "perfil.measurementsEmpty": "Anota tus medidas en {{sync}} y aquí vas a ver si subieron o bajaron.",
    "perfil.measureArm": "Brazo",
    "perfil.measureWaist": "Cintura",
    "perfil.measureChest": "Pecho",
    "perfil.measureLeg": "Pierna",
    "perfil.measureGlute": "Glúteos",
    "perfil.noChange": "Sin cambio",
    "perfil.firstMeasurement": "Primera medida",
    "perfil.noData": "Sin datos",
    "perfil.bodyCompTitle": "COMPOSICIÓN CORPORAL",
    "perfil.lastCapture": "Última captura: {{date}}",
    "perfil.noCaptureYet": "Sin captura aún",
    "perfil.bodyScoreTitle": "PUNTUACIÓN CORPORAL",
    "perfil.weightLabel": "Peso",
    "perfil.bodyBuild": "Complexión física",
    "perfil.bmi": "IMC",
    "perfil.bodyFat": "Grasa corporal",
    "perfil.waterLevel": "Nivel de agua",
    "perfil.proteinLevel": "Proteína",
    "perfil.basalMetabolism": "Metabolismo basal",
    "perfil.visceralFat": "Grasa visceral",
    "perfil.muscle": "Músculo",
    "perfil.boneMass": "Masa ósea",
    "perfil.badgeNormal": "Normal",
    "perfil.badgeHigh": "Alto",
    "perfil.badgeVeryHigh": "Muy alto",
    "perfil.badgeHighF": "Alta",
    "perfil.badgeVeryHighF": "Muy alta",
    "perfil.badgeGood": "Bueno",
    "perfil.badgeInsufficient": "Insuficiente",
    "perfil.badgeBelowIdeal": "Bajo lo ideal",
    "perfil.bodyCompEmpty": "Sube una captura de tu báscula desde {{settings}} y aquí verás tu composición corporal completa.",
    "perfil.activitySedentary": "Sedentario",
    "perfil.activitySedentaryDesc": "No haces nada de ejercicio",
    "perfil.activityLight": "Ligero",
    "perfil.activityLightDesc": "Por tu trabajo o rutina te mantienes caminando / en movimiento",
    "perfil.activityActive": "Activo",
    "perfil.activityActiveDesc": "Haces ejercicio 3 días a la semana o más",
  },
  en: {
    "tabbar.hoy": "Today",
    "tabbar.historial": "History",
    "tabbar.coach": "Coach",
    "tabbar.perfil": "Profile",

    "login.signinTitle": "Sign in to your account",
    "login.signupTitle": "Create your account — your data is yours alone",
    "login.recoverTitle": "We'll send you a link to set a new password",
    "login.namePlaceholder": "Your name",
    "login.emailPlaceholder": "Email",
    "login.passwordPlaceholder": "Password",
    "login.confirmPasswordPlaceholder": "Confirm your password",
    "login.forgotPassword": "Forgot your password?",
    "login.busy": "One moment…",
    "login.signIn": "Sign in",
    "login.createAccount": "Create account",
    "login.sendLink": "Send link",
    "login.toSignup": "Don't have an account? Create one",
    "login.toSignin": "Already have an account · Sign in",
    "login.toSigninFromRecover": "‹ Back to sign in",
    "login.localModeTitle": "Accounts not active yet",
    "login.localModeBody":
      "Supabase isn't configured yet (SUPABASE_URL and ANON_KEY in .env.local). In the meantime you can use the app in local mode: your data is saved only on this device.",
    "login.localModeCta": "Continue in local mode",
    "login.errEmailOnly": "Enter your email.",
    "login.errEmailInvalid": "That email doesn't look valid — check it has the form name@domain.com.",
    "login.infoRecoverSent": "If that email has an account, a link to set a new password was sent. Check spam too.",
    "login.errRecoverFailed": "Couldn't send the link",
    "login.errName": "Enter your name.",
    "login.errEmailPassword": "Enter your email and password.",
    "login.errPasswordShort": "Password must be at least 6 characters.",
    "login.errPasswordMismatch": "Passwords don't match.",
    "login.infoConfirmEmail": "Check your email to confirm your account. After that, someone needs to approve your access before you can sign in.",
    "login.errAuth": "Authentication error",

    "hoy.syncPrompt": "Upload your watch capture in Profile",
    "hoy.macrosTitle": "TODAY'S MACROS",
    "hoy.calories": "CALORIES",
    "hoy.carbs": "CARBS",
    "hoy.protein": "PROTEIN",
    "hoy.fat": "FAT",
    "hoy.hydrationTitle": "HYDRATION TRACKING",
    "hoy.sleepTitle": "SLEEP",
    "hoy.sleepWithinGoal": "Within your goal",
    "hoy.sleepBelowGoal": "Below your 7–8h goal",
    "hoy.sleepNoPhases": "No phase data — duration only",
    "hoy.sleepTapToLog": "Tap to log your hours",
    "hoy.summaryTitle": "Daily summary",
    "hoy.summarySubtitle": "Macro bars and how your day went",
    "hoy.viewMore": "View ›",
    "hoy.activityTitle": "TODAY'S ACTIVITY",
    "hoy.viewDetail": "View detail ›",
    "hoy.steps": "Steps",
    "hoy.activeTime": "Active time",
    "hoy.activityCalories": "Activity calories",
    "hoy.totalBurned": "Total burned",
    "hoy.distance": "Distance",

    "coach.title": "AI Coach",
    "coach.subtitle": "With your real-time data for today",
    "coach.clear": "Clear",
    "coach.kcalFree": "KCAL LEFT",
    "coach.kcalOver": "KCAL OVER",
    "coach.carbsLeft": "CARBS LEFT",
    "coach.carbsOver": "CARBS OVER",
    "coach.proteinLeft": "PROTEIN LEFT",
    "coach.proteinOver": "PROTEIN OVER",
    "coach.fatLeft": "FAT LEFT",
    "coach.fatOver": "FAT OVER",
    "coach.waterLeft": "WATER LEFT",
    "coach.waterOver": "WATER OVER",
    "coach.placeholderListening": "Listening…",
    "coach.placeholderPhoto": "Add context to your photo…",
    "coach.placeholderDefault": "Ask something or upload a photo…",
    "coach.photoReady": "Photo ready 📸 — add context if you want (e.g. \"I left half\") and hit send",

    "reset.title": "Set your new password",
    "reset.wait": "One moment…",
    "reset.invalidLink": "This link expired or isn't valid. Get a new one from the sign-in screen.",
    "reset.goToLogin": "Go to sign in",
    "reset.done": "Password updated. Taking you to the app…",
    "reset.newPassword": "New password",
    "reset.confirmNewPassword": "Confirm the new password",
    "reset.errPasswordShort": "Password must be at least 6 characters.",
    "reset.errPasswordMismatch": "Passwords don't match.",
    "reset.errFailed": "Couldn't update the password",
    "reset.save": "Save password",

    "perfil.languageTitle": "APP LANGUAGE",
    "perfil.languageSubtitle": "Changes the whole interface and the AI Coach",
    "perfil.languageEs": "Español",
    "perfil.languageEn": "English",

    "historial.title": "History",
    "historial.kcalTotal": "total kcal",
    "historial.emptyLine1": "You haven't logged any meals today yet.",
    "historial.emptyLine2": "Use the center button to scan your plate.",
    "historial.drinks": "DRINKS",
    "historial.macrosShort": "P {{p}}g · C {{c}}g · F {{f}}g",

    "perfil.tabProgress": "My progress",
    "perfil.tabSync": "Sync",
    "perfil.tabSettings": "Settings",
    "perfil.changePhoto": "Change your profile photo",
    "perfil.yourPhoto": "Your photo",
    "perfil.namePlaceholder": "Your name",
    "perfil.editHint": "Tap your name to edit it · tap the photo to change it",
    "perfil.photoUpdated": "Profile photo updated",
    "perfil.photoLoadError": "Couldn't load that photo",
    "perfil.metabolismTitle": "YOUR METABOLISM",
    "perfil.whatIs": "What is {{term}}",
    "perfil.bmrTitle": "What is BMR?",
    "perfil.bmrBody":
      "It's your Basal Metabolic Rate: the calories your body burns at total rest — just breathing, thinking, and keeping your organs running. It's calculated from your weight, height, age and sex (or comes straight from your smart scale). Even if you don't move all day, your body spends this.",
    "perfil.tdeeTitle": "What is TDEE?",
    "perfil.tdeeBody":
      "It's your Total Daily Energy Expenditure: your BMR multiplied by your activity level (walking, working, training). It represents all the calories you burn on a normal day. To lose weight, eat below your TDEE (deficit); to maintain, eat at your TDEE.",
    "perfil.weightHistoryTitle": "WEIGHT HISTORY",
    "perfil.days": "Days",
    "perfil.weeks": "Weeks",
    "perfil.weightTrendWeek": "this week",
    "perfil.weightTrendPeriod": "in this period",
    "perfil.weightTrendNoData": "Log your weight to see a trend",
    "perfil.weightEmpty": "Log your weight (in Settings or with the scale) and you'll see your progress.",
    "perfil.measurementsTitle": "MEASUREMENTS HISTORY",
    "perfil.measurementsEmpty": "Log your measurements in {{sync}} and here you'll see if they went up or down.",
    "perfil.measureArm": "Arm",
    "perfil.measureWaist": "Waist",
    "perfil.measureChest": "Chest",
    "perfil.measureLeg": "Leg",
    "perfil.measureGlute": "Glutes",
    "perfil.noChange": "No change",
    "perfil.firstMeasurement": "First measurement",
    "perfil.noData": "No data",
    "perfil.bodyCompTitle": "BODY COMPOSITION",
    "perfil.lastCapture": "Last capture: {{date}}",
    "perfil.noCaptureYet": "No capture yet",
    "perfil.bodyScoreTitle": "BODY SCORE",
    "perfil.weightLabel": "Weight",
    "perfil.bodyBuild": "Body build",
    "perfil.bmi": "BMI",
    "perfil.bodyFat": "Body fat",
    "perfil.waterLevel": "Water level",
    "perfil.proteinLevel": "Protein",
    "perfil.basalMetabolism": "Basal metabolism",
    "perfil.visceralFat": "Visceral fat",
    "perfil.muscle": "Muscle",
    "perfil.boneMass": "Bone mass",
    "perfil.badgeNormal": "Normal",
    "perfil.badgeHigh": "High",
    "perfil.badgeVeryHigh": "Very high",
    "perfil.badgeHighF": "High",
    "perfil.badgeVeryHighF": "Very high",
    "perfil.badgeGood": "Good",
    "perfil.badgeInsufficient": "Insufficient",
    "perfil.badgeBelowIdeal": "Below ideal",
    "perfil.bodyCompEmpty": "Upload a capture of your scale from {{settings}} and you'll see your full body composition here.",
    "perfil.activitySedentary": "Sedentary",
    "perfil.activitySedentaryDesc": "You don't do any exercise",
    "perfil.activityLight": "Light",
    "perfil.activityLightDesc": "Your job or routine keeps you walking / moving around",
    "perfil.activityActive": "Active",
    "perfil.activityActiveDesc": "You exercise 3 days a week or more",
  },
};

// Copia del idioma en localStorage, INDEPENDIENTE del perfil: /login y
// /reset-password se muestran ANTES de tener sesión, así que ahí no hay
// profile.language que leer todavía. El store sincroniza esta copia cada
// vez que carga o cambia el perfil, para que la próxima vez que alguien
// cierre sesión, la pantalla de login ya recuerde su idioma en ESTE
// dispositivo.
const LANG_KEY = "ahivoy:lang";

export function readLocalLang(): Lang {
  if (typeof window === "undefined") return "es";
  try {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

export function writeLocalLang(lang: Lang) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // sin storage: la próxima vez el login se queda en español
  }
}

// Nombres de días/meses compartidos entre pantallas (Hoy, Historial, etc.)
// para no duplicar el mismo array traducido en cada archivo.
export const WEEKDAYS_LONG: Record<Lang, string[]> = {
  es: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
export const WEEKDAY_LETTERS: Record<Lang, string[]> = {
  es: ["D", "L", "M", "M", "J", "V", "S"],
  en: ["S", "M", "T", "W", "T", "F", "S"],
};
export const MONTHS_SHORT: Record<Lang, string[]> = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
// Etiquetas de tiempo de comida (el valor guardado en la base de datos se
// queda en español — es solo la etiqueta EN PANTALLA la que cambia).
export const MEAL_TIME_LABEL: Record<Lang, Record<string, string>> = {
  es: { Desayuno: "Desayuno", Almuerzo: "Almuerzo", Cena: "Cena", Snack: "Snack" },
  en: { Desayuno: "Breakfast", Almuerzo: "Lunch", Cena: "Dinner", Snack: "Snack" },
};

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const dict = I18N[lang] ?? I18N.es;
  let str = dict[key] ?? I18N.es[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.split(`{{${k}}}`).join(String(v));
    }
  }
  return str;
}
