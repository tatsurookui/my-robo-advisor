import { describe, expect, it } from "vitest";
import {
  calculateRiskAssessment,
  classifyRiskScore,
  riskQuizAnswersSchema,
} from "../shared/riskQuiz";

describe("risk quiz scoring", () => {
  it.each([
    [3, "conservative"],
    [4, "conservative"],
    [5, "moderate"],
    [7, "moderate"],
    [8, "aggressive"],
    [9, "aggressive"],
  ] as const)("classifies boundary score %i as %s", (score, profile) => {
    expect(classifyRiskScore(score)).toBe(profile);
  });

  it("scores three answers and classifies the combined result", () => {
    expect(
      calculateRiskAssessment({
        timeHorizon: 2,
        marketDecline: 3,
        growthPriority: 2,
      }),
    ).toEqual({ risk_score: 7, risk_profile: "moderate" });
  });

  it("requires exactly three answers scored from 1 to 3", () => {
    expect(
      riskQuizAnswersSchema.safeParse({
        timeHorizon: 0,
        marketDecline: 2,
        growthPriority: 3,
      }).success,
    ).toBe(false);
    expect(
      riskQuizAnswersSchema.safeParse({
        timeHorizon: 1,
        marketDecline: 2,
      }).success,
    ).toBe(false);
  });

  it("rejects scores outside the quiz's total range", () => {
    expect(() => classifyRiskScore(2)).toThrow(RangeError);
    expect(() => classifyRiskScore(10)).toThrow(RangeError);
  });
});
