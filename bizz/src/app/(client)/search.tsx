import { Search } from 'lucide-react-native';

import { Placeholder } from '@/features/shell/Placeholder';
import { fr } from '@/i18n/fr';
import { colors } from '@/theme/theme';

export default function SearchScreen() {
  return <Placeholder heading={fr.nav.search} icon={<Search color={colors.primary} size={28} />} title={fr.placeholders.search.title} body={fr.placeholders.search.body} />;
}
