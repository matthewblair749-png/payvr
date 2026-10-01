import { Receipt } from 'lucide-react';

import { PagePlaceholder } from '@/components/common/page-placeholder';

export const metadata = { title: 'Payments · Lumen' };

export default function Page() {
  return <PagePlaceholder title="Payments" icon={Receipt} body="Every payment, refund and dispute will live here, searchable and filterable. For now, press ⌘K to find a payment by amount or customer." />;
}
