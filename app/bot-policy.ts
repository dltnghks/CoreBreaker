import { GAME_HEIGHT, GAME_WIDTH, MAX_AIM_HORIZONTAL_RATIO, PLAYER_PADDLE_Y, POLICY_VERSION, reflectWallX, type CanonicalControls } from "./canonical-engine";

export { POLICY_VERSION };
export type PolicyBall = { x: number; y: number; vx: number; vy: number; radius: number; temporary?: boolean };
export type PolicyBrick = { id?: number; x: number; y: number; w: number; h: number; hp: number; alive: boolean; trait: string };
export type PolicyItem = { x: number; y: number; vy?: number; alive: boolean; kind?: string };
export type BotObservation = { elapsed: number; paddleX: number; paddleWidth: number; paddleSpeed: number; balls: PolicyBall[]; bricks: PolicyBrick[]; items: PolicyItem[] };
export type BotPolicyState = { seed: number; stalledFor: number; lastTargetKey: string; lastAlive: number; lastHp: number; bankPhase: number };

export function createBotPolicyState(seed: number): BotPolicyState { return { seed, stalledFor: 0, lastTargetKey: "", lastAlive: -1, lastHp: -1, bankPhase: 0 }; }

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

function indestructibleTopCover(target: PolicyBrick, bricks: PolicyBrick[], ballRadius = 8) {
  return bricks.some((brick) => brick.alive && brick.trait === "indestructible"
    && brick.y + brick.h <= target.y
    && brick.x < target.x + target.w + ballRadius
    && brick.x + brick.w > target.x - ballRadius);
}

function bankAimToContact(target: PolicyBrick, targetX: number, targetContactY: number, originX: number, phase: number, obstacles: PolicyBrick[], ballRadius: number, requiredFinalDirection = 0) {
  const topY = ballRadius + 2;
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
    const topBounceUnfoldedX = originX + slope * (PLAYER_PADDLE_Y - topY);
    const upwardBlocks = obstacles.filter((brick) => {
      const faceCenterY = brick.y + brick.h + ballRadius;
      const upwardTravel = PLAYER_PADDLE_Y - faceCenterY;
      if (upwardTravel <= 0) return false;
      const crossingX = reflectWallX(originX + slope * upwardTravel, ballRadius);
      return crossingX >= brick.x - ballRadius - 4 && crossingX <= brick.x + brick.w + ballRadius + 4;
    }).length;
    // The old policy checked only the launch-to-ceiling half. Dense waves can
    // have a safe ascent that returns through an indestructible/reflector row,
    // so score the ceiling-to-target half as well.
    const downwardBlocks = obstacles.filter((brick) => brick !== target).filter((brick) => {
      const faceCenterY = brick.y - ballRadius - 2;
      if (faceCenterY <= topY || faceCenterY >= targetContactY) return false;
      const crossingX = reflectWallX(topBounceUnfoldedX + slope * (faceCenterY - topY), ballRadius);
      return crossingX >= brick.x - ballRadius - 4 && crossingX <= brick.x + brick.w + ballRadius + 4;
    }).length;
    const direction = Math.sign(horizontalRatio) || preferredDirection;
    const wallDerivative = Math.sign(reflectWallX(unfoldedTargetX + 0.1, ballRadius) - reflectWallX(unfoldedTargetX - 0.1, ballRadius)) || 1;
    const finalDirection = Math.sign(slope * wallDerivative);
    const valid = Math.abs(horizontalRatio) <= MAX_AIM_HORIZONTAL_RATIO;
    return {
      x: originX + slope * aimVerticalTravel,
      y: aimY,
      valid,
      horizontalRatio: Math.abs(horizontalRatio),
      pathBlocks: upwardBlocks + downwardBlocks,
      direction,
      finalDirection,
      finalDirectionMatches: requiredFinalDirection === 0 || finalDirection === requiredFinalDirection,
    };
  });
  const ranked = candidates.sort((a, b) => Number(b.valid) - Number(a.valid)
    || Number(b.finalDirectionMatches) - Number(a.finalDirectionMatches)
    || a.pathBlocks - b.pathBlocks
    || Number(a.direction !== preferredDirection) - Number(b.direction !== preferredDirection)
    || a.horizontalRatio - b.horizontalRatio);
  const best = ranked[0];
  const equivalentRoutes = ranked.filter((candidate) => candidate.valid === best.valid
    && candidate.finalDirectionMatches === best.finalDirectionMatches
    && candidate.pathBlocks === best.pathBlocks);
  return equivalentRoutes[Math.abs(phase) % equivalentRoutes.length] ?? best;
}

