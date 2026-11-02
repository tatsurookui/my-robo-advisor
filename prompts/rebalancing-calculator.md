Read PLAN.md and implement ONLY Feature 10: Rebalancing Calculator.

Sync with the latest GitHub main, including merged Feature 9, and create a new branch `feature/rebalancing-calculator` before making changes.

Implement:
1. Retrieve the authenticated user's risk profile and holdings.
2. Calculate current portfolio allocation and compare it with target allocation from PLAN.md.
3. Show a table with asset class, current %, target %, drift in percentage points, and dollar adjustment.
4. Calculate dollar adjustment as:
   Total Portfolio Value × Target Allocation − Current Asset Class Value.
5. Display Buy for positive adjustments and Sell for negative adjustments.
6. Highlight absolute allocation drift greater than 5 percentage points.
7. Handle empty portfolios and missing risk profiles.
8. Preserve user-level data isolation.
9. Follow the existing app design.
10. Do not implement real trading.

Save this prompt in `prompts/rebalancing-calculator.md`.

Run the production build and unit tests, including calculations for Buy, Sell, and zero adjustment.

Push the branch and open a PR into main with `closes #21`, assuming the new GitHub Issue is #21.

Do not merge. Stop for my review. Avoid unnecessary Playwright retries.
