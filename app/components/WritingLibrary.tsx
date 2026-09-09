"use client";

import { useEffect, useState } from "react";

type WritingQuestion = {
  audioUrl?: string;
  id: string;
  taskType: "tache_1" | "tache_2" | "tache_3";
  prompt: string;
  correction: string;
  topic: string;
  broadCategory: string;
  topicHeading: string;
  document1: string;
  document2: string;
  variantCount: number;
};

export default function WritingLibrary({
  onBack,
  nav,
}: {
  onBack: () => void;
  nav: (minimal?: boolean) => React.ReactNode;
}) {
  const [questions, setQuestions] = useState<WritingQuestion[]>([]);
  const [task, setTask] = useState<"all" | WritingQuestion["taskType"]>("all");
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [visible, setVisible] = useState(12);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [showAnswers, setShowAnswers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/materials/writing", {cache:"no-store"})
      .then((response) => {
        if (!response.ok) throw new Error("Writing prompts could not be loaded");
        return response.json();
      })
      .then((data: { questions: WritingQuestion[] }) => setQuestions(data.questions)).catch(() => { window.location.href = "/?access=subscription_required"; });
    try {
      setDrafts(JSON.parse(localStorage.getItem("tcf-writing-drafts") || "{}"));
    } catch {
      setDrafts({});
    }
  }, []);

  const categories = Array.from(new Set(questions.map((item) => item.broadCategory))).sort();
  const filtered = questions.filter(
    (item) =>
      (task === "all" || item.taskType === task) &&
      (category === "all" || item.broadCategory === category),
  );
  const chooseTask = (next: typeof task) => {
    setTask(next);
    setVisible(12);
    setOpenId(null);
  };
  const updateDraft = (id: string, value: string) => {
    const updated = { ...drafts, [id]: value };
    setDrafts(updated);
    localStorage.setItem("tcf-writing-drafts", JSON.stringify(updated));
  };
  const taskNumber = (value: WritingQuestion["taskType"]) => value.slice(-1);

  return (
    <div className="shell writing-shell">
      {nav()}
      <main className="writing-page">
        <header className="writing-header">
          <div>
            <button className="writing-back" onClick={onBack}>← Dashboard</button>
            <div className="writing-kicker">Expression écrite</div>
            <h1>Writing practice</h1>
            <p>113 authentic prompts across Tasks 1, 2 and 3. Choose a focus, write your response, then compare it with the model answer.</p>
          </div>
          <div className="writing-summary" aria-label="Writing question summary">
            <strong>{filtered.length}</strong><span>prompts in this selection</span>
          </div>
        </header>

        <section className="writing-controls" aria-label="Filter writing prompts">
          <div className="writing-tabs" role="group" aria-label="Filter by task">
            {(["all", "tache_1", "tache_2", "tache_3"] as const).map((value) => (
              <button key={value} className={task === value ? "active" : ""} onClick={() => chooseTask(value)}>
                {value === "all" ? "All tasks" : `Task ${taskNumber(value)}`}
                <span>{value === "all" ? questions.length : questions.filter((q) => q.taskType === value).length}</span>
              </button>
            ))}
          </div>
          <label className="writing-select">
            <span>Category</span>
            <select value={category} onChange={(event) => { setCategory(event.target.value); setVisible(12); setOpenId(null); }}>
              <option value="all">All categories</option>
              {categories.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </section>

        {!questions.length ? <div className="writing-empty">Loading writing prompts…</div> :
          !filtered.length ? <div className="writing-empty">No prompts match this selection.</div> : (
          <section className="writing-list" aria-live="polite">
            {filtered.slice(0, visible).map((item) => {
              const isOpen = openId === item.id;
              const draft = drafts[item.id] || "";
              const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
              return (
                <article className={`writing-card ${isOpen ? "open" : ""}`} key={item.id}>
                  <button className="writing-card-head" onClick={() => setOpenId(isOpen ? null : item.id)} aria-expanded={isOpen}>
                    <div>
                      <div className="writing-card-meta">
                        <span className={`writing-task task-${taskNumber(item.taskType)}`}>Task {taskNumber(item.taskType)}</span>
                        <span>{item.broadCategory}</span>
                      </div>
                      <h2>{item.topicHeading || item.topic}</h2>
                      <p>{item.taskType === "tache_3" ? item.document1 : item.prompt}</p>
                    </div>
                    <span className="writing-toggle" aria-hidden="true">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div className="writing-practice">
                      {item.taskType === "tache_3" ? (
                        <div className="writing-documents">
                          <article><span>Document 1</span><p>{item.document1}</p></article>
                          <article><span>Document 2</span><p>{item.document2}</p></article>
                        </div>
                      ) : <div className="writing-instruction"><span>French instruction</span><p>{item.prompt}</p></div>}
                      <div className="writing-answer-label"><label htmlFor={`draft-${item.id}`}>Your response</label><span>{wordCount} words · saved on this device</span></div>
                      <textarea id={`draft-${item.id}`} value={draft} onChange={(event) => updateDraft(item.id, event.target.value)} placeholder="Écrivez votre réponse ici…" />
                      <button className="btn secondary writing-model-button" onClick={() => setShowAnswers((current) => { const next = new Set(current); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })}>
                        {showAnswers.has(item.id) ? "Hide model answer" : "Show model answer"}
                      </button>
                      {item.audioUrl && <audio controls preload="none" src={item.audioUrl} />}
                      {showAnswers.has(item.id) && <div className="writing-model"><span>Model answer</span><p>{item.correction || "Model answer coming soon for this prompt."}</p></div>}
                    </div>
                  )}
                </article>
              );
            })}
            {visible < filtered.length && <button className="btn secondary writing-load" onClick={() => setVisible((count) => count + 12)}>Load 12 more</button>}
          </section>
        )}
      </main>
    </div>
  );
}

