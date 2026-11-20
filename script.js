const QUIZ_QUESTIONS = [
  {
    number: 1,
    question:
      "Uma empresa anuncia que substituirá seu sistema de atendimento por uma nova plataforma. Qual deve ser o primeiro passo para reconhecer essa mudança?",
    options: [
      { letter: "A", text: "Manter as atividades sem considerar o anúncio." },
      { letter: "B", text: "Começar a utilizar a nova plataforma imediatamente." },
      { letter: "C", text: "Identificar o que será alterado e quais áreas serão afetadas." },
      { letter: "D", text: "Cobrar que todos apresentem resultados no novo sistema." }
    ],
    correct: "C"
  },
  {
    number: 2,
    question:
      "Ao perceber que uma mudança está sendo implementada, um colaborador demonstra insegurança e faz perguntas. Como a organização deve interpretar essa reação?",
    options: [
      { letter: "A", text: "Como uma situação que deve ser resolvida somente pelo próprio colaborador." },
      { letter: "B", text: "Como um sinal de que existem dúvidas e impactos que precisam ser identificados." },
      { letter: "C", text: "Como falta de comprometimento com a empresa." },
      { letter: "D", text: "Como uma resistência que deve ser punida." }
    ],
    correct: "B"
  },
  {
    number: 3,
    question:
      "Após anunciar a implantação de um novo sistema, a empresa percebe que os funcionários não sabem por que ele será utilizado. O que deve fazer?",
    options: [
      { letter: "A", text: "Explicar os motivos, os objetivos e os impactos da implantação." },
      { letter: "B", text: "Exigir que todos aprendam o sistema por conta própria." },
      { letter: "C", text: "Repetir apenas a data em que o sistema começará a funcionar." },
      { letter: "D", text: "Esperar que os funcionários descubram os benefícios durante o uso." }
    ],
    correct: "A"
  },
  {
    number: 4,
    question:
      "Uma equipe recebeu informações sobre uma mudança, mas ainda não consegue visualizar como ela será aplicada no trabalho diário. O que a organização deve fazer?",
    options: [
      { letter: "A", text: "Apresentar somente os resultados esperados pela direção." },
      { letter: "B", text: "Deixar que cada funcionário descubra sozinho como agir." },
      { letter: "C", text: "Exigir que todos sigam as novas orientações sem questionamentos." },
      { letter: "D", text: "Demonstrar como as novas atividades serão realizadas e esclarecer dúvidas." }
    ],
    correct: "D"
  },
  {
    number: 5,
    question:
      "Uma empresa implantou um novo procedimento, mas parte da equipe ainda apresenta dificuldades para executá-lo. Qual é a melhor iniciativa?",
    options: [
      { letter: "A", text: "Cobrar produtividade igual à anterior desde o primeiro dia." },
      { letter: "B", text: "Oferecer treinamento, orientação e acompanhamento durante a aplicação." },
      { letter: "C", text: "Substituir os funcionários que apresentarem dúvidas." },
      { letter: "D", text: "Permitir que cada funcionário continue usando o procedimento antigo." }
    ],
    correct: "B"
  },
  {
    number: 6,
    question:
      "Depois de algumas semanas utilizando o novo sistema, os colaboradores apresentam sugestões e relatam dificuldades que ainda persistem. O que o RH deve fazer?",
    options: [
      { letter: "A", text: "Desconsiderar as sugestões para evitar novas alterações." },
      { letter: "B", text: "Retomar obrigatoriamente o sistema antigo." },
      { letter: "C", text: "Encerrar o acompanhamento porque a implantação já aconteceu." },
      { letter: "D", text: "Ouvir a equipe, avaliar os resultados e ajustar o que for necessário." }
    ],
    correct: "D"
  }
];

const MAX_TIME_MS = 3 * 60 * 1000; // 3 minutos = 180.000 ms
const SESSION_KEY = "quiz_odisseia_session_v4";
const RANKING_CACHE_KEY = "quiz_odisseia_global_ranking_cache_v2";

// Estado do Quiz
let currentSlide = "0"; // '0' | '1'..'6' | '7'
const userAnswers = {};
let playerId = null;
let playerName = "";
let viewOnlyRanking = false;
let globalRanking = [];
let eventSource = null;

