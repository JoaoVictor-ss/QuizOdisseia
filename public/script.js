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
const MAX_PLAYERS = 40;
const PEER_PREFIX = "odisseia-quiz-2026-";

// Estado da Sessão e Sala Multiplayer
let currentSlide = "0"; // '0' | 'lobby' | '1'..'6' | '7'
const userAnswers = {};
let roomCode = null;
let playerId = null;
let playerName = "";
let isHost = false;
let hostPlays = true; // Se o dono da sala vai jogar (true) ou só acompanhar o ranking (false)
let currentRoomData = null;
let eventSource = null;

// Modo P2P (PeerJS) para fallback em Static Site
let useP2PMode = false;
let peerInstance = null;
let hostConnections = new Map();
let guestConnection = null;
let p2pRoomState = null;

// Cronômetro de alta precisão (internamente mede milésimos; no topo exibe só Min:Seg)
let matchStartPerf = null;
let timerIntervalId = null;
let spectatorTimerIntervalId = null;
let hasSubmitted = false;
let finalElapsedMs = 0;

// Elementos DOM
const slidesContainer = document.getElementById("slides-container");
const questionsMount = document.getElementById("questions-mount");
const finalChoicesGrid = document.getElementById("final-choices-grid");
const timerTopbar = document.getElementById("timer-topbar");
const timerRoomCode = document.getElementById("timer-room-code");
const timerClockBox = document.getElementById("timer-clock-box");
const timerRemainingEl = document.getElementById("timer-remaining");
const timerElapsedEl = document.getElementById("timer-elapsed");

// Elementos do Modal de Confirmação
const confirmModal = document.getElementById("confirm-modal");
const confirmModalTitle = document.getElementById("confirm-modal-title");
const confirmModalText = document.getElementById("confirm-modal-text");
const btnModalCancel = document.getElementById("btn-modal-cancel");
const btnModalConfirm = document.getElementById("btn-modal-confirm");
let modalConfirmCallback = null;

// Elementos de Áudio
const bgMusic = document.getElementById("bg-music");
const seaAmbience = document.getElementById("sea-ambience");
const btnMusicToggle = document.getElementById("btn-music-toggle");
const musicToggleIcon = document.getElementById("music-toggle-icon");
const musicToggleText = document.getElementById("music-toggle-text");
const btnMute = document.getElementById("btn-mute");
const volumeIcon = document.getElementById("volume-icon");
const volumeSlider = document.getElementById("volume-slider");
const volumePercent = document.getElementById("volume-percent");

let userManuallyPaused = false;
let masterVolume = 0.65;
let isMuted = false;
let previousVolume = 0.65;

function generateRandomCode5() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateLocalId() {
  return "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * Formata milissegundos em "MMm SSs MMMms" (para o Ranking Final, com milésimos para desempate)
 */
function formatMinSecMs(ms) {
  const clamped = Math.max(0, Math.round(ms));
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const millis = clamped % 1000;

  const mStr = String(minutes).padStart(2, "0");
  const sStr = String(seconds).padStart(2, "0");
  const msStr = String(millis).padStart(3, "0");
  return `${mStr}m ${sStr}s ${msStr}ms`;
}

/**
 * Formata milissegundos em "MMm SSs" (sem milésimos para a barra do topo)
 */
function formatMinSecOnly(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * Formata milissegundos para o relógio regressivo do topo "MM:SS" (sem milésimos)
 */
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
    if (chosen && chosen === q.correct) {
      score++;
    }
  });
  return score;
}

