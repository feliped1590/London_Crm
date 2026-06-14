import { useEffect, useState } from 'react';

export type ResponsiveDensity = 'comfortable' | 'compact' | 'dense';

/**
 * Retorna a densidade ideal da UI baseada na largura efetiva da viewport
 * (já considera zoom do navegador, pois o zoom reduz a viewport CSS).
 *
 * - >= 1280px → comfortable (padding/fonte padrão)
 * - 960–1279px → compact (padding reduzido, fonte 13px)
 * - < 960px   → dense (ainda mais compacto + esconde colunas secundárias)
 */
export function useResponsiveDensity(): ResponsiveDensity {
  const compute = (): ResponsiveDensity => {
    if (typeof window === 'undefined') return 'comfortable';
    const w = window.innerWidth;
    if (w >= 1280) return 'comfortable';
    if (w >= 960) return 'compact';
    return 'dense';
  };

  const [density, setDensity] = useState<ResponsiveDensity>(compute);

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setDensity(compute()));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return density;
}
