import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Barra fina no topo que dá feedback imediato em mudanças de rota.
 * Resolve a sensação de "clique sem resposta" enquanto chunks lazy carregam.
 *
 * Comportamento:
 * - Inicia em mudança de pathname (location).
 * - Anima até 85% rapidamente.
 * - Termina quando o navegador fica idle (rota renderizou) ou após 1.5s.
 */
export function TopProgressBar() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const firstRenderRef = useRef(true);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    // Não dispara no mount inicial.
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    // Limpa timers anteriores
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];

    setVisible(true);
    setProgress(15);

    const t1 = window.setTimeout(() => setProgress(55), 80);
    const t2 = window.setTimeout(() => setProgress(85), 350);
    timersRef.current.push(t1, t2);

    const finish = () => {
      setProgress(100);
      const t3 = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 220);
      timersRef.current.push(t3);
    };

    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout?: number }) => number)
      | undefined;
    let idleHandle: number | null = null;
    let fallbackTimer: number | null = null;

    if (ric) {
      idleHandle = ric(finish, { timeout: 1500 });
    } else {
      fallbackTimer = window.setTimeout(finish, 800);
    }
    const hardCap = window.setTimeout(finish, 1500);
    timersRef.current.push(hardCap);
    if (fallbackTimer) timersRef.current.push(fallbackTimer);

    return () => {
      const cic = (window as any).cancelIdleCallback as ((h: number) => void) | undefined;
      if (idleHandle != null && cic) cic(idleHandle);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[100] h-0.5 pointer-events-none"
    >
      <div
        className="h-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.6)] transition-[width] duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
