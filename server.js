const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8090;
const PUBLIC_DIR = __dirname;
const LOCAL_DATA_FILE = path.join(__dirname, "ranking-data.json");

// Configuração opcional de persistência permanente sem banco de dados via GitHub (branch separada para não dar redeploy no Render)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO = process.env.GITHUB_REPO || "JoaoVictor-ss/QuizOdisseia";
const GITHUB_BRANCH = process.env.GITHUB_RANKING_BRANCH || "ranking-data";
const GITHUB_FILE_PATH = "ranking-data.json";

// Gabarito oficial das 6 questões
const CORRECT_ANSWERS = {
  1: "C",
  2: "B",
  3: "A",
  4: "D",
  5: "B",
  6: "D"
};

const MAX_TIME_MS = 3 * 60 * 1000; // 3 minutos = 180.000 ms

// Estado global do ranking em memória + clientes SSE
let rankingEntries = [];
const sseClients = new Set();

// Fila de gravação no GitHub para evitar conflito de SHA quando várias pessoas finalizam juntas
let githubSavePending = false;
let githubSaveRunning = false;
let githubFileSha = null;

function calculateOfficialScore(answers) {
  let score = 0;
  if (!answers || typeof answers !== "object") return 0;
  for (let q = 1; q <= 6; q++) {
    const chosen = String(answers[q] || "").toUpperCase();
    if (chosen && chosen === CORRECT_ANSWERS[q]) {
      score++;
    }
  }
  return score;
}

function sortRanking(list) {
  return [...list].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.elapsedMs !== b.elapsedMs) return a.elapsedMs - b.elapsedMs;
    return (a.finishedAt || 0) - (b.finishedAt || 0);
  });
}

function mergeEntries(incomingList) {
  if (!Array.isArray(incomingList)) return false;
  const map = new Map();
  for (const item of rankingEntries) {
    if (item && item.id) map.set(item.id, item);
  }
  let changed = false;
  for (const raw of incomingList) {
    if (!raw || !raw.id || !raw.name) continue;
    if (!map.has(raw.id)) {
      const score = Math.max(0, Math.min(6, Number(raw.score) || 0));
      const elapsedMs = Math.min(MAX_TIME_MS, Math.max(100, Math.round(Number(raw.elapsedMs) || MAX_TIME_MS)));
      map.set(String(raw.id), {
        id: String(raw.id),
        name: String(raw.name).trim().slice(0, 40),
        score,
        totalQuestions: 6,
        elapsedMs,
        finishedAt: Number(raw.finishedAt) || Date.now()
      });
      changed = true;
    }
  }
  if (changed) {
    rankingEntries = sortRanking(Array.from(map.values()));
  }
  return changed;
}

// ==========================================
// PERSISTÊNCIA SEM BANCO DE DADOS:
// 1) Arquivo local ranking-data.json
// 2) Branch separada no GitHub (ranking-data) via API REST (sobrevive a sleep/reinício/redeploy do Render!)
// ==========================================
function loadFromLocalDisk() {
  try {
    if (!fs.existsSync(LOCAL_DATA_FILE)) return;
    const raw = fs.readFileSync(LOCAL_DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      mergeEntries(parsed);
    }
  } catch {
    // Ignora se arquivo ainda não existir ou estiver inválido
  }
}

function saveToLocalDisk() {
  try {
    fs.writeFile(LOCAL_DATA_FILE, JSON.stringify(rankingEntries, null, 2), () => {});
  } catch {
    // Ignora erro de disco
  }
}

