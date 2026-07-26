import type { Ball, Brick } from "./_types/game";

export const MIN_VERTICAL_SPEED_RATIO = 0.32;

export type CollisionNormal = { normalX: number; normalY: number; penetration: number };

export function circleRectangleCollision(
  ball: Pick<Ball, "x" | "y" | "radius">,
  brick: Pick<Brick, "x" | "y" | "w" | "h">,
  previousX: number,
  previousY: number,
): CollisionNormal | null {
  const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
  const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared > ball.radius * ball.radius) return null;
  if (distanceSquared > 0.0001) {
    const distance = Math.sqrt(distanceSquared);
    return { normalX: dx / distance, normalY: dy / distance, penetration: ball.radius - distance };
  }
  const exits = [
    { normalX: -1, normalY: 0, distance: Math.abs(previousX - (brick.x - ball.radius)) },
    { normalX: 1, normalY: 0, distance: Math.abs(previousX - (brick.x + brick.w + ball.radius)) },
    { normalX: 0, normalY: -1, distance: Math.abs(previousY - (brick.y - ball.radius)) },
    { normalX: 0, normalY: 1, distance: Math.abs(previousY - (brick.y + brick.h + ball.radius)) },
  ];
  const exit = exits.sort((a, b) => a.distance - b.distance)[0];
  const penetration = exit.normalX < 0 ? ball.x + ball.radius - brick.x
    : exit.normalX > 0 ? brick.x + brick.w - (ball.x - ball.radius)
      : exit.normalY < 0 ? ball.y + ball.radius - brick.y
        : brick.y + brick.h - (ball.y - ball.radius);
  return { normalX: exit.normalX, normalY: exit.normalY, penetration: Math.max(0, penetration) };
}

export function ensureMinimumVerticalAngle(ball: Pick<Ball, "vx" | "vy">, fallbackDirection = -1): void {
  const speed = Math.max(1, Math.hypot(ball.vx, ball.vy));
  const minimumVerticalSpeed = speed * MIN_VERTICAL_SPEED_RATIO;
  if (Math.abs(ball.vy) >= minimumVerticalSpeed) return;
  const verticalDirection = Math.sign(ball.vy) || Math.sign(fallbackDirection) || -1;
  const horizontalDirection = Math.sign(ball.vx) || 1;
  ball.vy = verticalDirection * minimumVerticalSpeed;
  ball.vx = horizontalDirection * Math.sqrt(Math.max(0, speed * speed - minimumVerticalSpeed * minimumVerticalSpeed));
}

export function separateAndReflectBall(ball: Pick<Ball, "x" | "y" | "vx" | "vy">, collision: CollisionNormal): void {
  ball.x += collision.normalX * (collision.penetration + 0.1);
  ball.y += collision.normalY * (collision.penetration + 0.1);
  const approachSpeed = ball.vx * collision.normalX + ball.vy * collision.normalY;
  if (approachSpeed >= 0) return;
  ball.vx -= 2 * approachSpeed * collision.normalX;
  ball.vy -= 2 * approachSpeed * collision.normalY;
  ensureMinimumVerticalAngle(ball, collision.normalY);
}

export type PaddleSweep = { x: number; previousX: number; y: number; width: number };
export type PaddleContact = { contactX: number; paddleContactX: number; hitRatio: number } | null;

export function sweptPaddleContact(
  ball: Pick<Ball, "x" | "y" | "radius">,
  previousX: number,
  previousY: number,
  paddle: PaddleSweep,
  slop: number,
  sideDepth: number,
  forgiveness: number,
): PaddleContact {
  const verticalTravel = ball.y - previousY;
  const rawContactTime = verticalTravel > 0 ? (paddle.y - ball.radius - previousY) / verticalTravel : -1;
  const crossedPaddleTop = rawContactTime >= 0 && rawContactTime <= 1;
  const alreadyTouchingTop = previousY <= paddle.y + slop && previousY + ball.radius >= paddle.y - slop && ball.y - ball.radius <= paddle.y + 12;
  const sweptLeft = Math.min(previousX, ball.x) - ball.radius;
  const sweptRight = Math.max(previousX, ball.x) + ball.radius;
  const sideDepthContact = previousY + ball.radius >= paddle.y - slop && ball.y - ball.radius <= paddle.y + sideDepth
    && sweptRight >= Math.min(paddle.previousX, paddle.x) - paddle.width / 2 - forgiveness
    && sweptLeft <= Math.max(paddle.previousX, paddle.x) + paddle.width / 2 + forgiveness;
  if (!crossedPaddleTop && !alreadyTouchingTop && !sideDepthContact) return null;
  const contactTime = crossedPaddleTop ? Math.max(0, Math.min(1, rawContactTime)) : 1;
  const contactX = previousX + (ball.x - previousX) * contactTime;
  const paddleContactX = paddle.previousX + (paddle.x - paddle.previousX) * contactTime;
  if (contactX + ball.radius + forgiveness < paddleContactX - paddle.width / 2 || contactX - ball.radius - forgiveness > paddleContactX + paddle.width / 2) return null;
  return { contactX, paddleContactX, hitRatio: Math.max(-1, Math.min(1, (contactX - paddleContactX) / (paddle.width / 2))) };
}
