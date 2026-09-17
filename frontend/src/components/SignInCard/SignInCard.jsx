import { useEffect, useState } from "react";
import { Button, Typography } from "@material-ui/core";

import { useTranslation } from "react-i18next";

import LogInUser from "components/LogIn/components/LogInUser";
import LogInToken from "components/LogIn/components/LogInToken";

import { fetchAuthConfig, getLoginResult, startGoogleLogin } from "utils/auth";

import useStyles from "./SignInCard.styles";

/**
 * Google's mark, inlined so the sign-in gate does not depend on a request to
 * a third party -- this panel has to work on an isolated network.
 *
 * @returns {JSX.Element} the mark
 */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * The signed-out gate: what the panel is, and the one way in.
 *
 * @param {object} props component props
 * @param {string} [props.heading] overrides the default heading
 * @param {string} [props.message] overrides the default supporting line
 * @param {() => void} [props.onAuthDisabled] called when the backend reports
 *   that authentication is handled elsewhere, so there is nothing to sign in to
 * @returns {JSX.Element} the card
 */
function SignInCard({ heading, message, onAuthDisabled }) {
  const { t } = useTranslation();
  const classes = useStyles();

  const [config, setConfig] = useState(
    /** @type {{google: boolean, localLogin: boolean, allowedDomains: string[]} | null} */ (
      null
    )
  );
  const [error, setError] = useState(getLoginResult()?.error || "");

  useEffect(() => {
    let active = true;

    fetchAuthConfig()
      .then((result) => {
        if (!active) return;
        if (!result.enabled && onAuthDisabled) {
          onAuthDisabled();
          return;
        }
        setConfig(result);
      })
      .catch(() => {
        // Offer the sign-in anyway: a failed capability check should not leave
        // the page with no way forward. A bad guess surfaces as a clear error.
        if (active)
          setConfig({ google: true, localLogin: false, allowedDomains: [] });
      });

    return () => {
      active = false;
    };
  }, [onAuthDisabled]);

  // The logo lives in the public folder, served under the app's base path. An
  // absolute "/logo.svg" 404s wherever the panel is not mounted at the root.
  // BASE_URL may or may not carry a trailing slash, so normalise before joining.
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const logoSrc = `${base}/logo_dark.svg`;
  const domains = config?.allowedDomains || [];

  return (
    <div className={classes.page}>
      <div className={classes.card}>
        <img src={logoSrc} alt="ZeroUI" className={classes.logo} />

        <Typography component="h1" className={classes.heading}>
          {heading || t("signInHeading")}
        </Typography>
        <Typography component="p" className={classes.subheading}>
          {message || t("signInSubheading")}
        </Typography>

        <div className={classes.brandRule} />

        {error && (
          <div className={classes.error} role="alert">
            {t(error)}
          </div>
        )}

        {config && (
          <div className={classes.actions}>
            {config.google && (
              <Button
                className={classes.googleButton}
                variant="contained"
                disableElevation
                fullWidth
                startIcon={<GoogleIcon />}
                onClick={() => {
                  setError("");
                  startGoogleLogin();
                }}
              >
                {t("logInWithGoogle")}
              </Button>
            )}
            {config.localLogin && (
              <LogInUser className={classes.secondaryButton} />
            )}
            {import.meta.env.DEV && (
              <LogInToken className={classes.secondaryButton} />
            )}
          </div>
        )}

        <div className={classes.domains}>
          {domains.length > 0 && (
            <Typography component="p">
              {t("signInDomainNote")}{" "}
              {domains.map((domain, index) => (
                <span key={domain}>
                  {index > 0 && ", "}
                  <span className={classes.domain}>@{domain}</span>
                </span>
              ))}
            </Typography>
          )}
          <Typography component="p" className={classes.restricted}>
            {t("signInRestricted")}
          </Typography>
        </div>
      </div>
    </div>
  );
}

export default SignInCard;
