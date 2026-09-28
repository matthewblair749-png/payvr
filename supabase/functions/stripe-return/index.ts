// Stripe onboarding sends the browser here when it's done; bounce back into the app.
// Deploy with --no-verify-jwt (the browser redirect carries no Supabase token).
Deno.serve((req) => {
  const status = new URL(req.url).searchParams.get('status') === 'done' ? 'done' : 'refresh';
  return new Response(null, { status: 302, headers: { Location: `payvr://stripe-return?status=${status}` } });
});
