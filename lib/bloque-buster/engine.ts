// Port a TypeScript de references/started-games/04-arkanoid/ (game.js, levels.js y
// assets/spritesheet.js) (SPEC 08). Misma física, velocidad, niveles y puntuación.
// Todo el estado vive dentro de cada instancia de createBloqueBusterGame; a nivel de
// módulo solo hay constantes y funciones puras.

import type { GameStats } from "@/lib/game-types";
import type { ScoreSubmission } from "@/lib/scoring";

export type BloqueBusterPhase = "ready" | "playing" | "gameover";

export type BloqueBusterCallbacks = {
  onStats: (stats: GameStats) => void; // { score, lives, level }, solo si cambia
  onPhase: (phase: BloqueBusterPhase) => void; // ready → playing → gameover
  onGameOver: (result: ScoreSubmission) => void; // sin vidas, nivel 5 completado, o end()
};

export type BloqueBusterGame = {
  setPaused: (paused: boolean) => void;
  end: () => void; // congela el juego (botón FIN) y llama a onGameOver si aún no se llamó
  destroy: () => void; // cancela el rAF y quita los listeners
};

type BlockColor =
  "gray" | "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

type Level = {
  speed: number;
  blocks: { col: number; row: number; color: BlockColor }[];
};

type Frame = { sx: number; sy: number; sw: number; sh: number };
type Rect = { x: number; y: number; w: number; h: number };
type Block = Rect & { color: BlockColor; alive: boolean };
type Explosion = Rect & { color: BlockColor; elapsed: number };

