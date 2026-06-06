/**
 * Converte string para MAIÚSCULAS preservando null/undefined.
 * Regra global do sistema: todos os campos de texto livre (nomes, descrições,
 * endereços, observações) devem ser armazenados e exibidos em MAIÚSCULAS.
 *
 * NÃO aplicar em: e-mails, URLs, senhas, tokens, CNPJ/CPF, telefones,
 * códigos técnicos e JSON.
 */
export function toUpperSafe<T extends string | null | undefined>(value: T): T {
  if (value == null) return value;
  return value.toUpperCase() as T;
}

/**
 * Handler para inputs controlados — converte o valor em maiúsculas
 * preservando a posição do cursor.
 */
export function upperOnChange(
  setter: (v: string) => void
): React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> {
  return (e) => {
    const el = e.target;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const upper = el.value.toUpperCase();
    setter(upper);
    // restaura cursor após o React reaplicar o valor
    requestAnimationFrame(() => {
      try {
        if (start !== null && end !== null) el.setSelectionRange(start, end);
      } catch {
        /* noop */
      }
    });
  };
}
