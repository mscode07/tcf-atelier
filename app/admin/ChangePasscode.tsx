"use client";
import headerStyles from "./AdminHeaderActions.module.css";
import { useState, useEffect, useRef, FormEvent } from "react";
export default function ChangePasscode() {
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
      setError(e instanceof Error ? e.message : "Unable to change passcode.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className={`${headerStyles.securityButton} ${headerStyles.passcodeButton}`}
        aria-label="Change admin passcode"
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
        <span>Change passcode</span>
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="admin-modal admin-passcode-dialog"
          aria-labelledby="change-passcode-title"
          aria-describedby="change-passcode-description"
          onCancel={() => setOpen(false)}
        >
          <div className="admin-modal-head">
            <h2 id="change-passcode-title">Change admin passcode</h2>
            <button
              type="button"
              className="admin-icon-button"
              aria-label="Close dialog"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <form onSubmit={submit} className="admin-passcode-form">
            <p
              id="change-passcode-description"
              className="admin-passcode-description"
            >
              Enter your current passcode, then choose a new four-digit code.
            </p>
            {[
              ["currentPasscode", "Current passcode"],
              ["newPasscode", "New passcode"],
              ["confirmPasscode", "Confirm new passcode"],
            ].map(([name, label]) => (
              <label className="admin-field" key={name}>
                {label}
                <input
                  name={name}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  placeholder="4-digit code"
                  required
                  autoComplete={
                    name === "currentPasscode"
                      ? "current-password"
                      : "new-password"
                  }
                />
              </label>
            ))}
            <p className="admin-passcode-note">
              Saving will lock all admin sessions. Use your new passcode to sign
              in again.
            </p>
            {error && (
              <p className="admin-inline-error" role="alert">
                {error}
              </p>
            )}
            <div className="admin-passcode-actions">
              <button
                type="button"
                className="admin-button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className="admin-button primary" disabled={busy}>
                {busy ? "Saving…" : "Save passcode"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
