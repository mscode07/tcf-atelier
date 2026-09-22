"use client";
import { FormEvent, useEffect, useState } from "react";
import { ADMIN_PASSWORD_HELP } from "@/lib/admin/password-policy";
export default function PasswordLogin({ onUnlock }: { onUnlock: () => void }) {
  const [mode, setMode] = useState<"login" | "recover" | "recovered">("login");
  const [recoverMethod, setRecoverMethod] = useState<"questions" | "key">("key");
  const [questions, setQuestions] = useState<
    { question1: string; question2: string } | null | undefined
  >(undefined);
  const [password, setPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const switchMode = (next: typeof mode) => {
    setMode(next);
    setError("");
    setPassword("");
    setRecoveryKey("");
    setAnswer1("");
    setAnswer2("");
    setNewPassword("");
    setConfirmPassword("");
  };
  useEffect(() => {
    if (mode !== "recover" || questions !== undefined) return;
    fetch("/api/admin/security-questions", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setQuestions(d?.questions ?? null);
        if (d?.questions) setRecoverMethod("questions");
      })
      .catch(() => setQuestions(null));
  }, [mode, questions]);
  async function submitLogin(e: FormEvent) {
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
  async function submitRecovery(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          recoverMethod === "questions"
            ? { answer1, answer2, newPassword, confirmPassword }
            : { recoveryKey, newPassword, confirmPassword },
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      switchMode("recovered");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to reset password. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (mode === "recover")
    return (
      <div className="admin-shell admin-entry">
        <div className="admin-entry-card">
          <span className="admin-brand-mark">
            tcf<span>•</span>
          </span>
          <p className="admin-eyebrow">RECOVER ACCESS</p>
          <h1>Forgot your password?</h1>
          {questions === undefined ? (
            <p>Loading…</p>
          ) : (
            <>
              {recoverMethod === "questions" && questions ? (
                <p>Answer your two security questions to set a new password.</p>
              ) : (
                <p>
                  Enter the recovery key — the ADMIN_PASSWORD (or
                  ADMIN_PASSCODE) value set in your hosting environment
                  variables — to set a new password.
                </p>
              )}
              <form onSubmit={submitRecovery}>
                {recoverMethod === "questions" && questions ? (
                  <>
                    <label className="admin-field">
                      {questions.question1}
                      <input
                        className="admin-password-input"
                        type="text"
                        maxLength={200}
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        autoFocus
                        value={answer1}
                        onChange={(e) => setAnswer1(e.target.value)}
                      />
                    </label>
                    <label className="admin-field">
                      {questions.question2}
                      <input
                        className="admin-password-input"
                        type="text"
                        maxLength={200}
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        value={answer2}
                        onChange={(e) => setAnswer2(e.target.value)}
                      />
                    </label>
                  </>
                ) : (
                  <label className="admin-field">
                    Recovery key
                    <input
                      className="admin-password-input"
                      type="password"
                      maxLength={72}
                      name="recoveryKey"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      autoFocus
                      value={recoveryKey}
                      onChange={(e) => setRecoveryKey(e.target.value)}
                    />
                  </label>
                )}
                <label className="admin-field">
                  New password
                  <input
                    className="admin-password-input"
                    type="password"
                    minLength={8}
                    maxLength={72}
                    name="newPassword"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <small>{ADMIN_PASSWORD_HELP}</small>
                </label>
                <label className="admin-field">
                  Confirm new password
                  <input
                    className="admin-password-input"
                    type="password"
                    minLength={8}
                    maxLength={72}
                    name="confirmPassword"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </label>
                {error && (
                  <p role="alert" className="admin-inline-error">
                    {error}
                  </p>
                )}
                <button
                  className="admin-button primary"
                  type="submit"
                  disabled={
                    busy ||
                    !newPassword ||
                    !confirmPassword ||
                    (recoverMethod === "questions" ? !answer1 || !answer2 : !recoveryKey)
                  }
                >
                  {busy ? "Resetting…" : "Reset password →"}
                </button>
              </form>
              {questions && (
                <button
                  type="button"
                  className="admin-text-button admin-entry-back"
                  onClick={() => {
                    setRecoverMethod(recoverMethod === "questions" ? "key" : "questions");
                    setError("");
                  }}
                >
                  {recoverMethod === "questions"
                    ? "Use recovery key instead"
                    : "Use security questions instead"}
                </button>
              )}
            </>
          )}
          <button
            type="button"
            className="admin-text-button admin-entry-back"
            onClick={() => switchMode("login")}
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    );
  if (mode === "recovered")
    return (
      <div className="admin-shell admin-entry">
        <div className="admin-entry-card">
          <span className="admin-brand-mark">
            tcf<span>•</span>
          </span>
          <p className="admin-eyebrow">RECOVER ACCESS</p>
          <h1>Password reset.</h1>
          <p>Sign in with your new password to get back to work.</p>
          <button
            className="admin-button primary"
            onClick={() => switchMode("login")}
          >
            Go to sign in →
          </button>
        </div>
      </div>
    );
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
        <form onSubmit={submitLogin}>
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
        <button
          type="button"
          className="admin-text-button admin-entry-back"
          onClick={() => switchMode("recover")}
        >
          Forgot password?
        </button>
      </div>
    </div>
  );
}
