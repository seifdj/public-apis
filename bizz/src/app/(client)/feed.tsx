import { Home } from 'lucide-react-native';

import { Placeholder } from '@/features/shell/Placeholder';
import { fr } from '@/i18n/fr';
import { colors } from '@/theme/theme';

export default function FeedScreen() {
  return <Placeholder heading={fr.nav.feed} icon={<Home color={colors.primary} size={28} />} title={fr.placeholders.feed.title} body={fr.placeholders.feed.body} />;
}
