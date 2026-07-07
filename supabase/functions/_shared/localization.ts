/**
 * Notification copy, localized per recipient (users.language).
 *
 * PHI rule: these strings NEVER contain medication names, dosages, or patient
 * names — they are generic by design. Details load in-app after the tap.
 */

export type NotificationLanguage = 'he' | 'en';

interface NotificationCopy {
  title: string;
  body: string;
}

const COPY: Record<'reminder' | 'missed' | 'snoozed_limit', Record<NotificationLanguage, NotificationCopy>> = {
  reminder: {
    en: {
      title: 'Medication Reminder',
      body: 'Time to take your medication. Tap to view details.',
    },
    he: {
      title: 'תזכורת לתרופה',
      body: 'הגיע הזמן לקחת את התרופה. יש ללחוץ לפרטים.',
    },
  },
  missed: {
    en: {
      title: 'Missed Medication',
      body: 'A patient missed their scheduled medication. Tap to review.',
    },
    he: {
      title: 'תרופה שלא נלקחה',
      body: 'מטופל לא לקח תרופה שתוזמנה. יש ללחוץ לבדיקה.',
    },
  },
  snoozed_limit: {
    en: {
      title: 'Snooze Limit Reached',
      body: 'A patient has snoozed their medication reminder too many times. Tap to review.',
    },
    he: {
      title: 'נדחה יותר מדי פעמים',
      body: 'מטופל דחה את תזכורת התרופה יותר מדי פעמים. יש ללחוץ לבדיקה.',
    },
  },
};

export function notificationCopy(
  kind: 'reminder' | 'missed' | 'snoozed_limit',
  language: string | null | undefined
): NotificationCopy {
  const lang: NotificationLanguage = language === 'he' ? 'he' : 'en';
  return COPY[kind][lang];
}
