import { Users } from 'lucide-react';

import { PagePlaceholder } from '@/components/common/page-placeholder';

export const metadata = { title: 'Customers · Lumen' };

export default function Page() {
  return <PagePlaceholder title="Customers" icon={Users} body="See who buys, who comes back and what they spend. Until then, search any customer by name with ⌘K." />;
}
