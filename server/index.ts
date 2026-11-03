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
  listStarredHoldings,
  setHoldingStarred,
  updateHolding,
  type HoldingListFilters,
  type HoldingSort,
} from "./holdingStore";
import { getDashboardSummary } from "./dashboardStore";
import { validateHoldingInput } from "./holdingValidation";
import { calculateRebalancing } from "../shared/rebalancing";
import {
  AccountTransferRequiredError,
  ClerkIdentityMismatchError,
  ensureUserRecord,
  getUserRiskProfile,
  saveUserRiskProfile,
  transferUserRecord,
  UserEmailVerificationRequiredError,
} from "./userStore";
import {
  calculateRiskAssessment,
  riskQuizAnswersSchema,
} from "../shared/riskQuiz";

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

async function loadVerifiedClerkIdentity(authenticatedUserId: string) {
  const clerkUser = await clerkClient.users.getUser(authenticatedUserId);
  const verifiedPrimaryEmail = clerkUser.emailAddresses.find(
    (address) =>
      address.id === clerkUser.primaryEmailAddressId &&
      address.verification?.status === "verified",
  );
  const verifiedEmail =
    verifiedPrimaryEmail?.emailAddress ??
    clerkUser.emailAddresses.find(
      (address) => address.verification?.status === "verified",
    )?.emailAddress ??
    null;

  return { id: clerkUser.id, verifiedEmail };
}

app.post("/api/auth/sync", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  try {
    const account = await ensureUserRecord(
      pool,
      userId,
      loadVerifiedClerkIdentity,
    );
    res.json({ user: account });
  } catch (error) {
    if (error instanceof AccountTransferRequiredError) {
      res.status(409).json({
        code: "ACCOUNT_TRANSFER_REQUIRED",
        error:
          "An account with this verified email has saved data. Review the transfer before continuing.",
      });
      return;
    }

    if (error instanceof UserEmailVerificationRequiredError) {
      res.status(422).json({ error: error.message });
      return;
    }

    if (error instanceof ClerkIdentityMismatchError) {
      console.error("Refused to initialize a mismatched Clerk identity.");
      res.status(403).json({
        error: "Your signed-in account could not be verified. Please sign in again.",
      });
      return;
    }

    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      res.status(409).json({
        code: "ACCOUNT_TRANSFER_REQUIRED",
        error:
          "An account with this verified email has saved data. Review the transfer before continuing.",
      });
      return;
    }

    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
    console.error("Failed to sync the signed-in Clerk user:", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: errorCode,
    });
    res.status(500).json({ error: "Your account could not be saved. Please try again." });
  }
});

function requireSignedInUser(
  req: Request,
  res: Response,
  unauthorizedMessage = "Sign in to manage holdings.",
): string | null {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: unauthorizedMessage });
    return null;
  }
  return userId;
}

app.post("/api/auth/transfer", async (req, res) => {
  const userId = requireSignedInUser(
    req,
    res,
    "Sign in before transferring an existing account.",
  );
  if (!userId) return;

  if (req.body?.confirm !== true) {
    res.status(400).json({ error: "Confirm the account transfer to continue." });
    return;
  }

  try {
    const identity = await loadVerifiedClerkIdentity(userId);
    if (identity.id !== userId) {
      throw new ClerkIdentityMismatchError();
    }
    if (!identity.verifiedEmail) {
      throw new UserEmailVerificationRequiredError();
    }

    const account = await transferUserRecord(
      pool,
      userId,
      identity.verifiedEmail,
    );
    res.json({ user: account });
  } catch (error) {
    if (error instanceof UserEmailVerificationRequiredError) {
      res.status(422).json({ error: error.message });
      return;
    }

    if (error instanceof ClerkIdentityMismatchError) {
      res.status(403).json({
        error: "Your signed-in account could not be verified. Please sign in again.",
      });
      return;
    }

    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
    console.error("Failed to transfer a verified Clerk account:", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: errorCode,
    });
    res.status(500).json({
      error: "The existing account could not be transferred. No data was changed.",
    });
  }
});

app.get("/api/risk-profile", async (req, res) => {
  const userId = requireSignedInUser(
    req,
    res,
    "Sign in to view your risk profile.",
  );
  if (!userId) return;

  try {
    const riskProfile = await getUserRiskProfile(pool, userId);
    if (!riskProfile) {
      res.status(404).json({ error: "Your account could not be found." });
      return;
    }
    res.json({ riskProfile });
  } catch (error) {
    console.error("Failed to load the signed-in user's risk profile:", error);
    res.status(500).json({ error: "Your risk profile could not be loaded." });
  }
});

app.put("/api/risk-profile", async (req, res) => {
  const userId = requireSignedInUser(
    req,
    res,
    "Sign in to save your risk profile.",
  );
  if (!userId) return;

  const parsedAnswers = riskQuizAnswersSchema.safeParse(req.body);
  if (!parsedAnswers.success) {
    res.status(400).json({
      error: "Choose one answer for each of the three questions.",
    });
    return;
  }

  try {
    const assessment = calculateRiskAssessment(parsedAnswers.data);
    const riskProfile = await saveUserRiskProfile(pool, userId, assessment);
    if (!riskProfile) {
      res.status(404).json({ error: "Your account could not be found." });
      return;
    }
    res.json({ riskProfile });
  } catch (error) {
    console.error("Failed to save the signed-in user's risk profile:", error);
    res.status(500).json({ error: "Your risk profile could not be saved." });
  }
});