// Cronômetro baseado em timestamp real (Date.now())
let matchStartWallTime = null;
let timerIntervalId = null;
let hasSubmitted = false;
let finalElapsedMs = 0;

// Elementos DOM
const slidesContainer = document.getElementById("slides-container");
const questionsMount = document.getElementById("questions-mount");
const finalChoicesGrid = document.getElementById("final-choices-grid");
const timerTopbar = document.getElementById("timer-topbar");
const timerClockBox = document.getElementById("timer-clock-box");
const timerRemainingEl = document.getElementById("timer-remaining");

// Modal de Confirmação
const confirmModal = document.getElementById("confirm-modal");
const confirmModalTitle = document.getElementById("confirm-modal-title");
const confirmModalText = document.getElementById("confirm-modal-text");
const btnModalCancel = document.getElementById("btn-modal-cancel");
const btnModalConfirm = document.getElementById("btn-modal-confirm");
let modalConfirmCallback = null;

// Áudio
const bgMusic = document.getElementById("bg-music");
const seaAmbience = document.getElementById("sea-ambience");
const btnMusicToggle = document.getElementById("btn-music-toggle");
const musicToggleIcon = document.getElementById("music-toggle-icon");
const musicToggleText = document.getElementById("music-toggle-text");
const btnMute = document.getElementById("btn-mute");
const volumeSvgUse = document.getElementById("volume-svg-use");
const volumeSlider = document.getElementById("volume-slider");
const volumePercent = document.getElementById("volume-percent");

let userManuallyPaused = false;
let masterVolume = 0.65;
let isMuted = false;
let previousVolume = 0.65;

// ==========================================
// PERSISTÊNCIA LOCAL E SINCRONIZAÇÃO DISTRIBUÍDA
// ==========================================
function saveLocalRankingCache(list) {
  try {
    if (Array.isArray(list)) {
      localStorage.setItem(RANKING_CACHE_KEY, JSON.stringify(list));
    }
  } catch {
    // ignora
  }
}

