"use client";

// Perfil · Vista "Sincronización": las 4 tarjetas de registro (reloj, sueño,
// báscula, rutina) — cada una con su hoja inferior de subir captura o
// ingresar a mano. Vive entre "Mi progreso" y "Ajustes".

import { ProfileFooter, ProfileHeader, ProfileTabs } from "@/components/profileUi";
import SyncHub from "@/components/SyncHub";

export default function PerfilSincronizacion() {
  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 0" }}>
      <ProfileHeader />
      <ProfileTabs />
      <div style={{ marginTop: 20 }}>
        <SyncHub />
      </div>
      <ProfileFooter />
    </div>
  );
}
