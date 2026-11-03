Please comprehensively fix and simplify the Add Holding and Edit Holding forms in My Robo Advisor.

The current user experience is unacceptable. The form requires too much manual input, the numeric fields behave incorrectly, and users cannot easily add investments.

This is an urgent usability and reliability fix for my Coding for Managers assignment. Prioritize a simple, fully functional application over unnecessary complexity.

## 1. Simplify the form

The form should contain the following fields:

**Required fields:**
- Asset class
- Quantity
- Price per share (USD)

**Optional fields:**
- Ticker
- Name

Remove the Notes field from the main form.

Ticker and Name must BOTH be optional.

Users must be able to save a holding without entering either Ticker or Name.

Do not automatically require a ticker or a company name.

If both Ticker and Name are blank, display a sensible fallback name such as "Unnamed holding" in the Holdings list, Dashboard, and other relevant views.

If only Ticker is provided, use Ticker as the display name.

If only Name is provided, use Name as the display name.

If both are provided, preserve and display both appropriately.

Do not introduce external stock-price APIs or paid services.

Ensure the existing PostgreSQL schema supports optional Ticker and Name values. If the current database has NOT NULL constraints on these fields, implement a safe database migration without losing existing data.

Maintain backward compatibility with existing holdings.

## 2. Fix the numeric input bugs

The current Quantity field behaves incorrectly and can display strange values such as 1.00000001.

Fix the underlying cause rather than merely hiding the display problem.

Requirements:

- Users can manually type quantities and prices.
- Accept quantities such as 1, 10, 10.5, 0.25, and 0.0001.
- Never automatically change a quantity from 1 to 1.00000001.
- Do not unexpectedly increment or decrement values.
- Remove browser number spinner controls.
- Allow users to clear a field and type a replacement without interference.
- Preserve the exact entered quantity within the application's supported precision.
- Quantity must be greater than zero.
- Price must be zero or greater.
- Accept prices such as 250, 72.50, 0.99, and 0.
- Display USD prices with two decimal places in portfolio summaries.
- Avoid floating-point precision errors in market-value calculations.
- Use appropriate decimal handling for quantities and prices.
- Ensure frontend and backend validation rules are consistent.

Do not use a minimum input step that creates strange floating-point values.

## 3. Improve the form layout

Create a clean, compact, intuitive form.

Recommended field order:

1. Asset class (required)
2. Quantity (required)
3. Price per share in USD (required)
4. Ticker (optional)
5. Name (optional)

Use clear labels and example placeholders.

Examples:
- Quantity: 10
- Price per share: 250.00
- Ticker: VTI (optional)
- Name: Vanguard Total Stock Market ETF (optional)

Do not show validation errors immediately when the form first loads.

Show errors only after the user attempts to submit or interacts with the relevant field.

Make error messages clear and understandable.

Keep all entered values if saving fails.

Display a clear success confirmation after saving.

After a successful save, navigate back to the Holdings list.

Apply the same usability improvements to the Edit Holding form.

## 4. Add an estimated market value

Display an automatically calculated estimated market value below the numeric fields.

Formula:

Estimated Market Value = Quantity × Price per Share

Examples:
- Quantity 10 × Price $250 = $2,500.00
- Quantity 20 × Price $72.50 = $1,450.00

Update the estimated value as the user edits the fields.

Do not modify the quantity or price values while calculating the estimate.

If either numeric field is empty or invalid, show a neutral placeholder instead of an incorrect value.

## 5. Fix database and backend compatibility

Review the existing database schema, validation rules, API endpoints, and frontend components.

Ensure that:

- Ticker is nullable or otherwise safely optional.
- Name is nullable or otherwise safely optional.
- The backend accepts holdings without Ticker or Name.
- Existing holdings remain intact.
- All portfolio calculations work for unnamed holdings.
- Search, sorting, filtering, starring, editing, deleting, Dashboard, and Rebalancing continue working.
- Missing Ticker or Name values never cause runtime errors.
- No authentication or user-level data isolation protections are weakened.

Use safe database migrations where necessary.

Do not delete or reset the database.

## 6. Test the complete workflow

Add or update automated tests for the following scenarios:

Test A:
- Asset class: US Stocks
- Quantity: 10
- Price: 250
- Ticker: blank
- Name: blank
- Expected: Holding saves successfully with a fallback display name and market value $2,500.

Test B:
- Asset class: Bonds
- Quantity: 20
- Price: 72.50
- Ticker: BND
- Name: blank
- Expected: Holding saves successfully and market value is $1,450.

Test C:
- Combine Test A and Test B.
- Expected Dashboard total: $3,950.

Test D:
- Quantity: 0.25
- Price: 100
- Expected market value: $25.00.
- Quantity remains exactly 0.25.

Test E:
- Quantity: 1
- Expected: The input remains 1, not 1.00000001.

Test F:
- Empty Quantity, zero Quantity, negative Quantity, and negative Price must produce appropriate validation errors.

Test G:
- Edit an existing holding and save changes successfully.

Test H:
- Search, Dashboard, Starred, and Rebalancing must not crash when Ticker and Name are missing.

Test I:
- User A cannot access User B's holdings.

Test J:
- Existing holdings with Ticker and Name must continue working normally.

## 7. GitHub workflow

1. Sync with the latest GitHub main, including the account-loading fix if it has already been merged.
2. Create a new branch named `fix/holding-form-usability`.
3. Implement only the changes described in this prompt.
4. Save this exact prompt in `prompts/holding-form-usability.md`.
5. Run the production build and all unit tests.
6. Add regression tests for optional Ticker/Name, numeric precision, form validation, and saving holdings.
7. Push the branch and open a Pull Request into main.
8. Do not merge automatically.

## 8. Important restrictions

- Do not add paid services.
- Do not add external stock-price APIs.
- Do not introduce unnecessary dependencies.
- Do not change unrelated application features.
- Do not delete existing data.
- Do not weaken authentication or authorization.
- Avoid unnecessary Playwright retries.
- Prioritize completing this assignment reliably.

## 9. Final verification

Before finishing, verify that a user can:

1. Log in successfully.
2. Open Add Holding.
3. Enter only Asset Class, Quantity, and Price.
4. Save the holding without entering Ticker or Name.
5. See the holding in the Holdings list.
6. See the correct value on Dashboard.
7. Edit and delete the holding.
8. Use the Risk Quiz and Rebalancing features without errors.

Run all unit tests and the production build.

If a real authenticated browser session cannot be tested, explicitly state that limitation rather than claiming the application has been fully verified.

In your final response, explain:
- The root cause of the numeric input bug.
- The changes made to the form.
- Any database migration performed.
- The number of tests passed.
- Whether authenticated browser testing succeeded.
- The GitHub Pull Request URL.

Do not merge the PR. Stop for my review.
