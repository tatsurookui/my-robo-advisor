import express from "express";
import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { createServer as createViteServer } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { pool } from "./db";
import { upsertUserRecord } from "./userStore";

const app = express();
const port = Number(process.env.PORT ?? 5000);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(express.json());
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/sync", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const verifiedPrimaryEmail = clerkUser.emailAddresses.find(
      (address) =>
        address.id === clerkUser.primaryEmailAddressId &&
        address.verification?.status === "verified",
    );
    const email =
      verifiedPrimaryEmail?.emailAddress ??
      clerkUser.emailAddresses.find((address) => address.verification?.status === "verified")
        ?.emailAddress;

    if (!email) {
      res.status(422).json({ error: "Verify an email address to finish setting up your account." });
      return;
    }

    const account = await upsertUserRecord(pool, { id: userId, email });
    res.json({ user: account });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      res.status(409).json({ error: "This email is already linked to another account." });
      return;
    }

    console.error("Failed to sync the signed-in Clerk user:", error);
    res.status(500).json({ error: "Your account could not be saved. Please try again." });
  }
});

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  const publicDirectory = resolve(process.cwd(), "dist/public");
  app.use(express.static(publicDirectory));
  app.get(/.*/, (_req, res) => {
    res.sendFile(resolve(publicDirectory, "index.html"));
  });
  app.listen(port, "0.0.0.0", () => {
    console.log(`Application server listening on port ${port}`);
  });
} else {
  const currentFile = fileURLToPath(import.meta.url);
  const projectRoot = resolve(currentFile, "../..");

  const start = async () => {
    const vite = await createViteServer({
      configFile: resolve(projectRoot, "vite.config.ts"),
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api/")) {
        next();
        return;
      }

      try {
        const html = await vite.transformIndexHtml(
          req.originalUrl,
          await import("node:fs/promises").then(({ readFile }) =>
            readFile(resolve(projectRoot, "index.html"), "utf-8"),
          ),
        );
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    });

    app.listen(port, "0.0.0.0", () => {
      console.log(`API server listening on port ${port}`);
    });
  };

  void start();
}
