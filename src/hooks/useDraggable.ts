import { useState, useCallback, useRef, useEffect } from "react";

interface DragOffset {
  x: number;
  y: number;
}

interface UseDraggableReturn {
  offset: DragOffset;
  handleMouseDown: (e: React.MouseEvent) => void;
  isDragging: boolean;
  resetPosition: () => void;
}

const INTERACTIVE_ELEMENTS = ["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"];

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function useDraggable(): UseDraggableReturn {
  const [offset, setOffset] = useState<DragOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; offsetX: number; offsetY: number } | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);

  const resetPosition = useCallback(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStart.current) return;

    const deltaX = e.clientX - dragStart.current.mouseX;
    const deltaY = e.clientY - dragStart.current.mouseY;

    let newX = dragStart.current.offsetX + deltaX;
    let newY = dragStart.current.offsetY + deltaY;

    // Clamp using actual modal dimensions and viewport
    if (contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Modal center position = 50% viewport + offset
      // Ensure at least 100px of modal remains visible on each edge
      const minVisible = 100;
      const halfW = rect.width / 2;
      const halfH = rect.height / 2;

      const maxX = vw / 2 + halfW - minVisible;
      const minX = -(vw / 2 + halfW - minVisible);
      const maxY = vh / 2 + halfH - minVisible;
      const minY = -(vh / 2 + halfH - minVisible);

      newX = Math.max(minX, Math.min(maxX, newX));
      newY = Math.max(minY, Math.min(maxY, newY));
    }

    setOffset({ x: newX, y: newY });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragStart.current = null;
    setIsDragging(false);
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Skip on touch devices
      if (isTouchDevice()) return;

      // Skip interactive elements
      const target = e.target as HTMLElement;
      if (INTERACTIVE_ELEMENTS.includes(target.tagName) || target.closest("button, input, select, textarea, a")) {
        return;
      }

      e.preventDefault();

      // Find the dialog content element (closest ancestor with fixed positioning)
      const content = target.closest('[role="dialog"], [role="alertdialog"]') as HTMLElement | null;
      contentRef.current = content;

      dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };

      setIsDragging(true);
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [offset, handleMouseMove, handleMouseUp]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [handleMouseMove, handleMouseUp]);

  return { offset, handleMouseDown, isDragging, resetPosition };
}
