import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/auth-page";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage(props: PageProps<"/signin">) {
  return <AuthPage mode="signin" searchParams={props.searchParams} />;
}
