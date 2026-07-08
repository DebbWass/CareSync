/**
 * Locale-aware date/time formatting (M6).
 *
 * All screen-facing date strings go through these helpers so Hebrew gets the
 * Israeli conventions (24-hour clock, day-before-month, "7 ביולי") without
 * every screen re-deriving the rules. English keeps the original formats.
 */
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import i18n from '../i18n';

function isHebrew(): boolean {
  return i18n.language === 'he';
}

/** "8:00 PM" (en) / "20:00" (he) */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return isHebrew() ? format(date, 'HH:mm') : format(date, 'h:mm a');
}

/** "Jul 7" (en) / "7 ביולי" (he) */
export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return isHebrew() ? format(date, "d 'ב'MMMM", { locale: he }) : format(date, 'MMM d');
}

/** "Jul 7 at 8:00 PM" (en) / "7 ביולי, 20:00" (he) */
export function formatDateAtTime(iso: string): string {
  const date = new Date(iso);
  return isHebrew()
    ? format(date, "d 'ב'MMMM, HH:mm", { locale: he })
    : format(date, "MMM d 'at' h:mm a");
}

/** "Monday July 7, 8:00 PM" (en) / "יום שני, 7 ביולי, 20:00" (he) — a11y reads */
export function formatLongDateTime(iso: string): string {
  const date = new Date(iso);
  return isHebrew()
    ? format(date, "EEEE, d 'ב'MMMM, HH:mm", { locale: he })
    : format(date, 'EEEE MMMM d, h:mm a');
}
