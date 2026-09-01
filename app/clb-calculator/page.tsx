"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TestType = "TCF" | "TEF";
type Ability = "speaking" | "listening" | "reading" | "writing";
type Scores = Record<Ability, string>;
type Band = { level: number; min: number; max: number };

const abilities: { key: Ability; label: string; french: string }[] = [
  { key: "speaking", label: "Speaking", french: "Enter your speaking score" },
  { key: "listening", label: "Listening", french: "Enter your listening score" },
  { key: "reading", label: "Reading", french: "Enter your reading score" },
  { key: "writing", label: "Writing", french: "Enter your writing score" },
];

const bands: Record<TestType, Record<Ability, Band[]>> = {
  TCF: {
    speaking: [{ level: 10, min: 16, max: 20 }, { level: 9, min: 14, max: 15 }, { level: 8, min: 12, max: 13 }, { level: 7, min: 10, max: 11 }, { level: 6, min: 7, max: 9 }, { level: 5, min: 6, max: 6 }, { level: 4, min: 4, max: 5 }],
    listening: [{ level: 10, min: 549, max: 699 }, { level: 9, min: 523, max: 548 }, { level: 8, min: 503, max: 522 }, { level: 7, min: 458, max: 502 }, { level: 6, min: 398, max: 457 }, { level: 5, min: 369, max: 397 }, { level: 4, min: 331, max: 368 }],
    reading: [{ level: 10, min: 549, max: 699 }, { level: 9, min: 524, max: 548 }, { level: 8, min: 499, max: 523 }, { level: 7, min: 453, max: 498 }, { level: 6, min: 406, max: 452 }, { level: 5, min: 375, max: 405 }, { level: 4, min: 342, max: 374 }],
    writing: [{ level: 10, min: 16, max: 20 }, { level: 9, min: 14, max: 15 }, { level: 8, min: 12, max: 13 }, { level: 7, min: 10, max: 11 }, { level: 6, min: 7, max: 9 }, { level: 5, min: 6, max: 6 }, { level: 4, min: 4, max: 5 }],
  },
  TEF: {
    speaking: [{ level: 10, min: 393, max: 450 }, { level: 9, min: 371, max: 392 }, { level: 8, min: 349, max: 370 }, { level: 7, min: 310, max: 348 }, { level: 6, min: 271, max: 309 }, { level: 5, min: 226, max: 270 }, { level: 4, min: 181, max: 225 }],
    listening: [{ level: 10, min: 316, max: 360 }, { level: 9, min: 298, max: 315 }, { level: 8, min: 280, max: 297 }, { level: 7, min: 249, max: 279 }, { level: 6, min: 217, max: 248 }, { level: 5, min: 181, max: 216 }, { level: 4, min: 145, max: 180 }],
    reading: [{ level: 10, min: 263, max: 300 }, { level: 9, min: 248, max: 262 }, { level: 8, min: 233, max: 247 }, { level: 7, min: 207, max: 232 }, { level: 6, min: 181, max: 206 }, { level: 5, min: 151, max: 180 }, { level: 4, min: 121, max: 150 }],
    writing: [{ level: 10, min: 393, max: 450 }, { level: 9, min: 371, max: 392 }, { level: 8, min: 349, max: 370 }, { level: 7, min: 310, max: 348 }, { level: 6, min: 271, max: 309 }, { level: 5, min: 226, max: 270 }, { level: 4, min: 181, max: 225 }],
  },
};

const scoreLimits: Record<TestType, Record<Ability, number>> = {
  TCF: { speaking: 20, listening: 699, reading: 699, writing: 20 },
  TEF: { speaking: 450, listening: 360, reading: 300, writing: 450 },
};

function convert(test: TestType, ability: Ability, raw: string) {
  if (raw === "") return null;
  const score = Number(raw);
  if (!Number.isFinite(score) || score < 0 || score > scoreLimits[test][ability]) return "invalid" as const;
  return bands[test][ability].find(band => score >= band.min && score <= band.max)?.level ?? 0;
}