function loadLocalRankingCache() {
  try {
    const raw = localStorage.getItem(RANKING_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessionState() {
  try {
    if (currentSlide === "0") {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    const payload = JSON.stringify({
      savedAt: Date.now(),
      playerId,
      playerName,
      viewOnlyRanking,
      currentSlide,
      userAnswers: { ...userAnswers },
      hasSubmitted,
      finalElapsedMs,
      matchStartWallTime
    });
    sessionStorage.setItem(SESSION_KEY, payload);
  } catch {
    // ignora
  }
}

function loadSessionState() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || Date.now() - (data.savedAt || 0) > 3 * 60 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function generateLocalId() {
  return "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function formatMinSecMs(ms) {
  const clamped = Math.max(0, Math.round(ms));
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const millis = clamped % 1000;
  return `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s ${String(millis).padStart(3, "0")}ms`;
}

function formatCountdownMinSec(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function calculateScoreFromAnswers(ansObj) {
  let score = 0;
  QUIZ_QUESTIONS.forEach((q) => {
    const chosen = String((ansObj && ansObj[q.number]) || "").toUpperCase();
    if (chosen && chosen === q.correct) score++;
  });
  return score;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ==========================================
// MODAL DE CONFIRMAÇÃO
// ==========================================
function openConfirmModal({ title, text, cancelLabel = "Voltar", confirmLabel = "Confirmar", onConfirm }) {
  confirmModalTitle.textContent = title;
  confirmModalText.textContent = text;
  btnModalCancel.textContent = cancelLabel;
  btnModalConfirm.textContent = confirmLabel;
  modalConfirmCallback = onConfirm;
  confirmModal.style.display = "flex";
}

function closeConfirmModal() {
  confirmModal.style.display = "none";
  modalConfirmCallback = null;
}

// ==========================================
// SOM DO MAR E MÚSICA DE FUNDO
// ==========================================
function createSeaWavesAmbienceUrl() {
  const sampleRate = 22050;
  const durationSeconds = 16;
  const numSamples = sampleRate * durationSeconds;
  const leftChannel = new Float32Array(numSamples);
  const rightChannel = new Float32Array(numSamples);

  let b0L = 0, b1L = 0, b2L = 0, b3L = 0, b4L = 0, b5L = 0, b6L = 0;
  let b0R = 0, b1R = 0, b2R = 0, b3R = 0, b4R = 0, b5R = 0, b6R = 0;
  let waveLpL = 0, waveLpR = 0;
  let hullLpL = 0, hullLpR = 0;
  let hullHpL = 0, hullHpR = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const whiteL = Math.random() * 2 - 1;
    const whiteR = Math.random() * 2 - 1;

    b0L = 0.99886 * b0L + whiteL * 0.0555179;
    b1L = 0.99332 * b1L + whiteL * 0.0750759;
    b2L = 0.96900 * b2L + whiteL * 0.1538520;
    b3L = 0.86650 * b3L + whiteL * 0.3104856;
    b4L = 0.55000 * b4L + whiteL * 0.5329522;
    b5L = -0.7616 * b5L - whiteL * 0.0168980;
    const pinkL = (b0L + b1L + b2L + b3L + b4L + b5L + b6L + whiteL * 0.5362) * 0.04;
    b6L = whiteL * 0.115926;

    b0R = 0.99886 * b0R + whiteR * 0.0555179;
    b1R = 0.99332 * b1R + whiteR * 0.0750759;
    b2R = 0.96900 * b2R + whiteR * 0.1538520;
    b3R = 0.86650 * b3R + whiteR * 0.3104856;
    b4R = 0.55000 * b4R + whiteR * 0.5329522;
    b5R = -0.7616 * b5R - whiteR * 0.0168980;
    const pinkR = (b0R + b1R + b2R + b3R + b4R + b5R + b6R + whiteR * 0.5362) * 0.04;
    b6R = whiteR * 0.115926;

    const wavePhase1 = (2 * Math.PI * t) / 8.0;
    const waveShape1 = 0.5 + 0.5 * Math.sin(wavePhase1 - 0.35 * Math.cos(wavePhase1));
    const wavePhase2 = (2 * Math.PI * t) / 8.0 + 1.5;
    const waveShape2 = 0.5 + 0.5 * Math.sin(wavePhase2 - 0.3 * Math.cos(wavePhase2));

    const cutoffHzL = 160 + 1100 * Math.pow(waveShape1, 1.8);
    const cutoffHzR = 160 + 1100 * Math.pow(waveShape2, 1.8);
    const alphaL = Math.min(0.85, (2 * Math.PI * cutoffHzL) / sampleRate);
    const alphaR = Math.min(0.85, (2 * Math.PI * cutoffHzR) / sampleRate);

    waveLpL += alphaL * (pinkL - waveLpL);
    waveLpR += alphaR * (pinkR - waveLpR);

    const sprayL = whiteL * 0.014 * Math.pow(waveShape1, 4.0);
    const sprayR = whiteR * 0.014 * Math.pow(waveShape2, 4.0);

    const oceanL = (waveLpL * (0.25 + 0.45 * waveShape1) + sprayL) * 0.65;
    const oceanR = (waveLpR * (0.25 + 0.45 * waveShape2) + sprayR) * 0.65;

    const hullPhase = (2 * Math.PI * t) / 1.6;
    const hullSplashEnv = Math.pow(0.5 + 0.5 * Math.sin(hullPhase + 0.4 * Math.sin(hullPhase)), 3.2);
    const hullAlphaLp = Math.min(0.9, (2 * Math.PI * 1350) / sampleRate);
    const hullAlphaHp = Math.min(0.9, (2 * Math.PI * 380) / sampleRate);

    hullLpL += hullAlphaLp * (pinkL - hullLpL);
    hullHpL += hullAlphaHp * (hullLpL - hullHpL);
    const waterLapL = (hullLpL - hullHpL) * hullSplashEnv * 0.35;

    hullLpR += hullAlphaLp * (pinkR - hullLpR);
    hullHpR += hullAlphaHp * (hullLpR - hullHpR);
    const waterLapR = (hullLpR - hullHpR) * hullSplashEnv * 0.35;

    leftChannel[i] = oceanL + waterLapL;
    rightChannel[i] = oceanR + waterLapR;
  }

  const crossfadeSamples = Math.floor(0.25 * sampleRate);
  for (let i = 0; i < crossfadeSamples; i++) {
    const fade = i / crossfadeSamples;
    const endIdx = numSamples - crossfadeSamples + i;
    leftChannel[i] = leftChannel[i] * fade + leftChannel[endIdx] * (1 - fade);
    rightChannel[i] = rightChannel[i] * fade + rightChannel[endIdx] * (1 - fade);
  }

  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-0.95, Math.min(0.95, leftChannel[i]));
    const r = Math.max(-0.95, Math.min(0.95, rightChannel[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }

  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function applyVolumes() {
  const effective = isMuted ? 0 : masterVolume;
  bgMusic.volume = effective;
  bgMusic.muted = isMuted;
  seaAmbience.volume = Math.min(1, effective * 0.45);
  seaAmbience.muted = isMuted;
}

function updateMusicUI() {
  const isPlaying = !bgMusic.paused && !bgMusic.ended;
  btnMusicToggle.classList.toggle("playing", isPlaying);

  if (isPlaying) {
    musicToggleIcon.textContent = "||";
    musicToggleText.textContent = "Pausar";
  } else {
    musicToggleIcon.textContent = "▶";
    musicToggleText.textContent = "Tocar";
  }

  const effectiveVol = isMuted ? 0 : Math.round(masterVolume * 100);
  volumeSlider.value = String(effectiveVol);
  volumePercent.textContent = `${effectiveVol}%`;

  if (volumeSvgUse) {
    volumeSvgUse.setAttribute("href", effectiveVol === 0 ? "#svg-speaker-off" : "#svg-speaker-on");
  }
}

function tryAutoPlay() {
  if (userManuallyPaused) return;
  if (!bgMusic.paused) {
    if (seaAmbience.paused) seaAmbience.play().catch(() => {});
    updateMusicUI();
    return;
  }
  seaAmbience.play().catch(() => {});
  bgMusic
    .play()
    .then(() => {
      updateMusicUI();
      removeAutoplayUnlockListeners();
    })
    .catch(() => {
      updateMusicUI();
    });
}

const UNLOCK_EVENTS = ["pointerdown", "pointermove", "mousemove", "keydown", "touchstart", "wheel", "click"];

function removeAutoplayUnlockListeners() {
  UNLOCK_EVENTS.forEach((evt) => window.removeEventListener(evt, tryAutoPlay));
}

function initMusicPlayer() {
  seaAmbience.src = createSeaWavesAmbienceUrl();
  applyVolumes();
  updateMusicUI();
  tryAutoPlay();

  UNLOCK_EVENTS.forEach((evt) => window.addEventListener(evt, tryAutoPlay, { passive: true }));

  btnMusicToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (bgMusic.paused) {
      userManuallyPaused = false;
      seaAmbience.play().catch(() => {});
      bgMusic.play().then(updateMusicUI).catch(() => {});
    } else {
      userManuallyPaused = true;
      removeAutoplayUnlockListeners();
      bgMusic.pause();
      seaAmbience.pause();
      updateMusicUI();
    }
  });

  volumeSlider.addEventListener("input", (e) => {
    const val = Number(e.target.value) / 100;
    masterVolume = val;
    if (val > 0) {
      isMuted = false;
      previousVolume = val;
    }
    applyVolumes();
    if (bgMusic.paused && !userManuallyPaused && val > 0) tryAutoPlay();
    updateMusicUI();
  });

  btnMute.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isMuted || masterVolume === 0) {
      isMuted = false;
      if (masterVolume === 0) masterVolume = previousVolume || 0.65;
    } else {
      previousVolume = masterVolume;
      isMuted = true;
    }
    applyVolumes();
    updateMusicUI();
  });

  bgMusic.addEventListener("play", updateMusicUI);
  bgMusic.addEventListener("pause", updateMusicUI);
}

// ==========================================
// RENDERIZAÇÃO DOS SLIDES DE PERGUNTAS (1 A 6)
// ==========================================
function renderQuestionSlides() {
  const fragment = document.createDocumentFragment();

  QUIZ_QUESTIONS.forEach((q) => {
    const section = document.createElement("section");
    section.className = "slide-card";
    section.dataset.slide = String(q.number);
    section.setAttribute("aria-label", `Pergunta ${q.number}`);

    const optionsHtml = q.options
      .map(
        (opt) => `
        <button
          type="button"
          class="option-btn"
          data-question="${q.number}"
          data-letter="${opt.letter}"
          aria-pressed="false"
        >
          <span class="option-letter">${opt.letter}</span>
          <span class="option-text">${opt.text}</span>
          <span class="option-check" aria-hidden="true">✓</span>
        </button>
      `
      )
      .join("");

    const isLastQuestion = q.number === QUIZ_QUESTIONS.length;

    section.innerHTML = `
      <div class="question-layout">
        <div class="question-header-row">
          <div class="question-number-badge" aria-hidden="true">${q.number}</div>
          <div class="question-box-wrap">
            <h2 class="question-box">${q.question}</h2>
            <svg class="question-burst" aria-hidden="true">
              <use href="#svg-burst-small"></use>
            </svg>
          </div>
        </div>

        <div class="options-list" role="group" aria-label="Opções da pergunta ${q.number}">
          ${optionsHtml}
        </div>

        <div class="question-nav-footer">
          ${
            q.number > 1
              ? `<button type="button" class="btn-nav" data-action="prev" data-from="${q.number}">
                  <span>←</span>
                  <span>Questão Anterior</span>
                </button>`
              : `<span></span>`
          }

          ${
            isLastQuestion
              ? `<button type="button" class="btn-nav btn-finish-match" data-action="finish" data-from="${q.number}">
                  <span>Finalizar e Enviar Respostas</span>
                </button>`
              : `<button type="button" class="btn-nav btn-nav-primary" data-action="next" data-from="${q.number}">
                  <span>Próxima Questão</span>
                  <span>→</span>
                </button>`
          }
        </div>
      </div>

      <div class="waves-footer">
        <svg><use href="#svg-ocean-waves"></use></svg>
      </div>
    `;

    fragment.appendChild(section);
  });

  questionsMount.replaceWith(fragment);
}

function resetHorizontalOffset() {
  if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
}

function showSlide(slideId) {
  const changed = currentSlide !== String(slideId);
  currentSlide = String(slideId);

  const isQuestionSlide = ["1", "2", "3", "4", "5", "6"].includes(currentSlide);
  timerTopbar.classList.toggle("visible", isQuestionSlide);

  const allSlides = slidesContainer.querySelectorAll(".slide-card");
  allSlides.forEach((card) => {
    card.classList.toggle("active", card.dataset.slide === currentSlide);
  });

  if (changed) window.scrollTo(0, 0);
  resetHorizontalOffset();
  saveSessionState();
}

function applySelectedOptionsToDOM() {
  slidesContainer.querySelectorAll(".option-btn").forEach((btn) => {
    const qNum = Number(btn.dataset.question);
    const isSelected = userAnswers[qNum] === btn.dataset.letter;
    btn.classList.toggle("selected", isSelected);
    btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

function selectOption(questionNum, letter) {
  if (hasSubmitted) return;
  userAnswers[questionNum] = letter;

  const slideEl = slidesContainer.querySelector(`.slide-card[data-slide="${questionNum}"]`);
  if (slideEl) {
    slideEl.querySelectorAll(".option-btn").forEach((btn) => {
      const isSelected = btn.dataset.letter === letter;
      btn.classList.toggle("selected", isSelected);
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  }
  saveSessionState();
}

// ==========================================
// CRONÔMETRO DE 3 MINUTOS
// ==========================================
function startLocalMatchTimer(existingStartWallTime) {
  stopLocalMatchTimer();
  hasSubmitted = false;
  matchStartWallTime = existingStartWallTime || Date.now();

  function updateClock() {
    if (hasSubmitted) return;
    const elapsed = Math.max(0, Date.now() - matchStartWallTime);
    const remaining = Math.max(0, MAX_TIME_MS - elapsed);

    timerRemainingEl.textContent = formatCountdownMinSec(remaining);
    timerClockBox.classList.toggle("urgent", remaining <= 30000);

    if (remaining <= 0) {
      closeConfirmModal();
      submitQuizAnswers(MAX_TIME_MS);
    }
  }

  updateClock();
  timerIntervalId = setInterval(updateClock, 150);
  saveSessionState();
}

function stopLocalMatchTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

// ==========================================
// RANKING GLOBAL EM TEMPO REAL (SSE + SYNC)
// ==========================================
function updateRankingState(list) {
  if (!Array.isArray(list)) return;
  globalRanking = list;
  saveLocalRankingCache(globalRanking);
  if (currentSlide === "7") {
    renderFinalRankingAndChoices();
  }
}

function connectRankingEvents() {
  if (eventSource && eventSource.readyState !== EventSource.CLOSED) return;
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  try {
    eventSource = new EventSource("/api/ranking/events");
    eventSource.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "ranking_update" && Array.isArray(data.ranking)) {
          updateRankingState(data.ranking);
        }
      } catch {
        // ignora
      }
    };
    eventSource.onerror = () => {
      if (eventSource && eventSource.readyState === EventSource.CLOSED) {
        setTimeout(syncRankingWithServer, 2500);
      }
    };
  } catch {
    // ignora
  }
}

async function syncRankingWithServer() {
  const cached = loadLocalRankingCache();
  try {
    const res = await fetch("/api/ranking/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cachedRanking: cached })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.ranking)) {
        updateRankingState(data.ranking);
      }
    }
  } catch {
    if (globalRanking.length === 0 && cached.length > 0) {
      globalRanking = cached;
      if (currentSlide === "7") renderFinalRankingAndChoices();
    }
  }
  connectRankingEvents();
}

// ==========================================
// FLUXO DO QUIZ
// ==========================================
function startNewQuiz() {
  const nameInput = document.getElementById("input-player-name");
  const errorEl = document.getElementById("entry-error-msg");
  const name = nameInput.value.trim();

  if (!name) {
    errorEl.textContent = "Por favor, digite seu nome para começar o quiz.";
    nameInput.focus();
    return;
  }

  errorEl.textContent = "";
  playerId = generateLocalId();
  playerName = name;
  viewOnlyRanking = false;
  hasSubmitted = false;
  finalElapsedMs = 0;

  Object.keys(userAnswers).forEach((k) => delete userAnswers[k]);
  applySelectedOptionsToDOM();

  startLocalMatchTimer();
  showSlide("1");
}

function openRankingOnly() {
  viewOnlyRanking = true;
  hasSubmitted = false;
  stopLocalMatchTimer();
  renderFinalRankingAndChoices();
  showSlide("7");
  syncRankingWithServer();
}

async function submitQuizAnswers(forcedElapsedMs) {
  if (hasSubmitted) return;
  hasSubmitted = true;

  const measuredElapsed =
    typeof forcedElapsedMs === "number"
      ? forcedElapsedMs
      : matchStartWallTime
      ? Math.min(MAX_TIME_MS, Math.max(100, Math.round(Date.now() - matchStartWallTime)))
      : MAX_TIME_MS;

  finalElapsedMs = measuredElapsed;
  stopLocalMatchTimer();
  saveSessionState();

  try {
    const res = await fetch("/api/ranking/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: playerId,
        name: playerName,
        answers: userAnswers,
        elapsedMs: finalElapsedMs
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.ranking)) {
        updateRankingState(data.ranking);
      }
    }
  } catch {
    // Fallback local se houver oscilação momentânea de rede
    const localScore = calculateScoreFromAnswers(userAnswers);
    const merged = [...globalRanking.filter((e) => e.id !== playerId), {
      id: playerId,
      name: playerName,
      score: localScore,
      totalQuestions: 6,
      elapsedMs: finalElapsedMs,
      finishedAt: Date.now()
    }].sort((a, b) => (b.score !== a.score ? b.score - a.score : a.elapsedMs - b.elapsedMs));
    updateRankingState(merged);
  }

  renderFinalRankingAndChoices();
  showSlide("7");
}

function renderFinalRankingAndChoices() {
  const myScoreSummary = document.getElementById("my-score-summary");
  const finalChoicesBox = document.getElementById("final-choices-box");

  myScoreSummary.style.display = viewOnlyRanking ? "none" : "grid";
  finalChoicesBox.style.display = viewOnlyRanking ? "none" : "block";

  const localScore = calculateScoreFromAnswers(userAnswers);
  let effectiveRanking = Array.isArray(globalRanking) ? [...globalRanking] : [];

  if (!viewOnlyRanking && playerId && hasSubmitted) {
    const exists = effectiveRanking.some((p) => p.id === playerId);
    if (!exists) {
      effectiveRanking.push({
        id: playerId,
        name: playerName || "Você",
        score: localScore,
        elapsedMs: finalElapsedMs || MAX_TIME_MS
      });
      effectiveRanking.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.elapsedMs - b.elapsedMs));
    }
  }

  const count = effectiveRanking.length;
  document.getElementById("ranking-progress-text").textContent =
    count === 1 ? "1 participante" : `${count} participantes`;

  if (!viewOnlyRanking) {
    const myIndex = effectiveRanking.findIndex((p) => p.id === playerId);
    const myEntry = effectiveRanking[myIndex];

    document.getElementById("my-rank-pos").textContent = myIndex >= 0 ? `#${myIndex + 1}º` : "#1º";
    document.getElementById("my-score-count").textContent = `${myEntry ? myEntry.score : localScore} / 6`;
    document.getElementById("my-time-formatted").textContent = formatMinSecMs(
      myEntry ? myEntry.elapsedMs : finalElapsedMs
    );
  }

  const tbody = document.getElementById("ranking-tbody");
  if (effectiveRanking.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding: 18px;">
          Ninguém completou o quiz ainda. Seja o primeiro!
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = effectiveRanking
      .map((p, idx) => {
        const isMe = !viewOnlyRanking && p.id === playerId;
        const meBadge = isMe ? `<span class="me-tag">Você</span>` : "";
        return `
          <tr class="${isMe ? "is-me-row" : ""}">
            <td>${idx + 1}º</td>
            <td>${escapeHtml(p.name)}${meBadge}</td>
            <td>${p.score} / 6</td>
            <td class="col-time">${formatMinSecMs(p.elapsedMs)}</td>
          </tr>
        `;
      })
      .join("");
  }

  if (!viewOnlyRanking) {
    finalChoicesGrid.innerHTML = QUIZ_QUESTIONS.map((q) => {
      const chosenLetter = userAnswers[q.number];
      const chosenOpt = q.options.find((o) => o.letter === chosenLetter);
      const correctOpt = q.options.find((o) => o.letter === q.correct);
      const isCorrect = chosenLetter === q.correct;

      const answerHtml = chosenOpt
        ? `<span class="choice-a-letter">${chosenOpt.letter}</span><span>${chosenOpt.text}</span>`
        : `<span class="choice-a-letter">?</span><span><em>Não respondida</em></span>`;

      const correctHintHtml = !isCorrect && correctOpt
        ? `<div class="choice-correct-hint">✓ Correta: <strong>${correctOpt.letter})</strong> ${correctOpt.text}</div>`
        : `<div class="choice-correct-hint">✓ Você acertou!</div>`;

      return `
        <div class="choice-item ${isCorrect ? "is-correct" : "is-wrong"}">
          <div class="choice-q">
            <span class="choice-q-num">${q.number}</span>
            <span>${q.question}</span>
          </div>
          <div class="choice-a">
            ${answerHtml}
          </div>
          ${correctHintHtml}
        </div>
      `;
    }).join("");
  }
}

