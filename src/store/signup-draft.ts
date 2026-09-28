/** Holds sign-up answers between the sign-up steps (lives in memory only). */
export const signupDraft: {
  mode: 'signup' | 'login';
  /** Display form, e.g. "+1 (415) 555-0142". */
  phone: string;
  /** E.164 form sent to Supabase Auth, e.g. "+14155550142". */
  phoneE164: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
} = { mode: 'signup', phone: '', phoneE164: '', name: '', handle: '', avatarUrl: null };
