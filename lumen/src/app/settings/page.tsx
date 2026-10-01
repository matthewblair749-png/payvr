import { Settings } from 'lucide-react';

import { PagePlaceholder } from '@/components/common/page-placeholder';

export const metadata = { title: 'Settings · Lumen' };

export default function Page() {
  return <PagePlaceholder title="Settings" icon={Settings} body="Payouts, team members, taxes and notifications. Nothing here needs your attention right now." />;
}
