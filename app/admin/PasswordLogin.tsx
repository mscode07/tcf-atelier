"use client";
import { FormEvent, useState } from "react";
export default function PasswordLogin({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onUnlock();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Try again.",
      );
      setPassword("");
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
        <p>Enter your password to manage your platform.</p>
        <form onSubmit={submit}>
          <label className="admin-field">
            Password
            <input
              className="admin-password-input"
              type="password"
              maxLength={72}
              autoComplete="current-password"
              name="password"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={error ? "password-error" : undefined}
            />
          </label>
          {error && (
            <p id="password-error" role="alert" className="admin-inline-error">
              {error}
            </p>
          )}
          <button
            className="admin-button primary"
            type="submit"
            disabled={busy || !password}
          >
            {busy ? "Checking…" : "Unlock admin panel →"}
          </button>
        </form>
      </div>
    </div>
  );
}
