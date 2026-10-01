import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { isValidAnswer, SURVEY_QUESTION_KEYS } from "@/lib/survey/questions";
import { db } from "./db";
import { resolveCheckout } from "./dal/public-checkout";
import { UserError } from "./errors";

/**
 * One-tap survey answers from buyers.
 *
 * Anti-spam without accounts: an answer is only accepted if
 *  - the checkout actually asks that question (published config / variant),
 *  - the answer is one of that question's options,
 *  - this checkout session has a real order (created when the buyer pressed
 *    Pay; the payment webhook may still be in flight, so PENDING counts),
 *  - and it's the session's first answer to that question.
 */
export const surveyInputSchema = z.object({
  slug: z.string().min(1).max(64),
  sessionId: z.string().uuid(),
  question: z.enum(SURVEY_QUESTION_KEYS),
  answer: z.string().min(1).max(40),
});

export type SurveyResult = "recorded" | "duplicate";

export async function recordSurveyAnswer(input: z.infer<typeof surveyInputSchema>, visitorId: string): Promise<SurveyResult> {
  const checkout = await resolveCheckout(input.slug, visitorId);
  if (!checkout) throw new UserError("This checkout isn't available.");
  const survey = checkout.config.survey;
  if (!survey.enabled || survey.question !== input.question) throw new UserError("This checkout doesn't ask that question.");
  if (!isValidAnswer(input.question, input.answer)) throw new UserError("That isn't one of the answers.");

  const order = await db.order.findFirst({
    where: {
      sessionId: input.sessionId,
      checkoutPageId: checkout.pageId,
      status: { in: ["PENDING", "SUCCEEDED", "PARTIALLY_REFUNDED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, merchantId: true, variantId: true },
  });
  if (!order) throw new UserError("We couldn't find your order for this answer.");

  try {
    await db.surveyResponse.create({
      data: {
        merchantId: order.merchantId,
        checkoutPageId: checkout.pageId,
        orderId: order.id,
        sessionId: input.sessionId,
        variantId: order.variantId,
        question: input.question,
        answer: input.answer,
      },
    });
    return "recorded";
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "duplicate";
    throw e;
  }
}
