"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLang } from "@/contexts/LangContext";

// ─── Engine constants ─────────────────────────────────────────────────────────
const W = 600; // logical canvas width
const H = 200; // logical canvas height
const GROUND = 172; // y of the ground line
const PX = 3; // size of one sprite pixel
const GRAVITY = 0.55;
const JUMP_V = -10.8;
const BASE_SPEED = 4.0;
const MAX_SPEED = 9.5;
const ACCEL = 0.0016; // speed gain per normalized frame
const HS_KEY = "streetrunner_highscore";
const RESTART_DELAY_MS = 400; // ignore input right after death (prevents accidental restart)

// ─── Sprite palette ───────────────────────────────────────────────────────────
const COLORS: Record<string, string> = {
  H: "#2A2A2A", // hair / braids
  K: "#C98A5B", // skin
  T: "#303030", // oversized black tee
  G: "#1ED760", // neon green (print, chain, flames)
  J: "#5D7BA6", // baggy jeans
  W: "#F2F2F2", // sneakers / highlights
  D: "#4A4A4A", // dark garments in the clothes pile
  B: "#3F3F3F", // car body
};

// ─── Runner sprite (12×16 grid) — generic stylized streetwear character ──────
// Braids hang behind (left), face looks right. Green chain + graphic print.
const RUNNER_TOP = [
  "....HHHH....",
  "...HHHHHH...",
  ".H..HKKKK...",
  ".HH.HKKKK...",
  ".HH..KKK....",
  "..TTTTTTTT..",
  ".TTTGGTTTTT.",
  ".TTTTGGGTTT.",
  ".TTTTGGGTTT.",
  ".TTTTTTTTTT.",
  "..TTTTTTTT..",
];
const LEGS_STRIDE = [
  "..JJJJJJJJ..",
  "..JJJ..JJJ..",
  ".JJJ....JJJ.",
  ".JJ......JJ.",
  ".WW......WWW",
];
const LEGS_PASS = [
  "..JJJJJJJJ..",
  "...JJJJJJ...",
  "....JJJJ....",
  "....JJJ.....",
  "....WWW.....",
];
const LEGS_AIR = [
  "..JJJJJJJJ..",
  "..JJJJJJJJ..",
  "..JJ...JJJ..",
  "..WW...WWW..",
  "............",
];
const RUN_A = [...RUNNER_TOP, ...LEGS_STRIDE];
const RUN_B = [...RUNNER_TOP, ...LEGS_PASS];
const JUMP_FRAME = [...RUNNER_TOP, ...LEGS_AIR];
const PLAYER_W = 12 * PX;
const PLAYER_H = 16 * PX;
const PLAYER_X = 60;

// ─── Obstacle sprites ─────────────────────────────────────────────────────────
const CLOTHES_PILE = [
  "..WWWWWW..",
  ".WWWWWWWW.",
  "..GGGGGG..",
  ".GGGGGGGG.",
  "..DDDDDD..",
  ".DDDDDDDD.",
];
const CAR_BODY = [
  "....BBBBBBBBB.....",
  "...BWWBBBBWWBB....",
  "..BBBBBBBBBBBBB...",
  ".BBBBBBBBBBBBBBBB.",
  "BBBBBBBBBBBBBBBBBB",
  "BBBBBBBBBBBBBBBBBB",
  "..WW........WW....",
];
// Two flame frames → flicker animation above the burning car
const CAR_FLAMES = [
  [
    "...G......G.......",
    "..GG..G..GGG...G..",
    ".GGG.GGG.GGGG.GG..",
    "GGGGWGGGGGWGGGGGG.",
  ],
  [
    ".....G.......G....",
    "..G.GGG..G..GG.G..",
    ".GGGGGGG.GG.GGGG..",
    ".GGGWGGGGGGWGGGG..",
  ],
];

interface ObstacleSpec {
  map: string[];
  px: number;
  w: number;
  h: number;
  flames?: boolean;
}
const OBSTACLE_TYPES: ObstacleSpec[] = [
  { map: CLOTHES_PILE, px: 3, w: 10 * 3, h: 6 * 3 }, // small pile
  { map: CLOTHES_PILE, px: 4, w: 10 * 4, h: 6 * 4 }, // big pile
  { map: CAR_BODY, px: 3, w: 18 * 3, h: 7 * 3, flames: true }, // burning car
];

interface Obstacle {
  x: number;
  spec: ObstacleSpec;
}

type Phase = "ready" | "running" | "paused" | "over";

function drawSprite(
  ctx: CanvasRenderingContext2D,
  map: string[],
  x: number,
  y: number,
  px: number
) {
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      const col = COLORS[map[r][c]];
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(x + c * px), Math.round(y + r * px), px, px);
      }
    }
  }
}

interface StreetrunnerGameProps {
  /** True once the generation result is fully loaded — pauses the game and shows the success overlay */
  resultReady?: boolean;
  /** Called when the user exits the game to reveal the result */
  onExit?: () => void;
  /** Called when the user closes the game via the X button (game is optional) */
  onClose?: () => void;
}

