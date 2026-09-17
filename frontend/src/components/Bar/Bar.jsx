import logo from "./assets/logo.png";

import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useLocalStorage } from "react-use";

import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Divider,
  Menu,
  MenuItem,
  Link,
} from "@material-ui/core";
import MenuIcon from "@material-ui/icons/Menu";

import { logOut } from "utils/auth";

import { useTranslation } from "react-i18next";

function Bar() {
  const [loggedIn, setLoggedIn] = useLocalStorage("loggedIn", false);
  const [disabledAuth] = useLocalStorage("disableAuth", false);
  const [anchorEl, setAnchorEl] = useState(null);

  const openMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const closeMenu = () => {
    setAnchorEl(null);
  };

  const onLogOutClick = () => {
    setLoggedIn(false);
    // Revokes the session on the backend before clearing it locally, so a
    // leaked token cannot outlive the log out.
    logOut();
  };

  const { t, i18n } = useTranslation();

  // Signed out there is no menu and no sign-in button here -- the page itself
  // is the gate -- so the bar would only be an empty strip above it.
  if (!loggedIn) return null;

  const menuItems = [
    ...(disabledAuth
      ? []
      : [
          {
            name: t("users"),
            to: "/users",
          },
        ]),
    {
      name: t("settings"),
      to: "/settings",
    },
    ...(!disabledAuth
      ? [
          {
            name: t("logOut"),
            divide: true,
            onClick: onLogOutClick,
          },
        ]
      : []),
  ];

  return (
    <AppBar
      color="secondary"
      style={{ background: "#000000" }}
      position="static"
    >
      <Toolbar>
        <Box display="flex" flexGrow={1}>
          <Typography color="inherit" variant="h6">
            <Link
              color="inherit"
              component={RouterLink}
              to="/"
              underline="none"
            >
              <img src={logo} width="100" height="100" alt="logo" />
            </Link>
          </Typography>
        </Box>
        {loggedIn && menuItems.length > 0 && (
          <>
            <Button color="inherit" onClick={openMenu}>
              <MenuIcon></MenuIcon>
            </Button>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={closeMenu}
            >
              {menuItems.map((menuItem, index) => {
                if (
                  Object.prototype.hasOwnProperty.call(menuItem, "condition") &&
                  !menuItem.condition
                ) {
                  return null;
                }

                let component = null;

                if (menuItem.to) {
                  component = (
                    <MenuItem
                      key={index}
                      component={RouterLink}
                      to={menuItem.to}
                      onClick={closeMenu}
                    >
                      {menuItem.name}
                    </MenuItem>
                  );
                } else {
                  component = (
                    <MenuItem
                      key={index}
                      onClick={() => {
                        closeMenu();
                        menuItem.onClick();
                      }}
                    >
                      {menuItem.name}
                    </MenuItem>
                  );
                }

                if (menuItem.divide) {
                  return (
                    <span key={index}>
                      <Divider />

                      {component}
                    </span>
                  );
                }

                return component;
              })}
            </Menu>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default Bar;
