"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";

type Route = "home" | "auth" | "dashboard" | "tests" | "exam" | "results" | "comingSoon";
type Theme = "light" | "dark";
type PracticeMode = "exam" | "review";
type ModuleName = "Listening" | "Reading" | "Writing" | "Speaking";
type User = { email: string };
type Question = { level: string; prompt: string; ask: string; answers: string[]; correct: number };
type ModuleProgressData = { tests: { testNumber: number; status: "completed" | "in_progress"; percentage: number }[]; attempted: number; completed: number; average: number; best: number; recentScores: number[] };
type ProgressData = { modules: { listening: ModuleProgressData; reading: ModuleProgressData }; overall: { attempted: number; completed: number; average: number } };

const questions: Question[] = [
  { level: "A1", prompt: "ÉTUDIANTS INTERNATIONAUX : NE RESTEZ PAS SEULS !\nInscrivez-vous dans l’association de l’Université pour discuter avec des étudiants français, participer à des groupes de conversation et faire des activités ensemble.", ask: "Que propose cette association ?", answers: ["Des cours particuliers", "Des jobs pendant le week-end", "Des rencontres entre jeunes", "Des voyages à l’étranger"], correct: 2 },
  { level: "A1", prompt: "Le train pour Lyon partira exceptionnellement voie 8 avec un retard de dix minutes.", ask: "Que doivent faire les voyageurs ?", answers: ["Changer de quai", "Acheter un billet", "Attendre une heure", "Prendre un autobus"], correct: 0 },
  { level: "A2", prompt: "Bonjour Léa, je serai en retard au dîner. Commencez sans moi, j’arrive vers vingt heures trente.", ask: "Pourquoi cette personne écrit-elle ?", answers: ["Pour annuler un rendez-vous", "Pour prévenir d’un retard", "Pour changer de restaurant", "Pour inviter une amie"], correct: 1 },
  { level: "B1", prompt: "La mairie ouvre une nouvelle médiathèque samedi. Les inscriptions seront gratuites pendant tout le week-end.", ask: "Quelle information est annoncée ?", answers: ["Une fermeture temporaire", "Un tarif réduit", "Une inauguration", "Un changement d’adresse"], correct: 2 },
  { level: "B2", prompt: "Selon l’étude, les salariés qui organisent de courtes pauses régulières maintiennent plus longtemps leur concentration.", ask: "Que recommande implicitement cette étude ?", answers: ["De travailler chez soi", "De raccourcir la journée", "De faire des pauses", "De changer de métier"], correct: 2 }
];

