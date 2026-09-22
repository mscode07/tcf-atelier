"use client";
import headerStyles from "./AdminHeaderActions.module.css";
import { useState, useEffect, useRef, FormEvent } from "react";

const QUESTION_OPTIONS = [
  "What was your first car?",
  "Which school were you in?",
  "What is your pet's name?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "Other (write your own)",
];

function QuestionField({
  index,
  question,
  setQuestion,
  answer,
  setAnswer,
}: {
  index: 1 | 2;
  question: string;
  setQuestion: (v: string) => void;
  answer: string;
  setAnswer: (v: string) => void;
}) {
  const isCustom = question !== "" && !QUESTION_OPTIONS.slice(0, -1).includes(question);
  return (
    <>
      <label className="admin-field">
        Security question {index}
        <select
          value={isCustom ? "Other (write your own)" : question}
          onChange={(e) =>
            setQuestion(e.target.value === "Other (write your own)" ? "" : e.target.value)
          }
          required
        >
          <option value="" disabled>
            Choose a question…
          </option>
          {QUESTION_OPTIONS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </label>
      {(isCustom || question === "") && (
        <label className="admin-field">
          Your own question {index}
          <input
            type="text"
            maxLength={200}
            placeholder="Write your own question"
            required
            value={isCustom ? question : ""}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
      )}
      <label className="admin-field">
        Answer {index}
        <input
          type="text"
          maxLength={200}
          minLength={2}
          autoCapitalize="none"
          spellCheck={false}
          required
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
      </label>
    </>
  );
}

export default function SecurityQuestions() {
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [question1, setQuestion1] = useState("");
  const [answer1, setAnswer1] = useState("");
  const [question2, setQuestion2] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      fetch("/api/admin/security-questions", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setConfigured(Boolean(d?.questions)))
        .catch(() => {});
    }
  }, [open]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/security-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, question1, answer1, question2, answer2 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setOpen(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save security questions.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className={`${headerStyles.securityButton} ${headerStyles.passwordButton}`}
        aria-label="Set up security questions"
        onClick={() => {
          setError("");
          setCurrentPassword("");
          setQuestion1("");
          setAnswer1("");
          setQuestion2("");
          setAnswer2("");
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
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1 1.2-1 1.7" />
          <path d="M12 17h.01" />
        </svg>
        <span>Security questions</span>
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="admin-modal admin-password-dialog"
          aria-labelledby="security-questions-title"
          aria-describedby="security-questions-description"
          onCancel={() => setOpen(false)}
        >
          <div className="admin-modal-head">
            <h2 id="security-questions-title">Security questions</h2>
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
              id="security-questions-description"
              className="admin-password-description"
            >
              {configured
                ? "These replace your current security questions. Use them to reset a forgotten password without the recovery key."
                : "Set these up so you can reset a forgotten password yourself, without needing the recovery key."}
            </p>
            <label className="admin-field">
              Current password
              <input
                type="password"
                minLength={1}
                maxLength={72}
                autoCapitalize="none"
                spellCheck={false}
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <QuestionField
              index={1}
              question={question1}
              setQuestion={setQuestion1}
              answer={answer1}
              setAnswer={setAnswer1}
            />
            <QuestionField
              index={2}
              question={question2}
              setQuestion={setQuestion2}
              answer={answer2}
              setAnswer={setAnswer2}
            />
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
                {busy ? "Saving…" : "Save questions"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
