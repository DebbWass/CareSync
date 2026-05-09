// CareSync typography system
// Patient app uses larger base sizes for elderly users with visual impairments

export const FontSizes = {
  patient: {
    medicationName: 48,   // The medication being reminded — must be unmissable
    timeIndicator: 36,    // "8:00 AM" / "Now"
    dosage: 28,           // "10mg — 1 tablet"
    instructions: 24,     // "Take with food and water"
    confirmButton: 32,    // "MEDICATION TAKEN"
    snoozeButton: 22,     // "REMIND ME IN 30 MIN"
    body: 24,             // General body text
    caption: 20,          // Secondary information
    heading: 32,          // Screen headings
  },
  caregiver: {
    headline: 24,
    title: 20,
    body: 16,
    label: 14,
    caption: 12,
    heading: 22,
  },
} as const;

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const LineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
};
