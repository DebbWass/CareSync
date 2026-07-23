/**
 * PatientInvitations — accessible accept/decline surface for pending caregiver
 * invitations, shown on the patient home when there's no active reminder.
 *
 * Kept deliberately simple for elderly users: one card per invitation, a large
 * "Accept" (confirm) button and a quieter "Decline" (outline). All copy through
 * t() (patient.invitations.*); sizes route through the design-system <Text/>.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/ErrorBanner';
import { Colors } from '../../constants/colors';
import { FontSizes } from '../../constants/typography';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { patientKeys } from '../../hooks/usePatients';
import { respondToInvitation, type PatientInvitation } from '../../services/supabase/patients';

interface Props {
  invitations: PatientInvitation[];
}

export function PatientInvitations({ invitations }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const highContrast = useSettingsStore((s) => s.highContrastMode);
  const theme = highContrast ? Colors.highContrast : Colors.light;
  const patientId = useAuthStore((s) => s.profile?.id ?? '');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const respond = async (inv: PatientInvitation, accept: boolean) => {
    setPendingId(inv.relationship_id);
    setError(null);
    try {
      await respondToInvitation(inv.relationship_id, accept);
      qc.invalidateQueries({ queryKey: patientKeys.invitations(patientId) });
    } catch (e) {
      setError(e);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
      <Text
        size={FontSizes.patient.heading}
        weight="bold"
        color={theme.onBackground}
        align="center"
        accessibilityRole="header"
      >
        {t('patient.invitations.title')}
      </Text>

      {error ? <ErrorBanner error={error} /> : null}

      {invitations.map((inv) => {
        const busy = pendingId === inv.relationship_id;
        return (
          <View
            key={inv.relationship_id}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text size={FontSizes.patient.body} color={theme.onSurface} align="center">
              {t('patient.invitations.body', { name: inv.caregiver_name })}
            </Text>
            <Text size={FontSizes.patient.caption} color={theme.secondary} align="center">
              {inv.caregiver_email}
            </Text>
            <Button
              label={t('patient.invitations.accept')}
              variant="confirm"
              size="large"
              onPress={() => respond(inv, true)}
              loading={busy}
              disabled={pendingId !== null}
              accessibilityLabel={t('patient.invitations.acceptA11y', { name: inv.caregiver_name })}
              accessibilityHint={t('patient.invitations.acceptHint')}
            />
            <Button
              label={t('patient.invitations.decline')}
              variant="outline"
              onPress={() => respond(inv, false)}
              disabled={pendingId !== null}
              accessibilityLabel={t('patient.invitations.declineA11y', {
                name: inv.caregiver_name,
              })}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 32,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    gap: 14,
  },
});
