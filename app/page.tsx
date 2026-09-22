"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import dynamic from "next/dynamic";
import AuthCards from "./components/AuthCards";

const loadingLibrary = () => (
  <main className="section" role="status">
    Loading practice library…
  </main>
);
const WritingLibrary = dynamic(() => import("./components/WritingLibrary"), {
  loading: loadingLibrary,
});
const SpeakingLibrary = dynamic(() => import("./components/SpeakingLibrary"), {
  loading: loadingLibrary,
});

type Route =
  | "home"
  | "auth"
  | "dashboard"
  | "tests"
  | "exam"
  | "results"
  | "writing"
  | "speaking"
  | "comingSoon";
type ModuleName = "Listening" | "Reading" | "Writing" | "Speaking";
const moduleRoute = (module: ModuleName): Route =>
  module === "Writing"
    ? "writing"
    : module === "Speaking"
      ? "speaking"
      : "tests";
const moduleFromPath = (path: string): ModuleName | undefined => {
  const segment = path.split("/").filter(Boolean)[0]?.toLowerCase();
  return segment === "listening"
    ? "Listening"
    : segment === "reading"
      ? "Reading"
      : segment === "writing"
        ? "Writing"
        : segment === "speaking"
          ? "Speaking"
          : undefined;
};
type User = { email: string };
type Question = {
  level: string;
  prompt: string;
  ask: string;
  answers: string[];
  correct: number;
};
type ModuleProgressData = {
  tests: {
    testNumber: number;
    status: "completed" | "in_progress";
    percentage: number;
  }[];
  attempted: number;
  completed: number;
  average: number;
  best: number;
  recentScores: number[];
};
type ProgressData = {
  modules: { listening: ModuleProgressData; reading: ModuleProgressData };
  overall: { attempted: number; completed: number; average: number };
};

const questions: Question[] = [
  {
    level: "A1",
    prompt:
      "ÉTUDIANTS INTERNATIONAUX : NE RESTEZ PAS SEULS !\nInscrivez-vous dans l’association de l’Université pour discuter avec des étudiants français, participer à des groupes de conversation et faire des activités ensemble.",
    ask: "Que propose cette association ?",
    answers: [
      "Des cours particuliers",
      "Des jobs pendant le week-end",
      "Des rencontres entre jeunes",
      "Des voyages à l’étranger",
    ],
    correct: 2,
  },
  {
    level: "A1",
    prompt:
      "Le train pour Lyon partira exceptionnellement voie 8 avec un retard de dix minutes.",
    ask: "Que doivent faire les voyageurs ?",
    answers: [
      "Changer de quai",
      "Acheter un billet",
      "Attendre une heure",
      "Prendre un autobus",
    ],
    correct: 0,
  },
  {
    level: "A2",
    prompt:
      "Bonjour Léa, je serai en retard au dîner. Commencez sans moi, j’arrive vers vingt heures trente.",
    ask: "Pourquoi cette personne écrit-elle ?",
    answers: [
      "Pour annuler un rendez-vous",
      "Pour prévenir d’un retard",
      "Pour changer de restaurant",
      "Pour inviter une amie",
    ],
    correct: 1,
  },
  {
    level: "B1",
    prompt:
      "La mairie ouvre une nouvelle médiathèque samedi. Les inscriptions seront gratuites pendant tout le week-end.",
    ask: "Quelle information est annoncée ?",
    answers: [
      "Une fermeture temporaire",
      "Un tarif réduit",
      "Une inauguration",
      "Un changement d’adresse",
    ],
    correct: 2,
  },
  {
    level: "B2",
    prompt:
      "Selon l’étude, les salariés qui organisent de courtes pauses régulières maintiennent plus longtemps leur concentration.",
    ask: "Que recommande implicitement cette étude ?",
    answers: [
      "De travailler chez soi",
      "De raccourcir la journée",
      "De faire des pauses",
      "De changer de métier",
    ],
    correct: 2,
  },
];

