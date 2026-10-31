# My Robo Advisor

## Run in Replit

Install the project dependencies with `npm install`, then start the app with
`npm run dev`. The web app and API are served on port 5000.

The app uses Replit-managed PostgreSQL through `DATABASE_URL` and Clerk Auth
through the Replit-provisioned Clerk keys. Feature 1 owns the existing `users`
table. The additive holdings, asset-class, and stars schema is recorded in
`server/schema.sql`; it references `users` without recreating or changing it.