// ── Constantes de la referencia ───────────────────────────────────────────────
const PADDLE_SPEED = 400; // px/s
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (800 - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const PADDLE_W = 81;
const PADDLE_H = 14;
const PADDLE_Y = 560;
const BALL_W = 16;
const BALL_H = 16;
const PADDLE_TOLERANCE = 8; // px bajo paddle.y + paddle.h
const POINTS_PER_BLOCK = 10;
const START_LIVES = 3;
const BG = "#000";

// levels.js
const LEVELS: readonly Level[] = (() => {
  const rowColors1: BlockColor[] = [
    "red",
    "yellow",
    "cyan",
    "magenta",
    "hotpink",
    "green",
  ];
  const rowColors2: BlockColor[] = [
    "gray",
    "cyan",
    "hotpink",
    "yellow",
    "magenta",
    "green",
  ];
  const rowColors4: BlockColor[] = [
    "cyan",
    "magenta",
    "green",
    "yellow",
    "hotpink",
    "red",
  ];

  const l1: Level["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: Level["blocks"] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: Level["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: Level["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: Level["blocks"] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

// assets/spritesheet.js
const explosionRow = (sy: number): Frame[] =>
  [256, 288, 320, 352].map((sx) => ({ sx, sy, sw: 32, sh: 16 }));

const EXPLOSION_FRAMES: Readonly<Record<BlockColor, Frame[]>> = {
  red: explosionRow(176),
  cyan: explosionRow(192),
  green: explosionRow(208),
  magenta: explosionRow(224),
  yellow: explosionRow(240),
  hotpink: explosionRow(256),
  gray: explosionRow(176),
};

const EXPLOSION_DURATION = 150; // ms, 4 frames

const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } satisfies Record<BlockColor, Frame>,
} as const;

// ── Constantes del port ───────────────────────────────────────────────────────
const W = 800;
const H = 600;
const MAX_DT = 50; // ms
const SPRITESHEET_SRC = "/bloque-buster/spritesheet-breakout.png";

// Teclas del juego: se les hace preventDefault para que la página no haga scroll.
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "Space"]);

// ── Utils ─────────────────────────────────────────────────────────────────────
function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

function collideAABB(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

export function createBloqueBusterGame(
  canvas: HTMLCanvasElement,
  callbacks: BloqueBusterCallbacks,
): BloqueBusterGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  // Backing store a resolución de pantalla; la lógica sigue en 800×600.
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── Spritesheet ──
  let sheetLoaded = false;
  const sheet = new Image();
  sheet.onload = () => {
    sheetLoaded = true;
    draw();
  };
  sheet.onerror = () => console.error("Failed to load spritesheet");
  sheet.src = SPRITESHEET_SRC;

  // ── Estado ──
  const paddle: Rect = {
    x: (W - PADDLE_W) / 2,
    y: PADDLE_Y,
    w: PADDLE_W,
    h: PADDLE_H,
  };
  const ball = { x: 0, y: 0, w: BALL_W, h: BALL_H, vx: 0, vy: 0 };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = START_LIVES;
  let score = 0;
  let currentLevel = 1;
  let phase: BloqueBusterPhase = "ready";
  const keys = { ArrowLeft: false, ArrowRight: false };

  // Suma de dt (ya capados) en playing. La pausa no llega a update().
  let playedMs = 0;
  let reported = false;

  let paused = false;
  let ended = false;
  let lastTime: number | null = null;
  let rafId = 0;
  let emitted: GameStats = { score, lives, level: currentLevel };

  // ── Lógica (port de game.js) ──
  const setPhase = (nextPhase: BloqueBusterPhase) => {
    phase = nextPhase;
    callbacks.onPhase(nextPhase);
  };

  const emitStats = () => {
    if (
      emitted.score === score &&
      emitted.lives === lives &&
      emitted.level === currentLevel
    )
      return;
    emitted = { score, lives, level: currentLevel };
    callbacks.onStats(emitted);
  };

  const reportGameOver = () => {
    if (reported) return;
    reported = true;
    callbacks.onGameOver({
      score,
      level: currentLevel,
      durationMs: Math.round(playedMs),
    });
  };

  const finish = () => {
    setPhase("gameover");
    reportGameOver();
  };

  const initBall = () => {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  };

  const loadLevel = (n: number) => {
    currentLevel = n;
    blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    initBall();
  };

  const releaseKeys = () => {
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
  };

  const update = (dtMs: number) => {
    if (phase !== "playing") return;
    playedMs += dtMs;
    const dt = dtMs / 1000;

    // Paleta
    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Movimiento de la pelota
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Rebotes en las paredes y el techo
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    // Rebote en la paleta
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + PADDLE_TOLERANCE
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }

    // Colisión con los bloques: uno por frame
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(ball, block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += POINTS_PER_BLOCK;
        ball.vy = -ball.vy;
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < LEVELS.length) loadLevel(currentLevel + 1);
          else {
            finish(); // victoria: fin natural con level 5
            return;
          }
        }
        break;
      }
    }

    // Explosiones
    for (const exp of explosions) exp.elapsed += dtMs;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Pelota perdida
    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        finish();
      } else {
        initBall();
      }
    }
  };

  // ── Input ──
  const onKeyDown = (e: KeyboardEvent) => {
    if (isTextField(e.target) || ended || phase === "gameover") return;
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (paused) return;

    if (phase === "ready") {
      if (e.code === "Space" && !e.repeat && sheetLoaded) {
        setPhase("playing");
        initBall();
      }
      return;
    }

    if (e.code === "ArrowLeft" || e.code === "ArrowRight") keys[e.code] = true;
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") keys[e.code] = false;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (phase !== "playing" || paused || ended) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const mouseX = (e.clientX - rect.left) * (W / rect.width);
    paddle.x = Math.max(0, Math.min(W - paddle.w, mouseX - paddle.w / 2));
  };

  // ── Dibujo ──
  const drawFrame = (f: Frame, r: Rect) =>
    ctx.drawImage(sheet, f.sx, f.sy, f.sw, f.sh, r.x, r.y, r.w, r.h);

  const draw = () => {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    if (!sheetLoaded) return;

    for (const block of blocks)
      if (block.alive) drawFrame(SPRITES.blocks[block.color], block);

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawFrame(EXPLOSION_FRAMES[exp.color][frameIndex], exp);
    }

    drawFrame(SPRITES.paddle, paddle);
    drawFrame(SPRITES.ball, ball);
  };

  // ── Bucle ──
  const loop = (ts: number) => {
    if (!paused && !ended) {
      const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
      lastTime = ts;
      update(dt);
      emitStats();
      draw();
    }
    rafId = requestAnimationFrame(loop);
  };

  // ready: nivel 1 cargado, paleta centrada y pelota encima; nada se mueve.
  loadLevel(1);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);
  draw();
  rafId = requestAnimationFrame(loop);

  return {
    setPaused(nextPaused) {
      if (paused === nextPaused) return;
      paused = nextPaused;
      // Ocultar la pestaña puede comerse el keyup: la paleta no sigue sola al volver.
      if (paused) releaseKeys();
      // Al reanudar, el primer frame tiene dt = 0: la pelota no da un salto.
      lastTime = null;
    },
    end() {
      ended = true;
      releaseKeys();
      reportGameOver();
    },
    destroy() {
      cancelAnimationFrame(rafId);
      sheet.onload = null;
      sheet.onerror = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
    },
  };
}
