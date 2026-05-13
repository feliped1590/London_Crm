import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NumberInputProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  decimals?: number;
  suffix?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  onBlur?: () => void;
}

const formatPtBR = (value: number, decimals: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

const parsePtBR = (raw: string, suffix?: string): number | null => {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (suffix) s = s.replace(suffix.trim(), '').trim();
  s = s.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  if (s === '' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function NumberInput({
  value,
  onChange,
  decimals = 2,
  suffix,
  min,
  max,
  disabled,
  className,
  placeholder,
  onBlur,
}: NumberInputProps) {
  const focusedRef = useRef(false);
  const [display, setDisplay] = useState<string>(() =>
    value == null || Number.isNaN(value) ? '' : formatPtBR(Number(value), decimals)
  );

  // Sync external value changes when not focused
  useEffect(() => {
    if (focusedRef.current) return;
    setDisplay(value == null || Number.isNaN(value) ? '' : formatPtBR(Number(value), decimals));
  }, [value, decimals]);

  const commit = () => {
    let n = parsePtBR(display, suffix);
    if (n != null) {
      if (typeof min === 'number' && n < min) n = min;
      if (typeof max === 'number' && n > max) n = max;
    }
    onChange(n);
    setDisplay(n == null ? '' : formatPtBR(n, decimals));
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder}
      disabled={disabled}
      className={cn('text-right', className)}
      onFocus={(e) => {
        focusedRef.current = true;
        // Mostra valor "limpo" para edição (vírgula, sem milhar)
        const n = value == null || Number.isNaN(value) ? null : Number(value);
        setDisplay(n == null ? '' : String(n).replace('.', ','));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setDisplay(e.target.value)}
      onBlur={() => {
        focusedRef.current = false;
        commit();
        onBlur?.();
      }}
    />
  );
}

export default NumberInput;
