"use client";

import { useEffect, useRef, useState } from "react";

type SpeakingQuestion = {
  audioUrl?: string;
  id: string | number;
  number?: number;
  coverageMode: "quick";
  tache: 2 | 3;
  category: string;
  titleFr: string;
  promptFr: string;
  durationSeconds: number;
  referenceAnswer: { bulletItems?: string[]; text?: string };
  quickSetSupport?: {
    template?: { title: string; summary: string; templateLines: string[] };
    coachTip?: string;
    fills?: Record<string, string>;
  };
};
type SpeakingSummary = Pick<
  SpeakingQuestion,
  "id" | "number" | "tache" | "category" | "titleFr" | "durationSeconds"
>;

export default function SpeakingLibrary({
  onBack,
  nav,
}: {
  onBack: () => void;
  nav: (minimal?: boolean) => React.ReactNode;
}) {
  const [questions, setQuestions] = useState<SpeakingSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [task, setTask] = useState<"all" | 2 | 3>("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SpeakingQuestion | null>(null);
  const [done, setDone] = useState<Set<string | number>>(new Set());
  const [showGuide, setShowGuide] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const loadQuestions = (offset: number, replace = false) => {
    setLoadingMore(true);
    const params = new URLSearchParams({ limit: "12", offset: String(offset), task: String(task), category, search });
    fetch(`/api/materials/speaking?${params}`)
      .then((response) => {
        if (!response.ok) throw new Error("Module access required");
        return response.json();
      })
      .then((data: { questions: SpeakingSummary[]; total: number; categories: string[]; taskCounts: Record<string, number> }) => {
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
  }, [task, category, search]);
  useEffect(() => {
    try {
      setDone(
        new Set(JSON.parse(localStorage.getItem("tcf-speaking-done") || "[]")),
      );
    } catch {
      setDone(new Set());
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);
  const filtered = questions;
  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const resetFilters = () => {
    setTask("all");
    setCategory("all");
    setSearch("");
  };
  const toggleDone = (id: string | number) => {
    const next = new Set(done);
    next.has(id) ? next.delete(id) : next.add(id);
    setDone(next);
    localStorage.setItem("tcf-speaking-done", JSON.stringify(Array.from(next)));
  };
  const openQuestion = (question: SpeakingSummary) => {
    void fetch(`/api/materials/speaking?id=${encodeURIComponent(String(question.id))}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { question: SpeakingQuestion }) => setSelected(data.question));
    setShowGuide(false);
    setShowReference(false);
    setElapsed(0);
    setRecordingError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const startRecording = async () => {
    setRecordingError("");
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecordingError("Audio recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(
        () => setElapsed((time) => time + 1),
        1000,
      );
    } catch {
      setRecordingError(
        "Microphone access was not granted. Check your browser permission and try again.",
      );
    }
  };
  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  if (selected) {
    const referenceItems = selected.referenceAnswer.bulletItems;
    return (
      <div className="shell speaking-shell">
        {nav()}
        <main className="speaking-session">
          <button
            className="writing-back"
            onClick={() => {
              if (recording) stopRecording();
              setSelected(null);
            }}
          >
            ← All speaking prompts
          </button>
          <div className="speaking-session-meta">
            <span className={`writing-task task-${selected.tache}`}>
              Task {selected.tache}
            </span>
            <span>{formatTime(selected.durationSeconds)}</span>
          </div>
          <div className="speaking-prompt-number">
            Prompt {String(selected.number ?? selected.id).padStart(2, "0")}
          </div>
          <h1>{selected.category}</h1>
          <section className="speaking-prompt">
            <p>{selected.promptFr}</p>
            {selected.audioUrl && (
              <audio controls preload="none" src={selected.audioUrl} />
            )}
          </section>
          <section className="speaking-guide-bar">
            <div>
              <span>Quick-set framework</span>
              <p>
                {selected.quickSetSupport?.coachTip ||
                  "Organize your response clearly before you begin."}
              </p>
            </div>
            <button
              className="btn secondary"
              onClick={() => setShowGuide(!showGuide)}
            >
              {showGuide ? "Hide guide" : "Show guide"}
            </button>
          </section>
          {showGuide && selected.quickSetSupport?.template && (
            <section className="speaking-guide">
              <div>
                <span>Reusable structure</span>
                <h2>{selected.quickSetSupport.template.title}</h2>
                <p>{selected.quickSetSupport.template.summary}</p>
              </div>
              <ol>
                {selected.quickSetSupport.template.templateLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </section>
          )}
          <p className="speaking-instruction">
            Speak naturally and stay focused on the prompt. Your recording
            remains on this device and is not uploaded.
          </p>
          <section className={`speaking-recorder ${recording ? "active" : ""}`}>
            <div className="speaking-recorder-status">
              <span className="speaking-mic">●</span>
              <div>
                <strong>
                  {recording ? "Recording…" : "Practice recording"}
                </strong>
                <small>
                  {recording
                    ? `${formatTime(elapsed)} / ${formatTime(selected.durationSeconds)}`
                    : "Use your microphone to rehearse your answer"}
                </small>
              </div>
            </div>
            <button
              className={`btn ${recording ? "speaking-stop" : ""}`}
              onClick={recording ? stopRecording : startRecording}
            >
              {recording ? "Stop recording" : "Start recording"}
            </button>
          </section>
          {recordingError && (
            <p className="speaking-error" role="alert">
              {recordingError}
            </p>
          )}
          {audioUrl && (
            <section className="speaking-playback">
              <div>
                <strong>Your latest recording</strong>
                <span>{formatTime(elapsed)}</span>
              </div>
              <audio controls src={audioUrl} />
            </section>
          )}
          <div className="speaking-session-actions">
            <button
              className="btn secondary"
              onClick={() => setShowReference(!showReference)}
            >
              {showReference ? "Hide reference" : "Review reference answer"}
            </button>
            <button className="btn" onClick={() => toggleDone(selected.id)}>
              {done.has(selected.id)
                ? "Mark as not done"
                : "Mark practice complete"}
            </button>
          </div>
          {showReference && (
            <section className="speaking-reference">
              <span>Reference answer</span>
              {referenceItems ? (
                <ul>
                  {referenceItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>{selected.referenceAnswer.text}</p>
              )}
            </section>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="shell speaking-shell">
      {nav()}
      <main className="speaking-page">
        <header className="speaking-header">
          <button className="writing-back" onClick={onBack}>
            ← Dashboard
          </button>
          <div className="speaking-kicker">Expression orale</div>
          <h1>Speaking practice</h1>
          <p>
            Build confidence with the 52-question Quick Set. Filter by task or
            topic, rehearse with a reusable structure, and record yourself
            directly in the browser.
          </p>
          <div className="speaking-stats">
            <div>
              <strong>{Object.values(taskCounts).reduce((sum, count) => sum + count, 0)}</strong>
              <span>core prompts</span>
            </div>
            <div>
              <strong>{taskCounts["2"] ?? 0}</strong>
              <span>Task 2</span>
            </div>
            <div>
              <strong>{taskCounts["3"] ?? 0}</strong>
              <span>Task 3</span>
            </div>
            <div>
              <strong>{done.size}</strong>
              <span>completed</span>
            </div>
          </div>
        </header>
        <section className="speaking-controls">
          <div
            className="writing-tabs"
            role="group"
            aria-label="Filter by speaking task"
          >
            {(["all", 2, 3] as const).map((value) => (
              <button
                key={value}
                className={task === value ? "active" : ""}
                onClick={() => setTask(value)}
              >
                {value === "all" ? "All tasks" : `Task ${value}`}
                <span>
                  {value === "all"
                    ? questions.length
                    : questions.filter((q) => q.tache === value).length}
                </span>
              </button>
            ))}
          </div>
          <div className="speaking-filter-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search prompts…"
              aria-label="Search speaking prompts"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <button onClick={resetFilters}>Reset</button>
          </div>
        </section>
        <div className="speaking-result-count">
          {filtered.length} prompt{filtered.length === 1 ? "" : "s"} shown
        </div>
        <section className="speaking-list">
          {filtered.map((item) => (
            <article className="speaking-card" key={item.id}>
              <div className="speaking-card-top">
                <div>
                  <span className={`writing-task task-${item.tache}`}>
                    Task {item.tache}
                  </span>
                  <span>{item.category}</span>
                  <span>
                    Prompt {String(item.number ?? item.id).padStart(2, "0")}
                  </span>
                </div>
                <span>{formatTime(item.durationSeconds)}</span>
              </div>
              <p>{item.titleFr || "Open this prompt to see the full speaking task."}</p>
              <div className="speaking-card-bottom">
                <span className={done.has(item.id) ? "done" : ""}>
                  {done.has(item.id) ? "✓ Completed" : "Not done"}
                </span>
                <button
                  className="btn secondary"
                  onClick={() => openQuestion(item)}
                >
                  Start practice →
                </button>
              </div>
            </article>
          ))}
          {loadingMore && !questions.length && (
            <section className="catalog-loader library-loader" role="status" aria-live="polite">
              <div className="catalog-loader-mark" aria-hidden="true"><i /><i /><i /></div>
              <div><strong>Preparing your speaking practice</strong><p>Loading your first set of prompts…</p></div>
            </section>
          )}
          {!loadingMore && !questions.length && (
            <div className="writing-empty">No speaking prompts are currently available.</div>
          )}
          {questions.length > 0 && !filtered.length && (
            <div className="writing-empty">No prompts match these filters.</div>
          )}
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
      </main>
    </div>
  );
}
