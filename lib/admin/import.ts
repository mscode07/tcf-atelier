import { MaterialQuestion, MaterialTest, ModuleKey } from "./types";
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const string = (v: unknown) => (typeof v === "string" ? v : "");
const safeUrl = (v: unknown) => {
  const s = string(v).trim();
  return !s || /^https:\/\//i.test(s) || /^\/(?!\/)/.test(s) ? s : "";
};
export function normalizeQuestion(
  value: unknown,
  module: ModuleKey,
  index: number,
): MaterialQuestion {
  const q = object(value);
  const ref = object(q.referenceAnswer);
  const rawOptions = q.options || q.answers;
  const options = Array.isArray(rawOptions)
    ? rawOptions.map((v) =>
        typeof v === "string"
          ? v.replace(/^[A-H][.)]\s*/, "")
          : string(object(v).text),
      )
    : [];
  return {
    id: string(q.id) || String(q.id || crypto.randomUUID()),
    prompt:
      string(q.prompt || q.promptFr || q.question || q.ask) ||
      (module === "listening"
        ? "Écoutez l’enregistrement et choisissez la bonne réponse."
        : ""),
    passage: string(q.passage),
    options,
    correct:
      typeof q.correct === "number"
        ? String.fromCharCode(65 + q.correct)
        : string(q.correct || q.correctAnswer)
            .trim()
            .toUpperCase(),
    level: string(q.level) || "A1",
    audioUrl: safeUrl(q.audioUrl || q.audio),
    imageUrl: safeUrl(q.imageUrl || q.image),
    explanation: string(q.explanation),
    task:
      Number(q.task || q.tache || string(q.taskType).replace("tache_", "")) ||
      (module === "speaking" ? 2 : 1),
    category: string(q.category || q.broadCategory || q.topic) || "General",
    document1: string(q.document1),
    document2: string(q.document2),
    durationSeconds: Number(q.durationSeconds) || 210,
    referenceAnswer:
      string(q.referenceAnswer) ||
      string(q.correction || ref.text) ||
      (Array.isArray(ref.bulletItems) ? ref.bulletItems.join("\n") : ""),
    extra: {
      ...object(q.extra),
      ...(q.quickSetSupport ? { quickSetSupport: q.quickSetSupport } : {}),
      title: string(q.titleFr || q.topic) || string(object(q.extra).title),
      topicHeading:
        string(q.topicHeading) || string(object(q.extra).topicHeading),
    },
  };
}
export function questionIssues(
  q: MaterialQuestion,
  module: ModuleKey,
): string[] {
  const issues: string[] = [];
  if (
    !q.prompt.trim() &&
    !(
      module === "writing" &&
      q.task === 3 &&
      q.document1.trim() &&
      q.document2.trim()
    )
  )
    issues.push("Add the question prompt.");
  if (module === "reading" || module === "listening") {
    if (
      q.options.length < 2 ||
      q.options.length > 8 ||
      q.options.some((o) => !o.trim())
    )
      issues.push("Provide 2–8 non-empty answer options.");
    if (
      !/^[A-H]$/.test(q.correct) ||
      q.correct.charCodeAt(0) - 65 >= q.options.length
    )
      issues.push("Choose a valid correct answer.");
  }
  if (module === "listening" && !q.audioUrl) issues.push("Add an audio URL.");
  if (
    (module === "writing" && ![1, 2, 3].includes(q.task)) ||
    (module === "speaking" && ![2, 3].includes(q.task))
  )
    issues.push("Choose a supported task number.");
  if (
    !Number.isFinite(q.durationSeconds) ||
    q.durationSeconds < 1 ||
    q.durationSeconds > 86400
  )
    issues.push("Set a duration between 1 and 86400 seconds.");
  return issues;
}
export function normalizeImport(
  input: unknown,
  module: ModuleKey,
  testNumber = 1,
): MaterialTest[] {
  const root = object(input);
  let entries: unknown[];
  if (Array.isArray(root.tests)) entries = root.tests;
  else if (
    Array.isArray(input) &&
    input.length &&
    Array.isArray(object(input[0]).questions)
  )
    entries = input;
  else
    entries = [
      {
        ...root,
        questions: Array.isArray(input) ? input : root.questions,
        testNumber: root.testNumber || root.test || testNumber,
      },
    ];
  if (!entries.length || entries.length > 500)
    throw new Error("Upload between 1 and 500 tests.");
  const tests = entries.map((v, i) => {
    const t = object(v);
    if (!Array.isArray(t.questions) || !t.questions.length)
      throw new Error(
        "No questions were found. Upload a questions array or a tests array. Network captures and empty documents cannot be imported.",
      );
    if (t.questions.length > 1000)
      throw new Error("A test can contain at most 1,000 questions.");
    const number = Number(t.testNumber || t.test || testNumber + i);
    if (!Number.isInteger(number) || number < 1 || number > 10000)
      throw new Error("Test numbers must be between 1 and 10,000.");
    const questions = t.questions.map((q, index) =>
      normalizeQuestion(q, module, index),
    );
    // Each imported question gets a stable identifier within its test, even when source IDs repeat.
    const seen = new Set<string>();
    for (const q of questions) {
      if (seen.has(q.id)) q.id = crypto.randomUUID();
      seen.add(q.id);
    }
    return {
      module,
      testNumber: number,
      title:
        string(t.title) ||
        `${module[0].toUpperCase() + module.slice(1)} Test ${number}`,
      status: "draft" as const,
      questions,
    };
  });
  if (new Set(tests.map((t) => t.testNumber)).size !== tests.length)
    throw new Error(
      "The file contains duplicate test numbers. Give each test a unique number.",
    );
  return tests;
}
// Deterministic extraction: uploaded text is data and is never executed or treated as instructions.
export function parseDocumentText(
  text: string,
  module: ModuleKey,
  fallbackNumber = 1,
): MaterialTest[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const tests: { testNumber: number; questions: Record<string, unknown>[] }[] =
    [];
  let current = {
    testNumber: fallbackNumber,
    questions: [] as Record<string, unknown>[],
  };
  let q: Record<string, unknown> | null = null;
  let field = "prompt";
  for (const line of lines) {
    const test = line.match(/^(?:TCF\s+\w+\s*[—–-]\s*)?Test\s+(\d+)\s*$/i);
    if (test) {
      if (current.questions.length) tests.push(current);
      current = { testNumber: Number(test[1]), questions: [] };
      q = null;
      continue;
    }
    const heading = line.match(
      /^(?:Question\s+\d+\s*[:.)-]?|\d+[.)])\s*(.*)$/i,
    );
    if (heading) {
      q = { prompt: heading[1], options: [] };
      current.questions.push(q);
      field = "prompt";
      continue;
    }
    if (!q) continue;
    const option = line.match(/^([A-H])[.)]\s*(.*)$/);
    if (option) {
      (q.options as string[]).push(option[2]);
      field = "options";
      continue;
    }
    const labeled = line.match(
      /^(Answer|Correct(?: answer)?|Réponse(?: correcte)?|Audio(?: URL)?|Image(?: URL)?|Passage|Explanation|Explication|Reference(?: answer)?|Correction|Category|Task|Document1|Document2)\s*:\s*(.*)$/i,
    );
    if (labeled) {
      const label = labeled[1].toLowerCase();
      field = /^(answer|correct|réponse)/.test(label)
        ? "correct"
        : label.startsWith("audio")
          ? "audioUrl"
          : label.startsWith("image")
            ? "imageUrl"
            : /^(reference|correction)/.test(label)
              ? "referenceAnswer"
              : label.startsWith("exp")
                ? "explanation"
                : label;
      q[field] = field === "correct" ? labeled[2].slice(0, 1) : labeled[2];
      continue;
    }
    if (field === "options") {
      const opts = q.options as string[];
      opts[opts.length - 1] += " " + line;
    } else q[field] = (q[field] ? q[field] + "\n" : "") + line;
  }
  if (current.questions.length) tests.push(current);
  if (!tests.length)
    throw new Error(
      "No question bodies were found. Use headings such as “Question 1”, A. / B. options, and “Answer: B”. For scanned PDFs, upload a searchable PDF or JSON export.",
    );
  return normalizeImport({ tests }, module, fallbackNumber);
}
