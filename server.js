const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8090;
const PUBLIC_DIR = __dirname;

// Gabarito oficial das 6 questões da nova imagem
const CORRECT_ANSWERS = {
  1: "C",
  2: "B",
  3: "A",
  4: "D",
  5: "B",
  6: "D"
};

const MAX_TIME_MS = 3 * 60 * 1000; // 3 minutos = 180.000 ms
const MAX_PLAYERS_PER_ROOM = 40;

// Armazenamento em memória das salas e clientes SSE conectados
// rooms: Map<code, Room>
const rooms = new Map();
// sseClients: Map<code, Set<http.ServerResponse>>
const sseClients = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 5 dígitos alfanuméricos claros
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function generatePlayerId() {
  return crypto.randomBytes(8).toString("hex");
}

function serializeRoom(room) {
  const playersList = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.id === room.hostId,
    finished: p.finished,
    score: p.score,
    totalQuestions: 6,
    elapsedMs: p.elapsedMs,
    joinedAt: p.joinedAt
  }));

  // Ordena o Ranking:
  // 1) Quem já terminou vem antes de quem ainda está respondendo
  // 2) Maior número de acertos (score DESC)
  // 3) Menor tempo de resposta em milésimos (elapsedMs ASC)
  const ranking = [...playersList].sort((a, b) => {
    if (a.finished !== b.finished) {
      return a.finished ? -1 : 1;
    }
    if (!a.finished && !b.finished) {
      return a.joinedAt - b.joinedAt;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.elapsedMs ?? MAX_TIME_MS) - (b.elapsedMs ?? MAX_TIME_MS);
  });

  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status, // 'lobby' | 'playing' | 'finished'
    startedAt: room.startedAt,
    serverNow: Date.now(),
    maxPlayers: MAX_PLAYERS_PER_ROOM,
    playersCount: playersList.length,
    players: playersList,
    ranking
  };
}

