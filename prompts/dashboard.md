Read PLAN.md and implement ONLY Feature 7: Dashboard.

Sync with the latest GitHub main, including merged Feature 6, and create a new branch `feature/dashboard` before making changes.

Implement:
1. A dashboard with an asset allocation pie chart using Recharts.
2. Three summary statistics: total portfolio value, number of holdings, and largest holding.
3. Calculate each holding's market value as quantity × price.
4. Group holdings by the four asset classes and calculate their allocation percentages.
5. Ensure all dashboard data belongs to the authenticated user.
6. Handle empty portfolios gracefully.
7. Follow the dashboard design specifications in PLAN.md.

Add unit tests, including the $3,950 total portfolio value example in PLAN.md.

Save this prompt in `prompts/dashboard.md`.

Run the production build and unit tests.

Push the branch and open a PR into main with `closes #15`, assuming the new GitHub Issue is #15.

Do not merge. Stop for my review. Avoid unnecessary Playwright retries.