// ==========================================
// MODAL DE CONFIRMAÇÃO PERSONALIZADO
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

    const ampWaveL = 0.25 + 0.45 * waveShape1;
    const ampWaveR = 0.25 + 0.45 * waveShape2;

    const oceanL = (waveLpL * ampWaveL + sprayL) * 0.65;
    const oceanR = (waveLpR * ampWaveR + sprayR) * 0.65;

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
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
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

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
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
    musicToggleIcon.textContent = "⏸";
    musicToggleText.textContent = "Pausar";
  } else {
    musicToggleIcon.textContent = "▶";
    musicToggleText.textContent = "Tocar";
  }

  const effectiveVol = isMuted ? 0 : Math.round(masterVolume * 100);
  volumeSlider.value = String(effectiveVol);
  volumePercent.textContent = `${effectiveVol}%`;

  if (effectiveVol === 0) {
    volumeIcon.textContent = "🔇";
  } else if (effectiveVol < 50) {
    volumeIcon.textContent = "🔉";
  } else {
    volumeIcon.textContent = "🔊";
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
  UNLOCK_EVENTS.forEach((evt) => {
    window.removeEventListener(evt, tryAutoPlay);
  });
}

function initMusicPlayer() {
  seaAmbience.src = createSeaWavesAmbienceUrl();
  applyVolumes();
  updateMusicUI();
  tryAutoPlay();

  UNLOCK_EVENTS.forEach((evt) => {
    window.addEventListener(evt, tryAutoPlay, { passive: true });
  });

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
    if (bgMusic.paused && !userManuallyPaused && val > 0) {
      tryAutoPlay();
    }
    updateMusicUI();
  });

  btnMute.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isMuted || masterVolume === 0) {
      isMuted = false;
      if (masterVolume === 0) {
        masterVolume = previousVolume || 0.65;
      }
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
                  <span>🏁 Finalizar e Enviar Respostas</span>
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

function showSlide(slideId) {
  currentSlide = String(slideId);

  const isQuestionSlide = ["1", "2", "3", "4", "5", "6"].includes(currentSlide);
  timerTopbar.classList.toggle("visible", isQuestionSlide);

  const allSlides = slidesContainer.querySelectorAll(".slide-card");
  allSlides.forEach((card) => {
    card.classList.toggle("active", card.dataset.slide === currentSlide);
  });
}

function selectOption(questionNum, letter) {
  if (hasSubmitted) return;
  userAnswers[questionNum] = letter;

  const slideEl = slidesContainer.querySelector(`.slide-card[data-slide="${questionNum}"]`);
  if (slideEl) {
    const buttons = slideEl.querySelectorAll(".option-btn");
    buttons.forEach((btn) => {
      const isSelected = btn.dataset.letter === letter;
      btn.classList.toggle("selected", isSelected);
      btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  }
}

// ==========================================
// CRONÔMETRO DE 3 MINUTOS (NO TOPO SÓ MIN:SEG, NO FINAL COM MILÉSIMOS)
// ==========================================
function startLocalMatchTimer() {
  stopLocalMatchTimer();
  hasSubmitted = false;
  matchStartPerf = performance.now();
  timerRoomCode.textContent = roomCode || "-----";
  timerRemainingEl.textContent = "03:00";
  timerElapsedEl.textContent = "00m 00s";

  timerIntervalId = setInterval(() => {
    if (hasSubmitted) return;
    const elapsed = Math.max(0, performance.now() - matchStartPerf);
    const remaining = Math.max(0, MAX_TIME_MS - elapsed);

    timerRemainingEl.textContent = formatCountdownMinSec(remaining);
    timerElapsedEl.textContent = formatMinSecOnly(elapsed);
    timerClockBox.classList.toggle("urgent", remaining <= 30000);

    if (remaining <= 0) {
      closeConfirmModal();
      submitMatchAnswers(MAX_TIME_MS);
    }
  }, 150);
}

function stopLocalMatchTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function startSpectatorRoomTimer() {
  stopSpectatorRoomTimer();
  const badge = document.getElementById("ranking-spectator-timer");
  const digits = document.getElementById("spectator-timer-digits");
  badge.style.display = "inline-flex";
  const startPerf = performance.now();

  spectatorTimerIntervalId = setInterval(() => {
    const elapsed = Math.max(0, performance.now() - startPerf);
    const remaining = Math.max(0, MAX_TIME_MS - elapsed);
    digits.textContent = formatCountdownMinSec(remaining);
    if (remaining <= 0) {
      stopSpectatorRoomTimer();
    }
  }, 250);
}

function stopSpectatorRoomTimer() {
  if (spectatorTimerIntervalId) {
    clearInterval(spectatorTimerIntervalId);
    spectatorTimerIntervalId = null;
  }
  const badge = document.getElementById("ranking-spectator-timer");
  if (badge) badge.style.display = "none";
}

// ==========================================
// MOTOR P2P (PEERJS) PARA FALLBACK EM STATIC SITE
// ==========================================
function serializeP2PRoom() {
  if (!p2pRoomState) return null;
  const allUsers = Array.from(p2pRoomState.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.id === p2pRoomState.hostId,
    isSpectator: Boolean(p.isSpectator),
    finished: p.finished,
    score: p.score,
    totalQuestions: 6,
    elapsedMs: p.elapsedMs,
    joinedAt: p.joinedAt
  }));

  const activePlayers = allUsers.filter((p) => !p.isSpectator);

  const ranking = [...activePlayers].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (!a.finished && !b.finished) return a.joinedAt - b.joinedAt;
    if (b.score !== a.score) return b.score - a.score;
    return (a.elapsedMs ?? MAX_TIME_MS) - (b.elapsedMs ?? MAX_TIME_MS);
  });

  return {
    code: p2pRoomState.code,
    hostId: p2pRoomState.hostId,
    hostPlays: p2pRoomState.hostPlays,
    status: p2pRoomState.status,
    startedAt: p2pRoomState.startedAt,
    maxPlayers: MAX_PLAYERS,
    playersCount: activePlayers.length,
    players: allUsers,
    ranking
  };
}

