/**
 * Dosage units offered in the add-medication dropdown.
 *
 * These are i18n KEYS, not display text — resolve each via
 * `t('medications.form.units.<key>')` so the label follows the app language
 * (English / Hebrew). The chosen unit is combined with the amount into the
 * free-text `dosage` column (e.g. "500 mg", "2 כדורים").
 */
export const DOSAGE_UNIT_KEYS = ['pill', 'drops', 'mg', 'gram', 'ml'] as const;

export type DosageUnitKey = (typeof DOSAGE_UNIT_KEYS)[number];
