import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function PageNotFound({ base }: { base: string }) {
  return (
    <EmptyState icon={SearchX} title="We couldn't find that" description="It may have been deleted, or it belongs to a different workspace.">
      <ButtonLink href={base} variant="primary">
        Back to overview
      </ButtonLink>
    </EmptyState>
  );
}