function broadcastP2PRoom() {
  const serialized = serializeP2PRoom();
  if (!serialized) return;
  const payload = { type: "room_update", room: serialized };
  for (const conn of hostConnections.values()) {
    try {
      if (conn.open) conn.send(payload);
    } catch {
      // ignora conexões fechadas
    }
  }
  handleRoomStateUpdate(serialized);
}

function createRoomP2P(name, ownerPlays) {
  const errorEl = document.getElementById("entry-error-msg");
  if (typeof Peer === "undefined") {
    errorEl.textContent = "Carregando módulo de salas... tente novamente em 1 segundo.";
    return;
  }

  useP2PMode = true;
  const code = generateRandomCode5();
  const myId = generateLocalId();

  if (peerInstance) {
    peerInstance.destroy();
  }

  peerInstance = new Peer(PEER_PREFIX + code);

  peerInstance.on("open", () => {
    roomCode = code;
    playerId = myId;
    playerName = name;
    isHost = true;
    hostPlays = ownerPlays;

    p2pRoomState = {
      code,
      hostId: myId,
      hostPlays: ownerPlays,
      status: "lobby",
      startedAt: null,
      players: new Map()
    };

    p2pRoomState.players.set(myId, {
      id: myId,
      name,
      isSpectator: !ownerPlays,
      joinedAt: Date.now(),
      finished: false,
      score: 0,
      elapsedMs: null,
      answers: {}
    });

    window.history.replaceState({}, "", `?sala=${roomCode}`);
    broadcastP2PRoom();
    showSlide("lobby");
  });

  peerInstance.on("connection", (conn) => {
    conn.on("data", (msg) => {
      if (!msg || typeof msg !== "object" || !p2pRoomState) return;

      if (msg.type === "join") {
        const gId = String(msg.playerId || generateLocalId());
        const gName = String(msg.playerName || "Tripulante").slice(0, 32);

        const activeCount = Array.from(p2pRoomState.players.values()).filter((p) => !p.isSpectator).length;
        if (!p2pRoomState.players.has(gId) && activeCount >= MAX_PLAYERS) {
          conn.send({ type: "error", error: "A sala já atingiu o limite de 40 participantes." });
          return;
        }

        hostConnections.set(gId, conn);
        p2pRoomState.players.set(gId, {
          id: gId,
          name: gName,
          isSpectator: false,
          joinedAt: Date.now(),
          finished: false,
          score: 0,
          elapsedMs: null,
          answers: {}
        });

        broadcastP2PRoom();
      } else if (msg.type === "submit") {
        const p = p2pRoomState.players.get(msg.playerId);
        if (p && !p.finished && !p.isSpectator) {
          p.finished = true;
          p.answers = msg.answers || {};
          p.score = calculateScoreFromAnswers(p.answers);
          p.elapsedMs = Math.min(MAX_TIME_MS, Math.max(100, Number(msg.elapsedMs) || MAX_TIME_MS));
          broadcastP2PRoom();
        }
      }
    });
  });

  peerInstance.on("error", (err) => {
    if (err && err.type === "unavailable-id") {
      createRoomP2P(name, ownerPlays);
    } else {
      errorEl.textContent = "Não foi possível criar a sala no momento. Tente novamente.";
    }
  });
}

