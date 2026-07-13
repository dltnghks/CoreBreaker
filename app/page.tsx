"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type UpgradeId = "split" | "pierce" | "blast" | "speed" | "wide" | "chain";

type Upgrade = {
  id: UpgradeId;
  name: string;
  tag: string;
  description: string;
  color: string;
};

type GhostRecord = {
  id: string;
  name: string;
  score: number;
  bricks: number;
  maxCombo: number;
  upgrades: UpgradeId[];
  paddleTrack: number[];
  createdAt: number;
};

type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  owner: "player" | "ghost";
  ghostIndex?: number;
  pierce: number;
  blast: number;
  color: string;
};

type Brick = {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  hue: number;
  alive: boolean;
};

type GameState = {
  balls: Ball[];
  bricks: Brick[];
  paddleX: number;
  paddleWidth: number;
  ghostPaddles: number[];
  elapsed: number;
  score: number;
  xp: number;
  xpNeed: number;
  level: number;
  combo: number;
  maxCombo: number;
  comboTimer: number;
  bricksBroken: number;
  upgrades: UpgradeId[];
  paddleTrack: number[];
  particles: Particle[];
  flashes: Flash[];
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Flash = { text: string; x: number; y: number; life: number; color: string };

const W = 900;
const H = 600;
const RUN_SECONDS = 60;
const MAX_GHOSTS = 10;
const MAX_ACTIVE_GHOSTS = 3;

const UPGRADES: Upgrade[] = [
  { id: "split", name: "MULTI BALL", tag: "SPLIT", description: "현재 공 하나를 복제합니다.", color: "#ffcf4a" },
  { id: "pierce", name: "PIERCE CORE", tag: "PIERCE", description: "관통 횟수가 1 증가합니다.", color: "#60d7ff" },
  { id: "blast", name: "CHAIN BLAST", tag: "POWER", description: "파괴 시 주변 블럭에 피해를 줍니다.", color: "#ff6b87" },
  { id: "speed", name: "OVERDRIVE", tag: "RISK", description: "공 속도와 획득 점수가 12% 증가합니다.", color: "#ff9658" },
  { id: "wide", name: "WIDE SIGNAL", tag: "CONTROL", description: "현재 패들의 폭이 증가합니다.", color: "#9a8cff" },
  { id: "chain", name: "COMBO LINK", tag: "CHAIN", description: "콤보 유지 시간과 배율이 증가합니다.", color: "#72f1b8" },
];

const GHOST_COLORS = ["#9b8cff", "#58d5ff", "#ff78b7"];

function makeBricks(): Brick[] {
  const bricks: Brick[] = [];
  const cols = 12;
  const rows = 8;
  const gap = 7;
  const margin = 36;
  const width = (W - margin * 2 - gap * (cols - 1)) / cols;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const maxHp = row < 2 ? 3 : row < 5 ? 2 : 1;
      bricks.push({
        x: margin + col * (width + gap),
        y: 74 + row * 34,
        w: width,
        h: 24,
        hp: maxHp,
        maxHp,
        hue: 185 + row * 14 + col * 2,
        alive: true,
      });
    }
  }
  return bricks;
}

function ghostPower(upgrades: UpgradeId[]) {
  return {
    pierce: upgrades.filter((u) => u === "pierce").length,
    blast: upgrades.filter((u) => u === "blast").length,
    speed: upgrades.filter((u) => u === "speed").length,
    splits: Math.min(2, upgrades.filter((u) => u === "split").length),
  };
}

function initialGame(activeGhosts: GhostRecord[]): GameState {
  const balls: Ball[] = [{ x: W / 2, y: H - 72, vx: 190, vy: -250, radius: 8, owner: "player", pierce: 0, blast: 0, color: "#fff27a" }];
  activeGhosts.forEach((ghost, index) => {
    const power = ghostPower(ghost.upgrades);
    for (let i = 0; i <= power.splits; i++) {
      balls.push({
        x: W / 2 + (index - 1) * 38,
        y: H - 96 - index * 10,
        vx: 145 + index * 25 + i * 20,
        vy: -(225 + power.speed * 13 + i * 15),
        radius: 7,
        owner: "ghost",
        ghostIndex: index,
        pierce: power.pierce,
        blast: power.blast,
        color: GHOST_COLORS[index],
      });
    }
  });
  return {
    balls,
    bricks: makeBricks(),
    paddleX: W / 2,
    paddleWidth: 128,
    ghostPaddles: activeGhosts.map(() => W / 2),
    elapsed: 0,
    score: 0,
    xp: 0,
    xpNeed: 8,
    level: 1,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    bricksBroken: 0,
    upgrades: [],
    paddleTrack: [],
    particles: [],
    flashes: [],
  };
}

