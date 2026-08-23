"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ReadingQuestion = { number: number; level: string; passage: string; question: string; options: string[]; correct: string };

export default function ReadingTestClient({ test, questions, mode }: { test: number; questions: ReadingQuestion[]; mode: "exam" | "review" }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [finished, setFinished] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(35 * 60);
  const [reviewingResults, setReviewingResults] = useState(false);
  const question = questions[current];
  const selected = answers[current];
  const isChecked = checked.has(current);
  const correctIndex = question.correct.charCodeAt(0) - 65;
  const showCorrections = mode === "review" || reviewingResults;
  const score = useMemo(() => questions.reduce((total, item, index) => total + (answers[index] === item.correct.charCodeAt(0) - 65 ? 1 : 0), 0), [answers, questions]);

  useEffect(() => {
    const saved = localStorage.getItem(`reading-test-${test}`);
    if (!saved) { setHydrated(true); return; }
    try { const progress = JSON.parse(saved); setAnswers(progress.answers ?? {}); setCurrent(progress.current ?? 0); setSubmitted(Boolean(progress.submitted)); }
    catch { /* Ignore invalid local progress. */ }
    setHydrated(true);
  }, [test]);
  useEffect(() => { localStorage.setItem(`reading-test-${test}`, JSON.stringify({ answers, current, submitted })); }, [answers, current, submitted, test]);
  useEffect(() => {
    if (!hydrated || Object.keys(answers).length === 0 || finished || submitted) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ module: "reading", testNumber: test, status: "in_progress", maxScore: questions.length, answeredCount: Object.keys(answers).length }),
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [answers, finished, hydrated, questions.length, submitted, test]);

  const checkAnswer = () => {
    setChecked(previous => new Set(previous).add(current));
    if (mode === "exam") goNext();
  };
  const finishTest = () => {
    setFinished(true);
    setSubmitted(true);
    void fetch("/api/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ module: "reading", testNumber: test, status: "completed", score, maxScore: questions.length, answeredCount: Object.keys(answers).length }),
    });
  };
  const goNext = () => current < questions.length - 1 ? setCurrent(current + 1) : finishTest();

  useEffect(() => {
    if (mode !== "exam" || finished || submitted) return;
    const key = `reading-deadline-${test}`;
    let deadline = Number(sessionStorage.getItem(key));
    if (!deadline || deadline <= Date.now()) { deadline = Date.now() + 35 * 60 * 1000; sessionStorage.setItem(key, String(deadline)); }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) document.querySelector<HTMLButtonElement>(".reading-topbar .btn")?.click();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [finished, mode, submitted, test]);

  if (finished) return <main className="reading-result"><section><span className="level">Reading · Test {test}</span><h1>Test complete.</h1><div className="reading-score">{score}/{questions.length}</div><p>{Object.keys(answers).length} answered · {Math.round(score / questions.length * 100)}%</p><div className="hero-actions centered"><button className="btn secondary" onClick={() => { setReviewingResults(true); setFinished(false); }}>Review answers</button><Link className="btn" href="/">← Dashboard</Link></div></section></main>;

  return <div className="reading-player">
    <aside className={`reading-sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="reading-test-label"><strong>Test {test}</strong><span>{Object.keys(answers).length} / {questions.length} answered</span></div>
      <div className="reading-question-nav">{questions.map((item, index) => <button key={item.number} className={`${index === current ? "current" : ""} ${answers[index] !== undefined ? "answered" : ""}`} onClick={() => { setCurrent(index); setSidebarOpen(false); }}><i/><span>Q{item.number}</span><b className={`reading-level level-${item.level.toLowerCase()}`}>{item.level}</b></button>)}</div>
    </aside>
    <main className="reading-workspace">
      <header className="reading-topbar"><button className="reading-menu" aria-label="Toggle question list" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button><strong>Q{question.number}/{questions.length}{mode === "exam" && ` · ${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`}</strong><div><button className="btn ghost" onClick={finishTest}>End test</button><Link className="btn ghost" href="/">← Dashboard</Link></div></header>
      <section className="reading-content">
        <div className="reading-meta"><span className={`reading-level level-${question.level.toLowerCase()}`}>{question.level}</span></div>
        {question.passage && <article className="reading-passage"><span>Passage text</span><p>{question.passage}</p></article>}
        <h2>{question.question}</h2>
        <div className="reading-options">{question.options.map((option, index) => {
          let state = selected === index ? "selected" : "";
          if (showCorrections && isChecked && index === correctIndex) state = "correct";
          if (showCorrections && isChecked && selected === index && index !== correctIndex) state = "wrong";
          return <button key={index} className={state} disabled={isChecked} onClick={() => setAnswers(previous => ({ ...previous, [current]: index }))}><b>{"ABCD"[index]}.</b><span>{option}</span></button>;
        })}</div>
        {showCorrections && isChecked && <p className={`reading-feedback ${selected === correctIndex ? "correct" : "wrong"}`}>{selected === correctIndex ? "Correct answer." : `Correct answer: ${question.correct}. ${question.options[correctIndex]}`}</p>}
        {!isChecked ? <button className="btn reading-check" disabled={selected === undefined} onClick={checkAnswer}>{mode === "exam" ? (current === questions.length - 1 ? "Finish test" : "Confirm & next →") : "Check answer"}</button> : <button className="btn reading-check" onClick={goNext}>{current === questions.length - 1 ? "View results" : "Next question →"}</button>}
      </section>
    </main>
  </div>;
}
