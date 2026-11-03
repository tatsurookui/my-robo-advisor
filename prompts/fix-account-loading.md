Please investigate and fix the account loading error in My Robo Advisor.

**Current problem:**

I can successfully log in through Clerk and access the application, but when I try to manage my holdings, the application displays:

"Your account could not be loaded. Try again before managing your holdings."

Clicking "Try again" does not resolve the issue.

**Required actions:**

1. Investigate the root cause using application logs, server responses, and database queries. Do not assume the cause without verifying it.
2. Check whether the authenticated Clerk user is correctly created or synchronized in the PostgreSQL users table.
3. Verify that the Clerk user ID matches the database user ID.
4. Check the authentication middleware, user initialization endpoint, database connection, and relevant environment variables.
5. If the user record is missing, implement a safe and idempotent initialization process that creates it automatically after authentication.
6. Ensure existing users are not duplicated or overwritten.
7. Fix the issue so that a signed-in user can access Holdings, Dashboard, Starred, Risk Quiz, and Rebalance.
8. Preserve user-level data isolation and do not weaken authentication or authorization.
9. Add regression tests covering first-time login, returning users, and account initialization failures.
10. Run the production build and all unit tests.

**Verification:**

- A new user can sign up and access Holdings.
- An existing user can log in and access Holdings.
- A user can add a holding and see it in their portfolio.
- No "Your account could not be loaded" error appears during normal authenticated use.
- User A cannot access User B's holdings.

**GitHub workflow:**

- Sync with the latest main branch.
- Create a new branch named `fix/account-loading`.
- Save this prompt in `prompts/fix-account-loading.md`.
- Commit and push the changes.
- Open a Pull Request into main.
- Do not merge automatically.

**Important:** This is an assignment with a deadline. Prioritize the smallest reliable fix. Do not add unrelated features, change hosting plans, or perform unnecessary Playwright retries.

Explain the root cause, the fix, and the test results in your final response.
