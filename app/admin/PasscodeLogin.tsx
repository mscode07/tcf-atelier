"use client";
import { FormEvent, useState } from "react";
export default function PasscodeLogin() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.replace("/admin");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Try again.",
      );
      setPasscode("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-shell admin-entry">
      <div className="admin-entry-card">
        <span className="admin-brand-mark">
          tcf<span>•</span>
        </span>
        <p className="admin-eyebrow">PRIVATE ADMIN WORKSPACE</p>
        <h1>
          Your platform.
          <br />A clearer view.
        </h1>
        <p>Enter your four-digit passcode to manage your platform.</p>
        <form onSubmit={submit}>
          <label className="admin-field">
            Passcode
            <input
              className="admin-pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="off"
              required
              autoFocus
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))}
              aria-describedby={error ? "passcode-error" : undefined}
            />
          </label>
          {error && (
            <p id="passcode-error" role="alert" className="admin-inline-error">
              {error}
            </p>
          )}
          <button
            className="admin-button primary"
            type="submit"
            disabled={busy || passcode.length !== 4}
          >
            {busy ? "Checking…" : "Unlock admin panel →"}
          </button>
        </form>
      </div>
    </div>
  );
}
