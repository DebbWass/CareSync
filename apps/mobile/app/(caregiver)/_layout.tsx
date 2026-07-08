import { useMemo, useState } from 'react';
import { Alert, Pressable, Text as RNText } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';
import { signOut } from '../../src/services/supabase/auth';

function HeaderSignOutButton() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      await signOut();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('common.error');
      Alert.alert(t('common.signOutFailed'), message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Pressable
      onPress={handleSignOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('common.signOut')}
    >
      <RNText
        style={{
          color: Colors.light.primary,
          fontWeight: '700',
          fontSize: 15,
          opacity: loading ? 0.5 : 1,
        }}
      >
        {t('common.signOut')}
      </RNText>
    </Pressable>
  );
}

function HeaderSettingsButton() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/(caregiver)/settings')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('settings.openA11y')}
    >
      <MaterialCommunityIcons name="cog-outline" size={22} color={Colors.light.primary} />
    </Pressable>
  );
}

export default function CaregiverLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarStyle = useMemo(
    () => ({
      height: 58 + insets.bottom,
      paddingBottom: Math.max(insets.bottom, 8),
      paddingTop: 6,
    }),
    [insets.bottom]
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerTitleStyle: {
          color: Colors.light.onBackground,
          fontWeight: '700',
        },
        headerLeft: () => <HeaderSettingsButton />,
        headerLeftContainerStyle: { paddingStart: 16 },
        headerRight: () => <HeaderSignOutButton />,
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: Colors.light.secondary,
        tabBarStyle,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: t('tabs.dashboardA11y'),
        }}
      />
      <Tabs.Screen
        name="medications/index"
        options={{
          title: t('tabs.medications'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="pill" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: t('tabs.medicationsA11y'),
        }}
      />
      <Tabs.Screen
        name="schedules/index"
        options={{
          title: t('tabs.schedules'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-clock" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: t('tabs.schedulesA11y'),
        }}
      />
      <Tabs.Screen
        name="patients/index"
        options={{
          title: t('tabs.patients'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group-outline" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: t('tabs.patientsA11y'),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: t('tabs.alerts'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bell-outline" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: t('tabs.alertsA11y'),
        }}
      />
      {/* Detail/form screens live inside the tab navigator but must not render
          as tab buttons of their own — hide them from the tab bar. */}
      <Tabs.Screen name="settings" options={{ href: null, title: t('settings.title') }} />
      <Tabs.Screen
        name="messages/[patientId]"
        options={{ href: null, title: t('messages.title') }}
      />
      <Tabs.Screen
        name="patients/[patientId]"
        options={{ href: null, title: t('analytics.title') }}
      />
      <Tabs.Screen
        name="medications/new"
        options={{ href: null, title: t('medications.form.addTitle') }}
      />
      <Tabs.Screen
        name="medications/[id]"
        options={{ href: null, title: t('medications.title') }}
      />
      <Tabs.Screen
        name="schedules/new"
        options={{ href: null, title: t('schedules.form.addTitle') }}
      />
      <Tabs.Screen name="schedules/[id]" options={{ href: null, title: t('schedules.title') }} />
    </Tabs>
  );
}
