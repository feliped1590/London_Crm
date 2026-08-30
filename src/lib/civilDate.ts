/** Civil date stored as timestamptz at noon UTC to avoid timezone day-shift. */
export const CIVIL_DATE_TZ = 'America/Sao_Paulo';

export function toCivilDateUTC(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const dateOnly = dateStr.split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  return `${dateOnly}T12:00:00Z`;
}

export function fromCivilDateUTC(value: string | null | undefined): string {
  if (!value) return '';
  return value.split('T')[0];
}

export function todayCivilDate(timeZone = CIVIL_DATE_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
