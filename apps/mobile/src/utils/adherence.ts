/**
 * Adherence tone thresholds, shared by the dashboard badge and the trends
 * screen so a "good" number looks the same everywhere. Each tone carries an
 * icon so the state is never signalled by color alone (WCAG 2.1 AA).
 */
export type AdherenceTone = 'good' | 'fair' | 'poor';

export const ADHERENCE_TONE_ICONS: Record<AdherenceTone, string> = {
  good: '✓',
  fair: '!',
  poor: '✗',
};

export function adherenceTone(percent: number): AdherenceTone {
  if (percent >= 80) return 'good';
  if (percent >= 50) return 'fair';
  return 'poor';
}
