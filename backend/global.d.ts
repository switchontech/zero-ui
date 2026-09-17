declare module "axios";

declare namespace Express {
  interface Request {
    /** Bearer token extracted by express-bearer-token. */
    token?: string;
    /** The signed-in user, populated by services/auth.js isAuthorized. */
    user?: Record<string, any>;
  }
}
