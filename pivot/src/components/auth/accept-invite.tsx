"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { acceptInvite, type FormState } from "@/server/auth/actions";
import { SubmitButton } from "./submit";

export function AcceptInvite({ token }: { token: string }) {
  const [state, action] = useActionState<FormState>(() => acceptInvite(token), undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage tone="error">{state?.error}</FormMessage>
      <SubmitButton pendingLabel="Joining…">Accept invitation</SubmitButton>
    </form>
  );
}
