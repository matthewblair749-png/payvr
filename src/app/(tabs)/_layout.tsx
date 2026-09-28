import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/tab-bar';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme-provider';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { status } = useApp();
  // Signed out (or session expired) → back through the splash to onboarding.
  if (status !== 'signedIn') return <Redirect href="/" />;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
