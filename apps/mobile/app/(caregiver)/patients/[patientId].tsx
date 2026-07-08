/**
 * Per-patient adherence — the caregiver's read on how consistently a patient is
 * taking their doses. Headline percentage over the last 30 patient-local days
 * plus a per-day trend. Deliberately built from plain Views (no chart library):
 * adding one is a UI checkpoint the project owner signs off on.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { forwardArrow } from '../../../src/utils/rtl';
import { formatShortDay } from '../../../src/utils/dateFormat';
import { adherenceTone, ADHERENCE_TONE_ICONS } from '../../../src/utils/adherence';
import { useAdherence } from '../../../src/hooks/useAdherence';
import { summarizeAdherence, type AdherenceDay } from '../../../src/services/supabase/analytics';
import { ErrorBanner } from '../../../src/components/ui/ErrorBanner';
import { ADHERENCE_WINDOW_DAYS } from '../../../src/constants/config';
import { Colors, type ThemeColors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';
import { Text } from 'react-native-paper';

const TREND_BAR_MAX_HEIGHT = 120;
const TREND_BAR_MIN_HEIGHT = 6;

function toneColor(theme: ThemeColors, percent: number): string {
  switch (adherenceTone(percent)) {
    case 'good':
      return theme.confirm;
    case 'fair':
      return theme.snooze;
    default:
      return theme.danger;
  }
}

export default function PatientAdherenceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = Colors.light;
  const { patientId, patientName } = useLocalSearchParams<{
    patientId: string;
    patientName?: string;
  }>();

  const { data: days = [], isLoading, error, refetch } = useAdherence(patientId);
  const summary = summarizeAdherence(days);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Back ─────────────────────────────────────────────────────────── */}
        <Text
          style={[styles.back, { color: theme.primary }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.backLabel')}
        >
          {t('common.back')}
        </Text>

        {patientName ? (
          <Text style={[styles.patientName, { color: theme.onBackground }]}>{patientName}</Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={theme.primary} style={styles.loader} />
        ) : error ? (
          <ErrorBanner error={error} onRetry={refetch} />
        ) : summary.percent === null ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.emptyText, { color: theme.secondary }]}>
              {t('analytics.empty', { days: ADHERENCE_WINDOW_DAYS })}
            </Text>
          </View>
        ) : (
          <>
            <HeadlineCard theme={theme} percent={summary.percent} taken={summary.takenDoses} total={summary.totalDoses} />
            <TrendSection theme={theme} days={days} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Headline percentage card ──────────────────────────────────────────────────

interface HeadlineProps {
  theme: ThemeColors;
  percent: number;
  taken: number;
  total: number;
}

function HeadlineCard({ theme, percent, taken, total }: HeadlineProps) {
  const { t } = useTranslation();
  const color = toneColor(theme, percent);
  const tone = adherenceTone(percent);

  return (
    <View
      style={[styles.headlineCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      accessible
      accessibilityLabel={t('analytics.headlineA11y', {
        percent,
        taken,
        total,
        days: ADHERENCE_WINDOW_DAYS,
      })}
    >
      <Text style={[styles.headlineLabel, { color: theme.secondary }]}>
        {t('analytics.windowLabel', { days: ADHERENCE_WINDOW_DAYS })}
      </Text>
      <View style={styles.headlineRow}>
        <Text style={[styles.headlineIcon, { color }]}>{ADHERENCE_TONE_ICONS[tone]}</Text>
        <Text style={[styles.headlinePercent, { color }]}>{t('analytics.percent', { percent })}</Text>
      </View>
      <Text style={[styles.headlineSub, { color: theme.secondary }]}>
        {t('analytics.takenOfTotal', { taken, total })}
      </Text>
    </View>
  );
}

// ── Per-day trend ─────────────────────────────────────────────────────────────

function TrendSection({ theme, days }: { theme: ThemeColors; days: AdherenceDay[] }) {
  const { t } = useTranslation();

  return (
    <View style={styles.trendSection}>
      <Text style={[styles.sectionHeader, { color: theme.secondary }]}>
        {t('analytics.trendHeader')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trendScroll}
        accessibilityLabel={t('analytics.trendA11y')}
      >
        {days.map((day) => {
          const pct = day.total_doses > 0 ? Math.round((day.taken_doses / day.total_doses) * 100) : 0;
          const color = toneColor(theme, pct);
          const barHeight = Math.max(TREND_BAR_MIN_HEIGHT, (pct / 100) * TREND_BAR_MAX_HEIGHT);
          return (
            <View
              key={day.bucket_day}
              style={styles.trendColumn}
              accessible
              accessibilityLabel={t('analytics.dayA11y', {
                date: formatShortDay(day.bucket_day),
                percent: pct,
                taken: day.taken_doses,
                total: day.total_doses,
              })}
            >
              <View style={[styles.trendTrack, { height: TREND_BAR_MAX_HEIGHT }]}>
                <View style={[styles.trendBar, { height: barHeight, backgroundColor: color }]} />
              </View>
              <Text style={[styles.trendPct, { color: theme.onSurface }]}>{pct}</Text>
              <Text style={[styles.trendDate, { color: theme.secondary }]}>
                {formatShortDay(day.bucket_day)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <Text style={[styles.legend, { color: theme.secondary }]}>
        {t('analytics.legend')} {forwardArrow()}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  back: {
    fontSize: FontSizes.caregiver.body,
    fontWeight: FontWeights.semibold,
    paddingVertical: 4,
  },
  patientName: {
    fontSize: FontSizes.caregiver.headline,
    fontWeight: FontWeights.bold,
  },
  loader: {
    marginVertical: 32,
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSizes.caregiver.body,
    textAlign: 'center',
  },
  headlineCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  headlineLabel: {
    fontSize: FontSizes.caregiver.caption,
    fontWeight: FontWeights.bold,
    letterSpacing: 1.2,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headlineIcon: {
    fontSize: 36,
    fontWeight: FontWeights.bold,
  },
  headlinePercent: {
    fontSize: 56,
    fontWeight: FontWeights.bold,
  },
  headlineSub: {
    fontSize: FontSizes.caregiver.body,
  },
  trendSection: {
    gap: 10,
  },
  sectionHeader: {
    fontSize: FontSizes.caregiver.caption,
    fontWeight: FontWeights.bold,
    letterSpacing: 1.2,
  },
  trendScroll: {
    gap: 12,
    paddingVertical: 4,
  },
  trendColumn: {
    alignItems: 'center',
    gap: 4,
    width: 40,
  },
  trendTrack: {
    width: 24,
    justifyContent: 'flex-end',
    borderRadius: 6,
    overflow: 'hidden',
  },
  trendBar: {
    width: '100%',
    borderRadius: 6,
  },
  trendPct: {
    fontSize: FontSizes.caregiver.caption,
    fontWeight: FontWeights.semibold,
  },
  trendDate: {
    fontSize: 11,
    textAlign: 'center',
  },
  legend: {
    fontSize: FontSizes.caregiver.label,
  },
});
