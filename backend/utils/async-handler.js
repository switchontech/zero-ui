/**
 * Wraps an async route handler so a rejected promise reaches Express.
 *
 * Express 4 does not await handlers, so a rejection inside one is an
 * unhandled rejection -- which, under Node's default behaviour, terminates
 * the process. One unreachable ZeroTier controller would take the whole
 * panel down rather than failing the single request that touched it.
 *
 * @param {(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => Promise<any>} handler the route handler
 * @returns {import("express").RequestHandler} a handler that forwards rejections to next()
 */
export function asyncHandler(handler) {
  return function (req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
