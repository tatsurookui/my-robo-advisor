import { useEffect, useState, type FormEvent } from "react";
import {
  calculateRiskAssessment,
  riskQuizAnswersSchema,
  riskQuizQuestions,
  type RiskProfile,
  type RiskQuizAnswers,
  type RiskQuizQuestionId,
} from "../../shared/riskQuiz";

interface SavedRiskProfile {
  risk_score: number | null;
  risk_profile: RiskProfile | null;
}

interface RiskProfileResponse {
  riskProfile?: SavedRiskProfile;
  error?: string;
}

const profileLabels: Record<RiskProfile, string> = {
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
};

const profileDescriptions: Record<RiskProfile, string> = {
  conservative:
    "Your answers suggest a preference for stability and limiting losses, even if that means slower growth.",
  moderate:
    "Your answers suggest balancing long-term growth with protection from larger market swings.",
  aggressive:
    "Your answers suggest prioritizing long-term growth and being comfortable with larger market swings.",
};

async function requestRiskProfile(
  method: "GET" | "PUT",
  body?: RiskQuizAnswers,
): Promise<SavedRiskProfile> {
  const response = await fetch("/api/risk-profile", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = (await response.json().catch(() => null)) as
    | RiskProfileResponse
    | null;

  if (!response.ok || !result?.riskProfile) {
    throw new Error(result?.error ?? "Your risk profile could not be loaded.");
  }
  return result.riskProfile;
}

export default function RiskQuizPage() {
  const [savedProfile, setSavedProfile] = useState<SavedRiskProfile | null>(
    null,
  );
  const [answers, setAnswers] = useState<
    Partial<Record<RiskQuizQuestionId, 1 | 2 | 3>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    requestRiskProfile("GET")
      .then((profile) => {
        if (!cancelled) setSavedProfile(profile);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Your risk profile could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reload]);

  const hasSavedAssessment =
    savedProfile?.risk_score !== null &&
    savedProfile?.risk_score !== undefined &&
    savedProfile.risk_profile !== null;
  const isShowingResult = hasSavedAssessment && !isEditing;
  const hasAnsweredEverything = riskQuizQuestions.every(
    (question) => answers[question.id] !== undefined,
  );

  function updateAnswer(questionId: RiskQuizQuestionId, value: 1 | 2 | 3) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setError("");
  }

  function startRetake() {
    setAnswers({});
    setIsEditing(true);
    setError("");
  }

  function cancelRetake() {
    setIsEditing(false);
    setAnswers({});
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const validation = riskQuizAnswersSchema.safeParse(answers);
    if (!validation.success) {
      setError("Choose one answer for each of the three questions.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const assessment = calculateRiskAssessment(validation.data);
      const saved = await requestRiskProfile("PUT", validation.data);
      if (
        saved.risk_score !== assessment.risk_score ||
        saved.risk_profile !== assessment.risk_profile
      ) {
        throw new Error("Your saved result did not match your answers.");
      }
      setSavedProfile(saved);
      setIsEditing(false);
      setAnswers({});
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Your risk profile could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="holdings-content risk-quiz-content">
      <div className="holdings-page-heading">
        <div>
          <div className="eyebrow">PERSONALIZED PLAN</div>
          <h1>Risk tolerance quiz</h1>
          <p>
            Answer three questions to find a risk profile that reflects how you
            invest.
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="holdings-message">Loading your risk profile…</p>
      )}

      {!isLoading && error && (
        <div className="holdings-alert" role="alert">
          <span>{error}</span>
          {!savedProfile && (
            <button
              className="text-button"
              onClick={() => setReload((attempt) => attempt + 1)}
              type="button"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && isShowingResult && savedProfile.risk_profile && (
        <article className="risk-result-card">
          <div className="risk-result-card__icon" aria-hidden="true">
            ◈
          </div>
          <div className="risk-result-card__content">
            <div className="eyebrow">YOUR RISK PROFILE</div>
            <h2>{profileLabels[savedProfile.risk_profile]}</h2>
            <p>{profileDescriptions[savedProfile.risk_profile]}</p>
            <span className="risk-result-card__score">
              Score {savedProfile.risk_score} of 9
            </span>
          </div>
          <button className="button button--quiet" onClick={startRetake} type="button">
            Retake quiz
          </button>
        </article>
      )}

      {!isLoading && !isShowingResult && (
        <form className="risk-quiz-form" onSubmit={handleSubmit}>
          <div className="risk-quiz-form__intro">
            <h2>{hasSavedAssessment ? "Retake your quiz" : "About you as an investor"}</h2>
            <p>
              There are no right or wrong answers. Your result is private to
              your account.
            </p>
          </div>

          {riskQuizQuestions.map((question, questionIndex) => (
            <fieldset className="risk-question" key={question.id}>
              <legend>
                <span className="risk-question__number">
                  QUESTION {questionIndex + 1} OF {riskQuizQuestions.length}
                </span>
                <span className="risk-question__title">{question.title}</span>
              </legend>
              <div className="risk-question__options">
                {question.options.map((option) => {
                  const inputId = `${question.id}-${option.score}`;
                  const isSelected = answers[question.id] === option.score;

                  return (
                    <label
                      className={`risk-option${isSelected ? " risk-option--selected" : ""}`}
                      htmlFor={inputId}
                      key={option.score}
                    >
                      <input
                        checked={isSelected}
                        id={inputId}
                        name={question.id}
                        onChange={() =>
                          updateAnswer(question.id, option.score)
                        }
                        type="radio"
                        value={option.score}
                      />
                      <span className="risk-option__copy">
                        <strong>{option.label}</strong>
                        <small>{option.detail}</small>
                      </span>
                      <span className="risk-option__mark" aria-hidden="true">
                        {isSelected ? "✓" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="risk-quiz-form__actions">
            {hasSavedAssessment && (
              <button
                className="button button--quiet"
                onClick={cancelRetake}
                type="button"
              >
                Cancel
              </button>
            )}
            <button
              className="button"
              disabled={!hasAnsweredEverything || isSaving}
              type="submit"
            >
              {isSaving ? "Saving your result…" : "See my risk profile"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
