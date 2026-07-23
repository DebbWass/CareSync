import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Checkbox, Text, TextInput } from 'react-native-paper';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { signIn } from '../../src/services/supabase/auth';
import { normalizeSupabaseError } from '../../src/services/supabase/errors';
import { useSettingsStore } from '../../src/store/settingsStore';
import {
  getRememberedPassword,
  setRememberedPassword,
} from '../../src/services/rememberedPassword';
import { Colors } from '../../src/constants/colors';

export default function LoginScreen() {
  const { t } = useTranslation();
  const rememberedEmail = useSettingsStore((s) => s.rememberedEmail);
  const setRememberedEmail = useSettingsStore((s) => s.setRememberedEmail);
  // Derive the field value so it tracks the remembered email even when
  // settingsStore rehydrates from AsyncStorage AFTER this screen mounts, yet
  // hands control to the user the moment they type. `null` = untouched (follow
  // the store); any string (incl. '') = the user has taken over. No effect, so
  // no setState-in-effect cascade.
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const email = emailInput ?? rememberedEmail ?? '';
  // Same "untouched vs. taken over" pattern as email: `null` = follow the value
  // loaded from SecureStore; any string = the user has typed. The remembered
  // password loads ASYNC (Keychain/Keystore), so it can arrive after mount.
  const [passwordInput, setPasswordInput] = useState<string | null>(null);
  const [loadedPassword, setLoadedPassword] = useState<string | null>(null);
  const password = passwordInput ?? loadedPassword ?? '';
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  // Pre-fill the remembered password once, on mount. Critical for the patient
  // (dementia) who cannot recall it. If the user has already started typing by
  // the time it resolves, don't clobber their input.
  useEffect(() => {
    let active = true;
    getRememberedPassword().then((pw) => {
      if (active && pw) setLoadedPassword(pw);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(t('auth.login.fillAllFields'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // Persist (or clear) the pre-fill only after a successful sign-in.
      setRememberedEmail(remember ? email.trim().toLowerCase() : null);
      await setRememberedPassword(remember ? password : null);
      // Navigation is handled by the root layout's auth guard
    } catch (err: unknown) {
      setError(t(normalizeSupabaseError(err).messageKey));
    } finally {
      setLoading(false);
    }
  };

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName} accessibilityRole="header">
            {t('common.appName')}
          </Text>
          <Text style={styles.tagline}>{t('auth.login.tagline')}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            label={t('auth.login.emailLabel')}
            value={email}
            onChangeText={setEmailInput}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('auth.login.emailA11y')}
          />

          <TextInput
            label={t('auth.login.passwordLabel')}
            value={password}
            onChangeText={setPasswordInput}
            secureTextEntry={!passwordVisible}
            autoComplete="current-password"
            mode="outlined"
            style={styles.input}
            accessibilityLabel={t('auth.login.passwordLabel')}
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

          {/* Remember me — persists the email pre-fill for next launch */}
          <Pressable
            style={styles.rememberRow}
            onPress={() => setRemember((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            accessibilityLabel={t('auth.login.rememberMe')}
            accessibilityHint={t('auth.login.rememberMeHint')}
            hitSlop={8}
          >
            <Checkbox
              status={remember ? 'checked' : 'unchecked'}
              onPress={() => setRemember((v) => !v)}
              color={Colors.light.primary}
            />
            <Text style={styles.rememberLabel}>{t('auth.login.rememberMe')}</Text>
          </Pressable>

          {error ? (
            <Text style={styles.errorText} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            accessibilityLabel={t('auth.login.signInA11y')}
            accessibilityHint={t('auth.login.signInHint')}
          >
            {t('auth.login.signIn')}
          </Button>

          <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
            <Text style={styles.link}>{t('auth.login.forgotLink')}</Text>
          </Link>

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>{t('auth.login.noAccount')}</Text>
            <Link href="/(auth)/register">
              <Text style={styles.link}>{t('auth.login.registerLink')}</Text>
            </Link>
          </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.light.primary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 15,
    color: Colors.light.secondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: Colors.light.background,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  rememberLabel: {
    fontSize: 14,
    color: Colors.light.onBackground,
    marginLeft: 4,
  },
  errorText: {
    color: Colors.light.danger,
    fontSize: 14,
    marginTop: 2,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    height: 52,
  },
  forgotLink: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 4,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  linkText: {
    color: Colors.light.secondary,
    fontSize: 14,
  },
  link: {
    color: Colors.light.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});
