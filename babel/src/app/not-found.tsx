import { ButtonLink } from "@/components/ui/button";
import { Mascot } from "@/features/brand/mascot";
import { SiteHeader } from "@/features/landing/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap flex flex-col items-center py-16 text-center">
        <div className="w-[120px]">
          <Mascot mood="thinking" waving={false} />
        </div>
        <h1 className="mt-8 text-4xl sm:text-5xl">Lost in translation.</h1>
        <p className="mt-4 max-w-md text-lg text-muted">That page doesn&rsquo;t exist, in any language. Let&rsquo;s get you back.</p>
        <ButtonLink href="/" className="mt-8">
          Go home
        </ButtonLink>
      </main>
    </>
  );
}
