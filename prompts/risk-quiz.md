Read PLAN.md and implement ONLY Feature 8: Risk Tolerance Quiz.

Sync with the latest GitHub main, including merged Feature 7, and create a new branch `feature/risk-quiz` before making changes.

Implement:
1. A three-question risk tolerance quiz covering investment time horizon, reaction to a 20% market decline, and growth versus safety.
2. Three answer choices per question, scored 1–3, with clear and sensible labels.
3. Calculate the total score and classify users as Conservative (3–4), Moderate (5–7), or Aggressive (8–9).
4. Save risk_score and risk_profile to the existing PostgreSQL users table.
5. Allow users to retake the quiz and update their results.
6. Display the user's risk profile clearly.
7. Ensure results are accessible only to the authenticated user.
8. Follow the design specifications in PLAN.md.

Save this prompt in `prompts/risk-quiz.md`.

Run the production build and unit tests, including boundary score tests for 3, 4, 5, 7, 8, and 9.

Push the branch and open a PR into main with `closes #17`, assuming the new GitHub Issue is #17.

Do not merge. Stop for my review. Avoid unnecessary Playwright retries.
