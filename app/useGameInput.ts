import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { GameState } from "./_types/game";

type AimDirection = (fromX: number, fromY: number, targetX: number, targetY: number) => { horizontalRatio: number };

export function useGameInput(options: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  gameRef: RefObject<GameState | null>;
  width: number;
  height: number;
  paddleY: number;
  aimDirection: AimDirection;
}) {
  const { canvasRef, gameRef, width, height, paddleY, aimDirection } = options;
  const pointerXRef = useRef(width / 2);
  const pointerYRef = useRef(height / 3);
  const aimInputModeRef = useRef<"mouse" | "keyboard">("mouse");
  const keyboardAimRef = useRef({ left: false, right: false, horizontalRatio: 0 });
  const keyboardRef = useRef({ left: false, right: false });

  useEffect(() => {
    const setControlKey = (event: KeyboardEvent, pressed: boolean) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      const movementKey = key === "a" || key === "d";
      const aimKey = key === "arrowleft" || key === "arrowright";
      if (!movementKey && !aimKey) return;
      if (key === "a") keyboardRef.current.left = pressed;
      if (key === "d") keyboardRef.current.right = pressed;
      if (aimKey) {
        const wasPressed = key === "arrowleft" ? keyboardAimRef.current.left : keyboardAimRef.current.right;
        if (pressed && !wasPressed && aimInputModeRef.current !== "keyboard") {
          keyboardAimRef.current.horizontalRatio = aimDirection(
            gameRef.current?.paddleX ?? width / 2,
            paddleY,
            pointerXRef.current,
            pointerYRef.current,
          ).horizontalRatio;
          aimInputModeRef.current = "keyboard";
        }
        if (key === "arrowleft") keyboardAimRef.current.left = pressed;
        if (key === "arrowright") keyboardAimRef.current.right = pressed;
      }
      event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => setControlKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => setControlKey(event, false);
    const clearControls = () => {
      keyboardRef.current.left = false;
      keyboardRef.current.right = false;
      keyboardAimRef.current.left = false;
      keyboardAimRef.current.right = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearControls);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearControls);
    };
  }, [aimDirection, gameRef, paddleY, width]);

  const onPointerMove = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    aimInputModeRef.current = "mouse";
    pointerXRef.current = Math.max(0, Math.min(width, ((clientX - rect.left) / rect.width) * width));
    pointerYRef.current = Math.max(0, Math.min(height, ((clientY - rect.top) / rect.height) * height));
  }, [canvasRef, height, width]);

  return { pointerXRef, pointerYRef, aimInputModeRef, keyboardAimRef, keyboardRef, onPointerMove };
}
