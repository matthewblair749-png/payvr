import type { Metadata } from "next";
import { AuthPage } from "@/features/auth/auth-page";

export const metadata: Metadata = { title: "Make your account" };

export default function SignUpPage(props: PageProps<"/signup">) {
  return <AuthPage mode="signup" searchParams={props.searchParams} />;
}
