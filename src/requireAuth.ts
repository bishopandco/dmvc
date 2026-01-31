export interface AuthUser {
  role: string;
  [key: string]: any;
}

export type AuthCheckFn = (
  user: AuthUser,
  allowedRoles: string[]
) => boolean | Promise<boolean>;

export interface HonoContextLike {
  get: (key: string) => any;
  json: (payload: any, status?: number) => any;
}

export type HonoNextLike = () => Promise<void>;

export interface FastifyReplyLike {
  status: (code: number) => FastifyReplyLike;
  send: (payload?: any) => FastifyReplyLike;
}

export interface FastifyRequestLike {
  [key: string]: any;
}

export function requireAuth(
  allowedRoles: string[] = [],
  checkFn?: AuthCheckFn
): (c: HonoContextLike, next: HonoNextLike) => Promise<any> {
  return async (c: HonoContextLike, next: HonoNextLike) => {
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

export type FastifyAuthHook =
  | ((
      request: FastifyRequestLike,
      reply: FastifyReplyLike
    ) => Promise<void | FastifyReplyLike>)
  | null;

export function requireAuthFastify(
  allowedRoles: string[] = [],
  checkFn?: AuthCheckFn
): FastifyAuthHook {
  if (allowedRoles.length === 0 && !checkFn) {
    return null;
  }

  return async (request: FastifyRequestLike, reply: FastifyReplyLike) => {
    if (process.env.SKIP_AUTH === "true") {
      return;
    }

    if (allowedRoles.includes("anonymous")) {
      return;
    }

    const user = (request as any).user as AuthUser | undefined;
    if (!user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (allowedRoles.length > 0) {
      const ok = checkFn
        ? await checkFn(user, allowedRoles)
        : allowedRoles.includes(user.role);
      if (!ok) {
        return reply.status(403).send({ error: "Forbidden" });
      }
    }
  };
}
