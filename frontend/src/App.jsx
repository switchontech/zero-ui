import "@fontsource/roboto";

import { Suspense } from "react";
import { BrowserRouter, Route, Redirect, Switch } from "react-router-dom";
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
// are signed in, rather than flashing the sign-in gate after a successful
// round trip through Google. The outcome is read back by the sign-in card.
consumeLoginFragment();

function AppRoutes() {
  return (
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
