import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudioEditor, type StudioInitial } from "@/components/studio/studio-editor";
import { getPageForEditor, NotFoundError, parseConfig } from "@/server/dal/checkout-pages";
import { requireMerchant } from "@/server/dal/session";

export const metadata: Metadata = { title: "Editor" };

export default async function EditorPage({ params }: PageProps<"/studio/pages/[id]">) {
  const { id } = await params;
  const merchant = await requireMerchant(`/studio/pages/${id}`);

  let page;
  try {
    page = await getPageForEditor(merchant.id, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const experiment = page.experiments[0];
  const variantB = experiment?.variants.find((v) => v.key === "B");

  const initial: StudioInitial = {
    pageId: page.id,
    name: page.name,
    slug: page.slug,
    status: page.status,
    publishedVersionId: page.publishedVersionId,
    configA: parseConfig(page.draftConfig),
    configB: variantB?.config ? parseConfig(variantB.config) : null,
    experimentStatus: experiment ? (experiment.status as "DRAFT" | "RUNNING") : null,
    weightB: variantB?.weight ?? 50,
    product: page.product
      ? {
          name: page.product.name,
          description: page.product.description,
          priceCents: page.product.priceCents,
          currency: page.product.currency.toUpperCase(),
        }
      : { name: "Your product", description: "", priceCents: 2900, currency: "USD" },
    versions: page.versions.map((v) => ({ id: v.id, number: v.number, note: v.note, createdAt: v.createdAt.toISOString() })),
    appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  };

  return <StudioEditor initial={initial} />;
}
