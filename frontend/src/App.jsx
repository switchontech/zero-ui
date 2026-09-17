import "@fontsource/roboto";

import { Suspense, useState } from "react";
import { BrowserRouter, Route, Redirect, Switch } from "react-router-dom";
import { Snackbar } from "@material-ui/core";

import { useTranslation } from "react-i18next";

import Theme from "./components/Theme";
import Bar from "./components/Bar";

import Home from "./routes/Home";
import NotFound from "./routes/NotFound";
import Network from "./routes/Network/Network";
import Settings from "./routes/Settings";
import Users from "./routes/Users";

import Loading from "./components/Loading";

import { consumeLoginFragment } from "./utils/auth";

import "./i18n";

// Runs before React mounts so the very first render already knows whether we
// are signed in, which keeps the bar from flashing a log-in button after a
// successful round trip through Google.
const loginResult = consumeLoginFragment();

function AppRoutes() {
  const { t } = useTranslation();
  const [loginError, setLoginError] = useState(loginResult?.error || "");

  return (
    <>
      <BrowserRouter basename="/app">
        <Bar />
        <Switch>
          <Route exact path="/" component={Home} />
          <Route path="/network/:nwid" component={Network} />
          <Route path="/settings" component={Settings} />
          <Route path="/users" component={Users} />
          <Route path="/404" component={NotFound} />
          <Redirect to="/404" />
        </Switch>
      </BrowserRouter>
      <Snackbar
        open={Boolean(loginError)}
        autoHideDuration={8000}
        onClose={() => setLoginError("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        message={t(loginError)}
      />
    </>
  );
}

function App() {
  return (
    <Theme>
      <Suspense fallback={<Loading />}>
        <AppRoutes />
      </Suspense>
    </Theme>
  );
}

export default App;
