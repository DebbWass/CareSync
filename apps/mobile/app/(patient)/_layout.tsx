import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/colors';

export default function PatientLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: Colors.light.secondary,
        tabBarStyle: {
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            // Icon rendered as text for simplicity — swap for vector icons in Phase 3
            <TabIcon label="💊" color={color} />
          ),
          tabBarAccessibilityLabel: 'Today — current medication reminders',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => (
            <TabIcon label="📋" color={color} />
          ),
          tabBarAccessibilityLabel: 'History — past medication events',
        }}
      />
    </Tabs>
  );
}

function TabIcon({ label }: { label: string; color: string }) {
  return (
    <>{label}</>
  );
}
