import { GAME_HEIGHT, GAME_WIDTH, MAX_AIM_HORIZONTAL_RATIO, PLAYER_PADDLE_Y, POLICY_VERSION, reflectWallX, type CanonicalControls } from "./canonical-engine";

export { POLICY_VERSION };
export type PolicyBall = { x: number; y: number; vx: number; vy: number; radius: number };
export type PolicyBrick = { id?: number; x: number; y: number; w: number; h: number; hp: number; alive: boolean; trait: string };
export type PolicyItem = { x: number; y: number; vy?: number; alive: boolean; kind?: string };
export type BotObservation = { elapsed: number; paddleX: number; paddleWidth: number; paddleSpeed: number; balls: PolicyBall[]; bricks: PolicyBrick[]; items: PolicyItem[] };
export type BotPolicyState = { seed: number; stalledFor: number; lastTargetKey: string; lastAlive: number; bankPhase: number };

export function createBotPolicyState(seed: number): BotPolicyState { return { seed, stalledFor: 0, lastTargetKey: "", lastAlive: -1, bankPhase: 0 }; }

export function predictLandingX(ball: PolicyBall, paddleY = PLAYER_PADDLE_Y) {
  if (ball.vy <= 0) return ball.x;
  const time = Math.max(0, (paddleY - ball.y) / Math.max(1, ball.vy));
  return reflectWallX(ball.x + ball.vx * time, ball.radius);
}

function priority(brick: PolicyBrick) {
  const trait = brick.trait === "healer" ? 90 : brick.trait === "explosive" ? 70 : brick.trait === "guard" ? 42 : brick.trait === "reflector" ? 30 : 20;
  return brick.y * 1.8 + trait - Math.min(80, brick.hp * 2);
}

function directPathBlocked(target: PolicyBrick, bricks: PolicyBrick[], originX: number) {
  const tx = target.x + target.w / 2;
  const ty = target.y + target.h / 2;
  return bricks.some((brick) => brick !== target && brick.alive && brick.trait === "indestructible" && brick.y > ty && brick.y < PLAYER_PADDLE_Y && Math.abs((originX + (tx - originX) * ((brick.y - PLAYER_PADDLE_Y) / (ty - PLAYER_PADDLE_Y))) - (brick.x + brick.w / 2)) < brick.w / 2 + 8);
}

function bankAim(target: PolicyBrick, originX: number, phase: number) {
  const weakX = phase % 2 ? target.x + target.w + 8 : target.x - 8;
  const wallX = phase % 2 ? GAME_WIDTH : 0;
  const mirrored = wallX === 0 ? -weakX : GAME_WIDTH * 2 - weakX;
  const dy = target.y + target.h / 2 - PLAYER_PADDLE_Y;
  const dx = mirrored - originX;
  const t = Math.max(0.05, Math.min(0.95, (wallX - originX) / Math.max(1, dx)));
  return { x: wallX, y: Math.max(40, Math.min(PLAYER_PADDLE_Y - 60, PLAYER_PADDLE_Y + dy * t)) };
}

export function decideBotControls(observation: BotObservation, state: BotPolicyState, dt: number): CanonicalControls {
  const alive = observation.bricks.filter((brick) => brick.alive && brick.trait !== "indestructible");
  if (alive.length === state.lastAlive) state.stalledFor += dt; else { state.stalledFor = 0; state.lastAlive = alive.length; }
  if (state.stalledFor > 3.5) { state.bankPhase++; state.stalledFor = 0; }
  const falling = observation.balls.filter((ball) => ball.vy > 0).sort((a, b) => b.y - a.y)[0];
  const target = [...alive].sort((a, b) => priority(b) - priority(a) || (a.id ?? 0) - (b.id ?? 0))[0];
  let aimX = target ? target.x + target.w / 2 : GAME_WIDTH / 2;
  let aimY = target ? target.y + target.h / 2 : 80;
  if (target && (target.trait === "reflector" || directPathBlocked(target, observation.bricks, observation.paddleX) || state.bankPhase % 3 !== 0 && state.stalledFor > 2)) {
    const bank = bankAim(target, observation.paddleX, state.bankPhase);
    aimX = bank.x; aimY = bank.y;
  }
  const landingX = falling ? predictLandingX(falling) : observation.balls[0]?.x ?? observation.paddleX;
  const urgency = falling ? Math.max(0, Math.min(1, (falling.y - 360) / 150)) : 0;
  const desiredRatio = Math.max(-MAX_AIM_HORIZONTAL_RATIO, Math.min(MAX_AIM_HORIZONTAL_RATIO, (aimX - observation.paddleX) / Math.max(120, PLAYER_PADDLE_Y - aimY)));
  let paddleTarget = landingX - desiredRatio * observation.paddleWidth * 0.32;
  const item = observation.items.filter((entry) => entry.alive && entry.y < PLAYER_PADDLE_Y).sort((a, b) => b.y - a.y)[0];
  if (item && urgency < 0.35 && Math.abs(item.x - observation.paddleX) <= observation.paddleSpeed * 0.7) paddleTarget = item.x;
  paddleTarget = Math.max(observation.paddleWidth / 2, Math.min(GAME_WIDTH - observation.paddleWidth / 2, paddleTarget));
  const tolerance = Math.max(3, observation.paddleSpeed * dt * 0.45);
  const move: -1 | 0 | 1 = paddleTarget > observation.paddleX + tolerance ? 1 : paddleTarget < observation.paddleX - tolerance ? -1 : 0;
  state.lastTargetKey = target ? `${target.id ?? "x"}:${target.trait}` : "none";
  return { move, aimX, aimY: Math.min(GAME_HEIGHT - 1, aimY) };
}
