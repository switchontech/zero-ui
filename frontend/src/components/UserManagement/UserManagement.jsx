import { useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@material-ui/core";
import DeleteIcon from "@material-ui/icons/Delete";

import { format, parseISO } from "date-fns";

import { useTranslation } from "react-i18next";

import API from "utils/API";

/**
 * Formats an ISO timestamp for the table, tolerating the nulls that records
 * written before a field existed still carry.
 *
 * @param {string | null} value the ISO timestamp
 * @returns {string} a display string
 */
function formatDate(value) {
  if (!value) return "-";
  try {
    return format(parseISO(value), "yyyy-MM-dd HH:mm");
  } catch {
    return "-";
  }
}

/**
 * @typedef {object} ManagedUser
 * @property {string} id
 * @property {string | null} email
 * @property {string | null} name
 * @property {string | null} picture
 * @property {string} provider
 * @property {boolean} enabled
 * @property {boolean} canSignIn
 * @property {string | null} createdAt
 * @property {string | null} lastLoginAt
 * @property {number} sessionCount
 */

function UserManagement() {
  const { t } = useTranslation();

  const [users, setUsers] = useState(/** @type {ManagedUser[]} */ ([]));
  const [me, setMe] = useState(/** @type {ManagedUser | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState(
    /** @type {ManagedUser | null} */ (null)
  );

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([API.get("user"), API.get("/auth/me", { baseURL: "/" })])
      .then(([usersRes, meRes]) => {
        setUsers(usersRes.data);
        setMe(meRes.data);
      })
      .catch((error) => {
        setMessage(error.response?.data?.error || "loadFailed");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const setEnabled = (user, enabled) => {
    API.patch(`user/${user.id}`, { enabled: enabled })
      .then(load)
      .catch((error) =>
        setMessage(error.response?.data?.error || "saveFailed")
      );
  };

  const confirmDelete = () => {
    const target = pendingDelete;
    if (!target) return;
    setPendingDelete(null);
    API.delete(`user/${target.id}`)
      .then(load)
      .catch((error) =>
        setMessage(error.response?.data?.error || "deleteFailed")
      );
  };

  if (loading) return <Typography>{t("loading")}</Typography>;

  return (
    <>
      <TableContainer component={Paper}>
        {/* Inside the card: the page background is dark, so secondary text
            placed on it directly all but disappears. */}
        <Box px={2} pt={2}>
          <Typography variant="body2" color="textSecondary">
            {t("usersDesc")}
          </Typography>
        </Box>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>{t("name")}</TableCell>
              <TableCell>{t("email")}</TableCell>
              <TableCell>{t("createdAt")}</TableCell>
              <TableCell>{t("lastLogin")}</TableCell>
              <TableCell align="center">{t("enabled")}</TableCell>
              <TableCell align="right">{t("delete")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => {
              const isSelf = Boolean(me && user.id === me.id);
              return (
                <TableRow key={user.id}>
                  <TableCell padding="checkbox">
                    <Avatar src={user.picture || undefined}>
                      {(user.name || "?").charAt(0).toUpperCase()}
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    {user.name}
                    {isSelf && (
                      <Chip
                        size="small"
                        label={t("you")}
                        style={{ marginLeft: 8 }}
                      />
                    )}
                    {user.enabled && !user.canSignIn && (
                      <Tooltip title={t("cannotSignInHint")}>
                        <Chip
                          size="small"
                          color="secondary"
                          variant="outlined"
                          label={t("cannotSignIn")}
                          style={{ marginLeft: 8 }}
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>{user.email || "-"}</TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>{formatDate(user.lastLoginAt)}</TableCell>
                  <TableCell align="center">
                    <Tooltip title={isSelf ? t("cannotDisableSelf") : ""}>
                      <span>
                        <Switch
                          color="primary"
                          checked={user.enabled}
                          disabled={isSelf}
                          onChange={(event) =>
                            setEnabled(user, event.target.checked)
                          }
                        />
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={isSelf ? t("cannotDeleteSelf") : ""}>
                      <span>
                        <Button
                          color="secondary"
                          disabled={isSelf}
                          onClick={() => setPendingDelete(user)}
                        >
                          <DeleteIcon />
                        </Button>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
      >
        <DialogTitle>{t("deleteUser")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("deleteUserConfirm", {
              name: pendingDelete?.name || pendingDelete?.email,
            })}
          </DialogContentText>
          <DialogContentText>{t("deleteUserNote")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)} color="primary">
            {t("cancel")}
          </Button>
          <Button onClick={confirmDelete} color="secondary">
            {t("delete")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(message)}
        autoHideDuration={6000}
        onClose={() => setMessage("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        message={t(message)}
      />
    </>
  );
}

export default UserManagement;
