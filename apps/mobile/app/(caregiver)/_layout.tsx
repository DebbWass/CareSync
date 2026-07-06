import { useMemo, useState } from 'react';
import { Alert, Pressable, Text as RNText } from 'react-native';
import { Tabs } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/colors';
import { signOut } from '../../src/services/supabase/auth';

function HeaderSignOutButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      await signOut();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not sign out.';
      Alert.alert('Sign out failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Pressable
      onPress={handleSignOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
    >
      <RNText
        style={{
          color: Colors.light.primary,
          fontWeight: '700',
          fontSize: 15,
          opacity: loading ? 0.5 : 1,
        }}
      >
        Sign out
      </RNText>
    </Pressable>
  );
}

export default function CaregiverLayout() {
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
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'Dashboard — patient adherence overview',
        }}
      />
      <Tabs.Screen
        name="medications/index"
        options={{
          title: 'Medications',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="pill" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'Medications — manage patient medications',
        }}
      />
      <Tabs.Screen
        name="schedules/index"
        options={{
          title: 'Schedules',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-clock" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'Schedules — define medication timings',
        }}
      />
      <Tabs.Screen
        name="patients/index"
        options={{
          title: 'Patients',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-group-outline" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'Patients — manage your linked patients',
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bell-outline" color={color} size={size} />
          ),
          tabBarAccessibilityLabel: 'Alerts — missed medication notifications',
        }}
      />
      {/* Detail/form screens live inside the tab navigator but must not render
          as tab buttons of their own — hide them from the tab bar. */}
      <Tabs.Screen name="medications/new" options={{ href: null, title: 'Add Medication' }} />
      <Tabs.Screen name="medications/[id]" options={{ href: null, title: 'Medication' }} />
      <Tabs.Screen name="schedules/new" options={{ href: null, title: 'Add Schedule' }} />
      <Tabs.Screen name="schedules/[id]" options={{ href: null, title: 'Schedule' }} />
    </Tabs>
  );
}
