"use client";
import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ContentRecord,
  emptyQuestion,
  GrantRecord,
  MaterialQuestion,
  MaterialTest,
  MODULES,
  ModuleKey,
  StudentRecord,
} from "@/lib/admin/types";
import { questionIssues } from "@/lib/admin/import";

type Section = "overview" | "students" | "content" | "imports" | "activity";
type Activity = {
  id: string;
  action: string;
  detail: string;
  actor: string;
  createdAt: string;
};
type Summary = {
  activity: Activity[];
  students: { status: string; count: number }[];
  content: { module: ModuleKey; status: string; count: number }[];
};
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const date = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Lifetime";
const dateTime = (s: string | null) =>
  s
    ? new Date(s).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Lifetime";
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    students: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5" />
      </>
    ),
    content: (
      <>
        <path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v16h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4zM12 5v16" />
      </>
    ),
    imports: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
      </>
    ),
    activity: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    listening: (
      <>
        <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
        <rect x="3" y="12" width="4" height="8" rx="2" />
        <rect x="17" y="12" width="4" height="8" rx="2" />
      </>
    ),
    reading: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </>
    ),
    writing: (
      <>
        <path d="m4 16-1 5 5-1L20 8l-4-4zM14 6l4 4M14 21h7" />
      </>
    ),
    speaking: (
      <>
        <rect x="9" y="2" width="6" height="13" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.content}
    </svg>
  );
}
let modalCount = 0;
let priorBodyOverflow = "";
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    if (modalCount === 0) priorBodyOverflow = document.body.style.overflow;
    modalCount++;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      modalCount--;
      if (modalCount === 0) document.body.style.overflow = priorBodyOverflow;
      if (prior?.isConnected) prior.focus();
    };
  }, []);
  return (
    <div
      className="admin-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`admin-modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const nodes = ref.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
            );
            if (!nodes?.length) return;
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === ref.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="admin-modal-head">
          <h2>{title}</h2>
          <button
            className="admin-icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