async function loadFromGitHub() {
  // Mesmo sem token, se o repo for público, já tenta ler o ranking salvo na branch ranking-data!
  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}?ref=${GITHUB_BRANCH}`;
  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "QuizOdisseia-Server"
  };
  if (GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(apiUrl, { headers });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.sha) {
      githubFileSha = data.sha;
    }
    if (data && data.content) {
      const decoded = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      if (Array.isArray(parsed)) {
        mergeEntries(parsed);
        saveToLocalDisk();
        console.log(`Ranking restaurado do GitHub (${rankingEntries.length} registros).`);
      }
    }
  } catch (err) {
    console.log("Aviso ao ler ranking do GitHub:", err.message);
  }
}

async function flushToGitHub() {
  if (!GITHUB_TOKEN) return;
  if (githubSaveRunning) {
    githubSavePending = true;
    return;
  }

  githubSaveRunning = true;
  githubSavePending = false;

  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "QuizOdisseia-Server"
  };

  try {
    // Garante o SHA mais recente antes de atualizar
    if (!githubFileSha) {
      const getRes = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, { headers });
      if (getRes.ok) {
        const getJson = await getRes.json();
        githubFileSha = getJson.sha || null;
      }
    }

    const contentBase64 = Buffer.from(JSON.stringify(rankingEntries, null, 2), "utf-8").toString("base64");
    const payload = {
      message: `Atualiza ranking (${rankingEntries.length} participantes)`,
      content: contentBase64,
      branch: GITHUB_BRANCH
    };
    if (githubFileSha) {
      payload.sha = githubFileSha;
    }

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload)
    });

    if (putRes.ok) {
      const putJson = await putRes.json();
      if (putJson && putJson.content && putJson.content.sha) {
        githubFileSha = putJson.content.sha;
      }
    } else if (putRes.status === 409) {
      // Conflito de SHA: recarrega e tenta novamente
      githubFileSha = null;
      await loadFromGitHub();
      githubSavePending = true;
    }
  } catch (err) {
    console.log("Aviso ao salvar ranking no GitHub:", err.message);
  } finally {
    githubSaveRunning = false;
    if (githubSavePending) {
      setTimeout(flushToGitHub, 800);
    }
  }
}

function persistAndBroadcast() {
  saveToLocalDisk();
  flushToGitHub();

  const payload = `data: ${JSON.stringify({
    type: "ranking_update",
    ranking: rankingEntries,
    persistenceMode: GITHUB_TOKEN ? "github" : "local+client-sync"
  })}\n\n`;

  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

// Carrega dados salvos ao iniciar o servidor
loadFromLocalDisk();
loadFromGitHub();

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 5e5) {
        reject(new Error("Payload muito grande"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webm": "audio/webm",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function serveStaticFile(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Arquivo não encontrado");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      if (start >= stat.size || end >= stat.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": contentType
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      const headers = {
        "Content-Length": stat.size,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes"
      };
      if ([".html", ".css", ".js"].includes(ext)) {
        headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
      }
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // 1. Health check (útil para monitoramento ou ping opcional)
  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      totalEntries: rankingEntries.length,
      persistenceMode: GITHUB_TOKEN ? "github-branch" : "local+client-sync"
    });
  }

  // 2. Obter Ranking Global
  if (req.method === "GET" && pathname === "/api/ranking") {
    return sendJson(res, 200, {
      ranking: rankingEntries,
      persistenceMode: GITHUB_TOKEN ? "github-branch" : "local+client-sync"
    });
  }

  // 3. Enviar resultado de um participante para o Ranking Global
  if (req.method === "POST" && pathname === "/api/ranking/submit") {
    try {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim().slice(0, 40);
      if (!name) {
        return sendJson(res, 400, { error: "Nome do participante é obrigatório." });
      }

      const id = body.id ? String(body.id) : crypto.randomBytes(8).toString("hex");
      const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
      const score = calculateOfficialScore(answers);
      const rawElapsed = Number(body.elapsedMs);
      const elapsedMs = Number.isFinite(rawElapsed) && rawElapsed > 0
        ? Math.min(MAX_TIME_MS, Math.max(100, Math.round(rawElapsed)))
        : MAX_TIME_MS;

      const entry = {
        id,
        name,
        score,
        totalQuestions: 6,
        elapsedMs,
        finishedAt: Date.now()
      };

      // Atualiza se o mesmo ID já existe ou adiciona novo registro
      const existingIdx = rankingEntries.findIndex((e) => e.id === id);
      if (existingIdx >= 0) {
        rankingEntries[existingIdx] = entry;
      } else {
        rankingEntries.push(entry);
      }
      rankingEntries = sortRanking(rankingEntries);

      persistAndBroadcast();
      return sendJson(res, 200, {
        entry,
        ranking: rankingEntries
      });
    } catch {
      return sendJson(res, 400, { error: "Erro ao registrar resultado no ranking." });
    }
  }

  // 4. Sincronização distribuída (se o servidor reiniciar sem GITHUB_TOKEN, navegadores restauram automaticamente)
  if (req.method === "POST" && pathname === "/api/ranking/sync") {
    try {
      const body = await readJsonBody(req);
      const changed = mergeEntries(body.cachedRanking || []);
      if (changed) {
        persistAndBroadcast();
      }
      return sendJson(res, 200, { ranking: rankingEntries });
    } catch {
      return sendJson(res, 400, { error: "Erro ao sincronizar ranking." });
    }
  }

  // 5. Stream de eventos em tempo real (SSE) do Ranking Global
  if (req.method === "GET" && pathname === "/api/ranking/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });

    sseClients.add(res);
    res.write(
      `data: ${JSON.stringify({
        type: "ranking_update",
        ranking: rankingEntries,
        persistenceMode: GITHUB_TOKEN ? "github-branch" : "local+client-sync"
      })}\n\n`
    );

    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
    return;
  }

  // 6. Servir arquivos estáticos
  let safePath = pathname === "/" ? "/index.html" : pathname;
  safePath = decodeURIComponent(safePath);
  const fullPath = path.join(PUBLIC_DIR, safePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Acesso negado");
    return;
  }

  serveStaticFile(req, res, fullPath);
});

server.listen(PORT, () => {
  console.log(`Servidor Quiz Odisseia rodando em http://localhost:${PORT}`);
});
