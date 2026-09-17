import { useEffect, useState } from "react";
import { Box, Divider } from "@material-ui/core";

import LogInUser from "./components/LogInUser";
import LogInToken from "./components/LogInToken";
import LogInGoogle from "./components/LogInGoogle";

import { fetchAuthConfig } from "utils/auth";

function LogIn() {
  const [config, setConfig] = useState(
    /** @type {{google: boolean, localLogin: boolean} | null} */ (null)
  );

  useEffect(() => {
    let active = true;
    fetchAuthConfig()
      .then((result) => {
        if (active) setConfig(result);
      })
      .catch(() => {
        // Fall back to the local form so a backend hiccup does not leave the
        // bar with no way to sign in at all.
        if (active) setConfig({ google: false, localLogin: true });
      });
    return () => {
      active = false;
    };
  }, []);

  if (!config) return null;

  return (
    <Box display="flex" alignItems="center" gridGap={8}>
      {import.meta.env.DEV && (
        <>
          <LogInToken />
          <Divider orientation="vertical" />
        </>
      )}
      {config.google && <LogInGoogle />}
      {config.localLogin && <LogInUser />}
    </Box>
  );
}

export default LogIn;