async function api(url: string, body?: unknown) {
  const response = await fetch(url, {
    cache: "no-store",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}
export default function AdminWorkspace({ name }: { name: string }) {
  const [section, setSection] = useState<Section>("overview");
  const [mobile, setMobile] = useState(false);
  const [module, setModule] = useState<ModuleKey>("listening");
  const [summary, setSummary] = useState<Summary>({
    activity: [],
    students: [],
    content: [],
  });
  const [tests, setTests] = useState<ContentRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<MaterialTest | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [questionSelection, setQuestionSelection] = useState<Set<string>>(
    new Set(),
  );
  const [confirm, setConfirm] = useState<{
    title: string;
    detail: string;
    run: () => Promise<void>;
  } | null>(null);
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [paid, setPaid] = useState<{ expiresAt: string }[]>([]);
  const [attempts, setAttempts] = useState<
    { status: string; percentage: number | null }[]
  >([]);
  const [grantModules, setGrantModules] = useState<Set<ModuleKey>>(new Set());
  const [duration, setDuration] = useState("24");
  const [hours, setHours] = useState("1");
  const [kind, setKind] = useState("grant");
  const [reason, setReason] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [staged, setStaged] = useState<MaterialTest[]>([]);
  const [fileName, setFileName] = useState("");
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [destination, setDestination] = useState(1);
  const [stageIndex, setStageIndex] = useState(0);
  const [publishImport, setPublishImport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nav = (next: Section) => {
    if (next === "imports" && staged.length) setModule(staged[0].module);
    setSection(next);
    setMobile(false);
    setSearch("");
    setStatus("all");
    setSelected(new Set());
    setError("");
    setOffset(0);
  };
  const report = (e: unknown) =>
    setError(e instanceof Error ? e.message : "Please try again.");
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };
  const refreshSummary = async () => {
    setSummary(await api("/api/admin/activity"));
  };
  const refreshTests = async () => {
    setTests((await api(`/api/admin/content?module=${module}`)).tests);
  };
  useEffect(() => {
    let gone = false;
    setLoading(true);
    setError("");
    setSelected(new Set());
    const load = async () => {
      if (section === "overview" || section === "activity") {
        const d = await api("/api/admin/activity");
        if (!gone) setSummary(d);
      }
      if (section === "content" || section === "imports") {
        const d = await api(`/api/admin/content?module=${module}`);
        if (!gone) setTests(d.tests);
      }
      if (section === "students") {
        const d = await api(
          `/api/admin/students?q=${encodeURIComponent(search)}&offset=${offset}`,
        );
        if (!gone) {
          setStudents(d.students);
          setHasMore(d.hasMore);
        }
      }
    };
    const timer = setTimeout(
      () =>
        void load()
          .catch((e) => {
            if (!gone) report(e);
          })
          .finally(() => {
            if (!gone) setLoading(false);
          }),
      section === "students" ? 200 : 0,
    );
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [section, module, search, offset]);
  useEffect(() => {
    const verify = async () => {
      try {
        const response = await fetch("/api/admin/session", {
          cache: "no-store",
        });
        if (response.ok && !(await response.json()).authenticated)
          window.location.replace("/admin");
      } catch {
        /* Retry on the next interval. */
      }
    };
    const timer = setInterval(() => void verify(), 30000);
    window.addEventListener("focus", verify);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", verify);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const filtered = tests.filter(
    (t) =>
      (status === "all" || t.status === status) &&
      `${t.title} ${t.testNumber}`.toLowerCase().includes(search.toLowerCase()),
  );
  const toggle = (id: string) =>
    setSelected((old) => {
      const next = new Set(old);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const save = async (
    items: MaterialTest[],
    mode: "append" | "replace" = "replace",
    versions?: Record<string, number>,
  ) => {
    await api("/api/admin/content", {
      module,
      tests: items,
      mode,
      versions:
        versions ||
        Object.fromEntries(
          tests.map((t) => [`${t.module}:${t.testNumber}`, t.version]),
        ),
    });
    await refreshTests();
    setSelected(new Set());
    setNotice(`${items.length} test${items.length === 1 ? "" : "s"} saved.`);
  };
  const bulk = (next: MaterialTest["status"]) => {
    const items = tests
      .filter((t) => selected.has(t.id))
      .map((t) => ({ ...t, status: next }));
    setConfirm({
      title: `${next === "archived" ? "Archive" : next === "published" ? "Publish" : "Unpublish"} ${items.length} tests?`,
      detail:
        next === "archived"
          ? "These tests will be removed from the student library. Their content and previous versions are retained."
          : next === "published"
            ? "The selected tests will become available to students with module access. Questions must pass validation."
            : "These tests will become drafts and will no longer appear in the student library.",
      run: async () => {
        await save(items);
      },
    });
  };
  const edit = (t: MaterialTest, version = 0) => {
    setEditor(structuredClone(t));
    setEditorVersion(version);
    setQuestionSelection(new Set());
    setError("");
  };
  const openStudent = async (s: StudentRecord) => {
    setStudent(s);
    setGrants([]);
    setPaid([]);
    setAttempts([]);
    setGrantModules(new Set());
    setReason("");
    await run(async () => {
      const d = await api(`/api/admin/students?id=${s.id}`);
      setGrants(d.grants);
      setPaid(d.subscriptions);
      setAttempts(d.attempts);
    });
  };
  const updateStudent = async (body: unknown) => {
    await api("/api/admin/students", body);
    if (student) {
      const d = await api(`/api/admin/students?id=${student.id}`);
      setGrants(d.grants);
      setPaid(d.subscriptions);
    }
    setNotice("Student access updated.");
  };
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStaged([]);
    setStageIndex(0);
    setPublishImport(false);
    await run(async () => {
      const form = new FormData();
      form.set("file", file);
      form.set("module", module);
      form.set("testNumber", String(destination));
      const r = await fetch("/api/admin/import", {
        method: "POST",
        body: form,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setStaged(d.tests);
      setNotice(
        `${d.tests.length} test(s) extracted. Review the questions before importing.`,
      );
    });
    e.target.value = "";
  };
  const exportTemplate = () => {
    const template = {
      tests: [
        {
          testNumber: 1,
          title: `${label(module)} Test 1`,
          questions: [
            {
              prompt: "Your question in French",
              passage: "Optional reading passage",
              options:
                module === "reading" || module === "listening"
                  ? ["First answer", "Second answer"]
                  : [],
              correct:
                module === "reading" || module === "listening" ? "A" : "",
              audioUrl:
                module === "listening"
                  ? "https://your-media-host.example/audio.mp3"
                  : "",
              task: module === "speaking" ? 2 : 1,
              referenceAnswer: "Model answer or correction",
              category: "General",
            },
          ],
        },
      ],
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(template, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `tcf-${module}-template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const totalStudents = summary.students.reduce((s, r) => s + r.count, 0);
  const published = summary.content
    .filter((r) => r.status === "published")
    .reduce((s, r) => s + r.count, 0);
  const drafts = summary.content
    .filter((r) => r.status === "draft")
    .reduce((s, r) => s + r.count, 0);
  const moduleTabs = (
    <div className="admin-module-tabs" aria-label="Choose module">
      {MODULES.map((m) => (
        <button
          key={m}
          className={module === m ? "active" : ""}
          aria-pressed={module === m}
          disabled={busy || Boolean(staged.length)}
          onClick={() => {
            setModule(m);
            setSearch("");
            setStatus("all");
            setSelected(new Set());
          }}
        >
          <Icon name={m} />
          {label(m)}
        </button>
      ))}
    </div>
  );
  const activityList = (full = false) => (
    <div className="admin-activity-list">
      {summary.activity.length ? (
        summary.activity.slice(0, full ? 50 : 5).map((a) => (
          <div className="admin-activity-row" key={a.id}>
            <span className="admin-activity-dot">
              <Icon name="check" size={16} />
            </span>
            <div>
              <strong>{a.action}</strong>
              <p>{a.detail}</p>
              {full && <small>{a.actor}</small>}
            </div>
            <time>{dateTime(a.createdAt)}</time>
          </div>
        ))
      ) : (
        <div className="admin-empty">
          <Icon name="activity" size={30} />
          <h3>A clear history, from day one</h3>
          <p>Content and access changes will appear here as your team works.</p>
        </div>
      )}
    </div>
  );
  return (
    <div className="admin-shell">
      {mobile && (
        <button
          className="admin-mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        inert={Boolean(editor || student || confirm)}
        className={`admin-sidebar ${mobile ? "open" : ""}`}
      >
        <a
          className="admin-logo"
          href="/admin"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="admin-brand-mark">
            tcf<span>•</span>
          </span>
          <span>
            material<span className="admin-logo-caption">ADMIN WORKSPACE</span>
          </span>
        </a>
        <div className="admin-workspace-label">
          <span className="admin-status-dot" /> Platform management
        </div>
        <p className="admin-nav-caption">WORKSPACE</p>
        <nav>
          {(
            [
              ["overview", "Overview"],
              ["students", "Students & access"],
              ["content", "Content library"],
              ["imports", "Import materials"],
              ["activity", "Activity history"],
            ] as [Section, string][]
          ).map(([key, title]) => (
            <button
              className={section === key ? "active" : ""}
              key={key}
              onClick={() => nav(key)}
              aria-current={section === key ? "page" : undefined}
            >
              <Icon name={key} />
              <span>{title}</span>
              {section === key && <i />}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-help-card">
            <Icon name="lock" />
            <strong>Everything in your hands.</strong>
            <p>Manage content and give every student the right access.</p>
          </div>
          <a href="/" target="_blank" rel="noopener noreferrer">
            <Icon name="arrow" /> Open student website
          </a>
          <div className="admin-account">
            <span>{name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{name}</strong>
              <small>Administrator · Full access</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="admin-main" inert={Boolean(editor || student || confirm)}>
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <button
              className="admin-icon-button admin-mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Icon name="menu" />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>
              {
                {
                  overview: "Overview",
                  students: "Students & access",
                  content: "Content library",
                  imports: "Import materials",
                  activity: "Activity history",
                }[section]
              }
            </strong>
          </div>
          <div className="admin-topbar-right">
            <span className="admin-pill">
              <span className="admin-status-dot" />
              Administrator
            </span>
            <span className="admin-avatar">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <button
              className="admin-button"
              onClick={() =>
                void run(async () => {
                  const response = await fetch("/api/admin/session", {
                    method: "DELETE",
                  });
                  if (!response.ok)
                    throw new Error(
                      "Could not lock the panel. Please try again.",
                    );
                  window.location.replace("/admin");
                })
              }
            >
              Lock panel
            </button>
          </div>
        </header>
        <main className="admin-body">
          {error && (
            <div role="alert" className="admin-alert error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="admin-alert success">
              {notice}
            </div>
          )}
          {section === "overview" && (
            <>
              <div className="admin-page-heading">
                <div>
                  <p className="admin-eyebrow">YOUR PLATFORM AT A GLANCE</p>
                  <h1>
                    Welcome back, {name} <span className="admin-wave">✦</span>
                  </h1>
                  <p>A little clarity. More room to help your students grow.</p>
                </div>
                <button
                  className="admin-button primary"
                  onClick={() => nav("imports")}
                >
                  <Icon name="plus" />
                  Import materials
                </button>
              </div>
              <div className="admin-stat-grid">
                {[
                  [
                    "Registered students",
                    totalStudents,
                    "students",
                    "Your learning community",
                  ],
                  [
                    "Published collections",
                    published,
                    "content",
                    "Available to eligible students",
                  ],
                  [
                    "Draft collections",
                    drafts,
                    "writing",
                    "Ready for your next review",
                  ],
                  [
                    "Learning modules",
                    4,
                    "overview",
                    "Listening, reading, writing, speaking",
                  ],
                ].map(([title, value, icon, caption], i) => (
                  <div className="admin-stat" key={String(title)}>
                    <div>
                      <span>{title}</span>
                      <span className={`admin-stat-icon tone-${i}`}>
                        <Icon name={String(icon)} />
                      </span>
                    </div>
                    <strong>{loading ? "—" : value}</strong>
                    <small>{caption}</small>
                  </div>
                ))}
              </div>
              <section className="admin-feature">
                <div>
                  <span className="admin-feature-label">
                    BUILT FOR BETTER LEARNING
                  </span>
                  <h2>
                    Good content.
                    <br />
                    Great possibilities.
                  </h2>
                  <p>
                    Keep every practice session fresh. Add a question,
                    <br className="desktop-break" /> refine a test, or bring in
                    a whole new collection.
                  </p>
                  <button
                    className="admin-button"
                    onClick={() => nav("content")}
                  >
                    Manage your content <Icon name="arrow" size={18} />
                  </button>
                </div>
                <div className="admin-feature-art" aria-hidden="true">
                  <div className="admin-orbit orbit-one" />
                  <div className="admin-orbit orbit-two" />
                  <div className="admin-art-card">
                    <span className="admin-art-icon">
                      <Icon name="content" size={30} />
                    </span>
                    <div>
                      <span>THE NEXT CHAPTER</span>
                      <strong>Learning, elevated.</strong>
                      <div className="admin-art-lines">
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                    <span className="admin-art-check">
                      <Icon name="check" />
                    </span>
                  </div>
                  <span className="admin-art-spark">✦</span>
                  <span className="admin-art-mini">
                    <Icon name="speaking" /> Made to practise
                  </span>
                </div>
              </section>
              <div className="admin-section-title">
                <div>
                  <h2>Your learning library</h2>
                  <p>Four skills. One place to manage them.</p>
                </div>
                <button
                  className="admin-text-button"
                  onClick={() => nav("content")}
                >
                  View library <Icon name="arrow" size={16} />
                </button>
              </div>
              <div className="admin-skill-grid">
                {MODULES.map((m, i) => (
                  <button
                    className="admin-skill-card"
                    key={m}
                    onClick={() => {
                      setModule(m);
                      nav("content");
                    }}
                  >
                    <span className={`admin-skill-icon tone-${i}`}>
                      <Icon name={m} size={24} />
                    </span>
                    <h3>{label(m)}</h3>
                    <p>
                      {
                        [
                          "Audio comprehension",
                          "Text comprehension",
                          "Written expression",
                          "Spoken expression",
                        ][i]
                      }
                    </p>
                    <div>
                      <span>
                        {summary.content
                          .filter(
                            (c) => c.module === m && c.status === "published",
                          )
                          .reduce((s, c) => s + c.count, 0)}{" "}
                        published collections
                      </span>
                      <Icon name="arrow" size={18} />
                    </div>
                  </button>
                ))}
              </div>
              <div className="admin-overview-bottom">
                <section className="admin-panel">
                  <div className="admin-panel-heading">
                    <h2>Recent activity</h2>
                    <button
                      className="admin-text-button"
                      onClick={() => nav("activity")}
                    >
                      View all <Icon name="arrow" size={16} />
                    </button>
                  </div>
                  {activityList()}
                </section>
                <section className="admin-panel admin-access-callout">
                  <span className="admin-skill-icon tone-2">
                    <Icon name="lock" size={24} />
                  </span>
                  <h2>Open the right doors.</h2>
                  <p>
                    Give a student access to selected modules, for an hour or a
                    lifetime. You decide.
                  </p>
                  <button
                    className="admin-button"
                    onClick={() => nav("students")}
                  >
                    Manage student access <Icon name="arrow" size={16} />
                  </button>
                  <small>Locked modules stay visible to students.</small>
                </section>
              </div>
            </>
          )}
          {section === "content" && (
            <>
              <div className="admin-page-heading">
                <div>
                  <p className="admin-eyebrow">
                    CURATE THE LEARNING EXPERIENCE
                  </p>
                  <h1>Content library</h1>
                  <p>
                    One question or an entire collection. Make every update
                    count.
                  </p>
                </div>
                <div className="admin-actions">
                  <button
                    className="admin-button"
                    onClick={() => nav("imports")}
                  >
                    <Icon name="imports" />
                    Import
                  </button>
                  <button
                    className="admin-button primary"
                    disabled={loading}
                    onClick={() =>
                      edit({
                        module,
                        testNumber:
                          Math.max(0, ...tests.map((t) => t.testNumber)) + 1,
                        title: `${label(module)} Test ${Math.max(0, ...tests.map((t) => t.testNumber)) + 1}`,
                        status: "draft",
                        questions: [],
                      })
                    }
                  >
                    <Icon name="plus" />
                    New test
                  </button>
                </div>
              </div>
              {moduleTabs}
              <div className="admin-panel">
                <div className="admin-library-toolbar">
                  <label className="admin-search">
                    <Icon name="search" />
                    <input
                      aria-label="Search tests"
                      placeholder="Search by title or test number…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <label className="admin-filter">
                    <span>Status</span>
                    <select
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setSelected(new Set());
                      }}
                    >
                      <option value="all">All statuses</option>
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                </div>
                {selected.size > 0 && (
                  <div className="admin-bulk-bar">
                    <strong>{selected.size} selected</strong>
                    <button onClick={() => bulk("published")}>Publish</button>
                    <button onClick={() => bulk("draft")}>Move to draft</button>
                    <button onClick={() => bulk("archived")}>Archive</button>
                    <button onClick={() => setSelected(new Set())}>
                      Clear
                    </button>
                  </div>
                )}
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            aria-label="Select all filtered tests"
                            checked={
                              filtered.length > 0 &&
                              filtered.every((t) => selected.has(t.id))
                            }
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? new Set(filtered.map((t) => t.id))
                                  : new Set(),
                              )
                            }
                          />
                        </th>
                        <th>TEST COLLECTION</th>
                        <th>QUESTIONS</th>
                        <th>STATUS</th>
                        <th>LAST UPDATED</th>
                        <th>
                          <span className="admin-sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {!loading &&
                        filtered.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Select ${t.title}`}
                                checked={selected.has(t.id)}
                                onChange={() => toggle(t.id)}
                              />
                            </td>
                            <td>
                              <div className="admin-test-title">
                                <span
                                  className={`admin-test-icon tone-${MODULES.indexOf(module)}`}
                                >
                                  <Icon name={module} />
                                </span>
                                <div>
                                  <strong>{t.title}</strong>
                                  <small>
                                    Test {String(t.testNumber).padStart(2, "0")}{" "}
                                    · Version {t.version}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>
                              {t.questions.length}{" "}
                              <span className="admin-muted">questions</span>
                            </td>
                            <td>
                              <span className={`admin-badge ${t.status}`}>
                                {label(t.status)}
                              </span>
                            </td>
                            <td className="admin-muted">{date(t.updatedAt)}</td>
                            <td>
                              <button
                                className="admin-text-button"
                                onClick={() => edit(t, t.version)}
                              >
                                Edit <Icon name="arrow" size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {(loading || filtered.length === 0) && (
                  <div className="admin-empty">
                    <Icon name="content" size={32} />
                    <h3>
                      {loading ? "Loading your library…" : "No tests here yet"}
                    </h3>
                    <p>
                      {loading
                        ? "Fetching the latest content."
                        : "Create a test or import your existing materials to get started."}
                    </p>
                  </div>
                )}
                <div className="admin-table-footer">
                  <span>{filtered.length} test collections</span>
                  <span>Archive keeps previous versions safe.</span>
                </div>
              </div>
            </>
          )}
          {section === "imports" && (
            <>
              <div className="admin-page-heading">
                <div>
                  <p className="admin-eyebrow">FROM FILE TO PRACTICE</p>
                  <h1>Import materials</h1>
                  <p>
                    Bring your questions in. Give them the same familiar student
                    experience.
                  </p>
                </div>
                <button className="admin-button" onClick={exportTemplate}>
                  <Icon name="download" />
                  JSON template
                </button>
              </div>
              {moduleTabs}
              <div className="admin-import-steps">
                <span className={!staged.length ? "current" : "complete"}>
                  <b>1</b> Upload a file
                </span>
                <i />
                <span className={staged.length ? "current" : ""}>
                  <b>2</b> Review questions
                </span>
                <i />
                <span>
                  <b>3</b> Save & publish
                </span>
              </div>
              {!staged.length ? (
                <div className="admin-import-grid">
                  <section className="admin-panel admin-upload-panel">
                    <label className="admin-field">
                      Starting test number
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={destination}
                        onChange={(e) => setDestination(Number(e.target.value))}
                      />
                      <small>
                        Used when the file does not include test numbers.
                      </small>
                    </label>
                    <div className="admin-dropzone">
                      <span className="admin-upload-icon">
                        <Icon name="imports" size={36} />
                      </span>
                      <h2>Your next collection starts here</h2>
                      <p>Choose a JSON, Word document, or searchable PDF.</p>
                      <button
                        className="admin-button primary"
                        disabled={busy || loading}
                        onClick={() => fileRef.current?.click()}
                      >
                        {busy ? "Reading your file…" : "Browse files"}
                        <Icon name="arrow" size={18} />
                      </button>
                      <small>
                        JSON · DOCX · PDF &nbsp; / &nbsp; Up to 10 MB
                      </small>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".json,.docx,.pdf"
                        hidden
                        onChange={upload}
                      />
                    </div>
                    {fileName && (
                      <p className="admin-muted">Last selected: {fileName}</p>
                    )}
                  </section>
                  <aside className="admin-panel admin-import-guide">
                    <span className="admin-eyebrow">A SMOOTH IMPORT</span>
                    <h2>A little structure goes a long way.</h2>
                    <ol>
                      <li>
                        <strong>Keep questions clearly separated</strong>
                        <p>
                          Use “Test 1” and “Question 1” headings in Word and PDF
                          files.
                        </p>
                      </li>
                      <li>
                        <strong>Include answers and media</strong>
                        <p>
                          Use A. / B. options, “Answer: B”, and “Audio:
                          https://…” for listening.
                        </p>
                      </li>
                      <li>
                        <strong>Review before you publish</strong>
                        <p>
                          Correct missing fields in the editor. Nothing changes
                          until you save.
                        </p>
                      </li>
                    </ol>
                    <div className="admin-import-note">
                      Scanned PDFs need text recognition first. Embedded images
                      and audio should be supplied as hosted media URLs.
                    </div>
                  </aside>
                </div>
              ) : (
                <>
                  <div className="admin-panel admin-import-review">
                    <div className="admin-panel-heading">
                      <div>
                        <h2>{fileName}</h2>
                        <p>
                          {staged.length} tests ·{" "}
                          {staged.reduce((n, t) => n + t.questions.length, 0)}{" "}
                          questions extracted
                        </p>
                      </div>
                      <button
                        className="admin-button"
                        onClick={() =>
                          setConfirm({
                            title: "Discard this import?",
                            detail:
                              "Your extracted questions and preview edits will be discarded. Existing content will remain unchanged.",
                            run: async () => setStaged([]),
                          })
                        }
                      >
                        Choose another file
                      </button>
                    </div>
                    <div className="admin-form-grid">
                      <label className="admin-field">
                        When the destination already exists
                        <select
                          value={importMode}
                          onChange={(e) =>
                            setImportMode(
                              e.target.value as "append" | "replace",
                            )
                          }
                        >
                          <option value="append">
                            Add questions to existing tests
                          </option>
                          <option value="replace">
                            Replace all questions in matching tests
                          </option>
                        </select>
                        <small>
                          Only the test numbers listed below are affected.
                        </small>
                      </label>
                      <label className="admin-field">
                        Visibility after import
                        <select
                          value={publishImport ? "published" : "draft"}
                          onChange={(e) =>
                            setPublishImport(e.target.value === "published")
                          }
                        >
                          <option value="draft">
                            Save as draft — students cannot see it
                          </option>
                          <option value="published">
                            Publish for students with module access
                          </option>
                        </select>
                        <small>
                          Draft imports into existing tests also unpublish those
                          tests.
                        </small>
                      </label>
                    </div>
                    <div className="admin-import-test-list">
                      {staged.map((t, i) => (
                        <button
                          key={i}
                          className={stageIndex === i ? "active" : ""}
                          onClick={() => {
                            setStageIndex(i);
                            setQuestionSelection(new Set());
                          }}
                        >
                          <strong>{t.title}</strong>
                          <span>
                            Test {t.testNumber} · {t.questions.length} questions{" "}
                            {tests.some((x) => x.testNumber === t.testNumber)
                              ? "· Existing destination"
                              : "· New test"}
                          </span>
                        </button>
                      ))}
                    </div>
                    <QuestionEditor
                      test={staged[stageIndex]}
                      onChange={(t) =>
                        setStaged((old) =>
                          old.map((x, i) => (i === stageIndex ? t : x)),
                        )
                      }
                      selected={questionSelection}
                      onSelect={setQuestionSelection}
                    />
                    <div className="admin-save-bar">
                      <span>
                        {
                          staged.flatMap((t) =>
                            t.questions.flatMap((q) =>
                              questionIssues(q, module),
                            ),
                          ).length
                        }{" "}
                        fields need attention before publishing
                      </span>
                      <button
                        className="admin-button primary"
                        disabled={busy || loading}
                        onClick={() =>
                          setConfirm({
                            title: `${importMode === "replace" ? "Replace content in" : "Import into"} ${staged.length} tests?`,
                            detail: `${staged.reduce((n, t) => n + t.questions.length, 0)} incoming questions in ${label(module)}. ${importMode === "replace" ? "All current questions in matching tests will be replaced. Previous versions are retained." : "Incoming questions will be added to matching tests."} Visibility: ${publishImport ? "published" : "draft"}.`,
                            run: async () => {
                              await save(
                                staged.map((t) => ({
                                  ...t,
                                  status: publishImport ? "published" : "draft",
                                })),
                                importMode,
                              );
                              setStaged([]);
                              nav("content");
                            },
                          })
                        }
                      >
                        Review & confirm import <Icon name="arrow" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          {section === "students" && (
            <>
              <div className="admin-page-heading">
                <div>
                  <p className="admin-eyebrow">PEOPLE BEHIND THE PROGRESS</p>
                  <h1>Students & access</h1>
                  <p>Know your learners. Give them the access they need.</p>
                </div>
                <span className="admin-pill">
                  <Icon name="lock" size={16} /> Module-level control
                </span>
              </div>
              <section className="admin-panel">
                <div className="admin-library-toolbar">
                  <label className="admin-search">
                    <Icon name="search" />
                    <input
                      aria-label="Search students"
                      placeholder="Search by name or email…"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setOffset(0);
                      }}
                    />
                  </label>
                  <span className="admin-muted">Newest students first</span>
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>STUDENT</th>
                        <th>JOINED</th>
                        <th>LAST SIGN-IN</th>
                        <th>STATUS</th>
                        <th>ACCESS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <div className="admin-test-title">
                              <span className="admin-avatar">
                                {(s.name || s.email).slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <strong>
                                  {s.name || s.email.split("@")[0]}
                                </strong>
                                <small>{s.email}</small>
                              </div>
                            </div>
                          </td>
                          <td>{date(s.createdAt)}</td>
                          <td>{date(s.lastLoginAt)}</td>
                          <td>
                            <span
                              className={`admin-badge ${s.status === "active" ? "published" : "archived"}`}
                            >
                              {label(s.status)}
                            </span>
                          </td>
                          <td>
                            <button
                              className="admin-text-button"
                              onClick={() => void openStudent(s)}
                            >
                              Manage <Icon name="arrow" size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(loading || !students.length) && (
                  <div className="admin-empty">
                    <Icon name="students" size={34} />
                    <h3>
                      {loading
                        ? "Loading students…"
                        : search
                          ? "No matching students"
                          : "Your community starts here"}
                    </h3>
                    <p>
                      Registered students appear here automatically. Search by
                      name or email to manage their access.
                    </p>
                  </div>
                )}
                <div className="admin-table-footer">
                  <span>
                    {students.length
                      ? `${offset + 1}–${offset + students.length}`
                      : "0"}{" "}
                    students shown
                  </span>
                  <div className="admin-actions">
                    <button
                      className="admin-button"
                      disabled={!offset || loading}
                      onClick={() => setOffset(Math.max(0, offset - 50))}
                    >
                      Previous
                    </button>
                    <button
                      className="admin-button"
                      disabled={!hasMore || loading}
                      onClick={() => setOffset(offset + 50)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
          {section === "activity" && (
            <>
              <div className="admin-page-heading">
                <div>
                  <p className="admin-eyebrow">EVERY CHANGE, ACCOUNTED FOR</p>
                  <h1>Activity history</h1>
                  <p>
                    A shared record of content updates and student access
                    decisions.
                  </p>
                </div>
                <button
                  className="admin-button"
                  onClick={() => void run(refreshSummary)}
                >
                  Refresh
                </button>
              </div>
              <section className="admin-panel">
                {loading ? (
                  <div className="admin-empty">Loading activity…</div>
                ) : (
                  activityList(true)
                )}
              </section>
            </>
          )}
          <footer className="admin-footer">
            <span>
              TCF material <b> / </b> Admin workspace
            </span>
            <span>Thoughtfully managed. Better learning.</span>
          </footer>
        </main>
      </div>
      {editor && (
        <Modal
          title={
            editorVersion ? "Edit test collection" : "Create a test collection"
          }
          wide
          onClose={() => {
            if (!busy)
              setConfirm({
                title: "Close the editor?",
                detail: "Any unsaved edits in this editor will be discarded.",
                run: async () => setEditor(null),
              });
          }}
        >
          <QuestionEditor
            lockedNumber={editorVersion > 0}
            test={editor}
            onChange={setEditor}
            selected={questionSelection}
            onSelect={setQuestionSelection}
          />
          <div className="admin-save-bar">
            <label className="admin-field">
              Visibility
              <select
                value={editor.status}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    status: e.target.value as MaterialTest["status"],
                  })
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <div>
              <p className="admin-muted">
                {
                  editor.questions.flatMap((q) => questionIssues(q, module))
                    .length
                }{" "}
                fields need attention
              </p>
              <button
                className="admin-button primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await save([editor], "replace", {
                      [`${module}:${editor.testNumber}`]: editorVersion,
                    });
                    setEditor(null);
                  })
                }
              >
                {busy ? "Saving…" : "Save changes"}
                <Icon name="check" size={18} />
              </button>
            </div>
          </div>
          {error && (
            <p className="admin-inline-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {student && (
        <Modal
          title="Student details & access"
          wide
          onClose={() => {
            if (!busy) setStudent(null);
          }}
        >
          <div className="admin-student-profile">
            <span className="admin-avatar large">
              {(student.name || student.email).slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h3>{student.name || student.email.split("@")[0]}</h3>
              <p>{student.email}</p>
              <small>
                Joined {date(student.createdAt)} · Last sign-in{" "}
                {dateTime(student.lastLoginAt)}
              </small>
              <small>
                {[student.country, student.phone].filter(Boolean).join(" · ")}
              </small>
            </div>
            <span
              className={`admin-badge ${student.status === "active" ? "published" : "archived"}`}
            >
              {label(student.status)}
            </span>
          </div>
          <div className="admin-student-facts">
            <div>
              <strong>
                {paid.length
                  ? dateTime(paid[0].expiresAt)
                  : "No active paid plan"}
              </strong>
              <span>Paid access expiry</span>
            </div>
            <div>
              <strong>
                {
                  attempts.filter((a) =>
                    ["submitted", "evaluated"].includes(a.status),
                  ).length
                }
              </strong>
              <span>Completed in latest 100 attempts</span>
            </div>
          </div>
          <h3 className="admin-subheading">Module access overrides</h3>
          <p className="admin-muted">
            An explicit block overrides a paid plan. Removing an override
            returns the module to normal paid access.
          </p>
          <div className="admin-grant-list">
            {grants.length ? (
              grants.map((g) => (
                <div key={g.id}>
                  <Icon name={g.module} />
                  <div>
                    <strong>
                      {label(g.module)} ·{" "}
                      {g.kind === "deny" ? "Blocked" : "Free access"}
                    </strong>
                    <small>
                      {g.expiresAt && new Date(g.expiresAt) <= new Date()
                        ? "Expired "
                        : "Until "}
                      {dateTime(g.expiresAt)} · {g.reason}
                    </small>
                  </div>
                  <button
                    className="admin-text-button"
                    disabled={busy}
                    onClick={() =>
                      setConfirm({
                        title: "Remove this access override?",
                        detail:
                          "The student will return to their normal paid-plan access for this module.",
                        run: async () =>
                          updateStudent({
                            action: "revoke",
                            userId: student.id,
                            grantId: g.id,
                          }),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="admin-muted">No custom access overrides.</p>
            )}
          </div>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setConfirm({
                title:
                  kind === "deny"
                    ? "Block selected modules?"
                    : "Grant free module access?",
                detail: `${student.email} · ${[...grantModules].map(label).join(", ")} · ${duration === "lifetime" ? "Lifetime" : `${duration === "custom" ? hours : duration} hours`}. This replaces previous overrides for these modules.`,
                run: async () => {
                  await updateStudent({
                    action: "grant",
                    userId: student.id,
                    modules: [...grantModules],
                    kind,
                    hours:
                      duration === "lifetime"
                        ? null
                        : Number(duration === "custom" ? hours : duration),
                    reason,
                  });
                  setReason("");
                },
              });
            }}
          >
            <h3 className="admin-subheading">Set access</h3>
            <div className="admin-module-checks">
              {MODULES.map((m) => (
                <label key={m}>
                  <input
                    type="checkbox"
                    checked={grantModules.has(m)}
                    onChange={(e) =>
                      setGrantModules((old) => {
                        const n = new Set(old);
                        e.target.checked ? n.add(m) : n.delete(m);
                        return n;
                      })
                    }
                  />
                  <Icon name={m} />
                  {label(m)}
                </label>
              ))}
            </div>
            <div className="admin-form-grid">
              <label className="admin-field">
                Access action
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="grant">Grant free access</option>
                  <option value="deny">
                    Block access (including paid access)
                  </option>
                </select>
              </label>
              <label className="admin-field">
                Duration
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                  <option value="custom">Custom hours</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </label>
              {duration === "custom" && (
                <label className="admin-field">
                  Number of hours
                  <input
                    type="number"
                    min="1"
                    max="876000"
                    required
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                  />
                </label>
              )}
            </div>
            <label className="admin-field">
              Reason
              <input
                required
                maxLength={1000}
                placeholder="For example, complimentary Listening access for a new student"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="admin-save-bar">
              <button
                type="button"
                className="admin-button danger"
                disabled={busy}
                onClick={() =>
                  setConfirm({
                    title:
                      student.status === "active"
                        ? "Suspend this student?"
                        : "Reactivate this student?",
                    detail:
                      student.status === "active"
                        ? "All practice access will be blocked until you reactivate their account."
                        : "Their unexpired paid access and grants will become available again.",
                    run: async () => {
                      const status =
                        student.status === "active" ? "suspended" : "active";
                      await updateStudent({
                        action: "status",
                        userId: student.id,
                        status,
                      });
                      setStudent({ ...student, status });
                      setStudents((old) =>
                        old.map((s) =>
                          s.id === student.id ? { ...s, status } : s,
                        ),
                      );
                    },
                  })
                }
              >
                {student.status === "active"
                  ? "Suspend student"
                  : "Reactivate student"}
              </button>
              <button
                type="submit"
                className="admin-button primary"
                disabled={busy || !grantModules.size}
              >
                Apply access <Icon name="check" />
              </button>
            </div>
          </form>
          {error && (
            <p className="admin-inline-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {confirm && (
        <Modal
          title={confirm.title}
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <p className="admin-confirm-detail">{confirm.detail}</p>
          {error && (
            <p className="admin-inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-confirm-actions">
            <button
              className="admin-button"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              className="admin-button primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await confirm.run();
                  setConfirm(null);
                })
              }
            >
              {busy ? "Applying…" : "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function QuestionEditor({
  test,
  onChange,
  selected,
  onSelect,
  lockedNumber = false,
}: {
  test: MaterialTest;
  onChange: (t: MaterialTest) => void;
  selected: Set<string>;
  onSelect: (s: Set<string>) => void;
  lockedNumber?: boolean;
}) {
  const [current, setCurrent] = useState(0);
  const [remove, setRemove] = useState(false);
  const safeCurrent = Math.min(current, Math.max(0, test.questions.length - 1));
  const q = test.questions[safeCurrent];
  const patch = (data: Partial<MaterialQuestion>) =>
    onChange({
      ...test,
      questions: test.questions.map((item, i) =>
        i === safeCurrent ? { ...item, ...data } : item,
      ),
    });
  const issues = q ? questionIssues(q, test.module) : [];
  const mcq = test.module === "reading" || test.module === "listening";
  return (
    <div className="admin-editor">
      <div className="admin-form-grid">
        <label className="admin-field">
          Collection title
          <input
            value={test.title}
            maxLength={200}
            onChange={(e) => onChange({ ...test, title: e.target.value })}
          />
        </label>
        <label className="admin-field">
          Test number
          <input
            type="number"
            min={1}
            max={10000}
            disabled={lockedNumber}
            value={test.testNumber}
            onChange={(e) =>
              onChange({ ...test, testNumber: Number(e.target.value) })
            }
          />
          <small>
            Use an existing number to target that test when importing.
          </small>
        </label>
      </div>
      <div className="admin-editor-toolbar">
        <h3>
          Questions <span>{test.questions.length}</span>
        </h3>
        <div className="admin-actions">
          <button
            className="admin-button"
            onClick={() => {
              onChange({
                ...test,
                questions: [
                  ...test.questions,
                  {
                    ...emptyQuestion(),
                    task: test.module === "speaking" ? 2 : 1,
                    options: mcq ? ["", "", "", ""] : [],
                  },
                ],
              });
              setCurrent(test.questions.length);
            }}
          >
            <Icon name="plus" size={16} />
            Add question
          </button>
        </div>
      </div>
      <div className="admin-question-layout">
        <aside className="admin-question-list">
          <label className="admin-select-all">
            <input
              type="checkbox"
              checked={
                test.questions.length > 0 &&
                test.questions.every((q) => selected.has(q.id))
              }
              onChange={(e) =>
                onSelect(
                  e.target.checked
                    ? new Set(test.questions.map((q) => q.id))
                    : new Set(),
                )
              }
            />{" "}
            Select all questions
          </label>
          {test.questions.map((item, i) => (
            <div className={i === safeCurrent ? "active" : ""} key={item.id}>
              <input
                type="checkbox"
                aria-label={`Select question ${i + 1}`}
                checked={selected.has(item.id)}
                onChange={(e) => {
                  const n = new Set(selected);
                  e.target.checked ? n.add(item.id) : n.delete(item.id);
                  onSelect(n);
                }}
              />
              <button onClick={() => setCurrent(i)}>
                <strong>Question {String(i + 1).padStart(2, "0")}</strong>
                <span>{item.prompt || "New question"}</span>
              </button>
              {questionIssues(item, test.module).length > 0 && (
                <span
                  className="admin-question-warning"
                  title="Needs attention"
                >
                  !
                </span>
              )}
            </div>
          ))}
        </aside>
        <section className="admin-question-fields">
          {q ? (
            <>
              <div className="admin-question-heading">
                <span className="admin-eyebrow">
                  QUESTION {String(safeCurrent + 1).padStart(2, "0")}
                </span>
                <span
                  className={`admin-badge ${issues.length ? "draft" : "published"}`}
                >
                  {issues.length ? "Needs attention" : "Ready to publish"}
                </span>
              </div>
              <label className="admin-field">
                Question prompt
                <textarea
                  rows={4}
                  value={q.prompt}
                  onChange={(e) => patch({ prompt: e.target.value })}
                />
              </label>
              {test.module === "reading" && (
                <label className="admin-field">
                  Reading passage
                  <textarea
                    rows={5}
                    value={q.passage}
                    onChange={(e) => patch({ passage: e.target.value })}
                  />
                </label>
              )}
              {mcq ? (
                <>
                  <div className="admin-form-grid">
                    {q.options.map((o, i) => (
                      <label className="admin-field" key={i}>
                        Option {String.fromCharCode(65 + i)}
                        <input
                          value={o}
                          onChange={(e) =>
                            patch({
                              options: q.options.map((s, j) =>
                                i === j ? e.target.value : s,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <div className="admin-actions">
                    <button
                      className="admin-text-button"
                      disabled={q.options.length >= 8}
                      onClick={() => patch({ options: [...q.options, ""] })}
                    >
                      + Add option
                    </button>
                    <button
                      className="admin-text-button"
                      disabled={q.options.length <= 2}
                      onClick={() => patch({ options: q.options.slice(0, -1) })}
                    >
                      Remove last option
                    </button>
                  </div>
                  <div className="admin-form-grid">
                    <label className="admin-field">
                      Correct answer
                      <select
                        value={q.correct}
                        onChange={(e) => patch({ correct: e.target.value })}
                      >
                        <option value="">Choose an answer</option>
                        {q.options.map((_, i) => (
                          <option key={i} value={String.fromCharCode(65 + i)}>
                            Option {String.fromCharCode(65 + i)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-field">
                      Level
                      <select
                        value={q.level}
                        onChange={(e) => patch({ level: e.target.value })}
                      >
                        {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-form-grid">
                    <label className="admin-field">
                      Task
                      <select
                        value={q.task}
                        onChange={(e) =>
                          patch({ task: Number(e.target.value) })
                        }
                      >
                        {(test.module === "speaking" ? [2, 3] : [1, 2, 3]).map(
                          (n) => (
                            <option key={n} value={n}>
                              Tâche {n}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="admin-field">
                      Category
                      <input
                        value={q.category}
                        onChange={(e) => patch({ category: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="admin-field">
                    Model answer / correction
                    <textarea
                      rows={6}
                      value={q.referenceAnswer}
                      onChange={(e) =>
                        patch({ referenceAnswer: e.target.value })
                      }
                    />
                  </label>
                  {test.module === "writing" && (
                    <div className="admin-form-grid">
                      <label className="admin-field">
                        Document 1
                        <textarea
                          rows={4}
                          value={q.document1}
                          onChange={(e) => patch({ document1: e.target.value })}
                        />
                      </label>
                      <label className="admin-field">
                        Document 2
                        <textarea
                          rows={4}
                          value={q.document2}
                          onChange={(e) => patch({ document2: e.target.value })}
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
              {test.module === "listening" && (
                <label className="admin-field">
                  Audio URL
                  <input
                    type="url"
                    placeholder="https://…"
                    value={q.audioUrl}
                    onChange={(e) => patch({ audioUrl: e.target.value })}
                  />
                  <small>
                    A hosted audio file is required for listening questions.
                  </small>
                  {q.audioUrl.startsWith("https://") && (
                    <audio controls preload="none" src={q.audioUrl} />
                  )}
                </label>
              )}
              {mcq && (
                <label className="admin-field">
                  Image URL (optional)
                  <input
                    value={q.imageUrl}
                    placeholder="https://…"
                    onChange={(e) => patch({ imageUrl: e.target.value })}
                  />
                </label>
              )}
              <label className="admin-field">
                Explanation (optional)
                <textarea
                  rows={3}
                  value={q.explanation}
                  onChange={(e) => patch({ explanation: e.target.value })}
                />
              </label>
              {test.module === "speaking" && (
                <label className="admin-field">
                  Speaking duration (seconds)
                  <input
                    type="number"
                    min={1}
                    max={86400}
                    value={q.durationSeconds}
                    onChange={(e) =>
                      patch({ durationSeconds: Number(e.target.value) })
                    }
                  />
                </label>
              )}
              {issues.length > 0 && (
                <ul className="admin-validation">
                  {issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="admin-empty">
              <Icon name="plus" size={30} />
              <h3>Start with your first question</h3>
              <p>Add a question above or import a complete collection.</p>
            </div>
          )}
        </section>
      </div>
      {selected.size > 0 && (
        <div className="admin-bulk-bar">
          <strong>{selected.size} questions selected</strong>
          <label>
            Set level{" "}
            <select
              aria-label="Level for selected questions"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value)
                  onChange({
                    ...test,
                    questions: test.questions.map((q) =>
                      selected.has(q.id) ? { ...q, level: e.target.value } : q,
                    ),
                  });
                e.target.value = "";
              }}
            >
              <option value="">Choose…</option>
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <button onClick={() => setRemove(true)}>
            <Icon name="trash" size={16} />
            Remove selected
          </button>
          <button onClick={() => onSelect(new Set())}>Clear</button>
        </div>
      )}
      {remove && (
        <div className="admin-inline-confirm" role="alert">
          <p>
            Remove {selected.size} selected questions from this edit? This takes
            effect when you save.
          </p>
          <button
            className="admin-button danger"
            onClick={() => {
              onChange({
                ...test,
                questions: test.questions.filter((q) => !selected.has(q.id)),
              });
              onSelect(new Set());
              setCurrent(0);
              setRemove(false);
            }}
          >
            Remove questions
          </button>
          <button className="admin-button" onClick={() => setRemove(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
