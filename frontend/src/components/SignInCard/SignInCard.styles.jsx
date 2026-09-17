import { makeStyles } from "@material-ui/core/styles";

// The sign-in gate is deliberately its own visual world: the console behind it
// is light, this is dark. Neutrals are pulled slightly toward the green in the
// ZeroUI mark rather than being flat grey, so the ground reads as chosen.
const ground = "#0B0D0C";
const surface = "#15181A";
const line = "#252A2C";
const textPrimary = "#EEF1F0";
const textMuted = "#8C9694";
const brandGreen = "#4FBA6F";

const useStyles = makeStyles((theme) => ({
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    boxSizing: "border-box",
    background: ground,
    // A very faint wash behind the card, so the ground is not a flat slab.
    backgroundImage: `radial-gradient(60rem 30rem at 50% -10%, rgba(79, 186, 111, 0.10), transparent 70%)`,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    padding: theme.spacing(5, 4),
    boxSizing: "border-box",
    background: surface,
    border: `1px solid ${line}`,
    borderRadius: 12,
    textAlign: "center",
    boxShadow: "0 24px 48px -24px rgba(0, 0, 0, 0.75)",
  },
  logo: {
    width: 132,
    height: "auto",
    maxWidth: "100%",
    display: "block",
    margin: "0 auto",
  },
  heading: {
    marginTop: theme.spacing(3),
    color: textPrimary,
    fontSize: "1.375rem",
    fontWeight: 500,
    lineHeight: 1.3,
    textWrap: "balance",
  },
  subheading: {
    marginTop: theme.spacing(1),
    color: textMuted,
    fontSize: "0.875rem",
    lineHeight: 1.55,
  },
  actions: {
    marginTop: theme.spacing(4),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  googleButton: {
    // Google's brand guidance is a light button; it also makes the primary
    // action the brightest thing on a dark card, which is where it belongs.
    background: "#FFFFFF",
    color: "rgba(0, 0, 0, 0.78)",
    fontWeight: 500,
    textTransform: "none",
    fontSize: "0.9375rem",
    padding: theme.spacing(1.25, 2),
    "&:hover": {
      background: "#F1F3F4",
    },
  },
  secondaryButton: {
    color: textMuted,
    textTransform: "none",
    "&:hover": {
      color: textPrimary,
      background: "rgba(255, 255, 255, 0.04)",
    },
  },
  domains: {
    marginTop: theme.spacing(3),
    paddingTop: theme.spacing(2.5),
    borderTop: `1px solid ${line}`,
    color: textMuted,
    fontSize: "0.8125rem",
    lineHeight: 1.6,
  },
  domain: {
    color: textPrimary,
    // The domain is the one thing on this card the reader must match against
    // their own account, so it is set apart from the sentence around it.
    fontFamily: "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.8125rem",
    whiteSpace: "nowrap",
  },
  error: {
    marginTop: theme.spacing(3),
    padding: theme.spacing(1.5, 2),
    textAlign: "left",
    borderRadius: 8,
    border: "1px solid rgba(229, 115, 115, 0.35)",
    background: "rgba(229, 115, 115, 0.10)",
    color: "#F2B8B5",
    fontSize: "0.8125rem",
    lineHeight: 1.5,
  },
  brandRule: {
    width: 28,
    height: 2,
    margin: `${theme.spacing(3)}px auto 0`,
    background: brandGreen,
    borderRadius: 2,
    opacity: 0.75,
  },
}));

export default useStyles;
