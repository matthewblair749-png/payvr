/**
 * Landing page copy.
 *
 * PLACEHOLDERS: the customer logos, usage counters and testimonials below
 * are sample content for launch design. Replace them with real customers,
 * real numbers and permissioned quotes before going live. (Feature result
 * lines that mention Northstar Commerce describe the demo company, and are
 * produced by the real engine on its sample data.)
 */

export const HERO = {
  tagline: "Find the next move.",
  subtitle: "PIVOT turns business data into decisions.",
  supporting:
    "Understand what is happening, discover opportunities, simulate strategic decisions, and identify the moves that could have the biggest impact on your business.",
  primaryCta: "Start analyzing",
  secondaryCta: "See how it works",
  reassurance: ["Free 14-day Pro trial", "No credit card"],
};

/** PLACEHOLDER customer names (fictional). */
export const TRUST_LOGOS = ["Halden Foods", "Kestrel Supply", "Orlo Health", "Fernway", "Tallis Retail", "Quarry Lane"];

/** PLACEHOLDER usage counters. Wire these to real metrics before launch. */
export const PROOF_STATS = [
  { value: "2,847", label: "decisions simulated this week" },
  { value: "412", label: "companies connected this month" },
  { value: "91", label: "average PIVOT Score among active workspaces" },
];

export const STEPS = [
  { name: "Connect", body: "Upload a CSV, or start with sample data. It takes about two minutes." },
  { name: "Understand", body: "PIVOT reads every metric and explains what changed and why." },
  { name: "Detect", body: "It finds the risks and opportunities, and scores each one from 0 to 100." },
  { name: "Simulate", body: "Test a decision on your own numbers before you make it." },
  { name: "Pivot", body: "Get a ranked list of next moves. You decide which to make." },
];

/** PLACEHOLDER testimonials (fictional people and companies). */
export const TESTIMONIALS = [
  {
    quote: "PIVOT caught our retention drop three weeks before it showed up in the board deck.",
    name: "Dana Reyes",
    title: "VP Operations",
    company: "Halden Foods",
  },
  {
    quote: "We were about to raise prices 8%. The simulator showed it would cost us $46K a month in profit, so we raised them for our premium tier only.",
    name: "Marcus Bell",
    title: "CEO",
    company: "Kestrel Supply",
  },
  {
    quote: "Our Monday metrics meeting went from 60 minutes to 15. We start with PIVOT's top three moves and decide.",
    name: "Priya Nair",
    title: "Head of Growth",
    company: "Orlo Health",
  },
];

export const FAQ = [
  {
    q: "Is my data secure?",
    a: "Yes. Every company's data is isolated, and only members of your workspace can see it. Files are checked when you upload them, and your data is never used to train AI models.",
  },
  {
    q: "What if PIVOT is wrong?",
    a: "Every estimate shows its confidence and the assumptions behind it, and PIVOT tells you when your data can't answer a question. PIVOT shows the evidence; you make the call.",
  },
  {
    q: "Do I need to connect real data to try it?",
    a: "No. Explore the full product with Northstar Commerce, a demo company, without signing up. When you're ready, upload a CSV or import sample data.",
  },
  {
    q: "How is this different from a BI dashboard?",
    a: "A dashboard shows what happened. PIVOT explains why it happened, what it means and what to do next, then lets you test the decision before you make it.",
  },
  {
    q: "What data does PIVOT need?",
    a: "A monthly CSV with revenue is enough to start. Add customers, costs, marketing spend, products, channels or segments, and PIVOT finds more.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are monthly with no contract, and the Free plan stays free.",
  },
];
