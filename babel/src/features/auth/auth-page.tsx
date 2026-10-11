import { redirect } from "next/navigation";
import { SiteHeader } from "@/features/landing/site-header";
import { auth, googleEnabled } from "./auth";
import { AuthForm } from "./auth-form";
import { safePath } from "./safe-path";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Shared by /signin and /signup: same form, different words. */
export async function AuthPage({ mode, searchParams }: { mode: "signin" | "signup"; searchParams: SearchParams }) {
  const params = await searchParams;
  const callbackUrl = safePath(params.callbackUrl);
  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap py-8 sm:py-12">
        <AuthForm
          mode={mode}
          callbackUrl={callbackUrl}
          error={typeof params.error === "string" ? params.error : undefined}
          googleEnabled={googleEnabled()}
        />
      </main>
    </>
  );
}
