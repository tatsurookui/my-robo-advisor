Read PLAN.md and implement ONLY Feature 9: Recommended Allocation.

Sync with the latest GitHub main, including merged Feature 8, and create a new branch `feature/recommended-allocation` before making changes.

Implement:
1. Retrieve the authenticated user's saved risk profile.
2. Calculate current portfolio allocation percentages by asset class using quantity × price.
3. Display current allocation and recommended allocation side by side, using Recharts where appropriate.
4. Use the exact Conservative, Moderate, and Aggressive target allocations from PLAN.md.
5. Maintain consistent asset-class colors across all charts.
6. Handle users without a risk profile or holdings gracefully.
7. Preserve user-level data isolation.
8. Follow the existing dashboard design.

Save this prompt in `prompts/recommended-allocation.md`.

Run the production build and unit tests, including checks that all target allocations sum to 100%.

Push the branch and open a PR into main with `closes #19`, assuming the new GitHub Issue is #19.

Do not merge. Stop for my review. Avoid unnecessary Playwright retries.
