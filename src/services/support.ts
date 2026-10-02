import { backend } from './backend';

export type ReportTopic = 'missing_payment' | 'wrong_person' | 'add_or_cash_out' | 'app_problem' | 'account' | 'other';
export type DisputeReason = 'unauthorized' | 'wrong_amount' | 'wrong_person' | 'duplicate' | 'not_received';

export type Ticket = { id: string; createdAt: string };

const ticketId = () => `PV-${Math.floor(1000 + Math.random() * 9000)}`;

/**
 * Support tickets. Live mode inserts into the `disputes` / support tables through an Edge
 * Function (build step 6); mock mode returns a ticket number after a short pause.
 */
export async function submitReport(input: { topic: ReportTopic; details: string; transactionId?: string }): Promise<Ticket> {
  if (backend.mode === 'live') throw new Error('support_not_configured');
  void input;
  await new Promise((r) => setTimeout(r, 700));
  return { id: ticketId(), createdAt: new Date().toISOString() };
}

export async function submitDispute(input: { transactionId: string; reason: DisputeReason; details: string }): Promise<Ticket> {
  if (backend.mode === 'live') throw new Error('support_not_configured');
  void input;
  await new Promise((r) => setTimeout(r, 900));
  return { id: ticketId(), createdAt: new Date().toISOString() };
}