function reflectorSideAim(target: PolicyBrick, originX: number, phase: number, obstacles: PolicyBrick[], ballRadius = 8) {
  const centerY = target.y + target.h / 2;
  const contacts = [
    { x: target.x - ballRadius - 2, finalDirection: 1 },
    { x: target.x + target.w + ballRadius + 2, finalDirection: -1 },
  ].filter((contact) => contact.x >= ballRadius && contact.x <= GAME_WIDTH - ballRadius);
  const candidates = contacts.map((contact) => bankAimToContact(target, contact.x, centerY, originX, phase, obstacles, ballRadius, contact.finalDirection));
  return candidates.sort((a, b) => Number(b.valid) - Number(a.valid)
    || Number(b.finalDirectionMatches) - Number(a.finalDirectionMatches)
    || a.pathBlocks - b.pathBlocks
    || a.horizontalRatio - b.horizontalRatio)[0]
    ?? bankAimToContact(target, target.x + target.w / 2, centerY, originX, phase, obstacles, ballRadius);
}

export function reflectorBankAim(target: PolicyBrick, originX: number, phase: number, obstacles: PolicyBrick[] = [target], ballRadius = 8) {
  const topY = ballRadius + 2;
  return bankAimToContact(target, target.x + target.w / 2, Math.max(topY + 1, target.y - ballRadius - 2), originX, phase, obstacles, ballRadius);
}

function bankAim(target: PolicyBrick, originX: number, phase: number, reflectors: PolicyBrick[]) {
  return reflectorBankAim(target, originX, phase, reflectors);
}

function explorationAim(originX: number, phase: number, seed: number) {
  const ratios = [-0.78, 0.78, -0.62, 0.62, -0.46, 0.46, -0.3, 0.3, -0.14, 0.14, 0];
  const offset = (seed >>> 0) % ratios.length;
  const horizontalRatio = ratios[(Math.max(0, phase - 2) + offset) % ratios.length];
  const slope = horizontalRatio / Math.sqrt(Math.max(0.001, 1 - horizontalRatio * horizontalRatio));
  const aimY = 80;
  return { x: originX + slope * (PLAYER_PADDLE_Y - aimY), y: aimY };
}

