import { LineChart } from 'lucide-react';

import { PagePlaceholder } from '@/components/common/page-placeholder';

export const metadata = { title: 'Insights · Lumen' };

export default function Page() {
  return <PagePlaceholder title="Insights" icon={LineChart} body="Deeper trends and saved questions will collect here. You can already ask Lumen a question from Home." />;
}
