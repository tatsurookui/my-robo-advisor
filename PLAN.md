# PLAN.md — My Robo Advisor

## 1. Pitch

I'm building **My Robo Advisor**, a personal investment portfolio tracker, because my investments are spread across several accounts and I have no single place to see my overall asset allocation or know whether it still matches my risk tolerance. The app records my holdings (stocks, ETFs, bonds, cash), recommends a target allocation based on a 3-question risk quiz, and tells me exactly how much to buy or sell in each asset class to rebalance.

I'll use it **weekly** to update prices and **monthly** to check whether I need to rebalance.

Prices are entered manually. No real-time price API, brokerage linking, or automated trading.

---

## 2. Features (in build order)

### Spine features

1. **Sign up and login** — As a new visitor, I want to create an account with my email and password, log in, and log out, so that my portfolio is private to me.
2. **Data model** — As a user, I want every holding to belong to me and to one asset class (US Stocks, International Stocks, Bonds, Cash), so that my portfolio can be grouped and analyzed by asset class.
3. **CRUD holdings** — As an investor, I want to add a holding with ticker, name, asset class, quantity, price per share, and optional notes; view all my holdings in a list; open one holding's detail page; edit it; and delete it after an "Are you sure?" confirmation, so that my portfolio stays accurate.
4. **Validation** — As an investor, I want to see a friendly message if I leave ticker, name, asset class, quantity, or price blank, or enter a quantity ≤ 0 or a negative price, so that I can't save bad data.
5. **Stars** — As an investor, I want to star holdings I'm watching closely and see them on a "Starred" page, so that I can find my most important positions quickly.
6. **Find things** — As an investor, I want to search holdings by ticker or name, filter by asset class, and sort by market value (highest first), ticker (A–Z), or newest, so that I can find a position quickly.
7. **Dashboard** — As an investor, I want to see a pie chart of my allocation by asset class plus three summary stats (total portfolio value, number of holdings, largest holding), so that I understand my portfolio at a glance.

### My 3 features

8. **Risk tolerance quiz** — As an investor, I want to answer 3 questions (time horizon, reaction to a 20% drop, growth vs. safety), each scored 1–3, so that I get a risk profile: Conservative (3–4), Moderate (5–7), or Aggressive (8–9).
9. **Recommended allocation** — As an investor, I want to see the model allocation for my risk profile next to my current allocation, so that I know what my portfolio should look like.

   | Asset class | Conservative | Moderate | Aggressive |
   |---|---|---|---|
   | US Stocks | 20% | 35% | 55% |
   | International Stocks | 10% | 20% | 30% |
   | Bonds | 55% | 35% | 10% |
   | Cash | 15% | 10% | 5% |

10. **Rebalancing calculator** — As an investor, I want to see, for each asset class, my current %, target %, drift, and a dollar action ("Buy $1,200" / "Sell $800"), so that I know exactly what trades bring me back to target. Formula: `amount = total value × target % − current value of that class`. Classes drifting more than 5 percentage points are highlighted.

---

## 3. Database

| Table | Column | Type | Notes |
|---|---|---|---|
| **users** | id | text | **Primary key**; same as the Clerk user id |
| | email | text | |
| | risk_score | number | 3–9, blank until quiz is taken |
| | risk_profile | text | conservative / moderate / aggressive |
| | created_at | date | |
| **asset_classes** | id | number | **Primary key** |
| | name | text | US Stocks, International Stocks, Bonds, Cash |
| | target_conservative | number | target % |
| | target_moderate | number | target % |
| | target_aggressive | number | target % |
| **assets** (holdings) | id | text (UUID) | **Primary key** |
| | user_id | text (UUID) | → users.id |
| | asset_class_id | number | → asset_classes.id |
| | ticker | text | required, e.g. `VTI` |
| | name | text | required |
| | quantity | number | required, > 0 |
| | price | number | required, ≥ 0, entered manually |
| | notes | text | optional |
| | created_at | date | |
| | updated_at | date | |
| **stars** | user_id | text (UUID) | → users.id |
| | asset_id | text (UUID) | → assets.id |
| | created_at | date | |
| | | | **Primary key** = (user_id, asset_id) |

**Relationships**

- users → assets: **one-to-many** (a user owns many holdings)
- asset_classes → assets: **one-to-many** (an asset class contains many holdings)
- users ↔ assets via **stars**: **many-to-many** junction table (one table for all users)

```
users 1 ──── * assets * ──── 1 asset_classes
  │              │
  1              1
  └── * stars * ─┘
```

Each user sees only their own rows: every server query on assets and stars filters by the logged-in user's id, and the server ignores any user_id sent from the browser.

---

## 4. Tests

**Test 1 — Data isolation**
Given User A has added a holding "VTI" and User B is a separate account with no holdings,
when User B logs in and loads their holdings list,
then User B's list is empty and User A's "VTI" does not appear.

**Test 2 — Dashboard total value**
Given a user holds 10 shares of VTI at $250.00 and 20 shares of BND at $72.50,
when the dashboard calculates total portfolio value,
then it shows **$3,950.00** (10 × 250 + 20 × 72.50).

---

## 5. Technologies