export default function HomePage() {
  const [route, setRoute] = useState<Route>("home");
  const [theme, setTheme] = useState<Theme>("dark");
  const [user, setUser] = useState<User | null>(null);
  const [moduleName, setModuleName] = useState<ModuleName>("Listening");
  const [test, setTest] = useState(1);
  const [mode, setMode] = useState<PracticeMode>("review");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [showMode, setShowMode] = useState(false);
  const [toast, setToastState] = useState("");
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const setToast = (message: string) => setToastState(message === "Demo Google account connected" ? "" : message);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    if (savedTheme) setTheme(savedTheme);
    fetch("/api/auth/session").then(response => response.json()).then(({ user: sessionUser }: { user?: User | null }) => {
      if (sessionUser) { setUser(sessionUser); setRoute("dashboard"); }
    }).catch(() => undefined);
    const authStatus = new URLSearchParams(window.location.search).get("auth");
    if (authStatus === "error") setToast("Google sign-in failed. Check your Auth.js callback URL.");
    if (authStatus) window.history.replaceState({}, "", window.location.pathname);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("theme", theme); }, [theme]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 2200); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!user || (route !== "dashboard" && route !== "tests")) return;
    fetch("/api/progress", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(setProgressData).catch(() => undefined);
  }, [route, user]);

  const login = async (email: string) => {
    if (email === "learner@gmail.com") { void signIn("google", { callbackUrl: "/" }); return; }
    const password = (document.getElementById("password") as HTMLInputElement | null)?.value ?? "";
    const result = await signIn("credentials", { email, password, redirect: false });
    if (!result || result.error) { setToast("Incorrect email or password."); return; }
    const next = { email: email.trim().toLowerCase() };
    setUser(next); setRoute("dashboard");
  };
  const logout = () => { void signOut({ redirect: false }); setUser(null); localStorage.removeItem("tcf-user"); setRoute("home"); };
  const openModule = (nextModule: ModuleName) => {
    setModuleName(nextModule);
    setRoute(nextModule === "Writing" || nextModule === "Speaking" ? "comingSoon" : "tests");
  };
  const beginExam = (nextMode: PracticeMode) => {
    if (moduleName === "Listening") {
      window.location.href = `/listening-tests/test-${String(test).padStart(2, "0")}.html?mode=${nextMode}`;
      return;
    }
    if (moduleName === "Reading") {
      window.location.href = `/reading-tests/${String(test).padStart(2, "0")}?mode=${nextMode}`;
      return;
    }
    setMode(nextMode); setQuestionIndex(0); setAnswers({}); setFlagged(new Set()); setShowMode(false); setRoute("exam");
  };
  const nextQuestion = () => questionIndex < questions.length - 1 ? setQuestionIndex(questionIndex + 1) : setRoute("results");
  const toggleFlag = () => setFlagged(current => { const updated = new Set(current); updated.has(questionIndex) ? updated.delete(questionIndex) : updated.add(questionIndex); return updated; });
  const nav = (minimal = false) => <nav className="nav"><button className="brand" onClick={() => setRoute(user ? "dashboard" : "home")}>tcf<span>·</span>atelier</button><div className="nav-actions">{!minimal && <><button className="nav-link" onClick={() => setRoute("home")}>Features</button><button className="nav-link" onClick={() => { setRoute("home"); setTimeout(() => document.querySelector("#pricing")?.scrollIntoView(), 0); }}>Pricing</button></>}{user ? <><button className="nav-link" onClick={() => setRoute("dashboard")}>Dashboard</button><button className="nav-link" onClick={logout}>Sign out</button></> : <button className="btn" onClick={() => setRoute("auth")}>Sign in</button>}<button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{theme === "dark" ? "☀" : "☾"}</button></div></nav>;

  const Home = () => <div className="shell">{nav()}<main><section className="hero"><div><div className="eyebrow">The focused route to your TCF score</div><h1>French practice,<br/><em>without the noise.</em></h1><p className="lede">Forty full-length TCF practice tests, clear explanations, and a calmer way to build exam confidence — from your first A1 question to C1.</p><div className="hero-actions"><button className="btn" onClick={() => setRoute(user ? "dashboard" : "auth")}>Start practicing →</button><button className="btn secondary" onClick={() => document.querySelector("#features")?.scrollIntoView()}>See how it works</button></div><div className="mini-proof"><span>✓ 40 full tests</span><span>✓ Instant explanations</span><span>✓ Real score tracking</span></div></div><div className="preview"><div className="preview-top"><span className="mono">Review mode</span><span>03 / 39</span></div><div className="question-card"><span className="level">A1</span><div className="passage">Le train pour Lyon partira exceptionnellement voie 8.</div><div className="choice">A. Acheter un billet</div><div className="choice active">B. Changer de quai</div><div className="choice">C. Appeler un taxi</div></div></div></section><div className="stats-strip"><div className="stat"><strong>40</strong><span>curated practice tests</span></div><div className="stat"><strong>699</strong><span>CRS score mapping</span></div><div className="stat"><strong>2</strong><span>practice modes</span></div></div><section className="section" id="features"><div className="section-head"><div><div className="eyebrow">A complete practice room</div><h2>Learn from every answer.</h2></div><p className="section-copy">Train under pressure or slow things down. Every session builds a clear picture of where you are and what to do next.</p></div><div className="feature-grid">{[["01","Listen","Exam-style audio prompts and transcripts."],["02","Read","Authentic notices, messages, and longer texts."],["03","Write","Structured prompts from A1 through C1."],["04","Speak","Guided scenarios with timed preparation."]].map(item => <article className="feature" key={item[0]}><span className="num">{item[0]}</span><h3>{item[1]}</h3><p>{item[2]}</p></article>)}</div></section><section className="section" id="pricing"><div className="pricing"><div><div className="eyebrow">Simple access, no subscription</div><h2>Pick the time you need.</h2><p className="pricing-copy">All plans unlock every module, explanation, transcript and progress report.</p></div><div className="price-cards">{[["7 days","$10"],["15 days","$25"],["30 days","$45"]].map((plan, index) => <div className={`price-card ${index === 2 ? "best" : ""}`} key={plan[0]}><div><small>{plan[0]}</small><strong>{plan[1]}</strong></div><button className="btn" onClick={() => setToast(`${plan[0]} plan (${plan[1]}) — Razorpay is ready for API keys`)}>Choose</button></div>)}</div></div></section></main></div>;

  const Auth = () => <div className="shell">{nav(true)}<div className="auth-wrap"><form className="auth-card" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); login(new FormData(event.currentTarget).get("email") as string); }}><div className="eyebrow">Welcome to your study room</div><h1>Continue your progress.</h1><p className="user-note">Sign in or create an account — it only takes a moment.</p><button type="button" className="btn google" onClick={() => { login("learner@gmail.com"); setToast("Demo Google account connected"); }}>G&nbsp;&nbsp; Continue with Google</button><div className="divider">OR WITH EMAIL</div><div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required placeholder="you@example.com"/></div><div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={6} placeholder="At least 6 characters"/></div><button className="btn full-button">Continue →</button></form></div></div>;

  const Dashboard = () => <div className="shell">{nav()}<main className="dashboard"><div className="welcome"><div><div className="eyebrow">Your learning room</div><h1>Welcome back.</h1><p className="user-note">{user?.email}</p></div><button className="btn secondary" onClick={() => openModule("Listening")}>Resume practice →</button></div><div className="overview-stats"><div><strong>{progressData?.overall.attempted ?? 0}</strong><span>tests attempted</span></div><div><strong>{progressData?.overall.completed ?? 0}</strong><span>tests completed</span></div><div><strong>{progressData?.overall.average ?? 0}%</strong><span>overall average</span></div></div><div className="module-overviews"><ModuleOverview name="Listening" data={progressData?.modules.listening} onOpen={() => openModule("Listening")}/><ModuleOverview name="Reading" data={progressData?.modules.reading} onOpen={() => openModule("Reading")}/></div><div className="section-head"><div><div className="eyebrow">Practice</div><h2 className="dashboard-heading">Choose a skill</h2></div><p className="section-copy">Listening and Reading are available now. Writing and Speaking are coming soon.</p></div><div className="module-grid">{[["◖","Listening","Audio comprehension"],["▤","Reading","Text comprehension"],["✎","Writing","Coming soon"],["◉","Speaking","Coming soon"]].map(item => <button className="module" key={item[1]} onClick={() => openModule(item[1] as ModuleName)}><span>{item[0]}</span><b>{item[1]}</b><small>{item[2]}</small></button>)}</div></main></div>;

  const Tests = () => { const moduleProgress = progressData?.modules[moduleName.toLowerCase() as "listening" | "reading"]; return <div className="shell">{nav()}<main className="dashboard"><div className="tests-head"><div><div className="eyebrow">{moduleName} practice</div><h1>{moduleName} Tests</h1><p className="user-note">40 full tests · all levels · three attempts each</p></div><button className="btn secondary" onClick={() => setRoute("dashboard")}>← Dashboard</button></div><ScoreChart compact scores={moduleProgress?.recentScores} label={`${moduleName} score trend`}/><div className="progress-legend"><span><i className="legend-completed"/> Completed</span><span><i className="legend-progress"/> In progress</span><span>{moduleProgress?.completed ?? 0}/40 completed · {moduleProgress?.average ?? 0}% average</span></div><div className="tests-grid">{Array.from({ length: 40 }, (_, index) => { const testNumber = index + 1; const testProgress = moduleProgress?.tests.find(item => item.testNumber === testNumber); return <button className={`test ${testProgress?.status === "completed" ? "done" : testProgress?.status === "in_progress" ? "in-progress" : ""}`} key={index} onClick={() => { setTest(testNumber); setShowMode(true); }}><small>Test</small>{testNumber}{testProgress?.status === "completed" && <small>✓ {testProgress.percentage}%</small>}{testProgress?.status === "in_progress" && <small>In progress</small>}</button>; })}</div></main>{showMode && <ModeModal onBegin={beginExam} onClose={() => setShowMode(false)}/>}</div>; };

  const Exam = () => { const question = questions[questionIndex]; const selected = answers[questionIndex]; return <div className="shell">{nav(true)}<div className="progress"><i style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }}/></div><main className="exam"><aside className="rail"><div className="rail-top"><b>{moduleName} · Test {test}</b><p className="user-note">{Object.keys(answers).length}/{questions.length} answered</p></div><div className="q-nav">{questions.map((_, index) => <button className={`q-dot ${index === questionIndex ? "active" : ""}`} key={index} onClick={() => setQuestionIndex(index)}>Q{index + 1}</button>)}</div></aside><section className="exam-main"><div className="exam-top"><span className="level">{question.level}</span><span className="mono">Q{questionIndex + 1}/{questions.length}{mode === "exam" && " · 34:42"}</span></div><div className="prompt">{question.prompt.split("\n").map((line, index) => <span key={line}>{index > 0 && <br/>}{line}</span>)}</div><h3>{question.ask}</h3><div className="answers">{question.answers.map((answerText, index) => { let answerClass = selected === index ? "selected" : ""; if (mode === "review" && selected !== undefined) answerClass += index === question.correct ? " correct" : selected === index ? " wrong" : ""; return <button className={`answer ${answerClass}`} key={answerText} onClick={() => setAnswers(current => ({ ...current, [questionIndex]: index }))}><b>{"ABCD"[index]}.</b>&nbsp;&nbsp;{answerText}</button>; })}</div>{mode === "review" && selected !== undefined && <p className="user-note feedback">{selected === question.correct ? "Correct — well read." : `The key detail in the prompt points to answer ${"ABCD"[question.correct]}.`}</p>}<div className="exam-actions"><button className="btn ghost" onClick={toggleFlag}>{flagged.has(questionIndex) ? "⚑ Flagged" : "⚐ Flag for review"}</button><button className="btn" onClick={nextQuestion}>{questionIndex === questions.length - 1 ? "Finish test" : "Confirm & next →"}</button></div></section></main></div>; };

  const Results = () => { const correct = questions.filter((question, index) => answers[index] === question.correct).length; const answered = Object.keys(answers).length; const percentage = answered ? Math.round(correct / answered * 100) : 0; const estimatedLevel = correct / questions.length > .8 ? "B2" : correct / questions.length > .55 ? "B1" : "A2"; return <div className="shell">{nav()}<main className="dashboard"><div className="result-card"><div className="eyebrow">Test {test} · {mode} mode</div><h1 className="result-title">Test complete.</h1><div className="score">{percentage}%</div><p className="user-note">of answered questions</p><div className="score-grid"><div><strong className="correct-text">{correct}</strong><small>correct</small></div><div><strong className="wrong-text">{answered - correct}</strong><small>wrong</small></div><div><strong>{questions.length - answered}</strong><small>skipped</small></div></div><div className="score-estimate"><span className="mono user-note">TCF score estimate · {Math.round(correct / questions.length * 699)} pts</span><div className="level-bar"/></div><h2 className="level-title">Estimated level: {estimatedLevel}</h2><div className="hero-actions centered"><button className="btn secondary" onClick={() => { setAnswers({}); setQuestionIndex(0); setRoute("exam"); }}>Retry test</button><button className="btn" onClick={() => setRoute("tests")}>All tests →</button></div></div></main></div>; };

  const ComingSoon = () => <div className="shell">{nav()}<main className="dashboard"><section className="result-card coming-soon"><div className="coming-soon-icon" aria-hidden="true">{moduleName === "Writing" ? "✎" : "◉"}</div><div className="eyebrow">{moduleName} module</div><h1>Coming soon.</h1><p className="user-note">We’re preparing the {moduleName.toLowerCase()} practice experience. Listening and Reading are ready for you now.</p><div className="hero-actions centered"><button className="btn secondary" onClick={() => setRoute("dashboard")}>← Back to dashboard</button><button className="btn" onClick={() => openModule("Listening")}>Practice Listening →</button></div></section></main></div>;

  const views: Record<Route, React.ReactNode> = { home: <Home/>, auth: <Auth/>, dashboard: user ? <Dashboard/> : <Auth/>, tests: <Tests/>, exam: <Exam/>, results: <Results/>, comingSoon: <ComingSoon/> };
  return <>{views[route]}<div id="toast" role="status" aria-live="polite" className={toast ? "show" : ""}>{toast}</div></>;
}

