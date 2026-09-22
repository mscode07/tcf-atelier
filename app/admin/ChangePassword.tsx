"use client";
import { ADMIN_PASSWORD_HELP } from "@/lib/admin/password-policy";
import headerStyles from "./AdminHeaderActions.module.css";
import { useState, useEffect, useRef, FormEvent } from "react";
export default function ChangePassword() {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/admin/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      window.location.replace("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to change password.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className={`${headerStyles.securityButton} ${headerStyles.passwordButton}`}
        aria-label="Change admin password"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="9" r="5" />
          <path d="m12 12 8 8m-3-3 3-3m-6 0 3-3" />
        </svg>
        <span>Change password</span>
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="admin-modal admin-password-dialog"
          aria-labelledby="change-password-title"
          aria-describedby="change-password-description"
          onCancel={() => setOpen(false)}
        >
          <div className="admin-modal-head">
            <h2 id="change-password-title">Change admin password</h2>
            <button
              type="button"
              className="admin-icon-button"
              aria-label="Close dialog"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <form onSubmit={submit} className="admin-password-form">
            <p
              id="change-password-description"
              className="admin-password-description"
            >
              Enter your current password, then choose a new password.{" "}
              {ADMIN_PASSWORD_HELP}
            </p>
            {[
              ["currentPassword", "Current password"],
              ["newPassword", "New password"],
              ["confirmPassword", "Confirm new password"],
            ].map(([name, label]) => (
              <label className="admin-field" key={name}>
                {label}
                <input
                  name={name}
                  type="password"
                  minLength={name === "currentPassword" ? 1 : 8}
                  maxLength={72}
                  placeholder={
                    name === "currentPassword"
                      ? "Current password"
                      : "New password"
                  }
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  autoComplete={
                    name === "currentPassword"
                      ? "current-password"
                      : "new-password"
                  }
                />
              </label>
            ))}
            <p className="admin-password-note">
              Saving will lock all admin sessions. Use your new password to sign
              in again.
            </p>
            {error && (
              <p className="admin-inline-error" role="alert">
                {error}
              </p>
            )}
            <div className="admin-password-actions">
              <button
                type="button"
                className="admin-button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className="admin-button primary" disabled={busy}>
                {busy ? "Saving…" : "Save password"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