export default function ClbCalculatorPage() {
  const [test, setTest] = useState<TestType>("TCF");
  const [scores, setScores] = useState<Scores>({ speaking: "", listening: "", reading: "", writing: "" });
  const results = useMemo(() => Object.fromEntries(abilities.map(({ key }) => [key, convert(test, key, scores[key])])) as Record<Ability, number | "invalid" | null>, [scores, test]);
  const validLevels = abilities.map(({ key }) => results[key]).filter((level): level is number => typeof level === "number");
  const completed = validLevels.length === 4;
  const lowestLevel = completed ? Math.min(...validLevels) : null;
  const resetFor = (nextTest: TestType) => { setTest(nextTest); setScores({ speaking: "", listening: "", reading: "", writing: "" }); };

  return <div className="calculator-shell">
    <nav className="nav calculator-nav"><Link className="brand" href="/">tcf<span>·</span>material</Link><div className="nav-actions"><Link className="nav-link calculator-active" href="/clb-calculator">CLB Calculator</Link><Link className="nav-link" href="/#pricing">Pricing</Link><Link className="btn" href="/">Practice tests</Link></div></nav>
    <main className="calculator-page">
      <header className="calculator-hero"><div><span className="text-blue-600 text-2xl font-bold mb-5">Official score equivalency</span><h1>TEF / TCF<br/><em>CLB Calculator</em></h1></div><p>Enter the scores printed on your French test results to find the corresponding Canadian NCLC level for each language ability.</p></header>

      <section className="calculator-card">
        <div className="test-switch" role="group" aria-label="Choose a French language test"><button className={test === "TCF" ? "active" : ""} onClick={() => resetFor("TCF")}>TCF Canada</button><button className={test === "TEF" ? "active" : ""} onClick={() => resetFor("TEF")}>TEF Canada</button></div>
        {test === "TEF" && <div className="calculator-notice"><strong>Use “Équivalence ancien score.”</strong><span>For Express Entry, IRCC says not to enter the separate “Score / 699” values shown on newer TEF attestations.</span></div>}
        <div className="score-inputs">{abilities.map(({ key, label, french }) => {
          const result = results[key];
          return <label className={`score-input ${result === "invalid" ? "has-error" : ""}`} key={key}><span><strong>{label}</strong><small>{french}</small></span><div><input inputMode="numeric" min="0" max={scoreLimits[test][key]} step="1" value={scores[key]} onChange={event => setScores(current => ({ ...current, [key]: event.target.value }))} placeholder={`0–${scoreLimits[test][key]}`} aria-label={`${test} ${label} score`}/><output>{result === null ? "—" : result === "invalid" ? "Invalid" : result === 0 ? "Below 4" : `NCLC ${result}${result === 10 ? "+" : ""}`}</output></div></label>;
        })}</div>

        <div className={`calculator-summary ${completed ? "ready" : ""}`}><div><span className="mono">Lowest of all four abilities</span><strong>{lowestLevel === null ? "Enter all scores" : lowestLevel === 0 ? "Below NCLC 4" : `NCLC ${lowestLevel}${lowestLevel === 10 ? "+" : ""}`}</strong></div><p>Immigration programs normally assess every ability separately. The lowest result is shown only as a convenient readiness indicator.</p></div>
      </section>

      <section className="calculator-info"><article><span>01</span><h2>What is CLB / NCLC?</h2><p>Canada uses CLB for English and NCLC for French. TEF Canada and TCF Canada results are converted into an NCLC level for speaking, listening, reading, and writing.</p></article><article><span>02</span><h2>How is it used?</h2><p>Programs such as Express Entry compare each ability with their minimum language requirement. Requirements vary by immigration program and occupation category.</p></article><article><span>03</span><h2>Check before applying</h2><p>This calculator is a convenience tool, not immigration advice. Always compare your certificate and profile entries with the latest IRCC instructions.</p></article></section>
      <footer className="calculator-source">Source: <a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html" target="_blank" rel="noreferrer">IRCC — Express Entry language test results</a>. Tables reviewed August 27, 2026.</footer>
    </main>
  </div>;
}