function broadcastRoom(code) {
  const room = rooms.get(code);
  const clients = sseClients.get(code);
  if (!room || !clients || clients.size === 0) return;

  const payload = `data: ${JSON.stringify({ type: "room_update", room: serializeRoom(room) })}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

// Limpeza periódica de salas inativas há mais de 6 horas para liberar memória
setInterval(() => {
  const now = Date.now();
  const sixHours = 6 * 60 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > sixHours) {
      rooms.delete(code);
      sseClients.delete(code);
    }
  }
}, 30 * 60 * 1000);

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1e5) {
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

    // Suporte a Range Requests para áudio/vídeo no navegador
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
      res.writeHead(200, {
        "Content-Length": stat.size,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes"
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // 1. Criar nova sala
  if (req.method === "POST" && pathname === "/api/rooms/create") {
    try {
      const body = await readJsonBody(req);
      const name = String(body.playerName || "").trim().slice(0, 40);
      if (!name) {
        return sendJson(res, 400, { error: "Digite seu nome para criar a sala." });
      }

      const code = generateRoomCode();
      const playerId = generatePlayerId();
      const now = Date.now();

      const room = {
        code,
        hostId: playerId,
        status: "lobby",
        createdAt: now,
        startedAt: null,
        players: new Map()
      };

      room.players.set(playerId, {
        id: playerId,
        name,
        joinedAt: now,
        finished: false,
        score: 0,
        elapsedMs: null,
        answers: {}
      });

      rooms.set(code, room);
      return sendJson(res, 200, {
        code,
        playerId,
        room: serializeRoom(room)
      });
    } catch {
      return sendJson(res, 400, { error: "Erro ao criar a sala." });
    }
  }

  // 2. Entrar em uma sala existente
  if (req.method === "POST" && pathname === "/api/rooms/join") {
    try {
      const body = await readJsonBody(req);
      const code = String(body.code || "").trim().toUpperCase();
      const name = String(body.playerName || "").trim().slice(0, 40);
      const existingId = body.playerId ? String(body.playerId) : null;

      if (!code || code.length !== 5) {
        return sendJson(res, 400, { error: "Digite um código de sala válido de 5 dígitos." });
      }
      if (!name) {
        return sendJson(res, 400, { error: "Digite seu nome para entrar na sala." });
      }

      const room = rooms.get(code);
      if (!room) {
        return sendJson(res, 404, { error: "Sala não encontrada. Verifique o código de 5 dígitos." });
      }

      // Reconexão se o jogador já estava na sala
      if (existingId && room.players.has(existingId)) {
        const player = room.players.get(existingId);
        player.name = name;
        broadcastRoom(code);
        return sendJson(res, 200, {
          code,
          playerId: existingId,
          room: serializeRoom(room)
        });
      }

      if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
        return sendJson(res, 400, { error: `A sala já atingiu o limite de ${MAX_PLAYERS_PER_ROOM} participantes.` });
      }

      const playerId = generatePlayerId();
      room.players.set(playerId, {
        id: playerId,
        name,
        joinedAt: Date.now(),
        finished: false,
        score: 0,
        elapsedMs: null,
        answers: {}
      });

      broadcastRoom(code);
      return sendJson(res, 200, {
        code,
        playerId,
        room: serializeRoom(room)
      });
    } catch {
      return sendJson(res, 400, { error: "Erro ao entrar na sala." });
    }
  }

  // 3. Iniciar partida para todos na sala
  if (req.method === "POST" && pathname === "/api/rooms/start") {
    try {
      const body = await readJsonBody(req);
      const code = String(body.code || "").trim().toUpperCase();
      const playerId = String(body.playerId || "");

      const room = rooms.get(code);
      if (!room) {
        return sendJson(res, 404, { error: "Sala não encontrada." });
      }
      if (room.hostId !== playerId) {
        return sendJson(res, 403, { error: "Apenas quem criou a sala pode iniciar a partida." });
      }

      room.status = "playing";
      room.startedAt = Date.now();

      for (const p of room.players.values()) {
        p.finished = false;
        p.score = 0;
        p.elapsedMs = null;
        p.answers = {};
      }

      broadcastRoom(code);
      return sendJson(res, 200, { room: serializeRoom(room) });
    } catch {
      return sendJson(res, 400, { error: "Erro ao iniciar a partida." });
    }
  }

  // 4. Enviar respostas e tempo final do participante
  if (req.method === "POST" && pathname === "/api/rooms/submit") {
    try {
      const body = await readJsonBody(req);
      const code = String(body.code || "").trim().toUpperCase();
      const playerId = String(body.playerId || "");
      const answers = body.answers && typeof body.answers === "object" ? body.answers : {};

      const room = rooms.get(code);
      if (!room) {
        return sendJson(res, 404, { error: "Sala não encontrada." });
      }

      const player = room.players.get(playerId);
      if (!player) {
        return sendJson(res, 404, { error: "Participante não encontrado nesta sala." });
      }

      if (!player.finished) {
        let score = 0;
        for (let q = 1; q <= 6; q++) {
          const chosen = String(answers[q] || "").toUpperCase();
          if (chosen && chosen === CORRECT_ANSWERS[q]) {
            score++;
          }
        }

        const rawElapsed = Number(body.elapsedMs);
        const serverElapsed = room.startedAt ? Date.now() - room.startedAt : MAX_TIME_MS;
        const validElapsed = Number.isFinite(rawElapsed) && rawElapsed > 0
          ? Math.min(MAX_TIME_MS, Math.max(100, Math.round(rawElapsed)))
          : Math.min(MAX_TIME_MS, Math.max(100, serverElapsed));

        player.finished = true;
        player.score = score;
        player.elapsedMs = validElapsed;
        player.answers = answers;
      }

      broadcastRoom(code);
      return sendJson(res, 200, {
        room: serializeRoom(room),
        playerResult: {
          score: player.score,
          elapsedMs: player.elapsedMs,
          answers: player.answers
        }
      });
    } catch {
      return sendJson(res, 400, { error: "Erro ao enviar respostas." });
    }
  }

  // 5. Reiniciar sala de volta para o Lobby
  if (req.method === "POST" && pathname === "/api/rooms/reset") {
    try {
      const body = await readJsonBody(req);
      const code = String(body.code || "").trim().toUpperCase();
      const playerId = String(body.playerId || "");

      const room = rooms.get(code);
      if (!room) {
        return sendJson(res, 404, { error: "Sala não encontrada." });
      }
      if (room.hostId !== playerId) {
        return sendJson(res, 403, { error: "Apenas o criador da sala pode reiniciar a partida." });
      }

      room.status = "lobby";
      room.startedAt = null;
      for (const p of room.players.values()) {
        p.finished = false;
        p.score = 0;
        p.elapsedMs = null;
        p.answers = {};
      }

      broadcastRoom(code);
      return sendJson(res, 200, { room: serializeRoom(room) });
    } catch {
      return sendJson(res, 400, { error: "Erro ao reiniciar a sala." });
    }
  }

  // 6. Consultar estado atual de uma sala
  const roomMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{5})$/);
  if (req.method === "GET" && roomMatch) {
    const code = roomMatch[1].toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return sendJson(res, 404, { error: "Sala não encontrada." });
    }
    return sendJson(res, 200, { room: serializeRoom(room) });
  }

  // 7. Stream de eventos em tempo real (SSE) da sala
  const eventsMatch = pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{5})\/events$/);
  if (req.method === "GET" && eventsMatch) {
    const code = eventsMatch[1].toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      res.writeHead(404);
      res.end();
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    });

    if (!sseClients.has(code)) {
      sseClients.set(code, new Set());
    }
    const clients = sseClients.get(code);
    clients.add(res);

    // Envia estado inicial imediatamente
    res.write(`data: ${JSON.stringify({ type: "room_update", room: serializeRoom(room) })}\n\n`);

    // Heartbeat a cada 15s para manter a conexão ativa no Render
    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
    return;
  }

  // 8. Servir arquivos estáticos (index.html, styles.css, script.js, musica.webm, musica.m4a)
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
