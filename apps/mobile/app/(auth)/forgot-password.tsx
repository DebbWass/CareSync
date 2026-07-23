/**
 * Forgot-password screen — sends a recovery email with a deep link back to
 * /reset-password.
 *
 * Product decision (2026-07-22): unlike GoTrue's default anti-enumeration
 * behavior, this screen checks emailExists() first and shows an explicit "no
 * account" message when the address isn't registered. See the email_exists RPC
 * migration for the enumeration trade-off this accepts.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { emailExists, requestPasswordReset } from '../../src/services/supabase/auth';
import { normalizeSupabaseError } from '../../src/services/supabase/errors';
import { Colors } from '../../src/constants/colors';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      setError(t('auth.forgot.enterEmail'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      // Explicitly tell the user when no account exists (product decision) —
      // otherwise resetPasswordForEmail silently succeeds either way.
      const exists = await emailExists(normalizedEmail);
      if (!exists) {
        setError(t('auth.forgot.noAccount'));
        return;
      }
      await requestPasswordReset(normalizedEmail);
      setSent(true);
    } catch (err: unknown) {
      setError(t(normalizeSupabaseError(err).messageKey));
    } finally {
      setLoading(false);
    }
  };

  // ── Sent confirmation ───────────────────────────────────────────────────────
  if (sent) {
    return (
      <View style={styles.center}>
        <Text style={styles.sentIcon}>✉</Text>
        <Text style={styles.title} accessibilityRole="header">
          {t('auth.forgot.sentTitle')}
        </Text>
        <Text style={styles.body}>{t('auth.forgot.sentBody', { email: email.trim() })}</Text>
        <Text
          style={styles.link}
          onPress={() => router.replace('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel={t('auth.forgot.backToLoginA11y')}
        >
          {t('auth.forgot.backToLogin')}
        </Text>
      </View>
    );
  }

  // ── Email form ──────────────────────────────────────────────────────────────
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
            {t('auth.forgot.title')}
          </Text>
          <Text style={styles.body}>{t('auth.forgot.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label={t('auth.login.emailLabel')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('auth.login.emailA11y')}
          />

          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSend}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            accessibilityLabel={t('auth.forgot.sendA11y')}
          >
            {t('auth.forgot.sendButton')}
          </Button>

          <Text
            style={styles.link}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('auth.forgot.backToLoginA11y')}
          >
            {t('auth.forgot.backToLogin')}
          </Text>
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
    gap: 8,
  },
  sentIcon: {
    fontSize: 56,
    color: Colors.light.primary,
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
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    height: 52,
  },
  link: {
    color: Colors.light.primary,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
});
