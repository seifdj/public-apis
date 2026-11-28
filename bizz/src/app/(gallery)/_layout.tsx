import { Tabs } from 'expo-router';
import { Home, MessageCircle, Search, User } from 'lucide-react-native';
import { Alert } from 'react-native';

import { fr } from '@/i18n/fr';
import { GlassTabBar } from '@/ui';

const icons = { components: Home, colors: Search, typography: MessageCircle, navigation: User };

/** Demo of the client navigation: 4 tabs + raised + button. */
export default function GalleryLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <GlassTabBar
          {...props}
          icons={icons}
          badges={{ typography: 3 }}
          centerAction={{ label: fr.nav.publish, onPress: () => Alert.alert(fr.gallery.plusPressed) }}
        />
      )}
    >
      <Tabs.Screen name="components" options={{ title: fr.nav.feed }} />
      <Tabs.Screen name="colors" options={{ title: fr.nav.search }} />
      <Tabs.Screen name="typography" options={{ title: fr.nav.messages }} />
      <Tabs.Screen name="navigation" options={{ title: fr.nav.profile }} />
    </Tabs>
  );
}