| Choice | Why |
|---|---|
| **Replit Agent** (coding agent) | Builds, runs, and previews the app in the browser with no local setup, and can push branches and open pull requests on GitHub. |
| **GitHub** (code + feature loop) | Stores the code and tracks every Issue, branch, and pull request; main is only changed through merged PRs. |
| **Replit PostgreSQL** (database) | Built into Replit, so the agent can create tables with foreign keys without a separate account. |
| **Clerk Auth via Replit, email + password** (sign up / login) | Visitors create an account owned by my app, not a Replit account, so sign-up works for anyone; on first login the user is saved as a row in my users table. |
| **Replit Deployments** (hosting) | Publishes the app to a live URL from the same workspace with one click after each merge. |
| **React + TypeScript with a Node/Express server** (framework) | Replit Agent's default full-stack setup, so it generates and debugs it reliably. |
| **Tailwind CSS** (styling) | Fast way to get a clean, consistent look without writing CSS files. |
| **Recharts** (charts) | Simple React library for the dashboard pie chart and allocation bar chart. |
| **Zod** (validation) | One validation schema shared by the form and the server, so rules can't drift apart. |
| **Vitest** (tests) | Lightweight test runner that works out of the box with TypeScript. |

---

## 6. Design

- **Style:** calm, clean, trustworthy financial dashboard. Lots of white space, large numbers, soft card shadows, rounded corners.
- **Colors:** white background, dark slate text, indigo accent (#4F46E5); green for "Buy", muted red for "Sell"; one fixed color per asset class across all charts.
- **Font:** Inter, with tabular numbers for dollar amounts.
- **Layout:** left sidebar (Dashboard, Holdings, Starred, Rebalance, Risk Quiz) on desktop; stacked layout on mobile.
- **Inspiration:** **Wealthfront** (simple allocation donut and clean cards) and **Betterment** (plain-English explanation of target allocation).

---

## 7. Risks and cuts

- **Least sure I can build:** the data isolation test. It needs two separate logged-in users and must prove the server filters every query by the logged-in user, which is harder to set up than a simple unit test.
- **Cut first if I run out of time:**
  1. Filter by asset class (keep search + sort).
  2. Rebalancing calculator's dollar amounts → show only drift % per class.
  3. Mobile layout polish.

---

## 8. Plan vs. Reality

PR #22 completed all 10 planned features with 53 tests passing at that milestone; PR #27 later reported 65 passing tests. PR #26 reverted PRs #23 and #24 to the PR #22 baseline without removing the planned features, and PR #27 restored optional labels and decimal-quantity handling. “Done” describes feature implementation only: production Clerk sign-in and republishing reliability remain unresolved and are not claimed as working.

| Planned feature | Shipped / Changed / Cut | Status (Done/Backlogged) | Learning | What changed and why (one line) |
|---|---|---|---|---|
| 1. Sign up and login | Shipped — Clerk email/password sign-up, login, logout, and protected routes (PR #4). | Done | Passing feature tests does not prove production Clerk sign-in is reliable. | No planned auth flow was cut, but production sign-in reliability remains unresolved. |
| 2. Data model | Shipped — Reused users and added owner-linked holdings, asset classes, and stars (PR #6). | Done | Enforce ownership in database relationships and server queries, not browser-supplied IDs. | Feature 2 reused the Feature 1 users table to preserve existing identity records. |
| 3. CRUD holdings | Shipped — User-scoped add, list, detail, edit, and delete flows (PR #8). | Done | Derive the owner ID from the authenticated session for every read and mutation. | All planned CRUD actions shipped with ownership enforced from the signed-in user. |
| 4. Validation | Changed — Client/server validation shipped; Ticker and Name are optional and fractional quantities are preserved (PR #27). | Done | Keep form, API, and database rules aligned; quantity represents shares or units, not dollars. | Labels became optional and decimal quantities were preserved after Preview use exposed these needs; PR #27 restored them after PR #26 reverted PR #24. |
| 5. Stars | Shipped — Persisted star/unstar controls and an owner-scoped Starred page (PR #12). | Done | Persist user-specific star state instead of relying on temporary UI state. | Star state is stored per user and shown on the planned Starred page. |
| 6. Find things | Shipped — Case-insensitive search, asset-class filtering, and three sort options (PR #14). | Done | Combined search, filters, and sorting must remain owner-scoped. | Search, filter, and sort work together; none of the planned controls were cut. |
| 7. Dashboard | Shipped — Allocation chart and three portfolio summaries; Preview showed $1,070 across five holdings. | Done | Reuse quantity × price calculations so totals and allocations stay consistent. | The planned chart and summary stats shipped, and the Preview confirmed them with five saved holdings. |
| 8. Risk tolerance quiz | Shipped — Three scored questions, saved profile, and retakes (PR #18). | Done | Test scores at every profile boundary, not only typical answers. | The quiz stores score and profile on the existing users row, as planned. |
| 9. Recommended allocation | Shipped — Current allocation is compared with the exact risk-profile targets (PR #20). | Done | Validate that target percentages total 100% and keep chart colors consistent. | The app uses the target mixes in Section 2 and handles missing profiles without changing the planned allocation. |
| 10. Rebalancing calculator | Shipped — Owner-scoped drift and dollar Buy/Sell calculations (PR #22). | Done | Test positive, negative, zero adjustments, and the greater-than-five-point drift threshold. | The calculator uses the planned target-value-minus-current-value formula and does not place trades. |
