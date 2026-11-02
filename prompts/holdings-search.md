Read PLAN.md and implement ONLY Feature 6: Find things (GitHub Issue #13).

Sync with the latest GitHub main, including the merged Feature 5, and create a new branch `feature/holdings-search` before making changes.

Implement:
- Search holdings by ticker or name (case-insensitive).
- Filter holdings by asset class.
- Sort by market value (highest first), ticker (A–Z), or newest.
- Allow search, filter, and sort to work together.
- Preserve user-level data isolation.

Save this prompt in `prompts/holdings-search.md`.

Run build and unit tests, including tests for search, filtering, and sorting.

Push the branch and open a PR into main with `closes #13`.

Do not merge. Stop for my review. Avoid unnecessary Playwright retries.