function joinRoomP2P(code, name) {
  const errorEl = document.getElementById("entry-error-msg");
  if (typeof Peer === "undefined") {
    errorEl.textContent = "Carregando módulo de salas... tente novamente em 1 segundo.";
    return;
  }

  useP2PMode = true;
  const myId = playerId || generateLocalId();
  playerId = myId;
  playerName = name;

  if (peerInstance) {
    peerInstance.destroy();
  }

  peerInstance = new Peer();

  peerInstance.on("open", () => {
    const conn = peerInstance.connect(PEER_PREFIX + code, { reliable: true });
    guestConnection = conn;

    const timeout = setTimeout(() => {
      if (!currentRoomData) {
        errorEl.textContent = "Sala não encontrada ou o criador fechou a aba.";
      }
    }, 6000);

    conn.on("open", () => {
      roomCode = code;
      window.history.replaceState({}, "", `?sala=${roomCode}`);
      conn.send({
        type: "join",
        playerId: myId,
        playerName: name
      });
    });

    conn.on("data", (msg) => {
      clearTimeout(timeout);
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "error") {
        errorEl.textContent = msg.error || "Erro ao entrar na sala.";
        return;
      }
      if (msg.type === "room_update" && msg.room) {
        const wasOnCover = currentSlide === "0";
        handleRoomStateUpdate(msg.room);
        if (wasOnCover) {
          if (msg.room.status === "playing") {
            startLocalMatchTimer();
            showSlide("1");
          } else {
            showSlide("lobby");
          }
        }
      }
    });
  });

  peerInstance.on("error", (err) => {
    if (err && err.type === "peer-unavailable") {
      errorEl.textContent = "Sala não encontrada. Verifique o código de 5 dígitos.";
    } else {
      errorEl.textContent = "Erro ao conectar à sala. Verifique o código.";
    }
  });
}

// ==========================================
// COMUNICAÇÃO EM TEMPO REAL (SERVIDOR NODE OU PEERJS FALLBACK)
// ==========================================
function getShareableRoomLink(code) {
  const url = new URL(window.location.href);
  url.searchParams.set("sala", code);
  return url.toString();
}

function connectRoomEvents(code) {
  if (useP2PMode) return;
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  eventSource = new EventSource(`/api/rooms/${code}/events`);
  eventSource.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.type === "room_update" && data.room) {
        handleRoomStateUpdate(data.room);
      }
    } catch {
      // Ignora pacotes inválidos
    }
  };
}

function handleRoomStateUpdate(room) {
  const prevStatus = currentRoomData ? currentRoomData.status : null;
  currentRoomData = room;
  isHost = room.hostId === playerId;
  if (typeof room.hostPlays === "boolean") {
    hostPlays = room.hostPlays;
  }

  updateLobbyUI(room);

  // Se a sala acabou de mudar de 'lobby' para 'playing'
  if (room.status === "playing" && (currentSlide === "lobby" || prevStatus === "lobby")) {
    Object.keys(userAnswers).forEach((k) => delete userAnswers[k]);
    slidesContainer.querySelectorAll(".option-btn").forEach((btn) => {
      btn.classList.remove("selected");
      btn.setAttribute("aria-pressed", "false");
    });

    // Se for o dono da sala e escolheu NÃO jogar (apenas acompanhar o ranking)
    if (isHost && !hostPlays) {
      hasSubmitted = true;
      stopLocalMatchTimer();
      startSpectatorRoomTimer();
      renderFinalRankingAndChoices(room);
      showSlide("7");
      return;
    }

    startLocalMatchTimer();
    showSlide("1");
  }

  // Se o criador reiniciou a sala de volta para o Lobby
  if (room.status === "lobby" && currentSlide === "7") {
    stopLocalMatchTimer();
    stopSpectatorRoomTimer();
    closeConfirmModal();
    showSlide("lobby");
  }

  // Se o jogador/organizador já está na tela final (7), atualiza o Ranking Ao Vivo
  if (currentSlide === "7") {
    renderFinalRankingAndChoices(room);
  }
}

