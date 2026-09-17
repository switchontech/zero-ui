import { Grid, Link, Typography } from "@material-ui/core";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";

import { Link as RouterLink } from "react-router-dom";
import { useLocalStorage } from "react-use";

import UserManagement from "components/UserManagement";

import useStyles from "../Settings/Settings.styles";

import { useTranslation } from "react-i18next";

function Users() {
  const { t } = useTranslation();
  const [loggedIn] = useLocalStorage("loggedIn", false);

  const classes = useStyles();

  if (!loggedIn) {
    return (
      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justify="center"
        style={{
          minHeight: "50vh",
        }}
      >
        <Grid item xs={10}>
          <Typography variant="h5">{t("notAuthorized")}</Typography>
        </Grid>
      </Grid>
    );
  }

  return (
    <>
      <div className={classes.breadcrumbs}>
        <Link color="inherit" component={RouterLink} to="/" underline="none">
          <ArrowBackIcon className={classes.backIcon}></ArrowBackIcon>
          {t("users")}
        </Link>
      </div>
      <div className={classes.container}>
        <UserManagement />
      </div>
    </>
  );
}

export default Users;
