import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tipos de input que NÃO devem ter o conteúdo convertido para maiúsculas:
 * e-mails, URLs, senhas, números, telefones, datas, arquivos, busca, cores, etc.
 * Para campos mascarados (CNPJ/CPF/telefone) use `type="tel"` ou `preserveCase`.
 */
const CASE_SENSITIVE_TYPES = new Set([
  "email",
  "password",
  "url",
  "number",
  "tel",
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
  "file",
  "color",
  "range",
  "hidden",
  "search",
]);

export interface InputProps extends React.ComponentProps<"input"> {
  /** Quando true, preserva o case original (não força MAIÚSCULAS). */
  preserveCase?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onFocus, onChange, preserveCase, ...props }, ref) => {
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.target.select();
      onFocus?.(e);
    };

    const shouldUpper =
      !preserveCase && !CASE_SENSITIVE_TYPES.has((type ?? "text").toLowerCase());

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (shouldUpper && e.target.value && e.target.value !== e.target.value.toUpperCase()) {
        const el = e.target;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        const upper = el.value.toUpperCase();
        // Cria evento sintético com valor em maiúsculas
        el.value = upper;
        try {
          if (start !== null && end !== null) el.setSelectionRange(start, end);
        } catch {
          /* noop */
        }
      }
      onChange?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-background py-2 text-base ring-offset-background transition-all duration-150 ease-in-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/70 hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/0.10)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm text-left px-[12px] my-[10px]",
          className,
        )}
        ref={ref}
        onFocus={handleFocus}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
