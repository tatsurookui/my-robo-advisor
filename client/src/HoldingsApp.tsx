import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useClerk, useUser } from "@clerk/react";
import { Link, useLocation } from "wouter";
import {
  getHoldingFieldErrors,
  holdingInputSchema,
  type HoldingFieldErrors,
  type HoldingFieldName,
} from "../../shared/holdingValidation";

interface AssetClass {
  id: number;
  name: string;
}

interface Holding {
  id: string;
  asset_class_id: number;
  asset_class_name: string;
  ticker: string;
  name: string;
  quantity: string;
  price: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface HoldingFormValues {
  ticker: string;
  name: string;
  asset_class_id: string;
  quantity: string;
  price: string;
  notes: string;
}

const emptyForm: HoldingFormValues = {
  ticker: "",
  name: "",
  asset_class_id: "",
  quantity: "",
  price: "",
  notes: "",
};

interface ApiErrorResponse {
  error?: string;
  fieldErrors?: HoldingFieldErrors;
}

class ApiResponseError extends Error {
  fieldErrors?: HoldingFieldErrors;

  constructor(message: string, fieldErrors?: HoldingFieldErrors) {
    super(message);
    this.name = "ApiResponseError";
    this.fieldErrors = fieldErrors;
  }
}

async function requestJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options);
  const result = (
    response.status === 204
      ? undefined
      : await response.json().catch(() => null)
  ) as ApiErrorResponse | null | undefined;

  if (!response.ok) {
    throw new ApiResponseError(
      result?.error ?? "The request could not be completed.",
      result?.fieldErrors,
    );
  }
  return result as T;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <small className="form-field__error" id={id} role="alert">
      {message}
    </small>
  ) : null;
}

function formatQuantity(quantity: string) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(
    Number(quantity),
  );
}

function formatPrice(price: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(price));
}

function BrandLink() {
  return (
    <Link href="/" className="brand">
      <img src="/logo.svg" alt="" className="brand__icon" />
      <span>My Robo Advisor</span>
    </Link>
  );
}

function HoldingsLayout({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <main className="holdings-app">
      <header className="topbar holdings-topbar">
        <BrandLink />
        <nav className="holdings-nav" aria-label="Portfolio">
          <Link href="/holdings" className="holdings-nav__link">
            Holdings
          </Link>
          <Link href="/holdings/new" className="button button--small">
            Add holding
          </Link>
          <span className="holdings-nav__email">
            {user?.primaryEmailAddress?.emailAddress}
          </span>
          <button
            className="button button--quiet holdings-nav__logout"
            onClick={() => signOut({ redirectUrl: "/" })}
            type="button"
          >
            Log out
          </button>
        </nav>
      </header>
      {children}
    </main>
  );
}

function HoldingsListPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");
    requestJson<{ holdings: Holding[] }>("/api/holdings")
      .then(({ holdings: result }) => {
        if (!cancelled) setHoldings(result);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Your holdings could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reload]);

  return (
    <section className="holdings-content">
      <div className="holdings-page-heading">
        <div>
          <div className="eyebrow">YOUR PORTFOLIO</div>
          <h1>Holdings</h1>
          <p>Keep your manually entered investments in one place.</p>
        </div>
        <Link href="/holdings/new" className="button">
          Add a holding <span aria-hidden="true">+</span>
        </Link>
      </div>

      {isLoading && <p className="holdings-message">Loading your holdings…</p>}
      {error && (
        <div className="holdings-alert" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            onClick={() => setReload((attempt) => attempt + 1)}
            type="button"
          >
            Try again
          </button>
        </div>
      )}
      {!isLoading && !error && holdings.length === 0 && (
        <div className="holdings-empty">
          <div className="holdings-empty__icon" aria-hidden="true">
            +
          </div>
          <h2>Your portfolio starts here</h2>
          <p>Add your first holding to start tracking your investments.</p>
          <Link href="/holdings/new" className="button">
            Add your first holding
          </Link>
        </div>
      )}
      {!isLoading && !error && holdings.length > 0 && (
        <div className="holdings-table-wrap">
          <table className="holdings-table">
            <caption className="visually-hidden">Your investment holdings</caption>
            <thead>
              <tr>
                <th scope="col">Holding</th>
                <th scope="col">Asset class</th>
                <th scope="col">Quantity</th>
                <th scope="col">Price per share</th>
                <th scope="col"><span className="visually-hidden">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => (
                <tr key={holding.id}>
                  <td>
                    <Link
                      href={`/holdings/${holding.id}`}
                      className="holding-name"
                    >
                      <strong>{holding.ticker}</strong>
                      <span>{holding.name}</span>
                    </Link>
                  </td>
                  <td>{holding.asset_class_name}</td>
                  <td className="numeric-cell">
                    {formatQuantity(holding.quantity)}
                  </td>
                  <td className="numeric-cell">{formatPrice(holding.price)}</td>
                  <td>
                    <Link
                      href={`/holdings/${holding.id}`}
                      className="table-action"
                      aria-label={`View ${holding.ticker} details`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HoldingDetailPage({ holdingId }: { holdingId: string }) {
  const [, setLocation] = useLocation();
  const [holding, setHolding] = useState<Holding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");
    requestJson<{ holding: Holding }>(`/api/holdings/${holdingId}`)
      .then(({ holding: result }) => {
        if (!cancelled) setHolding(result);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "This holding could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [holdingId]);

  async function handleDelete() {
    if (!holding || isDeleting) return;
    if (!window.confirm(`Are you sure you want to delete ${holding.ticker}?`)) {
      return;
    }

    setIsDeleting(true);
    setError("");
    try {
      await requestJson<void>(`/api/holdings/${holding.id}`, {
        method: "DELETE",
      });
      setLocation("/holdings");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "This holding could not be deleted.",
      );
      setIsDeleting(false);
    }
  }

  return (
    <section className="holdings-content">
      <Link href="/holdings" className="back-link">
        ← All holdings
      </Link>
      {isLoading && <p className="holdings-message">Loading holding…</p>}
      {!isLoading && error && !holding && (
        <div className="holdings-alert" role="alert">
          {error}
        </div>
      )}
      {!isLoading && !holding && !error && (
        <div className="holdings-empty">
          <h1>Holding not found</h1>
          <p>It may have been deleted or may belong to another account.</p>
          <Link href="/holdings" className="button">
            Return to holdings
          </Link>
        </div>
      )}
      {holding && (
        <article className="holding-detail">
          <div className="holding-detail__heading">
            <div>
              <div className="eyebrow">HOLDING DETAILS</div>
              <h1>{holding.ticker}</h1>
              <p>{holding.name}</p>
            </div>
            <div className="holding-detail__actions">
              <Link
                href={`/holdings/${holding.id}/edit`}
                className="button button--quiet"
              >
                Edit
              </Link>
              <button
                className="button button--danger"
                onClick={handleDelete}
                disabled={isDeleting}
                type="button"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
          {error && (
            <div className="holdings-alert" role="alert">
              {error}
            </div>
          )}
          <dl className="holding-detail__grid">
            <div>
              <dt>Asset class</dt>
              <dd>{holding.asset_class_name}</dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{formatQuantity(holding.quantity)}</dd>
            </div>
            <div>
              <dt>Price per share</dt>
              <dd>{formatPrice(holding.price)}</dd>
            </div>
            <div className="holding-detail__notes">
              <dt>Notes</dt>
              <dd>{holding.notes || "No notes added."}</dd>
            </div>
          </dl>
        </article>
      )}
    </section>
  );
}

function HoldingFormPage({
  holdingId,
}: {
  holdingId?: string;
}) {
  const [, setLocation] = useLocation();
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
  const [form, setForm] = useState<HoldingFormValues>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<HoldingFieldErrors>({});

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    const classesRequest =
      requestJson<{ assetClasses: AssetClass[] }>("/api/asset-classes");
    const holdingRequest = holdingId
      ? requestJson<{ holding: Holding }>(`/api/holdings/${holdingId}`)
      : Promise.resolve(null);

    Promise.all([classesRequest, holdingRequest])
      .then(([classesResult, holdingResult]) => {
        if (cancelled) return;
        setAssetClasses(classesResult.assetClasses);
        if (holdingResult) {
          const holding = holdingResult.holding;
          setForm({
            ticker: holding.ticker,
            name: holding.name,
            asset_class_id: String(holding.asset_class_id),
            quantity: holding.quantity,
            price: holding.price,
            notes: holding.notes ?? "",
          });
        } else {
          setForm({
            ...emptyForm,
            asset_class_id: String(classesResult.assetClasses[0]?.id ?? ""),
          });
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "The form could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [holdingId]);

  function updateField(
    field: keyof HoldingFormValues,
    value: string,
  ) {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;
      const validation = holdingInputSchema.safeParse(nextForm);
      const nextErrors = validation.success
        ? {}
        : getHoldingFieldErrors(validation.error);
      return { ...currentErrors, [field]: nextErrors[field] };
    });
  }

  function validateField(field: HoldingFieldName) {
    const validation = holdingInputSchema.safeParse(form);
    const errors = validation.success
      ? {}
      : getHoldingFieldErrors(validation.error);
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [field]: errors[field],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError("");
    const validation = holdingInputSchema.safeParse(form);
    if (!validation.success) {
      setFieldErrors(getHoldingFieldErrors(validation.error));
      setError("Please correct the highlighted fields.");
      return;
    }
    setFieldErrors({});
    setIsSaving(true);

    try {
      const result = await requestJson<{ holding: Holding }>(
        holdingId ? `/api/holdings/${holdingId}` : "/api/holdings",
        {
          method: holdingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validation.data),
        },
      );
      setLocation(`/holdings/${result.holding.id}`);
    } catch (requestError) {
      if (requestError instanceof ApiResponseError && requestError.fieldErrors) {
        setFieldErrors(requestError.fieldErrors);
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "This holding could not be saved.",
      );
      setIsSaving(false);
    }
  }

  const cancelPath = holdingId ? `/holdings/${holdingId}` : "/holdings";

  return (
    <section className="holdings-content">
      <Link href={cancelPath} className="back-link">
        ← {holdingId ? "Holding details" : "All holdings"}
      </Link>
      <div className="holdings-page-heading holdings-page-heading--form">
        <div>
          <div className="eyebrow">{holdingId ? "UPDATE PORTFOLIO" : "NEW POSITION"}</div>
          <h1>{holdingId ? "Edit holding" : "Add a holding"}</h1>
          <p>Enter the details you want to track for this investment.</p>
        </div>
      </div>

      {isLoading && <p className="holdings-message">Loading form…</p>}
      {!isLoading && error && (
        <div className="holdings-alert" role="alert">
          {error}
        </div>
      )}
      {!isLoading && !error && assetClasses.length > 0 && (
        <form className="holding-form" noValidate onSubmit={handleSubmit}>
          <div className="holding-form__grid">
            <label className="form-field" htmlFor="holding-ticker">
              <span>Ticker</span>
              <input
                id="holding-ticker"
                name="ticker"
                autoComplete="off"
                required
                aria-invalid={Boolean(fieldErrors.ticker)}
                aria-describedby={fieldErrors.ticker ? "ticker-error" : undefined}
                value={form.ticker}
                onChange={(event) => updateField("ticker", event.target.value)}
                onBlur={() => validateField("ticker")}
              />
              <FieldError id="ticker-error" message={fieldErrors.ticker} />
            </label>
            <label className="form-field" htmlFor="holding-name">
              <span>Name</span>
              <input
                id="holding-name"
                name="name"
                required
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "name-error" : undefined}
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                onBlur={() => validateField("name")}
              />
              <FieldError id="name-error" message={fieldErrors.name} />
            </label>
            <label className="form-field" htmlFor="holding-asset-class">
              <span>Asset class</span>
              <select
                id="holding-asset-class"
                name="asset_class_id"
                required
                aria-invalid={Boolean(fieldErrors.asset_class_id)}
                aria-describedby={
                  fieldErrors.asset_class_id ? "asset-class-error" : undefined
                }
                value={form.asset_class_id}
                onChange={(event) =>
                  updateField("asset_class_id", event.target.value)
                }
                onBlur={() => validateField("asset_class_id")}
              >
                {assetClasses.map((assetClass) => (
                  <option key={assetClass.id} value={assetClass.id}>
                    {assetClass.name}
                  </option>
                ))}
              </select>
              <FieldError
                id="asset-class-error"
                message={fieldErrors.asset_class_id}
              />
            </label>
            <label className="form-field" htmlFor="holding-quantity">
              <span>Quantity</span>
              <input
                id="holding-quantity"
                name="quantity"
                type="number"
                min="0.00000001"
                step="any"
                required
                aria-invalid={Boolean(fieldErrors.quantity)}
                aria-describedby={fieldErrors.quantity ? "quantity-error" : undefined}
                value={form.quantity}
                onChange={(event) =>
                  updateField("quantity", event.target.value)
                }
                onBlur={() => validateField("quantity")}
              />
              <FieldError id="quantity-error" message={fieldErrors.quantity} />
            </label>
            <label className="form-field" htmlFor="holding-price">
              <span>Price per share</span>
              <div className="money-input">
                <span aria-hidden="true">$</span>
                <input
                  id="holding-price"
                  name="price"
                  type="number"
                  min="0"
                  step="any"
                  required
                  aria-invalid={Boolean(fieldErrors.price)}
                  aria-describedby={fieldErrors.price ? "price-error" : undefined}
                  value={form.price}
                  onChange={(event) => updateField("price", event.target.value)}
                  onBlur={() => validateField("price")}
                />
              </div>
              <FieldError id="price-error" message={fieldErrors.price} />
            </label>
            <label
              className="form-field holding-form__notes"
              htmlFor="holding-notes"
            >
              <span>Notes <small>Optional</small></span>
              <textarea
                id="holding-notes"
                name="notes"
                rows={4}
                aria-invalid={Boolean(fieldErrors.notes)}
                aria-describedby={fieldErrors.notes ? "notes-error" : undefined}
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                onBlur={() => validateField("notes")}
              />
              <FieldError id="notes-error" message={fieldErrors.notes} />
            </label>
          </div>
          <div className="holding-form__actions">
            <Link href={cancelPath} className="button button--quiet">
              Cancel
            </Link>
            <button className="button" disabled={isSaving} type="submit">
              {isSaving
                ? "Saving…"
                : holdingId
                  ? "Save changes"
                  : "Save holding"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function HoldingsApp() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [location, setLocation] = useLocation();
  const [syncState, setSyncState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [syncAttempt, setSyncAttempt] = useState(0);

  useEffect(() => {
    if (!isLoaded || !user) return;

    let cancelled = false;
    setSyncState("loading");
    fetch("/api/auth/sync", { method: "POST" })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to save your account.");
        if (!cancelled) setSyncState("ready");
      })
      .catch(() => {
        if (!cancelled) setSyncState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user?.id, syncAttempt]);

  if (!isLoaded || !user || syncState === "loading") {
    return <main className="loading-screen">Loading your secure portfolio…</main>;
  }

  if (syncState === "error") {
    return (
      <main className="holdings-app">
        <div className="holdings-sync-error" role="alert">
          <h1>Your account could not be loaded</h1>
          <p>Try again before managing your holdings.</p>
          <div>
            <button
              className="button"
              onClick={() => setSyncAttempt((attempt) => attempt + 1)}
              type="button"
            >
              Try again
            </button>
            <button
              className="button button--quiet"
              onClick={() => signOut({ redirectUrl: "/" })}
              type="button"
            >
              Log out
            </button>
          </div>
        </div>
      </main>
    );
  }

  const editMatch = location.match(/^\/holdings\/([^/]+)\/edit\/?$/);
  const detailMatch = location.match(/^\/holdings\/([^/]+)\/?$/);

  let page;
  if (location === "/" || location === "/holdings" || location === "/holdings/") {
    page = <HoldingsListPage />;
  } else if (location === "/holdings/new") {
    page = <HoldingFormPage />;
  } else if (editMatch) {
    page = <HoldingFormPage holdingId={editMatch[1]} />;
  } else if (detailMatch) {
    page = <HoldingDetailPage holdingId={detailMatch[1]} />;
  } else {
    page = (
      <section className="holdings-content holdings-empty">
        <h1>Page not found</h1>
        <Link href="/holdings" className="button">
          Return to holdings
        </Link>
      </section>
    );
  }

  return <HoldingsLayout>{page}</HoldingsLayout>;
}