const HOLDING_SORTS = new Set<HoldingSort>([
  "market-value",
  "ticker",
  "newest",
]);

function parseHoldingListFilters(
  query: Request["query"],
): HoldingListFilters | null {
  let search: string | undefined;
  if (query.search !== undefined) {
    if (typeof query.search !== "string" || query.search.length > 100) {
      return null;
    }
    search = query.search.trim();
  }

  let assetClassId: number | undefined;
  if (query.assetClassId !== undefined && query.assetClassId !== "") {
    if (typeof query.assetClassId !== "string") return null;
    assetClassId = Number(query.assetClassId);
    if (!Number.isSafeInteger(assetClassId) || assetClassId < 1) return null;
  }

  let sort: HoldingSort = "newest";
  if (query.sort !== undefined) {
    if (typeof query.sort !== "string" || !HOLDING_SORTS.has(query.sort as HoldingSort)) {
      return null;
    }
    sort = query.sort as HoldingSort;
  }

  return { search, assetClassId, sort };
}

function respondToHoldingError(res: Response, error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const constraint =
    typeof error === "object" && error !== null && "constraint" in error
      ? String(error.constraint)
      : "";
  if (code === "23503" && constraint.includes("asset_class_id")) {
    const message = "Select an available asset class.";
    res.status(400).json({
      error: message,
      fieldErrors: { asset_class_id: message },
    });
    return;
  }
  if (["22P02", "22003", "23502", "23514"].includes(code)) {
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

app.get("/api/dashboard", async (req, res) => {
  const userId = requireSignedInUser(req, res);
  if (!userId) return;

  try {
    res.json({ dashboard: await getDashboardSummary(pool, userId) });
  } catch (error) {
    respondToHoldingError(res, error);
  }
});

app.get("/api/rebalancing", async (req, res) => {
  const userId = requireSignedInUser(
    req,
    res,
    "Sign in to view your rebalance plan.",
  );
  if (!userId) return;

  try {
    const dashboard = await getDashboardSummary(pool, userId);
    res.json({ rebalancing: calculateRebalancing(dashboard) });
  } catch (error) {
    console.error("Failed to calculate the signed-in user's rebalance plan:", error);
    res.status(500).json({ error: "Your rebalance plan could not be loaded." });
  }
});

app.get("/api/holdings", async (req, res) => {
  const userId = requireSignedInUser(req, res);
  if (!userId) return;
  const filters = parseHoldingListFilters(req.query);
  if (!filters) {
    res.status(400).json({ error: "Search, asset class, or sort option is invalid." });
    return;
  }

  try {
    res.json({ holdings: await listHoldings(pool, userId, filters) });
  } catch (error) {
    respondToHoldingError(res, error);
  }
});

app.get("/api/holdings/starred", async (req, res) => {
  const userId = requireSignedInUser(req, res);
  if (!userId) return;
  const filters = parseHoldingListFilters(req.query);
  if (!filters) {
    res.status(400).json({ error: "Search, asset class, or sort option is invalid." });
    return;
  }

  try {
    res.json({ holdings: await listStarredHoldings(pool, userId, filters) });
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
  const validation = validateHoldingInput(req.body);
  if (!validation.success) {
    res.status(400).json({
      error: "Correct the highlighted holding fields.",
      fieldErrors: validation.fieldErrors,
    });
    return;
  }

  try {
    const holding = await createHolding(pool, userId, validation.input);
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
  const validation = validateHoldingInput(req.body);
  if (!validation.success) {
    res.status(400).json({
      error: "Correct the highlighted holding fields.",
      fieldErrors: validation.fieldErrors,
    });
    return;
  }

  try {
    const holding = await updateHolding(
      pool,
      userId,
      req.params.id,
      validation.input,
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

app.put("/api/holdings/:id/star", async (req, res) => {
  const userId = requireSignedInUser(req, res);
  if (!userId) return;
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(404).json({ error: "Holding not found." });
    return;
  }

  try {
    const updated = await setHoldingStarred(
      pool,
      userId,
      req.params.id,
      true,
    );
    if (!updated) {
      res.status(404).json({ error: "Holding not found." });
      return;
    }
    res.json({ is_starred: true });
  } catch (error) {
    respondToHoldingError(res, error);
  }
});

app.delete("/api/holdings/:id/star", async (req, res) => {
  const userId = requireSignedInUser(req, res);
  if (!userId) return;
  if (!UUID_PATTERN.test(req.params.id)) {
    res.status(404).json({ error: "Holding not found." });
    return;
  }

  try {
    const updated = await setHoldingStarred(
      pool,
      userId,
      req.params.id,
      false,
    );
    if (!updated) {
      res.status(404).json({ error: "Holding not found." });
      return;
    }
    res.json({ is_starred: false });
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
