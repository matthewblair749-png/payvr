-- AlterTable
ALTER TABLE "SurveyResponse" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_sessionId_question_key" ON "SurveyResponse"("sessionId", "question");

