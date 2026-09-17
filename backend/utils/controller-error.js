/**
 * Recognises a failure that came from talking to the ZeroTier controller.
 *
 * @param {any} err the thrown value
 * @returns {boolean} true when this is an axios error from the controller
 */
export function isControllerError(err) {
  if (!err || typeof err !== "object") return false;
  return Boolean(err.isAxiosError || err.response || err.request);
}

/**
 * Maps a controller failure onto a status and message for the client.
 *
 * The distinction matters when reading logs: 502 means the controller
 * answered with something we could not use, 504 means it did not answer.
 * Neither is the panel's own fault, so neither should read as a 500.
 *
 * @param {any} err the thrown value
 * @returns {{status: number, error: string, detail?: string}} the response body
 */
export function describeControllerError(err) {
  const status = err?.response?.status;

  if (status) {
    // The controller replied, but not with something we can pass on. 401 and
    // 403 here mean ZU_CONTROLLER_TOKEN is wrong, which is worth saying
    // plainly rather than surfacing as a generic upstream failure.
    if (status === 401 || status === 403) {
      return {
        status: 502,
        error: "controllerUnauthorized",
        detail: "The controller rejected ZU_CONTROLLER_TOKEN.",
      };
    }
    if (status === 404) {
      return { status: 404, error: "notFoundOnController" };
    }
    return {
      status: 502,
      error: "controllerError",
      detail: `The controller responded with ${status}.`,
    };
  }

  return {
    status: 504,
    error: "controllerUnreachable",
    detail: "Could not reach the ZeroTier controller.",
  };
}
