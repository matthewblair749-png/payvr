import { Platform, Share } from 'react-native';

import type { Contact, Transaction, User } from '@/data/types';

import { backend } from './backend';

export type DataExport = {
  exportedAt: string;
  profile: User;
  transactions: Transaction[];
  contacts: Contact[];
  settings: Record<string, unknown>;
};

/**
 * Hands the person a copy of their data. Live mode builds the export on the server (all
 * tables, including audit history) in build step 2; mock mode exports what's on the phone.
 */
export async function shareDataExport(data: DataExport): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const filename = `payvr-export-${data.exportedAt.slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: json });
}

/**
 * Closes the account. The server removes the profile and sign-in, and keeps payment records
 * only as long as financial regulations require. Live mode: build step 2.
 */
export async function deleteAccount(): Promise<void> {
  if (backend.mode === 'live') throw new Error('delete_not_configured');
  await new Promise((r) => setTimeout(r, 800));
}
