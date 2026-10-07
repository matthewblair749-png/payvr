"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The company this page was rendered for. Actions send it back so the server
 * can refuse to act on a different workspace (the user may have switched in
 * another tab since this page loaded).
 */
const CompanyId = createContext("");

export function WorkspaceProvider({ companyId, children }: { companyId: string; children: ReactNode }) {
  return <CompanyId value={companyId}>{children}</CompanyId>;
}

export const useCompanyId = () => useContext(CompanyId);

/** Hidden form field carrying the page's company id. */
export function CompanyIdField() {
  return <input type="hidden" name="companyId" value={useCompanyId()} />;
}
