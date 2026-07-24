"use client";

// Panel de administración: solo lo ve profile.isAdmin. Aprueba/rechaza
// cuentas nuevas y permite revocar el acceso a alguien ya aprobado.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Pressable from "@/components/Pressable";
import * as db from "@/lib/db";
import { useApp } from "@/lib/store";
import { AccessStatus, AdminUserRow } from "@/lib/types";

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function UserRow({ user, onSetStatus }: { user: AdminUserRow; onSetStatus: (id: string, status: AccessStatus) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      style={{ background: "#1b1e21", borderRadius: 14, padding: "12px 14px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{user.nombre}</div>
          <div style={{ fontSize: 11.5, color: "rgba(244,243,238,.5)", marginTop: 2, wordBreak: "break-all" }}>{user.email}</div>
          <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.35)", marginTop: 2 }}>Registrado: {fmtDate(user.creado)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {user.status !== "approved" && (
          <Pressable
            onClick={() => onSetStatus(user.id, "approved")}
            style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer", background: "#c7f27a", color: "#10240a" }}
          >
            Aprobar
          </Pressable>
        )}
        {user.status !== "rejected" && (
          <Pressable
            onClick={() => onSetStatus(user.id, "rejected")}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "9px 0",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              background: "rgba(255,255,255,.06)",
              color: "oklch(72% 0.18 25)",
              border: "1px solid oklch(72% 0.18 25 / 0.35)",
            }}
          >
            {user.status === "approved" ? "Revocar acceso" : "Rechazar"}
          </Pressable>
        )}
      </div>
    </motion.div>
  );
}

export default function AdminPanel() {
  const router = useRouter();
  const { profile, userEmail, showToast } = useApp();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);

  const load = () => {
    db.listUsersForAdmin().then(setUsers);
  };

  useEffect(() => {
    if (profile.isAdmin) load();
  }, [profile.isAdmin]);

  if (!profile.isAdmin) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center", color: "rgba(244,243,238,.5)", fontSize: 13 }}>
        No autorizado.
        <div onClick={() => router.push("/hoy")} style={{ marginTop: 16, color: "#c7f27a", fontWeight: 700, cursor: "pointer" }}>
          ‹ Volver a Hoy
        </div>
      </div>
    );
  }

  const setStatus = async (id: string, status: AccessStatus) => {
    // Optimista: refleja el cambio de inmediato, sin esperar la respuesta.
    setUsers((prev) => prev?.map((u) => (u.id === id ? { ...u, status } : u)) ?? prev);
    await db.setUserStatus(id, status);
    showToast(status === "approved" ? "Acceso aprobado" : "Acceso rechazado");
  };

  // El admin no se gestiona a sí mismo (evita un auto-bloqueo accidental).
  const others = users?.filter((u) => u.email !== userEmail) ?? [];
  const pending = others.filter((u) => u.status === "pending");
  const approved = others.filter((u) => u.status === "approved");
  const rejected = others.filter((u) => u.status === "rejected");

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 40px" }}>
      <div onClick={() => router.push("/perfil")} style={{ fontSize: 13, fontWeight: 700, color: "rgba(244,243,238,.7)", cursor: "pointer" }}>
        ‹ Volver
      </div>
      <div className="font-sora" style={{ fontSize: 20, fontWeight: 800, marginTop: 10 }}>
        Control de acceso
      </div>
      <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>Decide quién puede entrar a la app.</div>

      {users === null ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(244,243,238,.4)", fontSize: 13 }}>Cargando…</div>
      ) : (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".04em", marginTop: 24, marginBottom: 10 }}>
            SOLICITUDES PENDIENTES {pending.length > 0 && `(${pending.length})`}
          </div>
          {pending.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "rgba(244,243,238,.4)", background: "#1b1e21", borderRadius: 14, padding: "14px 16px" }}>
              No hay solicitudes esperando.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <AnimatePresence>
                {pending.map((u) => (
                  <UserRow key={u.id} user={u} onSetStatus={setStatus} />
                ))}
              </AnimatePresence>
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".04em", marginTop: 24, marginBottom: 10 }}>
            CON ACCESO ({approved.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <AnimatePresence>
              {approved.map((u) => (
                <UserRow key={u.id} user={u} onSetStatus={setStatus} />
              ))}
            </AnimatePresence>
          </div>

          {rejected.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".04em", marginTop: 24, marginBottom: 10 }}>
                RECHAZADOS ({rejected.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <AnimatePresence>
                  {rejected.map((u) => (
                    <UserRow key={u.id} user={u} onSetStatus={setStatus} />
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
