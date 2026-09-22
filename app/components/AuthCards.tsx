"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

type Mode = "signin" | "signup";
export default function AuthCards({
  mode,
  setMode,
  onSignedIn,
}: {
  mode: Mode;
  setMode: (mode: Mode) => void;
  onSignedIn: (email: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Unable to create your account.");
        setMessage("Account created. Signing you in…");
      }
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (!result || result.error)
        throw new Error(
          mode === "signup"
            ? "Your account was created. Please use Sign in to continue."
            : "Incorrect email or password. New here? Create an account first.",
        );
      onSignedIn(String(data.email).trim().toLowerCase());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const signup = mode === "signup";
  return (
    <div className="auth-wrap">
      <form
        key={mode}
        className={`auth-card ${signup ? "signup-card" : "signin-card"}`}
        onSubmit={submit}
        aria-labelledby="auth-title"
      >
        <div className="section-kicker">
          {signup ? "Begin your French journey" : "Your study room awaits"}
        </div>
        <h1 id="auth-title">{signup ? "Create an account" : "Welcome back"}</h1>
        <p className="auth-description">
          {signup
            ? "Make room for your next milestone. Sign up with Google or your email."
            : "Sign in to continue your TCF preparation."}
        </p>
        <button
          type="button"
          className="btn google"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await signIn("google", { callbackUrl: "/" });
            } catch {
              setError("Could not connect to Google. Please try again.");
              setBusy(false);
            }
          }}
        >
          G&nbsp;&nbsp; {signup ? "Sign up" : "Sign in"} with Google
        </button>
        <div className="divider">OR WITH EMAIL</div>
        {signup && (
          <div className="auth-name-fields">
            <div className="field">
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                required
                maxLength={100}
                placeholder="First name"
              />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                required
                maxLength={100}
                placeholder="Last name"
              />
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 8 : 6}
            maxLength={signup ? 72 : 128}
            placeholder={signup ? "At least 8 characters" : "Your password"}
          />
        </div>
        {signup && (
          <p className="auth-hint">
            Use your regular email address. Temporary emails and placeholder
            addresses such as test@gmail.com aren’t accepted.
          </p>
        )}
        {error && (
          <p className="auth-feedback auth-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="auth-feedback" role="status">
            {message}
          </p>
        )}
        <button className="btn full-button auth-submit" disabled={busy}>
          {busy ? "Please wait…" : signup ? "Create account →" : "Sign in →"}
        </button>
        <p className="auth-switch">
          {signup ? "Already have an account?" : "New to TCF?"}{" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode(signup ? "signin" : "signup");
              setError("");
              setMessage("");
            }}
          >
            {signup ? "Sign in" : "Create an account"}
          </button>
        </p>
      </form>
    </div>
  );
}
