/** Holds sign-up answers between the sign-up steps (prototype only; lives in memory). */
export const signupDraft: {
  mode: 'signup' | 'login';
  phone: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
} = { mode: 'signup', phone: '', name: '', handle: '', avatarUrl: null };