function handleNextQuestionRequest(fromQuestionNum) {
  if (!userAnswers[fromQuestionNum]) {
    openConfirmModal({
      title: `Questão ${fromQuestionNum} em branco`,
      text: `Você ainda não selecionou nenhuma resposta na Questão ${fromQuestionNum}. Deseja avançar para a próxima questão sem responder?`,
      cancelLabel: "Voltar e Responder",
      confirmLabel: "Avançar sem Responder →",
      onConfirm: () => showSlide(String(fromQuestionNum + 1))
    });
  } else {
    showSlide(String(fromQuestionNum + 1));
  }
}

function handleFinishQuizRequest() {
  const answeredCount = QUIZ_QUESTIONS.filter((q) => Boolean(userAnswers[q.number])).length;
  const unansweredNumbers = QUIZ_QUESTIONS.filter((q) => !userAnswers[q.number]).map((q) => q.number);

  const extraWarning =
    unansweredNumbers.length > 0
      ? ` Atenção: você deixou a(s) questão(ões) ${unansweredNumbers.join(", ")} sem resposta.`
      : " Todas as questões foram respondidas!";

  openConfirmModal({
    title: "Confirmar Finalização?",
    text: `Você respondeu ${answeredCount} de 6 perguntas.${extraWarning} Tem certeza de que deseja finalizar e enviar suas respostas?`,
    cancelLabel: "Revisar Questões",
    confirmLabel: "✓ Sim, Finalizar Agora",
    onConfirm: () => submitQuizAnswers()
  });
}

