import { LayoutGrid } from 'lucide-react-native';

import { Placeholder } from '@/features/shell/Placeholder';
import { fr } from '@/i18n/fr';
import { colors } from '@/theme/theme';

export default function PostsScreen() {
  return <Placeholder heading={fr.nav.posts} icon={<LayoutGrid color={colors.primary} size={28} />} title={fr.placeholders.posts.title} body={fr.placeholders.posts.body} />;
}
