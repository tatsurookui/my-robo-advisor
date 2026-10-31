import express, { type Request, type Response } from "express";
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
import {
  createHolding,
  deleteHolding,
  getHolding,
  listAssetClasses,
  listHoldings,
  updateHolding,
  type HoldingInput,
} from "./holdingStore";
import { upsertUserRecord } from "./userStore";

const app = express();
const port = Number(process.env.PORT ?? 5000);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function requireSignedInUser(req: Request, res: Response): string | null {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to manage holdings." });
    return null;
  }
  return userId;
}

function parseHoldingInput(body: unknown): HoldingInput | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }

  const values = body as Record<string, unknown>;
  const ticker = typeof values.ticker === "string" ? values.ticker.trim() : "";
  const name = typeof values.name === "string" ? values.name.trim() : "";
  const assetClassId = Number(values.asset_class_id);
  const parseDecimal = (value: unknown): string | null => {
    const decimal =
      typeof value === "string"
        ? value.trim()
        : typeof value === "number" && Number.isFinite(value)
          ? String(value)
          : "";

    if (!/^\d+(?:\.\d+)?$/.test(decimal) || !Number.isFinite(Number(decimal))) {
      return null;
    }
    return decimal;
  };
  const quantity = parseDecimal(values.quantity);
  const price = parseDecimal(values.price);
  const notes =
    values.notes === undefined || values.notes === null
      ? null
      : typeof values.notes === "string"
        ? values.notes.trim() || null
        : undefined;

  if (
    !ticker ||
    !name ||
    !Number.isSafeInteger(assetClassId) ||
    assetClassId < 1 ||
    quantity === null ||
    Number(quantity) <= 0 ||
    price === null ||
    Number(price) < 0 ||
    notes === undefined
  ) {
    return null;
  }

  return {
    ticker,
    name,
    assetClassId,
    quantity,
    price,
    notes,
  };
}

function respondToHoldingError(res: Response, error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (["22P02", "22003", "23502", "23503", "23514"].includes(code)) {
    res.status(400).json({ error: "Check the holding details and asset class." });
    return;
  }

  console.error("Holding request failed:", error);
  res.status(500).json({ error: "We couldn’t complete that holding request." });
}

app.get("/api/asset-classes", async (req, res) => {
  if (!requireSignedInUser(req, res)) return;

  try {
    res.json({ assetClasses: await listAssetClasses(pool) });
  } catch (error) {
    respondToHoldingError(res, error);
  }
});

app.get("/api/holdings", async (req, res) => {
  const userId = requireSignedInUser(req, res);
  if (!userId) return;

  try {
    res.json({ holdings: await listHoldings(pool, userId) });
  } catch (error) {
    respondToHoldingError(res, error);
  }
});

app.get("/api/holdings/:id", async (req, res) => {
  const userId = requireSignedInUser(req, res);
  if (!userId) return;
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(404).json({ error: "Holding not found." });
    return;
  }

  try {
    const holding = await getHolding(pool, userId, req.params.id);
    if (!holding) {
      res.status(404).json({ error: "Holding not found." });
      return;
    }
    res.json({ holding });
  } catch (error) {
    respondToHoldingError(res, error);
  }
});

app.post("/api/holdings", async (req, res) => {
  const userId = requireSignedInUser(req, res);
  if (!userId) return;
  const holdingInput = parseHoldingInput(req.body);
  if (!holdingInput) {
    res.status(400).json({ error: "Check the holding details and asset class." });
    return;
  }

  try {
    const holding = await createHolding(pool, userId, holdingInput);
    res.status(201).json({ holding });
  } catch (error) {
    respondToHoldingError(res, error);
  }
});

app.put("/api/holdings/:id", async (req, res) => {
  const userId = requireSignedInUser(req, res);
  if (!userId) return;
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(404).json({ error: "Holding not found." });
    return;
  }
  const holdingInput = parseHoldingInput(req.body);
  if (!holdingInput) {
    res.status(400).json({ error: "Check the holding details and asset class." });
    return;
  }

  try {
    const holding = await updateHolding(
      pool,
      userId,
      req.params.id,
      holdingInput,
    );
    if (!holding) {
      res.status(404).json({ error: "Holding not found." });
      return;
    }
    res.json({ holding });
  } catch (error) {
    respondToHoldingError(res, error);
  }
});

app.delete("/api/holdings/:id", async (req, res) => {
  const userId = requireSignedInUser(req, res);
  if (!userId) return;
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(404).json({ error: "Holding not found." });
    return;
  }

  try {
    const deleted = await deleteHolding(pool, userId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Holding not found." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    respondToHoldingError(res, error);
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
