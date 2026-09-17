import { useCallback } from "react";
import { useLocalStorage } from "react-use";
import { useHistory } from "react-router-dom";

import SignInCard from "components/SignInCard";

function HomeLoggedOut() {
  const [, setLoggedIn] = useLocalStorage("loggedIn", false);
  const [, setToken] = useLocalStorage("token", null);
  const [, setDisableAuth] = useLocalStorage("disableAuth", false);
  const history = useHistory();

  // ZU_DISABLE_AUTH means something in front of us is doing the authenticating,
  // so there is nobody to sign in here -- go straight through.
  const onAuthDisabled = useCallback(() => {
    setLoggedIn(true);
    setDisableAuth(true);
    setToken("");
    history.go(0);
  }, [history, setDisableAuth, setLoggedIn, setToken]);

  return <SignInCard onAuthDisabled={onAuthDisabled} />;
}

export default HomeLoggedOut;
