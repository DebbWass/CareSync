/**
 * Add medication form.
 * Receives patientId + patientName from route params.
 */
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Menu, Text, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCreateMedication } from '../../../src/hooks/useMedications';
import { normalizeSupabaseError } from '../../../src/services/supabase/errors';
import { DOSAGE_UNIT_KEYS, type DosageUnitKey } from '../../../src/constants/dosageUnits';
import { Colors } from '../../../src/constants/colors';
import { FontSizes, FontWeights } from '../../../src/constants/typography';

export default function NewMedicationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { patientId, patientName } = useLocalSearchParams<{
    patientId: string;
    patientName: string;
  }>();

  const [name, setName] = useState('');
  // Dosage is split into a free-text amount + a unit picked from a dropdown,
  // then combined into the single `dosage` column on save (e.g. "500 mg").
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<DosageUnitKey | ''>('');
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');

  const createMutation = useCreateMedication();

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('medications.form.nameRequired'));
      return;
    }
    if (!amount.trim()) {
      setError(t('medications.form.amountRequired'));
      return;
    }
    if (!unit) {
      setError(t('medications.form.unitRequired'));
      return;
    }
    if (!patientId) {
      setError(t('medications.form.noPatient'));
      return;
    }

    setError('');
    const dosage = `${amount.trim()} ${t(`medications.form.units.${unit}`)}`;
    createMutation.mutate(
      {
        patient_id: patientId,
        name: name.trim(),
        dosage,
        instructions: instructions.trim() || undefined,
      },
      {
        onSuccess: () => {
          router.back();
        },
        onError: (err: unknown) => {
          setError(t(normalizeSupabaseError(err).messageKey));
        },
      }
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('medications.form.cancelLabel')}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{t('medications.form.addTitle')}</Text>
          {patientName ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {t('medications.form.forPatient', { name: patientName })}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <TextInput
            label={t('medications.form.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('medications.form.nameA11y')}
            placeholder={t('medications.form.namePlaceholder')}
          />

          <View style={styles.dosageRow}>
            <TextInput
              label={t('medications.form.amountLabel')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, styles.amountInput]}
              accessibilityLabel={t('medications.form.amountA11y')}
              placeholder={t('medications.form.amountPlaceholder')}
            />
            <View style={styles.unitColumn}>
              <Menu
                visible={unitMenuVisible}
                onDismiss={() => setUnitMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    onPress={() => setUnitMenuVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('medications.form.unitA11y')}
                  >
                    <TextInput
                      label={t('medications.form.unitLabel')}
                      value={unit ? t(`medications.form.units.${unit}`) : ''}
                      placeholder={t('medications.form.unitPlaceholder')}
                      mode="outlined"
                      editable={false}
                      pointerEvents="none"
                      style={styles.input}
                      right={<TextInput.Icon icon="menu-down" />}
                    />
                  </TouchableOpacity>
                }
              >
                {DOSAGE_UNIT_KEYS.map((key) => (
                  <Menu.Item
                    key={key}
                    onPress={() => {
                      setUnit(key);
                      setUnitMenuVisible(false);
                    }}
                    title={t(`medications.form.units.${key}`)}
                    titleStyle={styles.unitItem}
                  />
                ))}
              </Menu>
            </View>
          </View>

          <TextInput
            label={t('medications.form.instructionsLabel')}
            value={instructions}
            onChangeText={setInstructions}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
            accessibilityLabel={t('medications.form.instructionsA11y')}
            placeholder={t('medications.form.instructionsPlaceholder')}
          />

          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSave}
            loading={createMutation.isPending}
            disabled={createMutation.isPending}
            style={styles.saveButton}
            contentStyle={styles.saveButtonContent}
            accessibilityLabel={t('medications.form.saveA11y')}
          >
            {t('medications.form.saveButton')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerBtn: {
    minWidth: 70,
    paddingVertical: 6,
  },
  headerBtnText: {
    fontSize: FontSizes.caregiver.body,
    color: '#FFFFFF',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSizes.caregiver.headline,
    fontWeight: FontWeights.bold,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: FontSizes.caregiver.label,
    color: '#FFFFFF',
    opacity: 0.85,
    marginTop: 2,
  },
  form: {
    padding: 20,
    gap: 14,
  },
  input: {
    backgroundColor: Colors.light.background,
  },
  dosageRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  amountInput: {
    flex: 1,
  },
  unitColumn: {
    flex: 1,
  },
  unitItem: {
    fontSize: FontSizes.caregiver.body,
  },
  errorText: {
    color: Colors.light.danger,
    fontSize: FontSizes.caregiver.body,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 8,
  },
  saveButtonContent: {
    height: 52,
  },
});
