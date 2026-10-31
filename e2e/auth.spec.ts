import { clerkClient } from "@clerk/express";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
import { pool } from "../server/db";

test("email/password sign-up, verification, login, logout, and account protection", async ({
  page,
}) => {
  const email = `robo-auth+clerk_test_${Date.now()}@example.com`;
  const password = "RoboAdvisor-Test!2026";

  try {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-up");
    await page.waitForSelector(".cl-signUp-root", { state: "attached" });

    const firstName = page.locator('input[name="firstName"]');
    if (await firstName.isVisible()) await firstName.fill("Robo");
    const lastName = page.locator('input[name="lastName"]');
    if (await lastName.isVisible()) await lastName.fill("Test");
    const username = page.locator('input[name="username"]');
    if (await username.isVisible()) {
      await username.fill(`robo${Date.now()}`);
    }
    const phone = page.locator('input[name="phoneNumber"]');
    if (await phone.isVisible()) await phone.fill("+15555550100");
    const legalAcceptance = page.locator('input[name="legalAccepted"]');
    if (await legalAcceptance.isVisible()) await legalAcceptance.check();

    await page.locator('input[name="emailAddress"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    const verificationPrepared = page.waitForResponse(
      (response) =>
        response.url().includes("prepare_verification") && response.status() === 200,
    );
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await verificationPrepared;

    await page
      .getByRole("textbox", { name: "Enter verification code" })
      .pressSequentially("424242");
    await expect(
      page.getByRole("heading", { name: "Welcome to your investing space." }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Your account is ready.");

    const syncResponse = await page.context().request.post(
      new URL("/api/auth/sync", page.url()).toString(),
    );
    expect(syncResponse.status()).toBe(200);
    const syncResult = (await syncResponse.json()) as {
      user: { id: string; email: string };
    };
    expect(syncResult.user.email).toBe(email);

    const persistedAccount = await pool.query(
      "SELECT id, email FROM users WHERE id = $1",
      [syncResult.user.id],
    );
    expect(persistedAccount.rows).toEqual([
      { id: syncResult.user.id, email },
    ]);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
    const signedOutSync = await page.context().request.post(
      new URL("/api/auth/sync", page.url()).toString(),
    );
    expect(signedOutSync.status()).toBe(401);

    await page.goto("/sign-in");
    await page.locator('input[name="identifier"]').fill(email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Welcome to your investing space." }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Your account is ready.");
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
  } finally {
    try {
      const users = await clerkClient.users.getUserList({
        emailAddress: [email],
        limit: 10,
      });
      for (const user of users.data) {
        await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
        await clerkClient.users.deleteUser(user.id);
      }
    } finally {
      await pool.query("DELETE FROM users WHERE email = $1", [email]);
    }
  }
});
