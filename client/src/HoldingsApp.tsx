import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useClerk, useUser } from "@clerk/react";
import { Link, useLocation } from "wouter";
import DashboardPage from "./DashboardPage";
import RiskQuizPage from "./RiskQuizPage";
import RebalancingPage from "./RebalancingPage";
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

type HoldingSort = "market-value" | "ticker" | "newest";

interface Holding {
  id: string;
  asset_class_id: number;
  asset_class_name: string;
  ticker: string;
  name: string;
  quantity: string;
  price: string;
  notes: string | null;
  is_starred: boolean;
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

function StarToggle({
  holdingId,
  isStarred,
  onStarChange,
}: {
  holdingId: string;
  isStarred: boolean;
  onStarChange: (isStarred: boolean) => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  async function toggleStar() {
    if (isUpdating) return;
    const nextState = !isStarred;
    setIsUpdating(true);
    setError("");

    try {
      const result = await requestJson<{ is_starred: boolean }>(
        `/api/holdings/${holdingId}/star`,
        { method: nextState ? "PUT" : "DELETE" },
      );
      onStarChange(result.is_starred);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The star status could not be updated.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  const actionLabel = isStarred ? "Remove from starred" : "Add to starred";

  return (
    <div className="star-toggle">
      <button
        aria-label={actionLabel}
        aria-pressed={isStarred}
        className={`star-toggle__button${isStarred ? " star-toggle__button--active" : ""}`}
        disabled={isUpdating}
        onClick={toggleStar}
        title={actionLabel}
        type="button"
      >
        <span aria-hidden="true">{isStarred ? "★" : "☆"}</span>
      </button>
      {error && (
        <span className="star-toggle__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
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

function formatMarketValue(quantity: string, price: string) {
  return formatPrice(String(Number(quantity) * Number(price)));
}

function BrandLink() {
  return (
    <Link href="/" className="brand">
      <img src="/logo.svg" alt="" className="brand__icon" />
      <span>My Robo Advisor</span>
    </Link>
  );
}

function HoldingsLayout({
  children,
  dashboard = false,
  activePage = "dashboard",
}: {
  children: ReactNode;
  dashboard?: boolean;
  activePage?: "dashboard" | "risk-quiz" | "rebalance";
}) {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <main className={`holdings-app${dashboard ? " holdings-app--dashboard" : ""}`}>
      <header className="topbar holdings-topbar">
        <BrandLink />
        <div className="holdings-nav">
          {!dashboard && (
            <>
              <Link href="/dashboard" className="holdings-nav__link">
                Dashboard
              </Link>
              <Link href="/holdings" className="holdings-nav__link">
                Holdings
              </Link>
              <Link href="/holdings/starred" className="holdings-nav__link">
                Starred
              </Link>
              <Link href="/rebalance" className="holdings-nav__link">
                Rebalance
              </Link>
              <Link href="/risk-quiz" className="holdings-nav__link">
                Risk Quiz
              </Link>
              <Link href="/holdings/new" className="button button--small">
                Add holding
              </Link>
            </>
          )}
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
        </div>
      </header>
      {dashboard ? (
        <div className="dashboard-shell">
          <aside className="dashboard-sidebar">
            <nav aria-label="Portfolio navigation">
              <Link
                href="/dashboard"
                aria-current={activePage === "dashboard" ? "page" : undefined}
              >
                <span aria-hidden="true">◷</span> Dashboard
              </Link>
              <Link href="/holdings">
                <span aria-hidden="true">▤</span> Holdings
              </Link>
              <Link href="/holdings/starred">
                <span aria-hidden="true">☆</span> Starred
              </Link>
              <Link
                href="/rebalance"
                aria-current={activePage === "rebalance" ? "page" : undefined}
              >
                <span aria-hidden="true">↔</span> Rebalance
              </Link>
              <Link
                href="/risk-quiz"
                aria-current={activePage === "risk-quiz" ? "page" : undefined}
              >
                <span aria-hidden="true">◈</span> Risk Quiz
              </Link>
            </nav>
          </aside>
          <div className="dashboard-shell__content">{children}</div>
        </div>
      ) : children}
    </main>
  );
}

function HoldingsListPage({ starredOnly = false }: { starredOnly?: boolean }) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [assetClassId, setAssetClassId] = useState("");
  const [sort, setSort] = useState<HoldingSort>("newest");

  useEffect(() => {
    let cancelled = false;
    setFilterError("");
    requestJson<{ assetClasses: AssetClass[] }>("/api/asset-classes")
      .then(({ assetClasses: result }) => {
        if (!cancelled) setAssetClasses(result);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setFilterError(
            requestError instanceof Error
              ? requestError.message
              : "Asset class filters could not be loaded.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (assetClassId) query.set("assetClassId", assetClassId);
    query.set("sort", sort);
    const endpoint = starredOnly
      ? "/api/holdings/starred"
      : "/api/holdings";
    const queryString = query.toString();
    const url = `${endpoint}?${queryString}`;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      setError("");
      requestJson<{ holdings: Holding[] }>(url)
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
    }, search.trim() ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reload, starredOnly, search, assetClassId, sort]);

  const hasActiveFilters = Boolean(search.trim() || assetClassId);

  return (
    <section className="holdings-content">
      <div className="holdings-page-heading">
        <div>
          <div className="eyebrow">
            {starredOnly ? "WATCHLIST" : "YOUR PORTFOLIO"}
          </div>
          <h1>{starredOnly ? "Starred holdings" : "Holdings"}</h1>
          <p>
            {starredOnly
              ? "Your important positions, all in one place."
              : "Keep your manually entered investments in one place."}
          </p>
        </div>
        {starredOnly ? (
          <Link href="/holdings" className="button button--quiet">
            All holdings
          </Link>
        ) : (
          <Link href="/holdings/new" className="button">
            Add a holding <span aria-hidden="true">+</span>
          </Link>
        )}
      </div>

      <div className="holding-filters" role="search" aria-label="Find holdings">
        <label className="holding-filter">
          <span>Search by ticker or name</span>
          <input
            type="search"
            maxLength={100}
            placeholder="e.g. VTI or Vanguard"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="holding-filter">
          <span>Asset class</span>
          <select
            value={assetClassId}
            onChange={(event) => setAssetClassId(event.target.value)}
          >
            <option value="">All asset classes</option>
            {assetClasses.map((assetClass) => (
              <option key={assetClass.id} value={assetClass.id}>
                {assetClass.name}
              </option>
            ))}
          </select>
        </label>
        <label className="holding-filter">
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as HoldingSort)}
          >
            <option value="market-value">Market value (highest first)</option>
            <option value="ticker">Ticker (A–Z)</option>
            <option value="newest">Newest</option>
          </select>
        </label>
        {hasActiveFilters && (
          <button
            className="text-button holding-filters__clear"
            onClick={() => {
              setSearch("");
              setAssetClassId("");
            }}
            type="button"
          >
            Clear filters
          </button>
        )}
      </div>

      {filterError && (
        <div className="holdings-alert" role="alert">
          <span>{filterError}</span>
          <button
            className="text-button"
            onClick={() => setReload((attempt) => attempt + 1)}
            type="button"
          >
            Try again
          </button>
        </div>
      )}
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
            {hasActiveFilters ? "⌕" : starredOnly ? "☆" : "+"}
          </div>
          <h2>
            {hasActiveFilters
              ? "No matching holdings"
              : starredOnly
                ? "No starred holdings yet"
                : "Your portfolio starts here"}
          </h2>
          <p>
            {hasActiveFilters
              ? "Try another search or choose a different asset class."
              : starredOnly
                ? "Star a holding to keep it easy to find."
                : "Add your first holding to start tracking your investments."}
          </p>
          {hasActiveFilters ? (
            <button
              className="button button--quiet"
              onClick={() => {
                setSearch("");
                setAssetClassId("");
              }}
              type="button"
            >
              Clear filters
            </button>
          ) : starredOnly ? (
            <Link href="/holdings" className="button">
              Browse holdings
            </Link>
          ) : (
            <Link href="/holdings/new" className="button">
              Add your first holding
            </Link>
          )}
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
                <th scope="col">Market value</th>
                <th scope="col">Starred</th>
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
                  <td className="numeric-cell">
                    {formatMarketValue(holding.quantity, holding.price)}
                  </td>
                  <td>
                    <StarToggle
                      holdingId={holding.id}
                      isStarred={holding.is_starred}
                      onStarChange={(isStarred) =>
                        setHoldings((current) =>
                          starredOnly && !isStarred
                            ? current.filter((item) => item.id !== holding.id)
                            : current.map((item) =>
                                item.id === holding.id
                                  ? { ...item, is_starred: isStarred }
                                  : item,
                              ),
                        )
                      }
                    />
                  </td>
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
              <StarToggle
                holdingId={holding.id}
                isStarred={holding.is_starred}
                onStarChange={(isStarred) =>
                  setHolding((current) =>
                    current ? { ...current, is_starred: isStarred } : current,
                  )
                }
              />
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
  const [syncError, setSyncError] = useState(
    "Your account could not be loaded. Try again before managing your holdings.",
  );
  const [syncAttempt, setSyncAttempt] = useState(0);

  useEffect(() => {
    if (!isLoaded || !user) return;

    let cancelled = false;
    setSyncState("loading");
    setSyncError("");
    fetch("/api/auth/sync", {
      method: "POST",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: unknown }
            | null;
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : "Your account could not be saved. Please try again.",
          );
        }
        if (!cancelled) setSyncState("ready");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSyncError(
            error instanceof Error
              ? error.message
              : "Your account could not be saved. Please try again.",
          );
          setSyncState("error");
        }
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
          <p>{syncError}</p>
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
  const isDashboardRoute =
    location === "/" ||
    location === "/dashboard" ||
    location === "/dashboard/";
  const isRiskQuizRoute = location === "/risk-quiz" || location === "/risk-quiz/";
  const isRebalanceRoute = location === "/rebalance" || location === "/rebalance/";

  let page;
  if (isDashboardRoute) {
    page = <DashboardPage />;
  } else if (isRiskQuizRoute) {
    page = <RiskQuizPage />;
  } else if (isRebalanceRoute) {
    page = <RebalancingPage />;
  } else if (location === "/holdings/starred" || location === "/holdings/starred/") {
    page = <HoldingsListPage starredOnly />;
  } else if (location === "/holdings" || location === "/holdings/") {
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

  return (
    <HoldingsLayout
      dashboard={isDashboardRoute || isRiskQuizRoute || isRebalanceRoute}
      activePage={
        isRiskQuizRoute
          ? "risk-quiz"
          : isRebalanceRoute
            ? "rebalance"
            : "dashboard"
      }
    >
      {page}
    </HoldingsLayout>
  );
}
