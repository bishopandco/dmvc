import { Context, Next } from "hono";

export interface AuthUser {
  role: string;
  [key: string]: any;
}

export type AuthCheckFn = (
  user: AuthUser,
  allowedRoles: string[]
) => boolean | Promise<boolean>;

export function requireAuth(
  allowedRoles: string[] = [],
  checkFn?: AuthCheckFn
): (c: Context, next: Next) => Promise<Response | void> {
  return async (c: Context, next: Next) => {
    if (process.env.SKIP_AUTH === "true") {
      return next();
    }
    if (allowedRoles.includes("anonymous")) {
      return next();
    }
    const user = c.get("user") as AuthUser;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (allowedRoles.length > 0) {
      const ok = checkFn
        ? await checkFn(user, allowedRoles)
        : allowedRoles.includes(user.role);
      if (!ok) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }
    await next();
  };
}