function updateLobbyUI(room) {
  document.getElementById("lobby-room-code").textContent = room.code;
  document.getElementById("lobby-players-count").textContent = `${room.playersCount} / ${room.maxPlayers}`;
  document.getElementById("lobby-share-url-preview").textContent = `Link de convite: ${getShareableRoomLink(room.code)}`;

  const grid = document.getElementById("lobby-players-grid");
  grid.innerHTML = room.players
    .map((p) => {
      const isMe = p.id === playerId;
      const crown = p.isHost ? "👑 " : "⚓ ";
      const meLabel = isMe ? " (Você)" : "";
      const specLabel = p.isSpectator ? " — Só acompanhando" : "";
      return `
        <div class="lobby-player-chip ${isMe ? "is-me" : ""} ${p.isSpectator ? "is-spectator" : ""}">
          <span>${crown}${escapeHtml(p.name)}${meLabel}${specLabel}</span>
        </div>
      `;
    })
    .join("");

  const hostModeBar = document.getElementById("lobby-host-mode-bar");
  const btnModePlay = document.getElementById("btn-mode-play");
  const btnModeSpectate = document.getElementById("btn-mode-spectate");
  const hostControls = document.getElementById("lobby-host-controls");
  const guestWaiting = document.getElementById("lobby-guest-waiting");

  if (isHost) {
    hostModeBar.style.display = "flex";
    btnModePlay.classList.toggle("active", hostPlays);
    btnModeSpectate.classList.toggle("active", !hostPlays);
    hostControls.style.display = "block";
    guestWaiting.style.display = "none";
  } else {
    hostModeBar.style.display = "none";
    hostControls.style.display = "none";
    guestWaiting.style.display = "block";
  }
}

async function setHostPlayMode(shouldPlay) {
  hostPlays = Boolean(shouldPlay);
  document.getElementById("check-host-plays").checked = hostPlays;

  if (!roomCode || !playerId || !isHost) return;

  if (useP2PMode && p2pRoomState) {
    p2pRoomState.hostPlays = hostPlays;
    const hp = p2pRoomState.players.get(playerId);
    if (hp) hp.isSpectator = !hostPlays;
    broadcastP2PRoom();
    return;
  }

  try {
    await fetch("/api/rooms/host-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: roomCode, playerId, hostPlays })
    });
  } catch {
    // atualizado via SSE
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function createRoom() {
  const nameInput = document.getElementById("input-player-name");
  const hostPlaysCheckbox = document.getElementById("check-host-plays");
  const errorEl = document.getElementById("entry-error-msg");
  const name = nameInput.value.trim();
  const ownerPlays = hostPlaysCheckbox ? hostPlaysCheckbox.checked : true;

  if (!name) {
    errorEl.textContent = "Por favor, digite seu nome antes de criar a sala.";
    nameInput.focus();
    return;
  }

  errorEl.textContent = "";
  try {
    const res = await fetch("/api/rooms/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName: name, hostPlays: ownerPlays })
    });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      createRoomP2P(name, ownerPlays);
      return;
    }

    const data = await res.json();
    if (!res.ok || !data.code) {
      errorEl.textContent = data.error || "Não foi possível criar a sala.";
      return;
    }

    useP2PMode = false;
    roomCode = data.code;
    playerId = data.playerId;
    playerName = name;
    isHost = true;
    hostPlays = ownerPlays;

    window.history.replaceState({}, "", `?sala=${roomCode}`);
    handleRoomStateUpdate(data.room);
    connectRoomEvents(roomCode);
    showSlide("lobby");
  } catch {
    createRoomP2P(name, ownerPlays);
  }
}

