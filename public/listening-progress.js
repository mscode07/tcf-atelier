(function () {
  const match = window.location.pathname.match(/test-(\d+)\.html$/);
  if (!match) return;

  const testNumber = Number(match[1]);
  const mode = new URLSearchParams(window.location.search).get("mode") === "exam" ? "exam" : "review";
  localStorage.removeItem("theme");
  const back = document.querySelector("header a");
  if (back) back.textContent = "← Dashboard";

  document.body.classList.add("protected-material");
  const shield = document.createElement("div");
  shield.className = "security-shield";
  shield.innerHTML = '<strong>Protected material</strong><span>Return to this tab to continue.</span>';
  document.body.appendChild(shield);
  const watermark = document.createElement("div");
  watermark.className = "security-watermark";
  document.body.appendChild(watermark);

  let watermarkIdentity = "Licensed user";
  const watermarkPositions = [[8, 18], [58, 16], [30, 47], [66, 70], [10, 76]];
  let watermarkPosition = 0;
  function updateWatermark() {
    const position = watermarkPositions[watermarkPosition++ % watermarkPositions.length];
    watermark.style.left = `${position[0]}%`;
    watermark.style.top = `${position[1]}%`;
    watermark.textContent = `${watermarkIdentity} · ${new Date().toLocaleString()}`;
  }
  updateWatermark();
  window.setInterval(updateWatermark, 12_000);

  const blockAction = event => event.preventDefault();
  ["copy", "cut", "contextmenu", "dragstart", "selectstart"].forEach(type => document.addEventListener(type, blockAction));
  document.addEventListener("keydown", event => {
    const blockedShortcut = (event.ctrlKey || event.metaKey) && ["c", "s", "p", "u", "a"].includes(event.key.toLowerCase());
    if (blockedShortcut || event.key === "PrintScreen") event.preventDefault();
  });
  function updateShield() { document.body.classList.toggle("content-shielded", document.hidden); }
  document.addEventListener("visibilitychange", updateShield);
  window.addEventListener("beforeprint", () => document.body.classList.add("content-shielded"));
  window.addEventListener("afterprint", () => document.body.classList.remove("content-shielded"));

  function validateAccess() {
    fetch("/api/access", { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (response.status === 401 || response.status === 403) {
          window.location.replace("/?access=signin_required");
          return;
        }
        if (response.ok) {
          const access = await response.json();
          if (!access.active) window.location.replace("/?access=subscription_required");
          if (access.watermark) { watermarkIdentity = access.watermark; updateWatermark(); }
        }
      })
      .catch(() => undefined);
  }
  validateAccess();
  window.setInterval(validateAccess, 30_000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) validateAccess(); });

  let saveTimer;
  function totals() {
    const answered = responses.filter(answer => answer !== null).length;
    const score = QUESTIONS.reduce((total, question, index) => total + (
      responses[index] !== null && letter(responses[index]) === question.correct ? 1 : 0
    ), 0);
    return { answered, score, incorrect: Math.max(0, answered - score), skipped: QUESTIONS.length - answered };
  }
  function save(status) {
    const result = totals();
    if (status === "in_progress" && result.answered === 0) return Promise.resolve();
    return fetch("/api/progress", {
      method: "POST", credentials: "same-origin", keepalive: status === "completed",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ module: "listening", testNumber, status, score: result.score, maxScore: QUESTIONS.length, answeredCount: result.answered }),
    }).then(async response => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Progress save failed (${response.status})`);
      }
    });
  }

  const originalCheckAnswer = checkAnswer;
  if (mode === "exam") {
    checkAnswer = function () {
      if (responses[current] === null) { alert("Please select an answer first."); return; }
      checked[current] = true;
      save("in_progress");
      if (current < QUESTIONS.length - 1) { current++; render(); } else { finish(); }
    };
  } else {
    checkAnswer = originalCheckAnswer;
  }

  window.reviewListeningAnswers = function () {
    responses.forEach((answer, index) => { if (answer !== null) checked[index] = true; });
    document.body.classList.remove("listening-results");
    document.getElementById("results").style.display = "none";
    current = 0;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  finish = function () {
    const result = totals();
    const percent = Math.round(result.score / QUESTIONS.length * 100);
    const box = document.getElementById("results");
    box.innerHTML = `<div class="score">${result.score}/${QUESTIONS.length}</div><h2>Listening test complete</h2><p>Score: ${percent}%</p><p id="progress-save-status">Saving progress…</p><div class="result-summary"><div><strong>${result.score}</strong><span>Correct</span></div><div><strong>${result.incorrect}</strong><span>Incorrect</span></div><div><strong>${result.skipped}</strong><span>Skipped</span></div></div><div class="result-actions"><button class="btn secondary" onclick="reviewListeningAnswers()">Review answers</button><a class="btn primary" href="/">Back to dashboard</a></div>`;
    document.body.classList.add("listening-results");
    box.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
    stopClock();
    save("completed").then(() => {
      document.getElementById("progress-save-status").textContent = "Progress saved.";
    }).catch(error => {
      console.error("Listening progress save failed", error);
      document.getElementById("progress-save-status").textContent = "Progress could not be saved. Please try ending the test again.";
    });
  };

  document.addEventListener("click", function (event) {
    const button = event.target.closest("button");
    if (!button || !button.classList.contains("option")) return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => { save("in_progress").catch(error => console.error("Listening progress save failed", error)); }, 250);
  });

  let clock;
  function stopClock() { if (clock) window.clearInterval(clock); }
  if (mode === "exam") {
    const key = `listening-deadline-${testNumber}`;
    let deadline = Number(sessionStorage.getItem(key));
    if (!deadline || deadline <= Date.now()) { deadline = Date.now() + 35 * 60 * 1000; sessionStorage.setItem(key, String(deadline)); }
    const timer = document.createElement("span");
    timer.className = "listening-timer";
    const headerDescription = document.querySelector("header p");
    if (headerDescription) headerDescription.style.display = "none";
    document.querySelector("header").appendChild(timer);
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      timer.textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
      if (remaining === 0) { stopClock(); finish(); }
    };
    tick();
    clock = window.setInterval(tick, 1000);
  }
})();