function formatScore(value: number) {
  return Math.floor(value).toLocaleString("ko-KR");
}

function pickUpgradeChoices(existing: UpgradeId[]) {
  const weighted = [...UPGRADES].sort(() => Math.random() - 0.5);
  const newOnes = weighted.filter((u) => !existing.includes(u.id));
  const repeats = weighted.filter((u) => existing.includes(u.id));
  return [...newOnes.slice(0, 2), ...repeats, ...weighted].filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i).slice(0, 3);
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const gameRef = useRef<GameState | null>(null);
  const activeGhostsRef = useRef<GhostRecord[]>([]);
  const pointerXRef = useRef(W / 2);
  const runningRef = useRef(false);
  const levelUpRef = useRef(false);

  const [ghosts, setGhosts] = useState<GhostRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"lobby" | "playing" | "levelup" | "result">("lobby");
  const [hud, setHud] = useState({ score: 0, time: RUN_SECONDS, level: 1, xp: 0, xpNeed: 8, combo: 0, bricks: 0 });
  const [choices, setChoices] = useState<Upgrade[]>([]);
  const [result, setResult] = useState<GameState | null>(null);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("echo-breaker-ghosts-v1");
      if (saved) setGhosts(JSON.parse(saved));
    } catch {
      setGhosts([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("echo-breaker-ghosts-v1", JSON.stringify(ghosts));
  }, [ghosts]);

  const selectedGhosts = useMemo(() => selectedIds.map((id) => ghosts.find((g) => g.id === id)).filter(Boolean) as GhostRecord[], [ghosts, selectedIds]);

  const toggleGhost = (id: string) => {
    if (mode !== "lobby") return;
    setSelectedIds((current) => current.includes(id) ? current.filter((x) => x !== id) : current.length < MAX_ACTIVE_GHOSTS ? [...current, id] : current);
  };

  const applyUpgrade = useCallback((upgrade: Upgrade) => {
    const game = gameRef.current;
    if (!game) return;
    game.upgrades.push(upgrade.id);
    if (upgrade.id === "split") {
      const source = game.balls.find((b) => b.owner === "player");
      if (source) game.balls.push({ ...source, vx: -source.vx * 0.9, vy: source.vy * 1.05, x: source.x + 10 });
    }
    if (upgrade.id === "pierce") game.balls.filter((b) => b.owner === "player").forEach((b) => b.pierce++);
    if (upgrade.id === "blast") game.balls.filter((b) => b.owner === "player").forEach((b) => b.blast++);
    if (upgrade.id === "speed") game.balls.filter((b) => b.owner === "player").forEach((b) => { b.vx *= 1.12; b.vy *= 1.12; });
    if (upgrade.id === "wide") game.paddleWidth = Math.min(220, game.paddleWidth + 28);
    game.flashes.push({ text: upgrade.name, x: W / 2, y: H / 2, life: 1.2, color: upgrade.color });
    levelUpRef.current = false;
    runningRef.current = true;
    setMode("playing");
    lastRef.current = performance.now();
  }, []);

  const finishRun = useCallback(() => {
    runningRef.current = false;
    const game = gameRef.current;
    if (!game) return;
    setResult({ ...game, balls: [...game.balls], upgrades: [...game.upgrades], paddleTrack: [...game.paddleTrack] });
    setMode("result");
  }, []);

  const levelUp = useCallback(() => {
    const game = gameRef.current;
    if (!game || levelUpRef.current) return;
    levelUpRef.current = true;
    runningRef.current = false;
    setChoices(pickUpgradeChoices(game.upgrades));
    setMode("levelup");
  }, []);

  const updateGame = useCallback((dt: number) => {
    const game = gameRef.current;
    if (!game) return;
    game.elapsed += dt;
    game.paddleX += (pointerXRef.current - game.paddleX) * Math.min(1, dt * 14);
    game.paddleX = Math.max(game.paddleWidth / 2, Math.min(W - game.paddleWidth / 2, game.paddleX));

    const trackIndex = Math.floor(game.elapsed * 10);
    if (game.paddleTrack.length <= trackIndex) game.paddleTrack.push(game.paddleX / W);

    activeGhostsRef.current.forEach((ghost, index) => {
      const sample = ghost.paddleTrack[Math.min(ghost.paddleTrack.length - 1, trackIndex)] ?? 0.5;
      game.ghostPaddles[index] = sample * W;
    });

    game.comboTimer -= dt;
    if (game.comboTimer <= 0 && game.combo > 0) game.combo = 0;
    game.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.life -= dt; });
    game.particles = game.particles.filter((p) => p.life > 0);
    game.flashes.forEach((f) => { f.y -= 28 * dt; f.life -= dt; });
    game.flashes = game.flashes.filter((f) => f.life > 0);

    const speedBonus = 1 + game.upgrades.filter((u) => u === "speed").length * 0.12;
    const chainLevel = game.upgrades.filter((u) => u === "chain").length;
    const paddleY = H - 38;

    for (const ball of game.balls) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - ball.radius) { ball.x = W - ball.radius; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < ball.radius) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }

      const px = ball.owner === "player" ? game.paddleX : game.ghostPaddles[ball.ghostIndex ?? 0] ?? W / 2;
      const pw = ball.owner === "player" ? game.paddleWidth : 108;
      const py = ball.owner === "player" ? paddleY : paddleY - 14 - (ball.ghostIndex ?? 0) * 9;
      if (ball.vy > 0 && ball.y + ball.radius >= py && ball.y - ball.radius <= py + 12 && ball.x >= px - pw / 2 && ball.x <= px + pw / 2) {
        const hit = (ball.x - px) / (pw / 2);
        ball.vx = hit * 330;
        ball.vy = -Math.max(215, Math.abs(ball.vy));
        ball.y = py - ball.radius;
      }

      if (ball.y > H + 30) {
        ball.x = px;
        ball.y = py - 20;
        ball.vx = 170 * (Math.random() > 0.5 ? 1 : -1);
        ball.vy = -250;
        if (ball.owner === "player") {
          game.combo = 0;
          game.flashes.push({ text: "SIGNAL LOST", x: px, y: H - 90, life: 0.8, color: "#ff6b87" });
        }
      }

      for (const brick of game.bricks) {
        if (!brick.alive) continue;
        if (ball.x + ball.radius < brick.x || ball.x - ball.radius > brick.x + brick.w || ball.y + ball.radius < brick.y || ball.y - ball.radius > brick.y + brick.h) continue;

        brick.hp--;
        if (ball.pierce <= 0) {
          const overlapX = Math.min(ball.x + ball.radius - brick.x, brick.x + brick.w - (ball.x - ball.radius));
          const overlapY = Math.min(ball.y + ball.radius - brick.y, brick.y + brick.h - (ball.y - ball.radius));
          if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1;
        }
        if (brick.hp <= 0) {
          brick.alive = false;
          game.bricksBroken++;
          game.combo++;
          game.maxCombo = Math.max(game.maxCombo, game.combo);
          game.comboTimer = 1.8 + chainLevel * 0.45;
          const multiplier = 1 + Math.min(4, game.combo * (0.05 + chainLevel * 0.015));
          const points = 100 * multiplier * (ball.owner === "ghost" ? 0.75 : 1) * speedBonus;
          game.score += points;
          game.xp += 1;
          game.flashes.push({ text: `+${Math.floor(points)}`, x: brick.x + brick.w / 2, y: brick.y, life: 0.55, color: ball.color });
          for (let p = 0; p < 7; p++) game.particles.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, vx: (Math.random() - 0.5) * 180, vy: (Math.random() - 0.7) * 150, life: 0.45 + Math.random() * 0.4, color: `hsl(${brick.hue} 95% 68%)` });

          if (ball.blast > 0) {
            const range = 55 + ball.blast * 15;
            game.bricks.forEach((near) => {
              if (!near.alive) return;
              const dx = near.x + near.w / 2 - (brick.x + brick.w / 2);
              const dy = near.y + near.h / 2 - (brick.y + brick.h / 2);
              if (Math.hypot(dx, dy) < range) near.hp--;
            });
          }
        }
        break;
      }
    }

    if (game.bricks.every((b) => !b.alive)) {
      game.bricks = makeBricks();
      game.score += 2500;
      game.flashes.push({ text: "BOARD CLEARED +2,500", x: W / 2, y: H / 2, life: 1.4, color: "#fff27a" });
    }

    if (game.xp >= game.xpNeed) {
      game.xp -= game.xpNeed;
      game.level++;
      game.xpNeed = 8 + (game.level - 1) * 4;
      levelUp();
    }

    if (game.elapsed >= RUN_SECONDS) finishRun();

    setHud({ score: game.score, time: Math.max(0, RUN_SECONDS - game.elapsed), level: game.level, xp: game.xp, xpNeed: game.xpNeed, combo: game.combo, bricks: game.bricksBroken });
  }, [finishRun, levelUp]);

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas || !game) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#10162f");
    bg.addColorStop(0.65, "#080d1e");
    bg.addColorStop(1, "#050812");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(92, 214, 255, .07)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 45) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 45) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    game.bricks.forEach((brick) => {
      if (!brick.alive) return;
      const alpha = 0.42 + (brick.hp / brick.maxHp) * 0.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = `hsla(${brick.hue}, 95%, 65%, .6)`;
      ctx.fillStyle = `hsla(${brick.hue}, 90%, ${brick.maxHp === 3 ? 64 : 58}%, ${alpha})`;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, 2);
      if (brick.maxHp > 1) {
        ctx.fillStyle = "rgba(4,8,20,.58)";
        ctx.font = "700 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(brick.hp), brick.x + brick.w / 2, brick.y + 16);
      }
    });

    game.ghostPaddles.forEach((x, index) => {
      const y = H - 52 - index * 9;
      ctx.globalAlpha = 0.33;
      ctx.shadowBlur = 16;
      ctx.shadowColor = GHOST_COLORS[index];
      ctx.fillStyle = GHOST_COLORS[index];
      ctx.fillRect(x - 54, y, 108, 7);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    });

    ctx.shadowBlur = 22;
    ctx.shadowColor = "#fff27a";
    ctx.fillStyle = "#fff27a";
    ctx.fillRect(game.paddleX - game.paddleWidth / 2, H - 38, game.paddleWidth, 10);
    ctx.fillStyle = "#fffce3";
    ctx.fillRect(game.paddleX - game.paddleWidth / 2 + 5, H - 36, game.paddleWidth - 10, 2);
    ctx.shadowBlur = 0;

    game.balls.forEach((ball) => {
      ctx.globalAlpha = ball.owner === "ghost" ? 0.58 : 1;
      ctx.shadowBlur = ball.owner === "ghost" ? 18 : 24;
      ctx.shadowColor = ball.color;
      ctx.fillStyle = ball.color;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    });

    game.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1;

    game.flashes.forEach((f) => {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.fillStyle = f.color;
      ctx.font = `900 ${f.text.includes("BOARD") ? 28 : 15}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    if (game.combo >= 3) {
      ctx.textAlign = "right";
      ctx.font = "900 28px monospace";
      ctx.fillStyle = game.combo >= 15 ? "#ffcf4a" : "#72f1b8";
      ctx.fillText(`${game.combo} COMBO`, W - 28, 44);
    }
  }, []);

  const loop = useCallback((time: number) => {
    const dt = Math.min(0.025, (time - lastRef.current) / 1000 || 0);
    lastRef.current = time;
    if (runningRef.current) updateGame(dt);
    drawGame();
    frameRef.current = requestAnimationFrame(loop);
  }, [drawGame, updateGame]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [loop]);

  const startRun = () => {
    activeGhostsRef.current = selectedGhosts;
    gameRef.current = initialGame(selectedGhosts);
    pointerXRef.current = W / 2;
    lastRef.current = performance.now();
    runningRef.current = true;
    levelUpRef.current = false;
    setSavedMessage("");
    setHud({ score: 0, time: RUN_SECONDS, level: 1, xp: 0, xpNeed: 8, combo: 0, bricks: 0 });
    setMode("playing");
  };

  const saveGhost = () => {
    if (!result) return;
    const record: GhostRecord = {
      id: `ghost-${Date.now()}`,
      name: `ECHO ${String(ghosts.length + 1).padStart(2, "0")}`,
      score: Math.floor(result.score),
      bricks: result.bricksBroken,
      maxCombo: result.maxCombo,
      upgrades: result.upgrades,
      paddleTrack: result.paddleTrack,
      createdAt: Date.now(),
    };
    setGhosts((current) => {
      if (current.length < MAX_GHOSTS) return [...current, record];
      const lowest = [...current].sort((a, b) => a.score - b.score)[0];
      return current.map((g) => g.id === lowest.id ? record : g);
    });
    setSavedMessage(ghosts.length < MAX_GHOSTS ? "새 고스트를 보관했습니다." : "최저 점수 고스트를 교체했습니다.");
  };

  const backToLobby = () => {
    runningRef.current = false;
    gameRef.current = null;
    setResult(null);
    setMode("lobby");
    setSelectedIds((ids) => ids.filter((id) => ghosts.some((g) => g.id === id)));
  };

  const onPointerMove = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerXRef.current = Math.max(0, Math.min(W, ((clientX - rect.left) / rect.width) * W));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (mode !== "playing") return;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") pointerXRef.current -= 55;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") pointerXRef.current += 55;
      pointerXRef.current = Math.max(0, Math.min(W, pointerXRef.current));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  const upgradeCounts = (ids: UpgradeId[]) => UPGRADES.map((u) => ({ ...u, count: ids.filter((id) => id === u.id).length })).filter((u) => u.count > 0);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">EB</span>
          <div><p className="eyebrow">PLAYTEST BUILD 0.1</p><h1>ECHO BREAKER</h1></div>
        </div>
        <div className="header-rule" />
        <div className="session-status"><span className={mode === "playing" ? "live-dot active" : "live-dot"} />{mode === "playing" ? "SESSION LIVE" : "SYSTEM READY"}</div>
      </header>

      <section className="workspace">
        <div className="game-column">
          <div className="hud-strip">
            <div><span>TIME</span><strong>{hud.time.toFixed(1)}</strong></div>
            <div><span>SCORE</span><strong>{formatScore(hud.score)}</strong></div>
            <div><span>LEVEL</span><strong>{hud.level}</strong></div>
            <div className="xp-cell"><span>EXPERIENCE</span><div className="xp-track"><i style={{ width: `${Math.min(100, (hud.xp / hud.xpNeed) * 100)}%` }} /></div><small>{hud.xp} / {hud.xpNeed}</small></div>
            <div><span>BRICKS</span><strong>{hud.bricks}</strong></div>
          </div>

          <div className="game-frame">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              aria-label="Echo Breaker 게임 화면"
              onPointerMove={(e) => onPointerMove(e.clientX)}
              onPointerDown={(e) => onPointerMove(e.clientX)}
            />

            {mode === "lobby" && (
              <div className="overlay lobby-overlay">
                <p className="overlay-kicker">ONE MINUTE. TEN ECHOES. ONE BUILD.</p>
                <h2>과거의 플레이를<br />이번 회차에 편성하세요.</h2>
                <p>보관한 고스트 중 최대 3개가 백그라운드에서 함께 벽돌을 파괴합니다.</p>
                <button className="primary-button" onClick={startRun}>60초 플레이 시작 <span>→</span></button>
                <small>마우스·터치 또는 A / D 키로 패들을 움직이세요.</small>
              </div>
            )}

            {mode === "levelup" && (
              <div className="overlay level-overlay">
                <p className="overlay-kicker">LEVEL {gameRef.current?.level} // SIGNAL UPGRADE</p>
                <h2>조합을 선택하세요</h2>
                <div className="upgrade-grid">
                  {choices.map((upgrade, index) => (
                    <button key={upgrade.id} className="upgrade-card" onClick={() => applyUpgrade(upgrade)} style={{ "--accent": upgrade.color } as React.CSSProperties}>
                      <span className="upgrade-index">0{index + 1}</span>
                      <span className="upgrade-tag">{upgrade.tag}</span>
                      <strong>{upgrade.name}</strong>
                      <p>{upgrade.description}</p>
                      <em>{(gameRef.current?.upgrades.filter((u) => u === upgrade.id).length ?? 0) > 0 ? `LV ${(gameRef.current?.upgrades.filter((u) => u === upgrade.id).length ?? 0) + 1}` : "NEW"}</em>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "result" && result && (
              <div className="overlay result-overlay">
                <p className="overlay-kicker">SESSION COMPLETE</p>
                <h2>{formatScore(result.score)}</h2>
                <p className="score-label">FINAL SCORE</p>
                <div className="result-stats">
                  <div><span>LEVEL</span><strong>{result.level}</strong></div>
                  <div><span>BRICKS</span><strong>{result.bricksBroken}</strong></div>
                  <div><span>MAX COMBO</span><strong>{result.maxCombo}</strong></div>
                  <div><span>UPGRADES</span><strong>{result.upgrades.length}</strong></div>
                </div>
                <div className="result-actions">
                  <button className="primary-button" onClick={saveGhost} disabled={!!savedMessage}>{savedMessage || "고스트로 저장"}</button>
                  <button className="secondary-button" onClick={backToLobby}>보관함으로</button>
                </div>
              </div>
            )}
          </div>

          <div className="build-tray">
            <span className="tray-title">CURRENT BUILD</span>
            <div className="build-items">
              {(gameRef.current ? upgradeCounts(gameRef.current.upgrades) : []).map((u) => <span key={u.id} style={{ borderColor: u.color, color: u.color }}>{u.tag} <b>×{u.count}</b></span>)}
              {(!gameRef.current || gameRef.current.upgrades.length === 0) && <em>레벨업하면 조합이 여기에 기록됩니다.</em>}
            </div>
            <div className="controls">MOVE <kbd>A</kbd><kbd>D</kbd> / POINTER</div>
          </div>
        </div>

        <aside className="ghost-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">ECHO ARCHIVE</p><h2>고스트 보관함</h2></div>
            <span>{ghosts.length} / {MAX_GHOSTS}</span>
          </div>
          <p className="panel-copy">한 회차에 사용할 고스트를 최대 3개 선택하세요.</p>
          <div className="selected-count"><span>ACTIVE LOADOUT</span><strong>{selectedIds.length} / {MAX_ACTIVE_GHOSTS}</strong></div>

          <div className="ghost-list">
            {ghosts.length === 0 && (
              <div className="empty-state"><span>＋</span><strong>아직 저장된 고스트가 없습니다.</strong><p>첫 플레이를 마치고 기록을 저장해보세요.</p></div>
            )}
            {[...ghosts].sort((a, b) => b.score - a.score).map((ghost, index) => {
              const selectedIndex = selectedIds.indexOf(ghost.id);
              const mainUpgrade = upgradeCounts(ghost.upgrades)[0];
              return (
                <button key={ghost.id} className={`ghost-card ${selectedIndex >= 0 ? "selected" : ""}`} onClick={() => toggleGhost(ghost.id)} disabled={mode !== "lobby"}>
                  <span className="ghost-rank">{String(index + 1).padStart(2, "0")}</span>
                  <div className="ghost-info"><strong>{ghost.name}</strong><span>{mainUpgrade ? `${mainUpgrade.tag} BUILD` : "BASE BUILD"}</span></div>
                  <div className="ghost-score"><strong>{formatScore(ghost.score)}</strong><span>{ghost.bricks} BRICKS</span></div>
                  <span className="select-indicator">{selectedIndex >= 0 ? selectedIndex + 1 : "+"}</span>
                </button>
              );
            })}
          </div>

          <div className="panel-note">
            <span>PLAYTEST NOTE</span>
            <p>현재 버전은 기기에 고스트 기록을 저장합니다. 10개가 가득 차면 새 기록이 최저 점수 기록을 교체합니다.</p>
          </div>
          {ghosts.length > 0 && mode === "lobby" && <button className="clear-button" onClick={() => { setGhosts([]); setSelectedIds([]); }}>보관함 초기화</button>}
        </aside>
      </section>
    </main>
  );
}