function ScoreChart({ compact = false, scores = [], label = "Score trend" }: { compact?: boolean; scores?: number[]; label?: string }) {
  const points = scores.map((score, index) => `${scores.length === 1 ? 50 : 5 + index * (90 / (scores.length - 1))},${95 - score * .75}`).join(" ");
  return <div className="chart" style={compact ? { height: 190 } : undefined}><span className="chart-label">{label} · last 5 completed attempts</span>{scores.length ? <svg className="score-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${label}: ${scores.join(", ")} percent`}><polyline points={points}/>{scores.map((score, index) => <circle key={index} cx={scores.length === 1 ? 50 : 5 + index * (90 / (scores.length - 1))} cy={95 - score * .75} r="1.8"/>)}</svg> : <div className="chart-empty">Complete a test to start your score trend.</div>}</div>;
}
function ModuleOverview({ name, data, onOpen }: { name: "Listening" | "Reading"; data?: ModuleProgressData; onOpen: () => void }) { return <article className="module-overview"><div className="module-overview-head"><div><span className="eyebrow">{name}</span><h3>{data?.average ?? 0}% average</h3></div><button className="btn secondary" onClick={onOpen}>View tests →</button></div><ScoreChart compact scores={data?.recentScores} label={name}/><div className="overview-meta"><span><strong>{data?.attempted ?? 0}</strong> attempted</span><span><strong>{data?.completed ?? 0}</strong> completed</span><span><strong>{data?.best ?? 0}%</strong> best</span></div></article>; }
function ModeModal({ onBegin, onClose }: { onBegin: (mode: PracticeMode) => void; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal"><div className="eyebrow">Choose your mode</div><h2 className="mode-title">How do you want to practice?</h2><button className="mode" onClick={() => onBegin("exam")}><h3>⏱ Exam Mode <span className="level">35 minutes</span></h3><p>39 questions under timed conditions. No answers or explanations until the end.</p></button><button className="mode" onClick={() => onBegin("review")}><h3>▤ Review Mode <span className="level">No timer</span></h3><p>Go at your pace. See the correct answer and explanation after each response.</p></button><button className="btn ghost full-button" onClick={onClose}>Cancel</button></div></div>; }
