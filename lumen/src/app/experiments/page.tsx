import { FlaskConical } from 'lucide-react';

import { PagePlaceholder } from '@/components/common/page-placeholder';

export const metadata = { title: 'Experiments · Lumen' };

export default function Page() {
  return <PagePlaceholder title="Experiments" icon={FlaskConical} body="Run price and checkout tests and see plain-English results. Your active test shows on Home." />;
}
