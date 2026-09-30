import type { Block, BlockType, CheckoutConfig, CheckoutProduct } from "./schema";

/** Default props for a freshly-added block of each type. */
export function defaultBlock(type: BlockType, id: string = `${type}-${Math.random().toString(36).slice(2, 8)}`): Block {
  switch (type) {
    case "orderSummary":
      return { id, type, hidden: false, props: { showImage: true } };
    case "upsell":
      return {
        id,
        type,
        hidden: false,
        props: { title: "Add a matching saucer", description: "Same speckled glaze. Saves you a trip.", priceCents: 1200 },
      };
    case "testimonial":
      return {
        id,
        type,
        hidden: false,
        props: {
          quote: "My coffee tastes better out of this mug. I can't prove it, but I'm sure.",
          author: "Priya N.",
          detail: "Bought 3 sets",
          rating: 5,
        },
      };
    case "countdown":
      return { id, type, hidden: false, props: { label: "Launch price ends in", minutes: 45 } };
    case "tipSlider":
      return { id, type, hidden: false, props: { label: "Add a tip for the studio", maxPercent: 25 } };
    case "payIn4":
      return { id, type, hidden: false, props: { label: "Pay in 4 interest-free payments" } };
    case "coupon":
      return {
        id,
        type,
        hidden: false,
        props: {
          placeholder: "Discount code",
          codes: [
            { code: "LUMEN10", percentOff: 10 },
            { code: "HELLO", percentOff: 15 },
          ],
        },
      };
    case "trustBadges":
      return { id, type, hidden: false, props: { items: ["secure", "refund", "support"] } };
    case "payment":
      return { id, type, hidden: false, props: { buttonLabel: "Pay", haptics: true, sound: false } };
  }
}

/** The demo checkout shown on the landing page and used as a Studio starter. */
export const DEMO_CONFIG: CheckoutConfig = {
  schemaVersion: 1,
  brand: { name: "Kiln & Co." },
  theme: {
    mode: "light",
    accent: "#F04A1A",
    background: "#EDEDF0",
    font: "dmSans",
    radius: 16,
    layout: "page",
  },
  blocks: [
    defaultBlock("orderSummary", "summary"),
    defaultBlock("countdown", "countdown"),
    defaultBlock("upsell", "upsell"),
    defaultBlock("testimonial", "testimonial"),
    defaultBlock("tipSlider", "tip"),
    defaultBlock("coupon", "coupon"),
    defaultBlock("payIn4", "payin4"),
    defaultBlock("payment", "payment"),
    defaultBlock("trustBadges", "trust"),
  ],
};

export const DEMO_PRODUCT: CheckoutProduct = {
  name: "Speckled mug set",
  description: "Two wheel-thrown stoneware mugs, 12oz, oatmeal glaze.",
  priceCents: 4800,
  currency: "USD",
};
