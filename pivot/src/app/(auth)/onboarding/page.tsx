import type { Metadata } from "next";
import { CompanyForm } from "@/components/auth/forms";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create your workspace" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  return (
    <>
      <p className="text-sm text-muted">Step 2 of 2</p>
      <h1 className="mt-1 text-3xl font-heavy tracking-tighter text-ink">Create your workspace</h1>
      <p className="mt-2 text-[15px] text-muted">
        Welcome, {user.name.split(" ")[0]}. A workspace holds your company&apos;s data. You can invite your team later.
      </p>
      <div className="mt-8">
        <CompanyForm />
      </div>
    </>
  );
}
