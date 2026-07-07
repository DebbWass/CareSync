/**
 * Reset-password screen — target of the recovery email deep link:
 *   caresync://reset-password#access_token=…&refresh_token=…&type=recovery
 *
 * GoTrue (implicit flow) delivers the recovery session in the URL fragment;
 * this screen installs it, then lets the user choose a new password. The
 * AuthGuard deliberately ignores this route (see app/_layout.tsx) so neither
 * the missing session (before restore) nor the installed one (after) can
 * redirect the user away mid-flow.
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useURL } from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { restoreSessionFromRecoveryUrl, updatePassword } from '../src/services/supabase/auth';
import { normalizeSupabaseError } from '../src/services/supabase/errors';
import { useAuthStore } from '../src/store/authStore';
import { Colors } from '../src/constants/colors';
import { MIN_PASSWORD_LENGTH } from '../src/constants/config';

type Phase = 'restoring' | 'form' | 'invalid' | 'success';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const url = useURL();
  const hasSession = useAuthStore((s) => !!s.session);

  const [phase, setPhase] = useState<Phase>('restoring');
  const [restoreError, setRestoreError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // ── Install the recovery session from the deep link ────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const restored = url ? await restoreSessionFromRecoveryUrl(url) : false;
        if (cancelled) return;
        // No tokens in the URL is still fine if a session already exists
        // (e.g. the auth listener processed the link before this screen mounted)
        setPhase(restored || hasSession ? 'form' : 'invalid');
      } catch (err: unknown) {
        if (cancelled) return;
        setRestoreError(t(normalizeSupabaseError(err).messageKey));
        setPhase('invalid');
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
    // hasSession intentionally read once per URL — a session appearing later
    // must not yank an 'invalid' verdict back to the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, t]);

  // ── Save the new password ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(t('auth.register.passwordTooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setFormError(t('auth.reset.mismatch'));
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await updatePassword(password);
      setPhase('success');
    } catch (err: unknown) {
      setFormError(t(normalizeSupabaseError(err).messageKey));
    } finally {
      setSaving(false);
    }
  };

  // ── Restoring ───────────────────────────────────────────────────────────────
  if (phase === 'restoring') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  // ── Invalid / expired link ──────────────────────────────────────────────────
  if (phase === 'invalid') {
    return (
      <View style={styles.center}>
        <Text style={styles.title} accessibilityRole="alert">
          {t('auth.reset.invalidTitle')}
        </Text>
        <Text style={styles.body}>{restoreError || t('auth.reset.invalidBody')}</Text>
        <Button
          mode="contained"
          onPress={() => router.replace('/(auth)/forgot-password')}
          style={styles.button}
          contentStyle={styles.buttonContent}
          accessibilityLabel={t('auth.reset.requestNewA11y')}
        >
          {t('auth.reset.requestNew')}
        </Button>
      </View>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <View style={styles.center}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.title} accessibilityRole="header">
          {t('auth.reset.successTitle')}
        </Text>
        <Text style={styles.body}>{t('auth.reset.successBody')}</Text>
        <Button
          mode="contained"
          onPress={() => router.replace('/')}
          style={styles.button}
          contentStyle={styles.buttonContent}
          accessibilityLabel={t('auth.reset.continueA11y')}
        >
          {t('auth.reset.continueButton')}
        </Button>
      </View>
    );
  }

  // ── New password form ───────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {t('auth.reset.title')}
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label={t('auth.reset.newPasswordLabel')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            autoComplete="new-password"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('auth.reset.newPasswordLabel')}
            right={
              <TextInput.Icon
                icon={passwordVisible ? 'eye-off' : 'eye'}
                onPress={() => setPasswordVisible((v) => !v)}
                accessibilityLabel={
                  passwordVisible ? t('auth.login.hidePassword') : t('auth.login.showPassword')
                }
              />
            }
          />

          <TextInput
            label={t('auth.reset.confirmPasswordLabel')}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!passwordVisible}
            autoComplete="new-password"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('auth.reset.confirmPasswordLabel')}
          />

          {formError ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {formError}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.button}
            contentStyle={styles.buttonContent}
            accessibilityLabel={t('auth.reset.saveA11y')}
          >
            {t('auth.reset.saveButton')}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.light.onBackground,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: Colors.light.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  successIcon: {
    fontSize: 56,
    color: Colors.light.confirm,
    fontWeight: '700',
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: Colors.light.background,
  },
  errorText: {
    color: Colors.light.danger,
    fontSize: 14,
  },
  button: {
    marginTop: 12,
    borderRadius: 8,
    minWidth: 220,
  },
  buttonContent: {
    height: 52,
  },
});
