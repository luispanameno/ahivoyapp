"use client";

// Panel de administración: solo lo ve profile.isAdmin. Aprueba/rechaza
// cuentas nuevas y permite revocar el acceso a alguien ya aprobado.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Pressable from "@/components/Pressable";
import Accordion from "@/components/Accordion";
import { SkeletonBox } from "@/components/Skeleton";
import * as db from "@/lib/db";
import { useApp } from "@/lib/store";
import { AccessStatus, AdminUserRow } from "@/lib/types";
import { Lang } from "@/lib/i18n";

function fmtDate(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function UserRow({
  user,
  onSetStatus,
  onDelete,
}: {
  user: AdminUserRow;
  onSetStatus: (id: string, status: AccessStatus) => void;
  onDelete?: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const { t, lang } = useApp();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      style={{ background: "#1b1e21", borderRadius: 18, padding: "12px 14px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{user.nombre}</div>
          <div style={{ fontSize: 11.5, color: "rgba(244,243,238,.5)", marginTop: 2, wordBreak: "break-all" }}>{user.email}</div>
          <div style={{ fontSize: 10.5, color: "rgba(244,243,238,.35)", marginTop: 2 }}>{t("admin.registered", { date: fmtDate(user.creado, lang) })}</div>
        </div>
        {/* Quitar de la lista: pide confirmación porque no se deshace. */}
        {onDelete && (
          <Pressable
            onClick={() => setConfirmando((c) => !c)}
            ariaLabel={confirmando ? t("admin.cancelDelete") : t("admin.removeUser", { name: user.nombre })}
            style={{
              width: 44,
              height: 44,
              flex: "none",
              marginTop: -6,
              marginRight: -6,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: confirmando ? "#f4f3ee" : "rgba(244,243,238,.4)",
            }}
          >
            <CloseIcon />
          </Pressable>
        )}
      </div>

      {confirmando && onDelete && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          style={{ overflow: "hidden" }}
        >
          <div style={{ fontSize: 11.5, color: "rgba(244,243,238,.6)", lineHeight: 1.4, paddingTop: 8 }}>
            {t("admin.removeWarning")}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Pressable
              onClick={() => onDelete(user.id)}
              style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: "pointer", background: "oklch(72% 0.18 25)", color: "#1a0505" }}
            >
              {t("admin.yesRemove")}
            </Pressable>
            <Pressable
              onClick={() => setConfirmando(false)}
              style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: "pointer", background: "rgba(255,255,255,.06)", color: "rgba(244,243,238,.7)" }}
            >
              {t("admin.cancel")}
            </Pressable>
          </div>
        </motion.div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {user.status !== "approved" && (
          <Pressable
            onClick={() => onSetStatus(user.id, "approved")}
            style={{ flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 12, fontSize: 12, fontWeight: 800, cursor: "pointer", background: "#c7f27a", color: "#10240a" }}
          >
            {t("admin.approve")}
          </Pressable>
        )}
        {user.status !== "rejected" && (
          <Pressable
            onClick={() => onSetStatus(user.id, "rejected")}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "9px 0",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              background: "rgba(255,255,255,.06)",
              color: "oklch(72% 0.18 25)",
              border: "1px solid oklch(72% 0.18 25 / 0.35)",
            }}
          >
            {user.status === "approved" ? t("admin.revokeAccess") : t("admin.reject")}
          </Pressable>
        )}
      </div>
    </motion.div>
  );
}

export default function AdminPanel() {
  const router = useRouter();
  const { profile, userEmail, showToast, t } = useApp();
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
        {t("admin.notAuthorized")}
        <Pressable onClick={() => router.push("/hoy")} style={{ marginTop: 16, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#c7f27a", fontWeight: 700, cursor: "pointer" }}>
          {t("admin.backToToday")}
        </Pressable>
      </div>
    );
  }

  const setStatus = async (id: string, status: AccessStatus) => {
    // Optimista: refleja el cambio de inmediato, sin esperar la respuesta.
    setUsers((prev) => prev?.map((u) => (u.id === id ? { ...u, status } : u)) ?? prev);
    await db.setUserStatus(id, status);
    showToast(status === "approved" ? t("admin.toastApproved") : t("admin.toastRejected"));
  };

  const removeUser = async (id: string) => {
    setUsers((prev) => prev?.filter((u) => u.id !== id) ?? prev);
    await db.deleteUserProfile(id);
    showToast(t("admin.toastRemoved"));
  };

  // El admin no se gestiona a sí mismo (evita un auto-bloqueo accidental).
  const others = users?.filter((u) => u.email !== userEmail) ?? [];
  const pending = others.filter((u) => u.status === "pending");
  const approved = others.filter((u) => u.status === "approved");
  const rejected = others.filter((u) => u.status === "rejected");

  return (
    <div style={{ boxSizing: "border-box", padding: "24px 20px 40px" }}>
      <Pressable onClick={() => router.push("/perfil/ajustes")} style={{ fontSize: 13, fontWeight: 700, color: "rgba(244,243,238,.7)", cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>
        {t("admin.back")}
      </Pressable>
      <div className="font-sora" style={{ fontSize: 20, fontWeight: 800, marginTop: 10 }}>
        {t("admin.title")}
      </div>
      <div style={{ fontSize: 12, color: "rgba(244,243,238,.5)", marginTop: 2 }}>{t("admin.subtitle")}</div>

      {users === null ? (
        <div aria-busy="true" aria-label={t("admin.loadingUsers")} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          <SkeletonBox height={11} width="45%" radius={100} style={{ marginBottom: 4 }} />
          <SkeletonBox height={96} radius={18} />
          <SkeletonBox height={96} radius={18} />
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(244,243,238,.45)", letterSpacing: ".04em", marginTop: 24, marginBottom: 10 }}>
            {t("admin.pendingRequests")} {pending.length > 0 && `(${pending.length})`}
          </div>
          {pending.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "rgba(244,243,238,.4)", background: "#1b1e21", borderRadius: 18, padding: "14px 16px" }}>
              {t("admin.noPending")}
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
            {t("admin.withAccess")} ({approved.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <AnimatePresence>
              {approved.map((u) => (
                <UserRow key={u.id} user={u} onSetStatus={setStatus} />
              ))}
            </AnimatePresence>
          </div>

          {/* Lista secundaria: va plegada para no competir con las
              solicitudes pendientes, que es lo que se viene a resolver. */}
          {rejected.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Accordion label={t("admin.viewRejected")} count={rejected.length}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <AnimatePresence>
                    {rejected.map((u) => (
                      <UserRow key={u.id} user={u} onSetStatus={setStatus} onDelete={removeUser} />
                    ))}
                  </AnimatePresence>
                </div>
              </Accordion>
            </div>
          )}
        </>
      )}
    </div>
  );
}
