import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

setup.describe.configure({ mode: "serial" });

setup("prepare Clerk development testing token", async () => {
  await clerkSetup();
});