function resetToHome() {
  stopLocalMatchTimer();
  closeConfirmModal();
  sessionStorage.removeItem(SESSION_KEY);
  playerId = null;
  viewOnlyRanking = false;
  hasSubmitted = false;
  finalElapsedMs = 0;
  Object.keys(userAnswers).forEach((k) => delete userAnswers[k]);
  applySelectedOptionsToDOM();
  showSlide("0");
}

function restorePreviousSessionIfAny() {
  const saved = loadSessionState();
  if (!saved || saved.currentSlide === "0") return;

  playerId = saved.playerId;
  playerName = saved.playerName || "";
  viewOnlyRanking = Boolean(saved.viewOnlyRanking);
  hasSubmitted = Boolean(saved.hasSubmitted);
  finalElapsedMs = Number(saved.finalElapsedMs) || 0;
  matchStartWallTime = saved.matchStartWallTime || Date.now();

  Object.keys(userAnswers).forEach((k) => delete userAnswers[k]);
  if (saved.userAnswers && typeof saved.userAnswers === "object") {
    Object.assign(userAnswers, saved.userAnswers);
  }

  const nameInput = document.getElementById("input-player-name");
  if (nameInput && playerName) nameInput.value = playerName;

  applySelectedOptionsToDOM();

  if (saved.currentSlide === "7" || hasSubmitted) {
    renderFinalRankingAndChoices();
    showSlide("7");
  } else if (["1", "2", "3", "4", "5", "6"].includes(String(saved.currentSlide))) {
    startLocalMatchTimer(matchStartWallTime);
    showSlide(String(saved.currentSlide));
  }
}

