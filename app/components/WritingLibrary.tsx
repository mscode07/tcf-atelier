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
type WritingSummary = Pick<
  WritingQuestion,
  "id" | "taskType" | "topic" | "broadCategory" | "topicHeading"
>;

export default function WritingLibrary({
  onBack,
  nav,
}: {
  onBack: () => void;
  nav: (minimal?: boolean) => React.ReactNode;
}) {
  const [questions, setQuestions] = useState<WritingSummary[]>([]);
  const [details, setDetails] = useState<Record<string, WritingQuestion>>({});
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [task, setTask] = useState<"all" | WritingQuestion["taskType"]>("all");
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [visible, setVisible] = useState(12);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [showAnswers, setShowAnswers] = useState<Set<string>>(new Set());

  const loadQuestions = (offset: number, replace = false) => {
    setLoadingMore(true);
    const params = new URLSearchParams({
      limit: "12",
      offset: String(offset),
      task,
      category,
    });
    fetch(`/api/materials/writing?${params}`)
      .then((response) => {
        if (!response.ok)
          throw new Error("Writing prompts could not be loaded");
        return response.json();
      })
      .then((data: { questions: WritingSummary[]; total: number; categories: string[]; taskCounts: Record<string, number> }) => {
        setQuestions((current) => replace ? data.questions : [...current, ...data.questions]);
        setTotal(data.total);
        setCategories(data.categories);
        setTaskCounts(data.taskCounts);
      })
      .catch(() => {
        window.location.href = "/?access=subscription_required";
      })
      .finally(() => setLoadingMore(false));
  };
  useEffect(() => {
    void loadQuestions(0, true);
  }, [task, category]);
  useEffect(() => {
    try {
      setDrafts(JSON.parse(localStorage.getItem("tcf-writing-drafts") || "{}"));
    } catch {
      setDrafts({});
    }
  }, []);
  const filtered = questions;
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
            <button className="writing-back" onClick={onBack}>
              ← Dashboard
            </button>
            <div className="writing-kicker">Expression écrite</div>
            <h1>Writing practice</h1>
            <p>
              113 authentic prompts across Tasks 1, 2 and 3. Choose a focus,
              write your response, then compare it with the model answer.
            </p>
          </div>
          <div
            className="writing-summary"
            aria-label="Writing question summary"
          >
            <strong>{filtered.length}</strong>
            <span>prompts in this selection</span>
          </div>
        </header>

        <section
          className="writing-controls"
          aria-label="Filter writing prompts"
        >
          <div
            className="writing-tabs"
            role="group"
            aria-label="Filter by task"
          >
            {(["all", "tache_1", "tache_2", "tache_3"] as const).map(
              (value) => (
                <button
                  key={value}
                  className={task === value ? "active" : ""}
                  onClick={() => chooseTask(value)}
                >
                  {value === "all" ? "All tasks" : `Task ${taskNumber(value)}`}
                  <span>
                    {value === "all"
                      ? taskCounts.all ?? Object.values(taskCounts).reduce((sum, count) => sum + count, 0)
                      : taskCounts[value] ?? 0}
                  </span>
                </button>
              ),
            )}
          </div>
          <label className="writing-select">
            <span>Category</span>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setVisible(12);
                setOpenId(null);
              }}
            >
              <option value="all">All categories</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </section>

        {loadingMore && !questions.length ? (
          <section className="catalog-loader library-loader" role="status" aria-live="polite">
            <div className="catalog-loader-mark" aria-hidden="true"><i /><i /><i /></div>
            <div><strong>Preparing your writing practice</strong><p>Loading your first set of prompts…</p></div>
          </section>
        ) : !questions.length ? (
          <div className="writing-empty">No writing prompts are currently available.</div>
        ) : !filtered.length ? (
          <div className="writing-empty">No prompts match this selection.</div>
        ) : (
          <section className="writing-list" aria-live="polite">
            {filtered.map((item) => {
              const isOpen = openId === item.id;
              const detail = details[item.id];
              const draft = drafts[item.id] || "";
              const wordCount = draft.trim()
                ? draft.trim().split(/\s+/).length
                : 0;
              return (
                <article
                  className={`writing-card ${isOpen ? "open" : ""}`}
                  key={item.id}
                >
                  <button
                    className="writing-card-head"
                    onClick={() => {
                      setOpenId(isOpen ? null : item.id);
                      if (!isOpen && !detail)
                        void fetch(`/api/materials/writing?id=${encodeURIComponent(item.id)}`)
                          .then((response) => response.ok ? response.json() : Promise.reject())
                          .then((data: { question: WritingQuestion }) =>
                            setDetails((current) => ({ ...current, [item.id]: data.question })),
                          );
                    }}
                    aria-expanded={isOpen}
                  >
                    <div>
                      <div className="writing-card-meta">
                        <span
                          className={`writing-task task-${taskNumber(item.taskType)}`}
                        >
                          Task {taskNumber(item.taskType)}
                        </span>
                        <span>{item.broadCategory}</span>
                      </div>
                      <h2>{item.topicHeading || item.topic}</h2>
                      <p>Open this prompt to view the full task and model answer.</p>
                    </div>
                    <span className="writing-toggle" aria-hidden="true">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="writing-practice">
                      {!detail ? <p className="writing-empty">Loading prompt…</p> : detail.taskType === "tache_3" ? (
                        <div className="writing-documents">
                          <article>
                            <span>Document 1</span>
                            <p>{detail.document1}</p>
                          </article>
                          <article>
                            <span>Document 2</span>
                            <p>{detail.document2}</p>
                          </article>
                        </div>
                      ) : (
                        <div className="writing-instruction">
                          <span>French instruction</span>
                          <p>{detail.prompt}</p>
                        </div>
                      )}
                      {detail && <><div className="writing-answer-label">
                        <label htmlFor={`draft-${item.id}`}>
                          Your response
                        </label>
                        <span>{wordCount} words · saved on this device</span>
                      </div>
                      <textarea
                        id={`draft-${item.id}`}
                        value={draft}
                        onChange={(event) =>
                          updateDraft(item.id, event.target.value)
                        }
                        placeholder="Écrivez votre réponse ici…"
                      />
                      <button
                        className="btn secondary writing-model-button"
                        onClick={() =>
                          setShowAnswers((current) => {
                            const next = new Set(current);
                            next.has(item.id)
                              ? next.delete(item.id)
                              : next.add(item.id);
                            return next;
                          })
                        }
                      >
                        {showAnswers.has(item.id)
                          ? "Hide model answer"
                          : "Show model answer"}
                      </button>
                      {detail.audioUrl && (
                        <audio controls preload="none" src={detail.audioUrl} />
                      )}
                      {showAnswers.has(item.id) && (
                        <div className="writing-model">
                          <span>Model answer</span>
                          <p>
                            {detail.correction ||
                              "Model answer coming soon for this prompt."}
                          </p>
                        </div>
                      )}</>}
                    </div>
                  )}
                </article>
              );
            })}
            {questions.length < total && (
              <button
                className="btn secondary writing-load"
                disabled={loadingMore}
                onClick={() => loadQuestions(questions.length)}
              >
                {loadingMore ? "Loading…" : "Load 12 more"}
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
