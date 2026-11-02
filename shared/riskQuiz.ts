import { z } from "zod";

const scoreChoiceSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

export const riskQuizAnswersSchema = z.object({
  timeHorizon: scoreChoiceSchema,
  marketDecline: scoreChoiceSchema,
  growthPriority: scoreChoiceSchema,
});

export type RiskQuizAnswers = z.infer<typeof riskQuizAnswersSchema>;
export type RiskQuizQuestionId = keyof RiskQuizAnswers;
export type RiskProfile = "conservative" | "moderate" | "aggressive";

export const riskProfileSchema = z.enum([
  "conservative",
  "moderate",
  "aggressive",
]);

export const riskQuizQuestions = [
  {
    id: "timeHorizon",
    title: "When do you expect to need this money?",
    options: [
      {
        score: 1,
        label: "Within 5 years",
        detail: "I may need access to this money relatively soon.",
      },
      {
        score: 2,
        label: "In 5–10 years",
        detail: "I have some time to ride out market changes.",
      },
      {
        score: 3,
        label: "More than 10 years",
        detail: "I can leave this money invested for the long term.",
      },
    ],
  },
  {
    id: "marketDecline",
    title: "If your investments fell 20%, what would you most likely do?",
    options: [
      {
        score: 1,
        label: "Sell to limit further losses",
        detail: "Protecting what remains would be my priority.",
      },
      {
        score: 2,
        label: "Hold and wait for recovery",
        detail: "I would stay invested but avoid adding more.",
      },
      {
        score: 3,
        label: "Invest more at lower prices",
        detail: "I could accept the decline as part of long-term growth.",
      },
    ],
  },
  {
    id: "growthPriority",
    title: "Which best describes your preference for growth and safety?",
    options: [
      {
        score: 1,
        label: "Prioritize stability",
        detail: "I prefer smaller swings, even with slower growth.",
      },
      {
        score: 2,
        label: "Balance growth and stability",
        detail: "I want a mix of growth potential and protection.",
      },
      {
        score: 3,
        label: "Prioritize long-term growth",
        detail: "I accept larger ups and downs for more growth potential.",
      },
    ],
  },
] as const;

export function classifyRiskScore(score: number): RiskProfile {
  if (!Number.isInteger(score) || score < 3 || score > 9) {
    throw new RangeError("A risk score must be an integer from 3 to 9.");
  }
  if (score <= 4) return "conservative";
  if (score <= 7) return "moderate";
  return "aggressive";
}

export function calculateRiskAssessment(answers: unknown): {
  risk_score: number;
  risk_profile: RiskProfile;
} {
  const parsed = riskQuizAnswersSchema.parse(answers);
  const risk_score =
    parsed.timeHorizon + parsed.marketDecline + parsed.growthPriority;

  return {
    risk_score,
    risk_profile: classifyRiskScore(risk_score),
  };
}