export default function StreetrunnerGame({
  resultReady = false,
  onExit,
  onClose,
}: StreetrunnerGameProps) {
  const { t } = useLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [finalScore, setFinalScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [successOverlay, setSuccessOverlay] = useState(false);

  // Mutable game state lives in refs — the rAF loop never triggers re-renders
  const phaseRef = useRef<Phase>("ready");
  const successOverlayRef = useRef(false);
  const yRef = useRef(GROUND - PLAYER_H);
  const vyRef = useRef(0);
  const speedRef = useRef(BASE_SPEED);
  const scoreRef = useRef(0);
  const highRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const nextSpawnRef = useRef(400);
  const groundOffsetRef = useRef(0);
  const distanceRef = useRef(0);
  const diedAtRef = useRef(0);

  useEffect(() => {
    highRef.current = Number(localStorage.getItem(HS_KEY) ?? 0);
    setHighScore(highRef.current);
  }, []);

  const changePhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // When the generation result is ready: freeze the game, show the overlay.
  // All game state stays in refs, so "Continue" resumes exactly where it stopped.
  useEffect(() => {
    if (resultReady) {
      if (phaseRef.current === "running") changePhase("paused");
      successOverlayRef.current = true;
      setSuccessOverlay(true);
    }
  }, [resultReady, changePhase]);

  const handleContinue = useCallback(() => {
    successOverlayRef.current = false;
    setSuccessOverlay(false);
    if (phaseRef.current === "paused") changePhase("running");
  }, [changePhase]);

  const restart = useCallback(() => {
    yRef.current = GROUND - PLAYER_H;
    vyRef.current = 0;
    speedRef.current = BASE_SPEED;
    scoreRef.current = 0;
    obstaclesRef.current = [];
    nextSpawnRef.current = 400;
    distanceRef.current = 0;
    changePhase("running");
  }, [changePhase]);

  const jump = useCallback(() => {
    if (yRef.current >= GROUND - PLAYER_H - 0.5) {
      vyRef.current = JUMP_V;
    }
  }, []);

  const onAction = useCallback(() => {
    if (successOverlayRef.current) return; // overlay open → ignore game input
    const p = phaseRef.current;
    if (p === "ready") {
      restart();
      vyRef.current = JUMP_V; // start with a jump, feels responsive
    } else if (p === "running") {
      jump();
    } else if (p === "over") {
      if (performance.now() - diedAtRef.current > RESTART_DELAY_MS) restart();
    }
  }, [restart, jump]);

  // Keyboard: spacebar / arrow-up
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (!e.repeat) onAction();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAction]);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Backing resolution: at least 2× so the upscaled fullscreen canvas stays crisp
    const scale = Math.max(2, Math.min(window.devicePixelRatio || 1, 3));
    canvas.width = W * scale;
    canvas.height = H * scale;
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;

    let raf = 0;
    let last = performance.now();

    const die = () => {
      diedAtRef.current = performance.now();
      const score = Math.floor(scoreRef.current);
      setFinalScore(score);
      if (score > highRef.current) {
        highRef.current = score;
        setHighScore(score);
        try {
          localStorage.setItem(HS_KEY, String(score));
        } catch {
          /* storage unavailable — high score just won't persist */
        }
      }
      phaseRef.current = "over";
      setPhase("over");
    };

    const frame = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const n = dt / 16.667; // normalize to 60fps units

      // ── Update (skipped while paused → scene freezes in place) ──
      if (phaseRef.current === "running") {
        speedRef.current = Math.min(MAX_SPEED, speedRef.current + ACCEL * n);
        const speed = speedRef.current;

        vyRef.current += GRAVITY * n;
        yRef.current = Math.min(GROUND - PLAYER_H, yRef.current + vyRef.current * n);

        distanceRef.current += speed * n;
        groundOffsetRef.current = (groundOffsetRef.current + speed * n) % 24;
        scoreRef.current += speed * 0.045 * n;

        nextSpawnRef.current -= speed * n;
        if (nextSpawnRef.current <= 0) {
          const spec =
            OBSTACLE_TYPES[
              Math.random() < 0.3 ? 2 : Math.random() < 0.4 ? 1 : 0
            ];
          obstaclesRef.current.push({ x: W + 20, spec });
          nextSpawnRef.current = 300 + Math.random() * 320 + speed * 18;
        }

        for (const ob of obstaclesRef.current) ob.x -= speed * n;
        obstaclesRef.current = obstaclesRef.current.filter((o) => o.x > -80);

        // AABB collision, slightly forgiving insets
        const pL = PLAYER_X + 6;
        const pR = PLAYER_X + PLAYER_W - 6;
        const pT = yRef.current + 4;
        const pB = yRef.current + PLAYER_H;
        for (const ob of obstaclesRef.current) {
          const oL = ob.x + 2;
          const oR = ob.x + ob.spec.w - 2;
          const oT = GROUND - ob.spec.h + 2;
          if (pR > oL && pL < oR && pB > oT) {
            die();
            break;
          }
        }
      }

      // ── Draw ──
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, W, H);

      // Ground: main line + scrolling dashes
      ctx.fillStyle = "#2E2E2E";
      ctx.fillRect(0, GROUND, W, 2);
      ctx.fillStyle = "#1C1C1C";
      for (let x = -groundOffsetRef.current; x < W; x += 24) {
        ctx.fillRect(Math.round(x), GROUND + 8, 10, 2);
      }

      // Obstacles (flames freeze too while paused — consistent freeze-frame)
      const flameFrame =
        phaseRef.current === "paused" ? 0 : Math.floor(now / 130) % 2;
      for (const ob of obstaclesRef.current) {
        const oy = GROUND - ob.spec.h;
        if (ob.spec.flames) {
          drawSprite(ctx, CAR_FLAMES[flameFrame], ob.x, oy - 4 * PX, PX);
        }
        drawSprite(ctx, ob.spec.map, ob.x, oy, ob.spec.px);
      }

      // Player
      const airborne = yRef.current < GROUND - PLAYER_H - 0.5;
      const runFrame = Math.floor(distanceRef.current / 14) % 2 === 0 ? RUN_A : RUN_B;
      const sprite =
        phaseRef.current === "ready"
          ? RUN_A
          : airborne
          ? JUMP_FRAME
          : runFrame;
      drawSprite(ctx, sprite, PLAYER_X, yRef.current, PX);

      // Score (top right, dino-style): HI 00123  00042
      ctx.textAlign = "right";
      ctx.font = "700 14px 'Courier New', monospace";
      ctx.fillStyle = "#535353";
      const hi = String(highRef.current).padStart(5, "0");
      const sc = String(Math.floor(scoreRef.current)).padStart(5, "0");
      ctx.fillText(`HI ${hi}`, W - 92, 26);
      ctx.fillStyle = "#1ED760";
      ctx.fillText(sc, W - 16, 26);

      // Ready hint (blinking)
      if (phaseRef.current === "ready" && Math.floor(now / 500) % 2 === 0) {
        ctx.textAlign = "center";
        ctx.font = "800 13px 'Courier New', monospace";
        ctx.fillStyle = "#B3B3B3";
        ctx.fillText("▶ SPACE / TAP", W / 2, 90);
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="relative w-full bg-surface border border-green rounded-card p-4 md:p-6"
      style={{ boxShadow: "0 0 32px rgba(30,215,96,0.15)" }}
    >
      {/* Close — the game is always optional */}
      <button
        onClick={onClose}
        aria-label="Close game"
        className="absolute top-3 right-3 z-20 w-7 h-7 flex items-center justify-center rounded-full border border-white/[0.12] text-text-muted hover:text-white hover:border-white/30 transition-colors"
      >
        <CloseIcon />
      </button>

      <p className="text-green font-extrabold text-sm md:text-base tracking-[0.4em] text-center mb-4">
        STREETRUNNER
      </p>

      <div className="relative select-none">
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            e.preventDefault();
            onAction();
          }}
          className="w-full rounded-card border border-white/[0.06] touch-none cursor-pointer"
          style={{ aspectRatio: `${W}/${H}`, background: "#0A0A0A" }}
          aria-label="Streetrunner mini game"
        />

        {/* Game-over overlay */}
        {phase === "over" && !successOverlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/70 rounded-card">
            <p className="text-white font-extrabold text-xl tracking-[0.25em]">
              GAME OVER
            </p>
            <p className="text-text-secondary text-sm font-bold">
              {t.gameScore}: <span className="text-green">{finalScore}</span>
              {" · "}
              {t.gameBest}: <span className="text-white">{highScore}</span>
            </p>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={restart}
                className="border border-white/[0.2] text-white font-extrabold text-sm px-5 py-2.5 rounded-pill hover:border-white/40 transition-colors"
              >
                {t.gameAgain}
              </button>
              {resultReady && (
                <button
                  onClick={onExit}
                  className="bg-green text-bg font-extrabold text-sm px-5 py-2.5 rounded-pill hover:bg-green/90 transition-colors"
                >
                  {t.gameExit}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Success overlay: generation finished → pause + choose */}
        {successOverlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/85 rounded-card backdrop-blur-[2px]">
            <p className="text-green font-extrabold text-xl tracking-tight">
              {t.gameDone}
            </p>
            <p className="text-text-secondary text-sm">{t.gameDoneSub}</p>
            <button
              onClick={onExit}
              className="mt-3 bg-green text-bg font-extrabold text-sm px-8 py-3 rounded-pill hover:bg-green/90 transition-colors"
            >
              {t.gameExit}
            </button>
            <button
              onClick={handleContinue}
              className="absolute bottom-4 text-white/80 text-xs font-bold hover:text-white hover:underline underline-offset-2 transition-colors"
            >
              {t.gameContinue}
            </button>
          </div>
        )}
      </div>

      <p className="text-text-muted text-xs md:text-sm text-center mt-4">
        {t.gameHint}
      </p>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M2.5 2.5l7 7M9.5 2.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
