import { GAME_HEIGHT, GAME_WIDTH, MAX_AIM_HORIZONTAL_RATIO, PLAYER_PADDLE_Y, POLICY_VERSION, reflectWallX, type CanonicalControls } from "./canonical-engine";

export { POLICY_VERSION };
export type PolicyBall = { x: number; y: number; vx: number; vy: number; radius: number; temporary?: boolean };
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

function protectedReflectorBlocking(target: PolicyBrick, bricks: PolicyBrick[], originX: number) {
  const targetX = target.x + target.w / 2;
  const targetY = target.y + target.h / 2;
  const verticalTravel = targetY - PLAYER_PADDLE_Y;
  if (verticalTravel >= 0) return undefined;
  return bricks
    .filter((brick) => brick.alive && brick.trait === "reflector")
    .filter((brick) => {
      const faceY = brick.y + brick.h;
      if (faceY >= PLAYER_PADDLE_Y || faceY <= targetY) return false;
      const time = (faceY - PLAYER_PADDLE_Y) / verticalTravel;
      const contactX = originX + (targetX - originX) * time;
      return contactX >= brick.x - 10 && contactX <= brick.x + brick.w + 10;
    })
    .sort((a, b) => b.y - a.y)[0];
}

export function reflectorBankAim(target: PolicyBrick, originX: number, phase: number, reflectors: PolicyBrick[] = [target], ballRadius = 8) {
  const topY = ballRadius + 2;
  const targetX = target.x + target.w / 2;
  const targetContactY = Math.max(topY + 1, target.y - ballRadius - 2);
  const verticalDistance = Math.max(1, (PLAYER_PADDLE_Y - topY) + (targetContactY - topY));
  const wallSpan = GAME_WIDTH - ballRadius * 2;
  const targetOffset = targetX - ballRadius;
  const aimY = 80;
  const aimVerticalTravel = PLAYER_PADDLE_Y - aimY;
  const preferredDirection = phase % 2 ? 1 : -1;
  const candidates = Array.from({ length: 5 }, (_, index) => index - 2).flatMap((turn) => {
    const period = turn * wallSpan * 2;
    return [ballRadius + period + targetOffset, ballRadius + period - targetOffset];
  }).map((unfoldedTargetX) => {
    const slope = (unfoldedTargetX - originX) / verticalDistance;
    const horizontalRatio = slope / Math.sqrt(1 + slope * slope);
    const upwardBlocks = reflectors.filter((brick) => {
      const faceCenterY = brick.y + brick.h + ballRadius;
      const upwardTravel = PLAYER_PADDLE_Y - faceCenterY;
      if (upwardTravel <= 0) return false;
      const crossingX = reflectWallX(originX + slope * upwardTravel, ballRadius);
      return crossingX >= brick.x - ballRadius - 4 && crossingX <= brick.x + brick.w + ballRadius + 4;
    }).length;
    const direction = Math.sign(horizontalRatio) || preferredDirection;
    const valid = Math.abs(horizontalRatio) <= MAX_AIM_HORIZONTAL_RATIO;
    return {
      x: originX + slope * aimVerticalTravel,
      y: aimY,
      valid,
      horizontalRatio: Math.abs(horizontalRatio),
      upwardBlocks,
      direction,
    };
  });
  return candidates.sort((a, b) => Number(b.valid) - Number(a.valid)
    || a.upwardBlocks - b.upwardBlocks
    || Number(a.direction !== preferredDirection) - Number(b.direction !== preferredDirection)
    || a.horizontalRatio - b.horizontalRatio)[0];
}

function bankAim(target: PolicyBrick, originX: number, phase: number, reflectors: PolicyBrick[]) {
  return reflectorBankAim(target, originX, phase, reflectors);
}

export function decideBotControls(observation: BotObservation, state: BotPolicyState, dt: number): CanonicalControls {
  const attackable = observation.bricks.filter((brick) => brick.alive && brick.trait !== "indestructible");
  const directTargets = attackable.filter((brick) => brick.trait !== "reflector");
  const reflectorTargets = attackable.filter((brick) => brick.trait === "reflector");
  if (attackable.length === state.lastAlive) state.stalledFor += dt; else { state.stalledFor = 0; state.lastAlive = attackable.length; }
  if (state.stalledFor > 3.5) { state.bankPhase++; state.stalledFor = 0; }
  const primaryBall = observation.balls.find((ball) => !ball.temporary) ?? observation.balls[0];
  const falling = observation.balls.filter((ball) => ball.vy > 0).sort((a, b) => Number(Boolean(a.temporary)) - Number(Boolean(b.temporary)) || b.y - a.y)[0];
  const directTarget = [...directTargets].sort((a, b) => priority(b) - priority(a) || (a.id ?? 0) - (b.id ?? 0))[0];
  const reflectorTarget = directTarget ? undefined : [...reflectorTargets].sort((a, b) => b.y - a.y || (a.id ?? 0) - (b.id ?? 0))[0];
  const target = directTarget ?? reflectorTarget;
  const blockingReflector = directTarget ? protectedReflectorBlocking(directTarget, observation.bricks, observation.paddleX) : undefined;
  let aimX = target ? target.x + target.w / 2 : GAME_WIDTH / 2;
  let aimY = target ? target.y + target.h / 2 : 80;
  if (target && (reflectorTarget || blockingReflector)) {
    const bank = reflectorBankAim(target, observation.paddleX, state.bankPhase, reflectorTargets);
    aimX = bank.x; aimY = bank.y;
  } else if (target && (directPathBlocked(target, observation.bricks, observation.paddleX) || state.bankPhase % 3 !== 0 && state.stalledFor > 2)) {
    const bank = bankAim(target, observation.paddleX, state.bankPhase, reflectorTargets);
    aimX = bank.x; aimY = bank.y;
  }
  const trackingBall = primaryBall?.vy > 0 ? primaryBall : falling ?? primaryBall;
  const landingX = trackingBall ? predictLandingX(trackingBall) : observation.paddleX;
  const urgency = trackingBall?.vy > 0 ? Math.max(0, Math.min(1, (trackingBall.y - 360) / 150)) : 0;
  const desiredRatio = Math.max(-MAX_AIM_HORIZONTAL_RATIO, Math.min(MAX_AIM_HORIZONTAL_RATIO, (aimX - observation.paddleX) / Math.max(120, PLAYER_PADDLE_Y - aimY)));
  let paddleTarget = landingX - desiredRatio * observation.paddleWidth * 0.32;
  const item = observation.items.filter((entry) => entry.alive && entry.y < PLAYER_PADDLE_Y).sort((a, b) => b.y - a.y)[0];
  if (item && urgency < 0.35 && Math.abs(item.x - observation.paddleX) <= observation.paddleSpeed * 0.7) paddleTarget = item.x;
  paddleTarget = Math.max(observation.paddleWidth / 2, Math.min(GAME_WIDTH - observation.paddleWidth / 2, paddleTarget));
  const tolerance = Math.max(3, observation.paddleSpeed * dt * 0.45);
  const move: -1 | 0 | 1 = paddleTarget > observation.paddleX + tolerance ? 1 : paddleTarget < observation.paddleX - tolerance ? -1 : 0;
  state.lastTargetKey = target ? `${target.id ?? "x"}:${target.trait}${reflectorTarget || blockingReflector ? ":bank" : ""}` : "none";
  return { move, aimX, aimY: Math.min(GAME_HEIGHT - 1, aimY) };
}