async function joinRoom() {
  const nameInput = document.getElementById("input-player-name");
  const codeInput = document.getElementById("input-room-code");
  const errorEl = document.getElementById("entry-error-msg");

  const name = nameInput.value.trim();
  const code = codeInput.value.trim().toUpperCase();

  if (!name) {
    errorEl.textContent = "Por favor, digite seu nome para entrar na sala.";
    nameInput.focus();
    return;
  }
  if (!code || code.length !== 5) {
    errorEl.textContent = "Digite o código de 5 dígitos da sala.";
    codeInput.focus();
    return;
  }

  errorEl.textContent = "";
  try {
    const res = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, playerName: name, playerId })
    });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      joinRoomP2P(code, name);
      return;
    }

    const data = await res.json();
    if (!res.ok || !data.code) {
      errorEl.textContent = data.error || "Não foi possível entrar na sala.";
      return;
    }

    useP2PMode = false;
    roomCode = data.code;
    playerId = data.playerId;
    playerName = name;

    window.history.replaceState({}, "", `?sala=${roomCode}`);
    handleRoomStateUpdate(data.room);
    connectRoomEvents(roomCode);

    if (data.room.status === "playing") {
      startLocalMatchTimer();
      showSlide("1");
    } else {
      showSlide("lobby");
    }
  } catch {
    joinRoomP2P(code, name);
  }
}

async function startMatchAsHost() {
  if (!roomCode || !playerId) return;

  if (useP2PMode && p2pRoomState) {
    p2pRoomState.status = "playing";
    p2pRoomState.startedAt = Date.now();
    for (const p of p2pRoomState.players.values()) {
      p.finished = false;
      p.score = 0;
      p.elapsedMs = null;
      p.answers = {};
    }
    broadcastP2PRoom();
    return;
  }

  try {
    await fetch("/api/rooms/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: roomCode, playerId, hostPlays })
    });
  } catch {
    // Tratado via SSE
  }
}

async function submitMatchAnswers(forcedElapsedMs) {
  if (hasSubmitted) return;
  hasSubmitted = true;

  const measuredElapsed =
    typeof forcedElapsedMs === "number"
      ? forcedElapsedMs
      : matchStartPerf
      ? Math.min(MAX_TIME_MS, Math.max(100, Math.round(performance.now() - matchStartPerf)))
      : MAX_TIME_MS;

  finalElapsedMs = measuredElapsed;
  stopLocalMatchTimer();

  if (useP2PMode) {
    if (isHost && p2pRoomState) {
      const me = p2pRoomState.players.get(playerId);
      if (me && !me.isSpectator) {
        me.finished = true;
        me.answers = { ...userAnswers };
        me.score = calculateScoreFromAnswers(userAnswers);
        me.elapsedMs = finalElapsedMs;
      }
      broadcastP2PRoom();
    } else if (guestConnection && guestConnection.open) {
      guestConnection.send({
        type: "submit",
        playerId,
        answers: userAnswers,
        elapsedMs: finalElapsedMs
      });
    }
    renderFinalRankingAndChoices(currentRoomData);
    showSlide("7");
    return;
  }

  try {
    const res = await fetch("/api/rooms/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: roomCode,
        playerId,
        answers: userAnswers,
        elapsedMs: finalElapsedMs
      })
    });
    const data = await res.json();
    if (res.ok && data.room) {
      currentRoomData = data.room;
    }
  } catch {
    // Continua com resultado local
  }

  renderFinalRankingAndChoices(currentRoomData);
  showSlide("7");
}

