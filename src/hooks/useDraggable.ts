import { useCallback, useRef, useEffect } from "react";

const INTERACTIVE_ELEMENTS = ["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"];

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function useDraggable() {
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const isDraggingRef = useRef(false);

  const applyTransform = useCallback(() => {
    if (!elementRef.current) return;
    const { x, y } = offsetRef.current;
    if (x === 0 && y === 0) {
      elementRef.current.style.transform = "";
    } else {
      elementRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStartRef.current || !elementRef.current) return;

    let newX = dragStartRef.current.startX + (e.clientX - dragStartRef.current.mouseX);
    let newY = dragStartRef.current.startY + (e.clientY - dragStartRef.current.mouseY);

    // Clamp using actual modal rect
    const rect = elementRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const minVisible = 100;
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;
    const maxX = vw / 2 + halfW - minVisible;
    const minX = -maxX;
    const maxY = vh / 2 + halfH - minVisible;
    const minY = -maxY;

    newX = Math.max(minX, Math.min(maxX, newX));
    newY = Math.max(minY, Math.min(maxY, newY));

    offsetRef.current = { x: newX, y: newY };
    // Direct DOM update — no React re-render
    elementRef.current.style.transform = `translate(calc(-50% + ${newX}px), calc(-50% + ${newY}px))`;
  }, []);

  const handleMouseUp = useCallback(() => {
    dragStartRef.current = null;
    isDraggingRef.current = false;
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isTouchDevice()) return;

      const target = e.target as HTMLElement;
      if (INTERACTIVE_ELEMENTS.includes(target.tagName) || target.closest("button, input, select, textarea, a")) {
        return;
      }

      e.preventDefault();

      const content = target.closest('[role="dialog"], [role="alertdialog"]') as HTMLElement | null;
      if (!content) return;
      elementRef.current = content;

      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startX: offsetRef.current.x,
        startY: offsetRef.current.y,
      };

      isDraggingRef.current = true;
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [handleMouseMove, handleMouseUp]
  );

  const resetPosition = useCallback(() => {
    offsetRef.current = { x: 0, y: 0 };
    if (elementRef.current) {
      elementRef.current.style.transform = "";
    }
  }, []);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [handleMouseMove, handleMouseUp]);

  return { handleMouseDown, resetPosition };
}
