const QUIZ_QUESTIONS = [
  {
    number: 1,
    question: "Quando uma mudança acontece no trabalho, o que você considera mais importante?",
    options: [
      { letter: "A", text: "Saber o que está mudando." },
      { letter: "B", text: "Entender como isso afetará minha rotina." },
      { letter: "C", text: "Receber orientações sobre o processo." },
      { letter: "D", text: "Ter apoio da minha liderança." }
    ]
  },
  {
    number: 2,
    question: "O que pode ajudar um colaborador a se sentir mais seguro durante uma mudança?",
    options: [
      { letter: "A", text: "Uma comunicação clara." },
      { letter: "B", text: "Treinamento adequado." },
      { letter: "C", text: "Acompanhamento da equipe." },
      { letter: "D", text: "Reconhecimento pelo esforço." }
    ]
  },
  {
    number: 3,
    question: "Qual atitude facilita mais a adaptação a uma nova forma de trabalhar?",
    options: [
      { letter: "A", text: "Resistir à mudança." },
      { letter: "B", text: "Buscar aprender e se adaptar." },
      { letter: "C", text: "Esperar para ver como será." },
      { letter: "D", text: "Comparar com o modelo antigo." }
    ]
  },
  {
    number: 4,
    question: "Após uma mudança ser implementada, o que é mais importante fazer?",
    options: [
      { letter: "A", text: "Avaliar as dificuldades." },
      { letter: "B", text: "Celebrar as conquistas." },
      { letter: "C", text: "Buscar mais informações." },
      { letter: "D", text: "Continuar com o antigo processo." }
    ]
  },
  {
    number: 5,
    question: "Qual papel do RH é mais relevante durante uma mudança organizacional?",
    options: [
      { letter: "A", text: "Informar apenas sobre a mudança." },
      { letter: "B", text: "Oferecer suporte e orientação." },
      { letter: "C", text: "Cobrar resultados rápidos." },
      { letter: "D", text: "Ignorar as dificuldades." }
    ]
  },
  {
    number: 6,
    question: "Qual frase melhor representa o impacto de uma mudança bem conduzida?",
    options: [
      { letter: "A", text: "Gera insegurança e desmotivação." },
      { letter: "B", text: "Traz aprendizado, crescimento e novas oportunidades." },
      { letter: "C", text: "Aumenta a pressão no trabalho." },
      { letter: "D", text: "Cria ainda mais processos." }
    ]
  }
];

let currentSlide = 0; // 0 = Capa, 1..6 = Perguntas, 7 = Mensagem Final + Escolhas
const userAnswers = {};

const slidesContainer = document.getElementById("slides-container");
const questionsMount = document.getElementById("questions-mount");
const finalChoicesGrid = document.getElementById("final-choices-grid");

// Elementos de Áudio (Música solicitada + Ambiência de Mar/Barco)
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

/**
 * Gera o som realista das ondas do mar e do barco velejando na água
 * para tocar em conjunto com a música de fundo escolhida.
 */
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

    // Marola batendo no casco do barco velejando
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

  // O som suave do mar acompanha proporcionalmente o volume da música
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

  // Toca imediatamente ao abrir o site
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
          <button type="button" class="btn-nav" data-action="prev" data-from="${q.number}">
            <span>←</span>
            <span>Voltar</span>
          </button>

          <button type="button" class="btn-nav btn-nav-primary" data-action="next" data-from="${q.number}">
            <span>${isLastQuestion ? "Concluir Jornada" : "Próxima"}</span>
            <span>→</span>
          </button>
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

function renderFinalChoices() {
  if (!finalChoicesGrid) return;

  finalChoicesGrid.innerHTML = QUIZ_QUESTIONS.map((q) => {
    const chosenLetter = userAnswers[q.number];
    const chosenOpt = q.options.find((o) => o.letter === chosenLetter);

    const answerHtml = chosenOpt
      ? `<span class="choice-a-letter">${chosenOpt.letter}</span><span>${chosenOpt.text}</span>`
      : `<span><em>Não respondida</em></span>`;

    return `
      <div class="choice-item">
        <div class="choice-q">
          <span class="choice-q-num">${q.number}</span>
          <span>${q.question}</span>
        </div>
        <div class="choice-a">
          ${answerHtml}
        </div>
      </div>
    `;
  }).join("");
}

function goToSlide(slideIndex) {
  currentSlide = Math.max(0, Math.min(7, slideIndex));

  if (currentSlide === 7) {
    renderFinalChoices();
  }

  const allSlides = slidesContainer.querySelectorAll(".slide-card");
  allSlides.forEach((card) => {
    const cardIndex = Number(card.dataset.slide);
    card.classList.toggle("active", cardIndex === currentSlide);
  });
}

function selectOption(questionNum, letter) {
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

function restartQuiz() {
  Object.keys(userAnswers).forEach((k) => delete userAnswers[k]);

  slidesContainer.querySelectorAll(".option-btn").forEach((btn) => {
    btn.classList.remove("selected");
    btn.setAttribute("aria-pressed", "false");
  });

  goToSlide(0);
}

function initQuiz() {
  renderQuestionSlides();
  renderFinalChoices();
  initMusicPlayer();

  document.getElementById("btn-start-quiz").addEventListener("click", () => {
    tryAutoPlay();
    goToSlide(1);
  });

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
      if (action === "prev") {
        goToSlide(from - 1);
      } else if (action === "next") {
        goToSlide(from + 1);
      }
    }
  });

  document.getElementById("btn-restart-quiz").addEventListener("click", restartQuiz);

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      if (currentSlide < 7) goToSlide(currentSlide + 1);
    } else if (e.key === "ArrowLeft") {
      if (currentSlide > 0) goToSlide(currentSlide - 1);
    } else if (currentSlide >= 1 && currentSlide <= 6) {
      const keyUpper = e.key.toUpperCase();
      if (["A", "B", "C", "D"].includes(keyUpper)) {
        selectOption(currentSlide, keyUpper);
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", initQuiz);