function initQuiz() {
  renderQuestionSlides();
  initMusicPlayer();

  // Carrega cache local imediatamente e sincroniza com o servidor + SSE
  globalRanking = loadLocalRankingCache();
  syncRankingWithServer();

  restorePreviousSessionIfAny();

  window.addEventListener("resize", resetHorizontalOffset);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      resetHorizontalOffset();
      syncRankingWithServer();
    }
  });

  window.addEventListener("focus", () => {
    resetHorizontalOffset();
    syncRankingWithServer();
  });

  // Modal de confirmação
  btnModalCancel.addEventListener("click", closeConfirmModal);
  btnModalConfirm.addEventListener("click", () => {
    const cb = modalConfirmCallback;
    closeConfirmModal();
    if (typeof cb === "function") cb();
  });

  // Botões da Capa
  document.getElementById("btn-start-quiz").addEventListener("click", () => {
    tryAutoPlay();
    startNewQuiz();
  });

  document.getElementById("input-player-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      tryAutoPlay();
      startNewQuiz();
    }
  });

  document.getElementById("btn-view-ranking").addEventListener("click", () => {
    tryAutoPlay();
    openRankingOnly();
  });

  // Delegação de eventos das Questões 1 a 6
  slidesContainer.addEventListener("click", (e) => {
    tryAutoPlay();

    const optionBtn = e.target.closest(".option-btn");
    if (optionBtn) {
      selectOption(Number(optionBtn.dataset.question), optionBtn.dataset.letter);
      return;
    }

    const navBtn = e.target.closest("[data-action]");
    if (navBtn) {
      const action = navBtn.dataset.action;
      const from = Number(navBtn.dataset.from);
      if (action === "prev" && from > 1) {
        showSlide(String(from - 1));
      } else if (action === "next" && from < 6) {
        handleNextQuestionRequest(from);
      } else if (action === "finish") {
        handleFinishQuizRequest();
      }
    }
  });

  document.getElementById("btn-restart-quiz").addEventListener("click", resetToHome);
}

document.addEventListener("DOMContentLoaded", initQuiz);