function renderFinalRankingAndChoices(room) {
  const isSpectatingHost = isHost && !hostPlays;
  const myScoreSummary = document.getElementById("my-score-summary");
  const finalChoicesBox = document.getElementById("final-choices-box");

  // Se o dono escolheu apenas acompanhar o ranking, oculta as caixas de resposta individual dele
  myScoreSummary.style.display = isSpectatingHost ? "none" : "grid";
  finalChoicesBox.style.display = isSpectatingHost ? "none" : "block";

  const localScore = calculateScoreFromAnswers(userAnswers);
  document.getElementById("ranking-room-code").textContent = roomCode || "-----";

  const tbody = document.getElementById("ranking-tbody");
  if (room && Array.isArray(room.ranking)) {
    const finishedCount = room.ranking.filter((p) => p.finished).length;
    document.getElementById("ranking-progress-text").textContent =
      `${finishedCount} de ${room.playersCount} finalizaram`;

    if (!isSpectatingHost) {
      const myIndex = room.ranking.findIndex((p) => p.id === playerId);
      const myPlayer = room.ranking[myIndex];

      document.getElementById("my-rank-pos").textContent =
        myIndex >= 0 ? `#${myIndex + 1}º` : "#1º";
      document.getElementById("my-score-count").textContent =
        `${myPlayer && myPlayer.finished ? myPlayer.score : localScore} / 6`;
      document.getElementById("my-time-formatted").textContent =
        formatMinSecMs(myPlayer && myPlayer.elapsedMs ? myPlayer.elapsedMs : finalElapsedMs);
    }

    if (room.ranking.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; padding: 18px;">
            Nenhum participante jogando nesta partida.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = room.ranking
        .map((p, idx) => {
          const pos = idx + 1;
          const medal = pos === 1 ? "🥇 1º" : pos === 2 ? "🥈 2º" : pos === 3 ? "🥉 3º" : `${pos}º`;
          const isMe = p.id === playerId;
          const meBadge = isMe ? `<span class="me-tag">Você</span>` : "";
          const scoreText = p.finished ? `${p.score} / 6` : "—";
          // No Ranking Final exibe Minuto, Segundo e Milésimo para desempate!
          const timeText = p.finished ? formatMinSecMs(p.elapsedMs) : "⏳ Respondendo...";

          return `
            <tr class="${isMe ? "is-me-row" : ""}">
              <td>${medal}</td>
              <td>${escapeHtml(p.name)}${meBadge}</td>
              <td>${scoreText}</td>
              <td class="col-time">${timeText}</td>
            </tr>
          `;
        })
        .join("");
    }

    const btnBackLobby = document.getElementById("btn-back-lobby");
    btnBackLobby.style.display = isHost ? "inline-flex" : "none";
  } else if (!isSpectatingHost) {
    document.getElementById("my-rank-pos").textContent = "#1º";
    document.getElementById("my-score-count").textContent = `${localScore} / 6`;
    document.getElementById("my-time-formatted").textContent = formatMinSecMs(finalElapsedMs);
  }

  if (!isSpectatingHost) {
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
  const hasAnswer = Boolean(userAnswers[fromQuestionNum]);
  if (!hasAnswer) {
    openConfirmModal({
      title: `Questão ${fromQuestionNum} em branco`,
      text: `Você ainda não selecionou nenhuma resposta na Questão ${fromQuestionNum}. Deseja avançar para a próxima questão sem responder?`,
      cancelLabel: "Voltar e Responder",
      confirmLabel: "Avançar sem Responder →",
      onConfirm: () => {
        showSlide(String(fromQuestionNum + 1));
      }
    });
  } else {
    showSlide(String(fromQuestionNum + 1));
  }
}

function handleFinishMatchRequest() {
  const answeredNumbers = QUIZ_QUESTIONS.filter((q) => Boolean(userAnswers[q.number])).map((q) => q.number);
  const unansweredNumbers = QUIZ_QUESTIONS.filter((q) => !userAnswers[q.number]).map((q) => q.number);
  const answeredCount = answeredNumbers.length;

  const extraWarning =
    unansweredNumbers.length > 0
      ? ` Atenção: você deixou a(s) questão(ões) ${unansweredNumbers.join(", ")} sem resposta.`
      : " Todas as questões foram respondidas!";

  openConfirmModal({
    title: "Confirmar Finalização?",
    text: `Você respondeu ${answeredCount} de 6 perguntas.${extraWarning} Tem certeza de que deseja finalizar e enviar suas respostas?`,
    cancelLabel: "Revisar Questões",
    confirmLabel: "✓ Sim, Finalizar Agora",
    onConfirm: () => {
      submitMatchAnswers();
    }
  });
}

function leaveRoomAndReset() {
  stopLocalMatchTimer();
  stopSpectatorRoomTimer();
  closeConfirmModal();
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (peerInstance) {
    peerInstance.destroy();
    peerInstance = null;
  }
  hostConnections.clear();
  guestConnection = null;
  p2pRoomState = null;
  roomCode = null;
  currentRoomData = null;
  hasSubmitted = false;
  Object.keys(userAnswers).forEach((k) => delete userAnswers[k]);
  window.history.replaceState({}, "", window.location.pathname);
  showSlide("0");
}

function initQuiz() {
  renderQuestionSlides();
  initMusicPlayer();

  const urlParams = new URLSearchParams(window.location.search);
  const urlRoomCode = urlParams.get("sala");
  if (urlRoomCode) {
    const codeInput = document.getElementById("input-room-code");
    codeInput.value = urlRoomCode.trim().toUpperCase().slice(0, 5);
  }

  // Eventos do Modal de Confirmação
  btnModalCancel.addEventListener("click", closeConfirmModal);
  btnModalConfirm.addEventListener("click", () => {
    const cb = modalConfirmCallback;
    closeConfirmModal();
    if (typeof cb === "function") cb();
  });

  // Botões de Criar e Entrar na Sala
  document.getElementById("btn-create-room").addEventListener("click", () => {
    tryAutoPlay();
    createRoom();
  });

  document.getElementById("btn-join-room").addEventListener("click", () => {
    tryAutoPlay();
    joinRoom();
  });

  document.getElementById("input-room-code").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      tryAutoPlay();
      joinRoom();
    }
  });

  // Toggle no Lobby: Dono da sala joga ou só acompanha
  document.getElementById("btn-mode-play").addEventListener("click", () => setHostPlayMode(true));
  document.getElementById("btn-mode-spectate").addEventListener("click", () => setHostPlayMode(false));

  const copyFeedback = document.getElementById("lobby-copy-feedback");

  document.getElementById("btn-copy-code").addEventListener("click", () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode).then(() => {
      copyFeedback.textContent = `✓ Código ${roomCode} copiado!`;
      setTimeout(() => { copyFeedback.textContent = ""; }, 3000);
    });
  });

  document.getElementById("btn-copy-link").addEventListener("click", () => {
    if (!roomCode) return;
    const link = getShareableRoomLink(roomCode);
    navigator.clipboard.writeText(link).then(() => {
      copyFeedback.textContent = "✓ Link de convite copiado! Envie para os participantes.";
      setTimeout(() => { copyFeedback.textContent = ""; }, 3500);
    });
  });

  document.getElementById("btn-leave-lobby").addEventListener("click", leaveRoomAndReset);
  document.getElementById("btn-start-match").addEventListener("click", startMatchAsHost);

  slidesContainer.addEventListener("click", (e) => {
    tryAutoPlay();

    const optionBtn = e.target.closest(".option-btn");
    if (optionBtn) {
      const qNum = Number(optionBtn.dataset.question);
      const letter = optionBtn.dataset.letter;
      selectOption(qNum, letter);
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
        handleFinishMatchRequest();
      }
    }
  });

  document.getElementById("btn-restart-quiz").addEventListener("click", leaveRoomAndReset);

  document.getElementById("btn-back-lobby").addEventListener("click", async () => {
    if (!roomCode || !playerId) return;
    if (useP2PMode && isHost && p2pRoomState) {
      p2pRoomState.status = "lobby";
      p2pRoomState.startedAt = null;
      for (const p of p2pRoomState.players.values()) {
        p.finished = false;
        p.score = 0;
        p.elapsedMs = null;
        p.answers = {};
      }
      broadcastP2PRoom();
      return;
    }
    await fetch("/api/rooms/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: roomCode, playerId })
    });
  });
}

document.addEventListener("DOMContentLoaded", initQuiz);
