import { useEffect, useState } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
  useUser,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Link, Route, Router, Switch, useLocation } from "wouter";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY.");
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#4f46e5",
    colorForeground: "#172033",
    colorMutedForeground: "#667085",
    colorDanger: "#c2413b",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#172033",
    colorNeutral: "#dce2eb",
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: { width: "100%", display: "flex", justifyContent: "center" },
    cardBox: {
      width: "440px",
      maxWidth: "100%",
      overflow: "hidden",
      backgroundColor: "#ffffff",
      borderRadius: "20px",
      boxShadow: "0 24px 70px rgba(27, 39, 70, 0.12)",
    },
    card: { boxShadow: "none", border: "none", backgroundColor: "transparent" },
    footer: { boxShadow: "none", border: "none", backgroundColor: "transparent" },
    headerTitle: { color: "#172033", fontWeight: 650 },
    headerSubtitle: { color: "#667085" },
    socialButtonsBlockButtonText: { color: "#172033" },
    formFieldLabel: { color: "#344054", fontWeight: 550 },
    footerActionLink: { color: "#4f46e5" },
    footerActionText: { color: "#667085" },
    dividerText: { color: "#667085" },
    formButtonPrimary: { backgroundColor: "#4f46e5" },
    formFieldInput: { borderRadius: "10px" },
  },
};

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <Link href="/" className={`brand ${small ? "brand--small" : ""}`}>
      <img src={`${basePath}/logo.svg`} alt="" className="brand__icon" />
      <span>My Robo Advisor</span>
    </Link>
  );
}

function LandingPage() {
  return (
    <main className="landing">
      <header className="topbar">
        <BrandMark />
        <nav className="topbar__actions" aria-label="Account">
          <Link href="/sign-in" className="text-link">
            Log in
          </Link>
          <Link href="/sign-up" className="button button--small">
            Create account
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero__copy">
          <div className="eyebrow">
            <span className="eyebrow__dot" />
            YOUR PORTFOLIO, IN ONE PLACE
          </div>
          <h1>Make room for a clearer view of your investments.</h1>
          <p>
            Bring your accounts together, understand your allocation, and make
            your next investing decision with confidence.
          </p>
          <div className="hero__actions">
            <Link href="/sign-up" className="button">
              Get started <span aria-hidden="true">→</span>
            </Link>
            <Link href="/sign-in" className="button button--quiet">
              I already have an account
            </Link>
          </div>
          <div className="privacy-note">
            <span aria-hidden="true">◈</span>
            Your account is protected with secure sign-in.
          </div>
        </div>

        <div className="hero-art" aria-label="A preview of an investment dashboard">
          <div className="hero-art__glow" />
          <div className="preview-card">
            <div className="preview-card__top">
              <div>
                <div className="preview-card__label">TOTAL PORTFOLIO</div>
                <div className="preview-card__value">$84,260.40</div>
              </div>
              <div className="preview-badge">
                <span /> Steady progress
              </div>
            </div>
            <div className="allocation">
              <div className="allocation__ring">
                <div className="allocation__center">
                  <span>4</span>
                  <small>ASSET CLASSES</small>
                </div>
              </div>
              <div className="allocation__list">
                <div><i className="swatch swatch--indigo" /><span>US Stocks</span><b>42%</b></div>
                <div><i className="swatch swatch--blue" /><span>International</span><b>23%</b></div>
                <div><i className="swatch swatch--teal" /><span>Bonds</span><b>25%</b></div>
                <div><i className="swatch swatch--gold" /><span>Cash</span><b>10%</b></div>
              </div>
            </div>
            <div className="preview-card__footer">
              <span>Allocation overview</span>
              <span className="footer-sparkline" aria-hidden="true">╱╲╱╱╲╱╱╱</span>
            </div>
          </div>
          <div className="floating-note">
            <span className="floating-note__icon">✓</span>
            <span><b>Your plan, at a glance</b><small>Simple and easy to follow</small></span>
          </div>
          <div className="hero-art__caption">A more thoughtful way to stay on track</div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>Designed for the long view.</span>
        <span>Prices entered by you. No brokerage connections.</span>
      </footer>
    </main>
  );
}

function AccountPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [syncState, setSyncState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!isLoaded || !user) return;

    let cancelled = false;
    fetch("/api/auth/sync", { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to save your account.");
        }
        if (!cancelled) setSyncState("ready");
      })
      .catch(() => {
        if (!cancelled) setSyncState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user?.id]);

  if (!isLoaded || !user) {
    return <main className="loading-screen">Loading your secure account…</main>;
  }

  return (
    <main className="account-page">
      <header className="topbar">
        <BrandMark />
        <button
          className="button button--quiet"
          onClick={() => signOut({ redirectUrl: basePath || "/" })}
          type="button"
        >
          Log out
        </button>
      </header>
      <section className="account-card">
        <div className="account-card__icon">✓</div>
        <div className="eyebrow">ACCOUNT SECURED</div>
        <h1>Welcome to your investing space.</h1>
        <p className="account-card__email">{user.primaryEmailAddress?.emailAddress}</p>
        <div className={`sync-status sync-status--${syncState}`} role="status">
          {syncState === "loading" && "Saving your account…"}
          {syncState === "ready" && "Your account is ready."}
          {syncState === "error" && "We couldn’t save your account. Refresh to try again."}
        </div>
        <p className="account-card__note">
          Your personal portfolio tools will be ready here as they’re added.
        </p>
      </section>
    </main>
  );
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <main className="loading-screen">Loading secure sign-in…</main>;
  }

  return isSignedIn ? <AccountPage /> : <LandingPage />;
}

function AuthRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to access your account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start bringing your investments together",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/" component={HomeRoute} />
        <Route path="/sign-in/*?">
          <main className="auth-page">
            <div className="auth-page__brand"><BrandMark small /></div>
            <SignIn
              routing="path"
              path={`${basePath}/sign-in`}
              signUpUrl={`${basePath}/sign-up`}
            />
          </main>
        </Route>
        <Route path="/sign-up/*?">
          <main className="auth-page">
            <div className="auth-page__brand"><BrandMark small /></div>
            <SignUp
              routing="path"
              path={`${basePath}/sign-up`}
              signInUrl={`${basePath}/sign-in`}
            />
          </main>
        </Route>
        <Route>
          <HomeRoute />
        </Route>
      </Switch>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <Router base={basePath}>
      <AuthRoutes />
    </Router>
  );
}