export function decideBotControls(observation: BotObservation, state: BotPolicyState, dt: number): CanonicalControls {
  const attackable = observation.bricks.filter((brick) => brick.alive && brick.trait !== "indestructible");
  const directTargets = attackable.filter((brick) => brick.trait !== "reflector");
  const reflectorTargets = attackable.filter((brick) => brick.trait === "reflector");
  const bankObstacles = observation.bricks.filter((brick) => brick.alive && (brick.trait === "reflector" || brick.trait === "indestructible"));
  const attackableHp = attackable.reduce((sum, brick) => sum + Math.max(0, brick.hp), 0);
  const madeProgress = attackable.length < state.lastAlive || state.lastHp >= 0 && attackableHp < state.lastHp - 0.001;
  if (state.lastAlive < 0 || madeProgress) {
    state.stalledFor = 0;
    state.bankPhase = 0;
  } else {
    state.stalledFor += dt;
  }
  state.lastAlive = attackable.length;
  state.lastHp = attackableHp;
  if (state.stalledFor > 3.5) { state.bankPhase++; state.stalledFor = 0; }
  const primaryBall = observation.balls.find((ball) => !ball.temporary) ?? observation.balls[0];
  const falling = observation.balls.filter((ball) => ball.vy > 0).sort((a, b) => Number(Boolean(a.temporary)) - Number(Boolean(b.temporary)) || b.y - a.y)[0];
  const trackingBall = primaryBall?.vy > 0 ? primaryBall : falling ?? primaryBall;
  const landingX = trackingBall ? predictLandingX(trackingBall) : observation.paddleX;
  // Canonical paddle reflection evaluates aim from the ball's swept contact
  // point, not from the paddle center. Use the predicted contact consistently
  // or edge/corner bank calculations diverge from the simulated trajectory.
  const launchOriginX = trackingBall?.vy > 0 ? landingX : observation.paddleX;
  // Prefer a target with a clear launch lane. A high-priority brick behind an
  // indestructible wall otherwise keeps the policy locked on an impossible
  // straight shot while exposed bricks remain available.
  const launchLaneBlocked = (brick: PolicyBrick) => directPathBlocked(brick, observation.bricks, launchOriginX)
    || Boolean(protectedReflectorBlocking(brick, observation.bricks, launchOriginX));
  const directTarget = [...directTargets].sort((a, b) => Number(launchLaneBlocked(a))
    - Number(launchLaneBlocked(b))
    || priority(b) - priority(a)
    || (a.id ?? 0) - (b.id ?? 0))[0];
  const reflectorTarget = directTarget ? undefined : [...reflectorTargets].sort((a, b) => b.y - a.y || (a.id ?? 0) - (b.id ?? 0))[0];
  const target = directTarget ?? reflectorTarget;
  const blockingReflector = directTarget ? protectedReflectorBlocking(directTarget, observation.bricks, launchOriginX) : undefined;
  const blockingIndestructible = directTarget ? directPathBlocked(directTarget, observation.bricks, launchOriginX) : false;
  const sideAttackReflector = reflectorTarget && indestructibleTopCover(reflectorTarget, observation.bricks) ? reflectorTarget
    : blockingReflector && indestructibleTopCover(blockingReflector, observation.bricks) ? blockingReflector
      : undefined;
  let reportedTarget = target;
  let routeSuffix = "";
  let aimX = target ? target.x + target.w / 2 : GAME_WIDTH / 2;
  let aimY = target ? target.y + target.h / 2 : 80;
  if (sideAttackReflector) {
    const side = reflectorSideAim(sideAttackReflector, launchOriginX, state.bankPhase, bankObstacles);
    aimX = side.x; aimY = side.y;
    reportedTarget = sideAttackReflector;
    routeSuffix = ":side";
  } else if (target && (reflectorTarget || blockingReflector)) {
    const bank = reflectorBankAim(target, launchOriginX, state.bankPhase, bankObstacles);
    aimX = bank.x; aimY = bank.y;
    routeSuffix = ":bank";
  } else if (target && (blockingIndestructible || state.bankPhase % 3 !== 0 && state.stalledFor > 2)) {
    const bank = bankAim(target, launchOriginX, state.bankPhase, bankObstacles);
    aimX = bank.x; aimY = bank.y;
    routeSuffix = ":bank";
  }
  if (target && state.bankPhase >= 2) {
    const sweep = explorationAim(launchOriginX, state.bankPhase, state.seed ^ (target.id ?? 0));
    aimX = sweep.x;
    aimY = sweep.y;
    routeSuffix = ":sweep";
  }
  const urgency = trackingBall?.vy > 0 ? Math.max(0, Math.min(1, (trackingBall.y - 360) / 150)) : 0;
  const desiredRatio = Math.max(-MAX_AIM_HORIZONTAL_RATIO, Math.min(MAX_AIM_HORIZONTAL_RATIO, (aimX - launchOriginX) / Math.max(120, PLAYER_PADDLE_Y - aimY)));
  let paddleTarget = landingX - desiredRatio * observation.paddleWidth * 0.32;
  const item = observation.items.filter((entry) => entry.alive && entry.y < PLAYER_PADDLE_Y).sort((a, b) => b.y - a.y)[0];
  if (item && urgency < 0.35 && Math.abs(item.x - observation.paddleX) <= observation.paddleSpeed * 0.7) paddleTarget = item.x;
  paddleTarget = Math.max(observation.paddleWidth / 2, Math.min(GAME_WIDTH - observation.paddleWidth / 2, paddleTarget));
  const tolerance = Math.max(3, observation.paddleSpeed * dt * 0.45);
  const move: -1 | 0 | 1 = paddleTarget > observation.paddleX + tolerance ? 1 : paddleTarget < observation.paddleX - tolerance ? -1 : 0;
  state.lastTargetKey = reportedTarget ? `${reportedTarget.id ?? "x"}:${reportedTarget.trait}${routeSuffix}` : "none";
  return { move, aimX, aimY: Math.min(GAME_HEIGHT - 1, aimY) };
}
