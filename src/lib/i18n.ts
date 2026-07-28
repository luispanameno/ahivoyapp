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