export default function HomePage() {
  const initialModule =
    typeof window === "undefined"
      ? undefined
      : moduleFromPath(window.location.pathname);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [route, setRoute] = useState<Route>(initialModule ? "auth" : "home");
  const [user, setUser] = useState<User | null>(null);
  const [moduleName, setModuleName] = useState<ModuleName>(
    initialModule ?? "Listening",
  );
  const [test, setTest] = useState(1);
  const [mode] = useState<"exam" | "review">("review");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [toast, setToastState] = useState("");
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [accessActive, setAccessActive] = useState(false);
  const [accessReady, setAccessReady] = useState(false);
  const [moduleAccess, setModuleAccess] = useState<
    Record<string, { active: boolean }>
  >({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [catalog, setCatalog] = useState<
    { testNumber: number; title: string }[]
  >([]);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [livePricing, setLivePricing] = useState<
    Record<string, { priceMinor: number; currency: string }>
  >({});
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const submitFeedback = async () => {
    setFeedbackBusy(true);
    setFeedbackError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: feedbackCategory,
          message: feedbackMessage,
          module: moduleName.toLowerCase(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFeedbackSent(true);
      setFeedbackMessage("");
    } catch (e) {
      setFeedbackError(
        e instanceof Error ? e.message : "Could not send your feedback.",
      );
    } finally {
      setFeedbackBusy(false);
    }
  };
  useEffect(() => {
    let gone = false;
    fetch("/api/pricing", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { plans?: { code: string; priceMinor: number; currency: string }[] } | null) => {
        if (gone || !data?.plans) return;
        const next: Record<string, { priceMinor: number; currency: string }> = {};
        for (const plan of data.plans) next[plan.code] = plan;
        setLivePricing(next);
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, []);
  const formatPrice = (code: string, fallback: string) => {
    const live = livePricing[code];
    if (!live) return fallback;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: live.currency.toUpperCase(),
      minimumFractionDigits: live.priceMinor % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(live.priceMinor / 100);
  };
  const refreshAccess = async () => {
    const response = await fetch("/api/access", { cache: "no-store" });
    if (response.status === 401) {
      setModuleAccess({});
      setAccessActive(false);
      setAccessReady(true);
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    setAccessActive(Boolean(data.active));
    setModuleAccess(data.modules || {});
    setIsAdmin(Boolean(data.isAdmin));
    setAccessReady(true);
  };
  useEffect(() => {
    if (!user) return;
    void refreshAccess().catch(() => {});
    const timer = setInterval(
      () => void refreshAccess().catch(() => {}),
      120000,
    );
    return () => clearInterval(timer);
  }, [user]);
  useEffect(() => {
    if (route !== "tests") return;
    let cancelled = false;
    setCatalog([]);
    setCatalogError("");
    setCatalogLoading(true);
    fetch(`/api/materials/${moduleName.toLowerCase()}?catalog=1`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "These tests could not be loaded. Check your module access and try again.",
          );
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setCatalog(d.tests);
      })
      .catch((e) => {
        if (!cancelled) setCatalogError(e.message);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [route, moduleName]);
  const setToast = (message: string) => {
    const legacyPlan = message.match(/^(7|15|30) days plan/);
    if (legacyPlan) {
      void startCheckout(`${legacyPlan[1]}-days`);
      return;
    }
    setToastState(message === "Demo Google account connected" ? "" : message);
  };

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const authStatus = query.get("auth");
    if (authStatus === "signin" || authStatus === "signup") {
      setAuthMode(authStatus);
      setRoute("auth");
    }
    const paymentStatus = query.get("payment");
    const checkoutSessionId = query.get("session_id");
    const accessStatus = query.get("access");
    if (authStatus === "error")
      setToast("Google sign-in failed. Check your Auth.js callback URL.");
    if (paymentStatus === "cancelled")
      setToast("Checkout cancelled. You have not been charged.");
    if (accessStatus === "subscription_required")
      setToast("An active plan is required. Choose a pack to continue.");
    if (accessStatus === "signin_required")
      setToast("Sign in and choose a plan to access practice modules.");
    if (authStatus || paymentStatus || accessStatus)
      window.history.replaceState({}, "", window.location.pathname);
    void (async () => {
      try {
        if (paymentStatus === "success" && checkoutSessionId) {
          setToast("Confirming your payment…");
          const verificationResponse = await fetch("/api/stripe/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: checkoutSessionId }),
          });
          const verification = (await verificationResponse.json()) as {
            active?: boolean;
            error?: string;
          };
          if (!verificationResponse.ok || !verification.active)
            throw new Error(
              verification.error || "Payment could not be activated.",
            );
          setAccessActive(true);
          setToast("Payment confirmed — your modules are now unlocked.");
        }

        const sessionResponse = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        if (!sessionResponse.ok) {
          throw new Error(
            "Could not check your sign-in status. Please try again.",
          );
        }
        // Auth.js returns null for signed-out visitors, including expired sessions.
        const session = (await sessionResponse.json()) as {
          user?: User | null;
        } | null;
        const sessionUser = session?.user;
        if (!sessionUser?.email) {
          const adminAccess = await fetch("/api/access", { cache: "no-store" });
          const access = await adminAccess.json();
          if (access.isAdmin) {
            setUser({ email: "passcode-admin@tcf.internal.invalid" });
            setRoute(initialModule ? moduleRoute(initialModule) : "dashboard");
          }
          return;
        }
        setUser(sessionUser);
        setRoute(initialModule ? moduleRoute(initialModule) : "dashboard");

        // The user effect performs the access check once and keeps it fresh.
      } catch (error) {
        setToast(
          error instanceof Error
            ? error.message
            : "Could not verify your access.",
        );
      }
    })();
  }, [initialModule]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!user || (route !== "dashboard" && route !== "tests")) return;
    fetch("/api/progress", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setProgressData)
      .catch(() => undefined);
  }, [route, user]);

  useEffect(() => {
    if (
      accessReady &&
      ["writing", "speaking", "tests"].includes(route) &&
      !moduleAccess[moduleName.toLowerCase()]?.active
    )
      setRoute("dashboard");
  }, [accessReady, moduleAccess, moduleName, route]);

  const logout = () => {
    void signOut({ redirect: false });
    setUser(null);
    setAccessActive(false);
    localStorage.removeItem("tcf-user");
    setRoute("home");
  };
  const openModule = (nextModule: ModuleName) => {
    if (!accessReady) {
      setToast("Checking your plan…");
      void refreshAccess().catch(() => {});
      return;
    }
    if (!moduleAccess[nextModule.toLowerCase()]?.active) {
      setToast("Choose an active plan to unlock the practice modules.");
      setRoute("home");
      setTimeout(() => document.querySelector("#pricing")?.scrollIntoView(), 0);
      return;
    }
    window.location.assign(`/${nextModule.toLowerCase()}`);
  };
  const beginReview = (selectedTest: number) => {
    setTest(selectedTest);
    if (moduleName === "Listening") {
      window.location.href = `/practice/listening/${selectedTest}`;
      return;
    }
    if (moduleName === "Reading") {
      window.location.href = `/practice/reading/${selectedTest}`;
      return;
    }
    setQuestionIndex(0);
    setAnswers({});
    setFlagged(new Set());
    setRoute("exam");
  };
  const nextQuestion = () =>
    questionIndex < questions.length - 1
      ? setQuestionIndex(questionIndex + 1)
      : setRoute("results");
  const toggleFlag = () =>
    setFlagged((current) => {
      const updated = new Set(current);
      updated.has(questionIndex)
        ? updated.delete(questionIndex)
        : updated.add(questionIndex);
      return updated;
    });
  const startCheckout = async (plan: string) => {
    if (checkoutPlan) return;
    if (!user) {
      setToast("Sign in first, then choose your plan.");
      setRoute("auth");
      return;
    }
    setCheckoutPlan(plan);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url)
        throw new Error(result.error || "Checkout could not be started.");
      window.location.assign(result.url);
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Checkout could not be started.",
      );
      setCheckoutPlan(null);
    }
  };
  const nav = (minimal = false) => (
    <nav className="nav">
      <button className="brand" onClick={() => window.location.assign("/")}>
        <span className="brand-mark" aria-hidden="true">
          TM
        </span>
        <span className="brand-copy">
          TCF <b>Material</b>
          <small>French exam preparation</small>
        </span>
      </button>
      <div className="nav-actions">
        {!minimal && (
          <>
            {/* <button
              className="nav-link"
              onClick={() => {
                setRoute("home");
                setTimeout(
                  () => document.querySelector("#features")?.scrollIntoView(),
                  0,
                );
              }}
            >
              Practice
            </button> */}
            <button
              className="nav-link"
              onClick={() => {
                window.location.href = "/clb-calculator";
              }}
            >
              CLB Calculator
            </button>
            <button
              className="nav-link"
              onClick={() => {
                setRoute("home");
                setTimeout(
                  () => document.querySelector("#pricing")?.scrollIntoView(),
                  0,
                );
              }}
            >
              Pricing
            </button>
          </>
        )}
        {user ? (
          <>
            <button
              className="nav-link account-link"
              onClick={() => setRoute("dashboard")}
            >
              Dashboard
            </button>
            <button
              className="nav-link account-link"
              onClick={() => {
                setFeedbackSent(false);
                setFeedbackError("");
                setFeedbackOpen(true);
              }}
            >
              Feedback
            </button>
            <button className="nav-link account-link" onClick={logout}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <button className="nav-signin" onClick={() => { setAuthMode("signin"); setRoute("auth"); }}>
              Sign in
            </button>
            <button className="btn nav-cta" onClick={() => { setAuthMode("signup"); setRoute("auth"); }}>
              Start practising
            </button>
          </>
        )}
      </div>
      <details
        className="mobile-nav"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button"))
            event.currentTarget.open = false;
        }}
      >
        <summary aria-label="Open navigation menu">Menu ☰</summary>
        <div className="mobile-nav-panel">
          <button
            onClick={() => {
              setRoute("home");
              setTimeout(
                () => document.querySelector("#features")?.scrollIntoView(),
                0,
              );
            }}
          >
            Practice
          </button>
          <a href="/clb-calculator">CLB Calculator</a>
          <button
            onClick={() => {
              setRoute("home");
              setTimeout(
                () => document.querySelector("#pricing")?.scrollIntoView(),
                0,
              );
            }}
          >
            Pricing
          </button>
          {user ? (
            <>
              <button onClick={() => setRoute("dashboard")}>Dashboard</button>
              <button onClick={logout}>Sign out</button>
            </>
          ) : (
            <button onClick={() => { setAuthMode("signin"); setRoute("auth"); }}>Sign in</button>
          )}
        </div>
      </details>
    </nav>
  );

  const Home = () => (
    <div className="shell">
      {nav()}
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-badge">
              <span>✦</span> The focused route to your TCF score
            </div>
            <h1>
              French practice,
              <br />
              <em>without the noise.</em>
            </h1>
            <p className="lede">
              Forty full-length TCF practice tests, clear explanations, and a
              calmer way to build exam confidence — from your first A1 question
              to C1.
            </p>
            <div className="hero-actions">
              <button
                className="btn"
                onClick={() => { setAuthMode("signup"); setRoute(user ? "dashboard" : "auth"); }}
              >
                Start practising free <span>→</span>
              </button>
              <button
                className="btn secondary"
                onClick={() =>
                  document.querySelector("#features")?.scrollIntoView()
                }
              >
                Explore the platform
              </button>
            </div>
            <div className="mini-proof">
              <span>{/* <i>✓</i> No subscription */}</span>
              <span>
                <i>✓</i> All four skills
              </span>
              <span>
                <i>✓</i> Learn at your pace
              </span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="TCF practice dashboard preview"
          >
            <div className="maple-stamp" aria-hidden="true">
              ✦
            </div>
            <div className="floating-card floating-score">
              <span>Target score</span>
              <strong>CLB 7+</strong>
              <small>On track ↑</small>
            </div>
            <div className="preview">
              <div className="preview-top">
                <span className="preview-brand">TCF Reading</span>
                <span className="preview-progress">Question 03 / 39</span>
              </div>
              <div className="question-card">
                <div className="question-meta">
                  <span className="level">A1</span>
                  <span>Reading comprehension</span>
                </div>
                <div className="passage">
                  Le train pour Lyon partira exceptionnellement voie 8.
                </div>
                <p className="preview-question">
                  Que doivent faire les voyageurs ?
                </p>
                <div className="choice">A. Acheter un billet</div>
                <div className="choice active">
                  <span>B. Changer de quai</span>
                  <b>✓</b>
                </div>
                <div className="choice">C. Appeler un taxi</div>
              </div>
              <div className="preview-footer">
                <span>Great work — that&apos;s correct!</span>
                <button>Next question →</button>
              </div>
            </div>
          </div>
        </section>
        <div className="stats-strip">
          <div>
            <strong>40</strong>
            <span>Complete practice tests</span>
          </div>
          <div>
            <strong>4</strong>
            <span>Skills in one platform</span>
          </div>
          <div>
            <strong>A1–C1</strong>
            <span>Progressive difficulty</span>
          </div>
          <div>
            <strong>699</strong>
            <span>TCF score mapping</span>
          </div>
        </div>
        
        <section className="section pricing-section" id="pricing">
          <div className="pricing-heading">
            <div className="font-semibold text-blue-600 text-2xl">
              Simple access
            </div>
            <h2 className="font-semibold">Pick the time you need</h2>
            <p className="font-semibold">
              Every plan unlocks all practice tests, instant explanations,
              transcripts, and progress reports.
            </p>
          </div>
          <div className="price-cards">
            {[
              [
                "7-days",
                "Starter",
                "7 days",
                formatPrice("7-days", "$10"),
                [
                  "All 40 practice tests",
                  "Listening and Reading",
                  "Instant answer explanations",
                  "Progress tracking",
                ],
              ],
              [
                "30-days",
                "Focused",
                "30 days",
                formatPrice("30-days", "$25"),
                [
                  "Everything in Starter",
                  "30 days of full access",
                  "Unlimited review sessions",
                  "Detailed score history",
                ],
              ],
              [
                "60-days",
                "Complete",
                "60 days",
                formatPrice("60-days", "$45"),
                [
                  "Everything in Focused",
                  "60 days of full access",
                  "Unlimited review sessions",
                  "Best value for preparation",
                ],
              ],
            ].map((plan, index) => (
              <article
                className={`price-card ${index === 2 ? "best" : ""}`}
                key={plan[0] as string}
              >
                {index === 2 && (
                  <span className="popular-badge">Best value</span>
                )}
                <div className="plan-icon" aria-hidden="true">
                  ✓
                </div>
                <span className="plan-label">{plan[1] as string} plan</span>
                <h3>{plan[2] as string}</h3>
                <div className="plan-price">
                  <strong>{plan[3] as string}</strong>
                  <span>one-time</span>
                </div>
                <ul>
                  {(plan[4] as string[]).map((feature) => (
                    <li key={feature}>
                      <span>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  className="btn plan-button"
                  disabled={checkoutPlan === plan[0]}
                  onClick={() => void startCheckout(plan[0] as string)}
                >
                  {checkoutPlan === plan[0]
                    ? "Opening checkout…"
                    : "Choose this plan"}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="features">
          <div className="section-head">
            <div>
              <div className="section-kicker">Everything you need</div>
              <h2>Master every part of the TCF.</h2>
            </div>
            <p className="text-lg max-w-xl">
              One calm, structured workspace for building the exact French
              skills your exam preparation calls for.
            </p>
          </div>
          <div className="feature-grid">
            {[
              [
                "01",
                "Listen",
                "Focused audio prompts with immediate corrections.",
                "Listening",
              ],
              [
                "02",
                "Read",
                "Authentic notices, messages, and longer texts.",
                "Reading",
              ],
              [
                "03",
                "Write",
                "Structured prompts from A1 through C1.",
                "Writing",
              ],
              [
                "04",
                "Speak",
                "Guided scenarios with clear preparation steps.",
                "Speaking",
              ],
            ].map((item) => (
              <a className="feature feature-link" href="#pricing" key={item[0]} aria-label={`${item[1]} — view pricing plans`}>
                <div className="feature-icon-row">
                  <span className="font-semibold text-xl text-blue-600">
                    {item[0]}
                  </span>
                  <ModuleIcon name={item[3] as ModuleName} />
                </div>
                <h3 className="font-semibold">{item[1]}</h3>
                <p className="text-md font-semibold">{item[2]}</p>
              </a>
            ))}
          </div>
        </section>
        <section className="level-journey" aria-label="TCF level journey">
          <div className="level-intro">
            <div className="section-kicker">Progress you can see</div>
            <h2>Grow from foundation to fluency.</h2>
            <p>
              Practice moves with you, from everyday language to confident,
              complex communication.
            </p>
          </div>
          <div className="level-track">
            {[
              ["A1", "Discover", "First essentials"],
              ["A2", "Build", "Everyday French"],
              ["B1", "Connect", "Independent use"],
              ["B2", "Express", "Confident fluency"],
              ["C1", "Master", "Advanced control"],
            ].map((level, index) => (
              <div className="level-stop" key={level[0]}>
                <span>{level[0]}</span>
                <strong>{level[1]}</strong>
                <small>{level[2]}</small>
                {index < 4 && <i />}
              </div>
            ))}
          </div>
        </section>
        <section className="study-path">
          <div className="study-path-copy">
            <div className="section-kicker">A smarter study rhythm</div>
            <h2>A clear path from first practice to test day.</h2>
            <p>
              Stop guessing what to study next. Short, focused sessions make
              progress visible and keep your preparation moving.
            </p>
            <button
              className="btn secondary"
              onClick={() => { setAuthMode("signup"); setRoute(user ? "dashboard" : "auth"); }}
            >
              Build my study plan →
            </button>
          </div>
          <div className="path-steps">
            {[
              [
                "01",
                "Choose your skill",
                "Focus on listening, reading, writing, or speaking.",
              ],
              [
                "02",
                "Practise realistically",
                "Work through exam-style questions at your own pace.",
              ],
              [
                "03",
                "Learn from feedback",
                "See corrections and understand where to improve.",
              ],
              [
                "04",
                "Track your readiness",
                "Follow your scores and prepare with confidence.",
              ],
            ].map((step) => (
              <div className="path-step" key={step[0]}>
                <span>{step[0]}</span>
                <div>
                  <h3>{step[1]}</h3>
                  <p>{step[2]}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="testimonial-section">
          <div className="testimonial-mark">“</div>
          <blockquote>
            TCF Material makes preparation feel manageable. I can see what I
            need to improve, practise it, and go into each session with a plan.
          </blockquote>
          <div className="testimonial-person">
            <span>AM</span>
            <div>
              <strong>Amélie M.</strong>
              <small>TCF learner</small>
            </div>
          </div>
        </section>
        <section className="final-cta">
          <div>
            <span>READY WHEN YOU ARE</span>
            <h2>Make French your next milestone.</h2>
          </div>
          <button
            className="btn"
            onClick={() => { setAuthMode("signup"); setRoute(user ? "dashboard" : "auth"); }}
          >
            Start practising today →
          </button>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-brand">
          <span className="brand-mark">TM</span>
          <div>
            <strong>TCF Material</strong>
            <p>
              Focused French preparation for confident exam day performance.
            </p>
          </div>
        </div>
        <div className="footer-links">
          <button
            onClick={() =>
              document.querySelector("#features")?.scrollIntoView()
            }
          >
            Practice
          </button>
          <button
            onClick={() => {
              window.location.href = "/clb-calculator";
            }}
          >
            CLB Calculator
          </button>
          <button
            onClick={() => document.querySelector("#pricing")?.scrollIntoView()}
          >
            Pricing
          </button>
          <button onClick={() => (window.location.href = "/privacy")}>
            Privacy Policy
          </button>
        </div>
        <small>© 2026 TCF Material. Made for focused French learners.</small>
      </footer>
    </div>
  );

  const Auth = () => (
    <div className="shell">
      {nav(true)}
      <AuthCards key={authMode} mode={authMode} setMode={setAuthMode} onSignedIn={(email) => {
        setUser({ email });
        setRoute(initialModule ? moduleRoute(initialModule) : "dashboard");
      }} />
    </div>
  );

  const Dashboard = () => (
    <div className="shell">
      {nav()}
      <main className="dashboard student-dashboard">
        <section className="student-welcome" aria-labelledby="student-title">
          <div className="student-welcome-copy">
            <span className="student-kicker">Your French journey</span>
            <h1 id="student-title">Bonjour, {user?.email?.split("@")[0]}.</h1>
            <p>
              A small session today is the easiest way to keep your TCF goal
              moving.
            </p>
            <p className={`plan-chip ${accessActive ? "on" : "off"}`}>
              {accessActive
                ? "Your practice plan is active"
                : "Choose a plan to unlock practice"}
            </p>
          </div>
          <div className="daily-card">
            <span className="daily-card-label">TODAY&apos;S FOCUS</span>
            <div className="daily-card-heading">
              <span aria-hidden="true">◌</span>
              <div>
                <strong>Listening practice</strong>
                <small>Build confidence with exam-style audio</small>
              </div>
            </div>
            <button className="btn" onClick={() => openModule("Listening")}>
              Continue learning <span>→</span>
            </button>
          </div>
        </section>

        <section className="learning-glance" aria-label="Learning progress">
          <div className="glance-intro">
            <span className="student-kicker">Your progress</span>
            <h2>Keep your momentum.</h2>
          </div>
          <div className="overview-stats student-stats">
            <div>
              <strong>{progressData?.overall.attempted ?? 0}</strong>
              <span>tests attempted</span>
            </div>
            <div>
              <strong>{progressData?.overall.completed ?? 0}</strong>
              <span>tests completed</span>
            </div>
            <div>
              <strong>{progressData?.overall.average ?? 0}%</strong>
              <span>current average</span>
            </div>
          </div>
        </section>

        <section className="skill-path" aria-labelledby="skill-path-title">
          <div className="dashboard-section-head">
            <div>
              <span className="student-kicker">Practice path</span>
              <h2 id="skill-path-title">Choose what to practise</h2>
            </div>
            <p>
              Move between skills whenever you need. Your results stay together
              here.
            </p>
          </div>
          {isAdmin && (
            <a
              className="btn"
              href="/admin"
              style={{ marginBottom: 24, display: "inline-flex" }}
            >
              Open admin workspace →
            </a>
          )}
          <div className="module-grid">
            {[
              ["Listening", "Audio comprehension", "Train your ear"],
              ["Reading", "Text comprehension", "Read with precision"],
              ["Writing", "Guided writing prompts", "Shape your ideas"],
              ["Speaking", "Guided speaking prompts", "Speak with ease"],
            ].map((item) => (
              <button
                className="module"
                key={item[0]}
                onClick={() => openModule(item[0] as ModuleName)}
              >
                <ModuleIcon name={item[0] as ModuleName} />
                <b>
                  {item[0]}{" "}
                  {!moduleAccess[item[0].toLowerCase()]?.active && (
                    <span aria-label="Locked" title="Module access required">
                      🔒
                    </span>
                  )}
                </b>
                <small>{item[1]}</small>
                <span className="module-prompt">
                  {item[2]} <i>→</i>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="module-overviews-section" aria-label="Score trends">
          <div className="dashboard-section-head">
            <div>
              <span className="student-kicker">Review</span>
              <h2>Your score story</h2>
            </div>
            <p>Completed attempts reveal the areas to revisit next.</p>
          </div>
          <div className="module-overviews">
            <ModuleOverview
              name="Listening"
              data={progressData?.modules.listening}
              onOpen={() => openModule("Listening")}
            />
            <ModuleOverview
              name="Reading"
              data={progressData?.modules.reading}
              onOpen={() => openModule("Reading")}
            />
          </div>
        </section>
      </main>
    </div>
  );

  const Tests = () => {
    const moduleProgress =
      progressData?.modules[
        moduleName.toLowerCase() as "listening" | "reading"
      ];
    const completed = moduleProgress?.completed ?? 0;
    const attempted = moduleProgress?.attempted ?? 0;
    const average = moduleProgress?.average ?? 0;
    const activeTest =
      moduleProgress?.tests.find((item) => item.status === "in_progress")
        ?.testNumber ??
      catalog.find(
        ({ testNumber }) =>
          !moduleProgress?.tests.some(
            (item) =>
              item.testNumber === testNumber && item.status === "completed",
          ),
      )?.testNumber ??
      catalog[0]?.testNumber;
    return (
      <div className="shell">
        {nav()}
        <main className="dashboard module-library">
          <button
            className="library-back"
            onClick={() => setRoute("dashboard")}
          >
            <span aria-hidden="true">←</span> Back to dashboard
          </button>
          <section className="module-journey" aria-labelledby="module-title">
            <div className="module-journey-copy">
              <span className="student-kicker">{moduleName} practice</span>
              <h1 id="module-title">
                Build your {moduleName.toLowerCase()} confidence.
              </h1>
              <p>
                Short, realistic practice tests with feedback after every
                attempt. Pick up where you left off or choose any test below.
              </p>
              <div className="journey-metrics" aria-label="Module progress">
                <span>
                  <strong>{completed}</strong> completed
                </span>
                <span>
                  <strong>{average}%</strong> average
                </span>
                <span>
                  <strong>{catalog.length}</strong> available
                </span>
              </div>
            </div>
            <aside className="next-lesson" aria-label="Next recommended test">
              <span className="next-lesson-kicker">YOUR NEXT STEP</span>
              <div className="next-lesson-icon">
                <ModuleIcon name={moduleName} />
              </div>
              <div>
                <small>{moduleName} test</small>
                <strong>Test {activeTest ?? "—"}</strong>
                <p>
                  {completed
                    ? "Keep your progress moving."
                    : "Start your first practice test."}
                </p>
              </div>
              <button
                className="btn"
                disabled={!activeTest}
                onClick={() => activeTest && beginReview(activeTest)}
              >
                {attempted ? "Continue test" : "Start now"} <span>→</span>
              </button>
            </aside>
          </section>

          <section className="library-progress" aria-label="Progress summary">
            <div>
              <span className="student-kicker">Your momentum</span>
              <h2>
                {completed
                  ? "You’re building a strong routine."
                  : "Your first step starts here."}
              </h2>
            </div>
            <div className="library-progress-bar" aria-hidden="true">
              <i
                style={{
                  width: `${catalog.length ? (completed / catalog.length) * 100 : 0}%`,
                }}
              />
            </div>
            <p>
              <strong>{completed}</strong> of {catalog.length} tests completed
            </p>
          </section>

          {catalogLoading ? (
            <section
              className="catalog-loader"
              role="status"
              aria-live="polite"
            >
              <div className="catalog-loader-mark" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <div>
                <strong>
                  Preparing your {moduleName.toLowerCase()} practice
                </strong>
                <p>Finding your available tests and saved progress…</p>
              </div>
            </section>
          ) : (
            <>
              {catalogError && <p role="alert">{catalogError}</p>}
              {!catalogError && catalog.length === 0 && (
                <p>No published tests are currently available.</p>
              )}
              <section
                className="test-library"
                aria-labelledby="test-library-title"
              >
                <div className="test-library-head">
                  <div>
                    <span className="student-kicker">Practice library</span>
                    <h2 id="test-library-title">Choose a test</h2>
                  </div>
                  <div
                    className="test-status-key"
                    aria-label="Test status legend"
                  >
                    <span>
                      <i className="legend-completed" /> Completed
                    </span>
                    <span>
                      <i className="legend-progress" /> In progress
                    </span>
                  </div>
                </div>
                <div className="tests-grid module-tests-grid">
                  {catalog.map(({ testNumber }, index) => {
                    const testProgress = moduleProgress?.tests.find(
                      (item) => item.testNumber === testNumber,
                    );
                    return (
                      <button
                        className={`test ${testProgress?.status === "completed" ? "done" : testProgress?.status === "in_progress" ? "in-progress" : ""}`}
                        key={index}
                        onClick={() => beginReview(testNumber)}
                      >
                        <small>Test</small>
                        {testNumber}
                        {testProgress?.status === "completed" && (
                          <small>✓ {testProgress.percentage}%</small>
                        )}
                        {testProgress?.status === "in_progress" && (
                          <small>In progress</small>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    );
  };

  const Exam = () => {
    const question = questions[questionIndex];
    const selected = answers[questionIndex];
    return (
      <div className="shell">
        {nav(true)}
        <div className="progress">
          <i
            style={{
              width: `${((questionIndex + 1) / questions.length) * 100}%`,
            }}
          />
        </div>
        <main className="exam">
          <aside className="rail">
            <div className="rail-top">
              <b>
                {moduleName} · Test {test}
              </b>
              <p className="user-note">
                {Object.keys(answers).length}/{questions.length} answered
              </p>
            </div>
            <div className="q-nav">
              {questions.map((_, index) => (
                <button
                  type="button"
                  className={`q-dot ${index === questionIndex ? "active" : ""} ${answers[index] !== undefined ? "answered" : ""}`}
                  key={index}
                  onPointerDown={() => setQuestionIndex(index)}
                  onClick={() => setQuestionIndex(index)}
                >
                  Q{index + 1}
                </button>
              ))}
            </div>
          </aside>
          <section className="exam-main">
            <div className="exam-top">
              <span className="level">{question.level}</span>
              <span className="mono">
                Q{questionIndex + 1}/{questions.length}
                {mode === "exam" && " · 34:42"}
              </span>
            </div>
            <nav
              className="reading-jump exam-jump"
              aria-label="Jump to any question"
            >
              {questions.map((_, index) => (
                <button
                  type="button"
                  key={index}
                  className={`${index === questionIndex ? "current" : ""} ${answers[index] !== undefined ? "answered" : ""}`}
                  onPointerDown={() => setQuestionIndex(index)}
                  onClick={() => setQuestionIndex(index)}
                >
                  {index + 1}
                </button>
              ))}
            </nav>
            <div className="prompt">
              {question.prompt.split("\n").map((line, index) => (
                <span key={line}>
                  {index > 0 && <br />}
                  {line}
                </span>
              ))}
            </div>
            <h3>{question.ask}</h3>
            <div className="answers">
              {question.answers.map((answerText, index) => {
                let answerClass = selected === index ? "selected" : "";
                if (mode === "review" && selected !== undefined)
                  answerClass +=
                    index === question.correct
                      ? " correct"
                      : selected === index
                        ? " wrong"
                        : "";
                return (
                  <button
                    className={`answer ${answerClass}`}
                    key={answerText}
                    onClick={() =>
                      setAnswers((current) => ({
                        ...current,
                        [questionIndex]: index,
                      }))
                    }
                  >
                    <b>{"ABCD"[index]}.</b>&nbsp;&nbsp;{answerText}
                  </button>
                );
              })}
            </div>
            {mode === "review" && selected !== undefined && (
              <p className="user-note feedback">
                {selected === question.correct
                  ? "Correct — well read."
                  : `The key detail in the prompt points to answer ${"ABCD"[question.correct]}.`}
              </p>
            )}
            <div className="exam-actions">
              <button
                className="btn ghost"
                disabled={questionIndex === 0}
                onClick={() => setQuestionIndex(Math.max(0, questionIndex - 1))}
              >
                ← Previous
              </button>
              <button className="btn ghost" onClick={toggleFlag}>
                {flagged.has(questionIndex) ? "⚑ Flagged" : "⚐ Flag for review"}
              </button>
              <button className="btn" onClick={nextQuestion}>
                {questionIndex === questions.length - 1
                  ? "Finish test"
                  : "Next question →"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  };

  const Results = () => {
    const correct = questions.filter(
      (question, index) => answers[index] === question.correct,
    ).length;
    const answered = Object.keys(answers).length;
    const percentage = answered ? Math.round((correct / answered) * 100) : 0;
    const estimatedLevel =
      correct / questions.length > 0.8
        ? "B2"
        : correct / questions.length > 0.55
          ? "B1"
          : "A2";
    return (
      <div className="shell">
        {nav()}
        <main className="dashboard">
          <div className="result-card">
            <div className="eyebrow">
              Test {test} · {mode} mode
            </div>
            <h1 className="result-title">Test complete.</h1>
            <div className="score">{percentage}%</div>
            <p className="user-note">of answered questions</p>
            <div className="score-grid">
              <div>
                <strong className="correct-text">{correct}</strong>
                <small>correct</small>
              </div>
              <div>
                <strong className="wrong-text">{answered - correct}</strong>
                <small>wrong</small>
              </div>
              <div>
                <strong>{questions.length - answered}</strong>
                <small>skipped</small>
              </div>
            </div>
            <div className="score-estimate">
              <span className="mono user-note">
                TCF score estimate ·{" "}
                {Math.round((correct / questions.length) * 699)} pts
              </span>
              <div className="level-bar" />
            </div>
            <h2 className="level-title">Estimated level: {estimatedLevel}</h2>
            <div className="hero-actions centered">
              <button
                className="btn secondary"
                onClick={() => {
                  setAnswers({});
                  setQuestionIndex(0);
                  setRoute("exam");
                }}
              >
                Retry test
              </button>
              <button className="btn" onClick={() => setRoute("tests")}>
                All tests →
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  };

  const ComingSoon = () => (
    <div className="shell">
      {nav()}
      <main className="dashboard">
        <section className="result-card coming-soon">
          <div className="coming-soon-icon" aria-hidden="true">
            {moduleName === "Writing" ? "✎" : "◉"}
          </div>
          <div className="eyebrow">{moduleName} module</div>
          <h1>Coming soon.</h1>
          <p className="user-note">
            Your active package includes {moduleName}. Its practice material has
            not been added yet. Listening and Reading are ready now, and this
            module will unlock automatically as soon as its tests are published.
          </p>
          <div className="hero-actions centered">
            <button
              className="btn secondary"
              onClick={() => setRoute("dashboard")}
            >
              ← Back to dashboard
            </button>
            <button className="btn" onClick={() => openModule("Listening")}>
              Practice Listening →
            </button>
          </div>
        </section>
      </main>
    </div>
  );

  const views: Record<Route, React.ReactNode> = {
    home: <Home />,
    auth: Auth(),
    dashboard: user ? <Dashboard /> : <Auth />,
    tests: <Tests />,
    exam: <Exam />,
    results: <Results />,
    writing: <WritingLibrary onBack={() => setRoute("dashboard")} nav={nav} />,
    speaking: (
      <SpeakingLibrary onBack={() => setRoute("dashboard")} nav={nav} />
    ),
    comingSoon: <ComingSoon />,
  };
  return (
    <>
      {views[route]}
      <div
        id="toast"
        role="status"
        aria-live="polite"
        className={toast ? "show" : ""}
      >
        {toast}
      </div>
      {feedbackOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFeedbackOpen(false);
          }}
        >
          <div className="modal feedback-modal" role="dialog" aria-modal="true">
            {feedbackSent ? (
              <>
                <h2>Thanks for letting us know.</h2>
                <p className="feedback-note">
                  We've received your report and will look into it.
                </p>
                <button className="btn" onClick={() => setFeedbackOpen(false)}>
                  Close
                </button>
              </>
            ) : (
              <>
                <h2>Report a problem</h2>
                <p className="feedback-note">
                  Tell us what's going wrong — a bug, missing content, a
                  payment issue, or anything else.
                </p>
                <div className="field">
                  <label>What kind of problem is it?</label>
                  <select
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value)}
                  >
                    <option value="bug">Something's broken</option>
                    <option value="content">A test or question issue</option>
                    <option value="payment">Payment or access issue</option>
                    <option value="other">Something else</option>
                  </select>
                </div>
                <div className="field">
                  <label>What happened?</label>
                  <textarea
                    className="feedback-textarea"
                    maxLength={2000}
                    rows={5}
                    placeholder="Describe the problem you ran into…"
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                  />
                </div>
                {feedbackError && (
                  <p className="feedback-error" role="alert">
                    {feedbackError}
                  </p>
                )}
                <div className="feedback-actions">
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => setFeedbackOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn"
                    type="button"
                    disabled={feedbackBusy || feedbackMessage.trim().length < 5}
                    onClick={() => void submitFeedback()}
                  >
                    {feedbackBusy ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ScoreChart({
  compact = false,
  scores = [],
  label = "Score trend",
}: {
  compact?: boolean;
  scores?: number[];
  label?: string;
}) {
  const points = scores
    .map(
      (score, index) =>
        `${scores.length === 1 ? 50 : 5 + index * (90 / (scores.length - 1))},${95 - score * 0.75}`,
    )
    .join(" ");
  return (
    <div className={`chart score-trend ${compact ? "compact" : ""}`}>
      <span className="score-trend-label">
        {label} · last 5 completed attempts
      </span>
      {scores.length ? (
        <svg
          className="score-chart"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-label={`${label}: ${scores.join(", ")} percent`}
        >
          <polyline points={points} />
          {scores.map((score, index) => (
            <circle
              key={index}
              cx={
                scores.length === 1
                  ? 50
                  : 5 + index * (90 / (scores.length - 1))
              }
              cy={95 - score * 0.75}
              r="1.8"
            />
          ))}
        </svg>
      ) : (
        <p className="chart-empty">
          Complete a test to start your score trend.
        </p>
      )}
    </div>
  );
}
function ModuleOverview({
  name,
  data,
  onOpen,
}: {
  name: "Listening" | "Reading";
  data?: ModuleProgressData;
  onOpen: () => void;
}) {
  return (
    <article className="module-overview">
      <div className="module-overview-head">
        <div>
          <span className="font-bold text-blue-600">{name}</span>
          <h3 className="pt-3">{data?.average ?? 0}% average</h3>
        </div>
        <button className="btn secondary" onClick={onOpen}>
          View tests →
        </button>
      </div>
      <ScoreChart compact scores={data?.recentScores} label={name} />
      <div className="overview-meta">
        <span>
          <strong>{data?.attempted ?? 0}</strong>{" "}
          <p className="text-md font-medium text-gray-500">attempted</p>
        </span>
        <span>
          <strong>{data?.completed ?? 0}</strong>{" "}
          <p className="text-md">completed</p>
        </span>
        <span>
          <strong>{data?.best ?? 0}%</strong> <p className="text-md">best</p>
        </span>
      </div>
    </article>
  );
}

function ModuleIcon({ name }: { name: ModuleName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span className="module-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" {...common}>
        {name === "Listening" && (
          <>
            <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
            <path d="M4 14a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2zM20 14a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z" />
          </>
        )}
        {name === "Reading" && (
          <>
            <path d="M3.5 5.5A3.5 3.5 0 0 1 7 4h4v16H7a3.5 3.5 0 0 0-3.5 1z" />
            <path d="M20.5 5.5A3.5 3.5 0 0 0 17 4h-4v16h4a3.5 3.5 0 0 1 3.5 1z" />
          </>
        )}
        {name === "Writing" && (
          <>
            <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16z" />
            <path d="m14.5 6.7 3 3M4 20h6" />
          </>
        )}
        {name === "Speaking" && (
          <>
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
          </>
        )}
      </svg>
    </span>
  );
}
