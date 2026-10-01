import { Palette } from 'lucide-react';

import { PagePlaceholder } from '@/components/common/page-placeholder';

export const metadata = { title: 'Checkout Studio · Lumen' };

export default function Page() {
  return <PagePlaceholder title="Checkout Studio" icon={Palette} body="Design, preview and publish your checkout page. Your current checkout keeps working while we build this." />;
}
