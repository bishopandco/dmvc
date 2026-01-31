import * as z from "zod";
import { BaseModel } from "./BaseModel";
import { QueryService } from "./QueryService";
import {
  requireAuth,
  AuthCheckFn,
  requireAuthFastify,
  FastifyAuthHook,
} from "./requireAuth";
export { requireAuth };

type HonoLikeApp = {
  get: (path: string, ...handlers: any[]) => void;
  post: (path: string, ...handlers: any[]) => void;
  patch: (path: string, ...handlers: any[]) => void;
  delete: (path: string, ...handlers: any[]) => void;
};

type FastifyInstanceLike = {
  get: (path: string, opts: Record<string, unknown>, handler: any) => void;
  post: (path: string, opts: Record<string, unknown>, handler: any) => void;
  patch: (path: string, opts: Record<string, unknown>, handler: any) => void;
  delete: (path: string, opts: Record<string, unknown>, handler: any) => void;
};

interface ControllerResult<T = unknown> {
  status: number;
  data?: T;
}

export interface BaseModelClass {
  keySchema: z.ZodObject<Record<string, z.ZodType>>;
  find: any;
  get: any;
  create: any;
  update: any;
  delete: any;
  list: any;
  count: any;
  match: any;
  new (...args: any[]): BaseModel<any>;
}

export interface ControllerOptions<M extends BaseModelClass> {
  /** The data model class (extends BaseModel) */
  model: M;
  /** Base path for routes, e.g. '/items' */
  basePath: string;
  /** Name of the path parameter corresponding to the primary key (defaults to first keySchema property) */
  idParam?: string;
  /** Roles allowed per operation */
  roles?: {
    list?: string[];
    get?: string[];
    create?: string[];
    update?: string[];
    delete?: string[];
  };
  /** Optional custom authorization checker */
  authCheckFn?: AuthCheckFn;
  /** Default page size for pagination */
  pageSize?: number;
}

export class BaseController<M extends BaseModelClass> {
  protected model: M;
  protected options: ControllerOptions<M>;
  protected pkName: string;
  protected keyNames: string[];
  private queryService: QueryService<typeof BaseModel>;

  constructor(options: ControllerOptions<M>) {
    this.model = options.model;
    this.options = options;
    const schemaShape =
      (
        this.model.keySchema as z.ZodObject<Record<string, z.ZodType>>
      )._def?.shape() ?? {};
    this.keyNames = Object.keys(schemaShape);
    this.pkName = options.idParam || this.keyNames[0];
    this.queryService = new QueryService(
      options.model as unknown as typeof BaseModel,
      options.pageSize
    );
  }

  public static register<M extends BaseModelClass>(
    app: HonoLikeApp,
    options: ControllerOptions<M>
  ) {
    const controller = new BaseController(options);
    const { basePath, roles = {}, authCheckFn } = options;
    const pkName = controller.pkName;
    const listAuth = requireAuth(roles.list || [], authCheckFn);
    const getAuth = requireAuth(roles.get || [], authCheckFn);
    const createAuth = requireAuth(roles.create || [], authCheckFn);
    const updateAuth = requireAuth(roles.update || [], authCheckFn);
    const deleteAuth = requireAuth(roles.delete || [], authCheckFn);

    app.get(`${basePath}`, listAuth, async (c: any) => {
      const result = await controller.list(c.req.query());
      return c.json(result);
    });

    app.get(`${basePath}/_count`, listAuth, async (c: any) => {
      const result = await controller.count(c.req.query());
      return c.json(result);
    });

    app.get(`${basePath}/:${pkName}`, getAuth, async (c: any) => {
      const id = c.req.param(pkName) as string;
      const result = await controller.getById(id);
      if (result.status === 404) {
        return c.notFound();
      }
      return c.json(result.data, result.status);
    });

    app.post(`${basePath}`, createAuth, async (c: any) => {
      let body: Record<string, unknown> | undefined;
      try {
        body = await c.req.json();
      } catch {
        body = undefined;
      }
      const result = await controller.create(body, c.get("user"));
      return c.json(result.data, result.status);
    });

    app.patch(`${basePath}`, updateAuth, async (c: any) => {
      const updates = (await c.req.json()) as Record<string, unknown>;
      const result = await controller.update(updates);
      return c.json(result.data, result.status);
    });

    app.delete(`${basePath}/:${pkName}`, deleteAuth, async (c: any) => {
      const id = c.req.param(pkName) as string;
      const result = await controller.deleteById(id);
      if (result.status === 404) {
        return c.notFound();
      }
      return c.json(result.data, result.status);
    });
  }

  public static registerFastify<M extends BaseModelClass>(
    app: FastifyInstanceLike,
    options: ControllerOptions<M>
  ) {
    const controller = new BaseController(options);
    const { basePath, roles = {}, authCheckFn } = options;
    const pkName = controller.pkName;

    const withAuth = (allowed: string[] = []): FastifyAuthHook | undefined =>
      requireAuthFastify(allowed, authCheckFn) || undefined;

    const listAuth = withAuth(roles.list || []);
    const getAuth = withAuth(roles.get || []);
    const createAuth = withAuth(roles.create || []);
    const updateAuth = withAuth(roles.update || []);
    const deleteAuth = withAuth(roles.delete || []);

    /* v8 ignore start */
    app.get(
      `${basePath}`,
      listAuth ? { preHandler: listAuth } : {},
      async (request: any, reply: any) => {
        const result = await controller.list(request.query || {});
        return reply.status(200).send(result);
      }
    );

    app.get(
      `${basePath}/_count`,
      listAuth ? { preHandler: listAuth } : {},
      async (request: any, reply: any) => {
        const result = await controller.count(request.query || {});
        return reply.status(200).send(result);
      }
    );

    app.get(
      `${basePath}/:${pkName}`,
      getAuth ? { preHandler: getAuth } : {},
      async (request: any, reply: any) => {
        const params = (request.params || {}) as Record<string, string>;
        const id = params[pkName] as string;
        const result = await controller.getById(id);
        if (result.status === 404) {
          return reply.status(404).send();
        }
        return reply.status(result.status).send(result.data);
      }
    );

    app.post(
      `${basePath}`,
      createAuth ? { preHandler: createAuth } : {},
      async (request: any, reply: any) => {
        const result = await controller.create(request.body || {}, request.user);
        return reply.status(result.status).send(result.data);
      }
    );

    app.patch(
      `${basePath}`,
      updateAuth ? { preHandler: updateAuth } : {},
      async (request: any, reply: any) => {
        const result = await controller.update((request.body || {}) as Record<string, unknown>);
        return reply.status(result.status).send(result.data);
      }
    );

    app.delete(
      `${basePath}/:${pkName}`,
      deleteAuth ? { preHandler: deleteAuth } : {},
      async (request: any, reply: any) => {
        const params = (request.params || {}) as Record<string, string>;
        const id = params[pkName] as string;
        const result = await controller.deleteById(id);
        if (result.status === 404) {
          return reply.status(404).send();
        }
        return reply.status(result.status).send(result.data);
      }
    );
    /* v8 ignore stop */
  }

  public async list(query: Record<string, unknown>) {
    return this.queryService.list(query);
  }

  public async count(query: Record<string, unknown>) {
    return this.queryService.count(query);
  }

  public async getById(id: string): Promise<ControllerResult> {
    let item: unknown | null;
    if (this.keyNames.length > 1) {
      const result = await this.model.find(
        { [this.pkName]: id } as Record<string, unknown>,
        undefined,
        1
      );
      item = result.data[0] ?? null;
    } else {
      item = await this.model.get({ [this.pkName]: id });
    }
    if (!item) {
      return { status: 404 };
    }
    return { status: 200, data: item };
  }

  public async create(
    body: Record<string, unknown> | undefined,
    user?: Record<string, unknown>
  ): Promise<ControllerResult> {
    const payload: Record<string, unknown> = body && typeof body === "object"
      ? { ...body }
      : {};
    if (user) {
      const createdBy =
        (user as any).id ?? (user as any).user ?? (user as any).sub;
      if (createdBy) {
        payload.createdBy = createdBy;
      }
    }
    const created = await this.model.create(payload);
    return { status: 201, data: created };
  }

  public async update(updates: Record<string, unknown>): Promise<ControllerResult> {
    const changes: Record<string, unknown> = { ...updates };
    if (this.keyNames.length > 1) {
      const missing = this.keyNames.filter((k) => !(k in changes));
      const primaryKey = this.keyNames[0];
      if (missing.length > 0 && typeof changes[primaryKey] === "string") {
        const pkVal = changes[primaryKey] as string;
        const found = await this.model.find(
          { [primaryKey]: pkVal } as Record<string, unknown>,
          undefined,
          1
        );
        const existing = found.data[0] as Record<string, unknown> | undefined;
        if (existing) {
          for (const key of missing) {
            if (existing[key] !== undefined) {
              changes[key] = existing[key];
            }
          }
        }
      }
    }
    const updated = await this.model.update(changes);
    return { status: 200, data: updated };
  }

  public async deleteById(id: string): Promise<ControllerResult> {
    let key: Record<string, unknown> | string = id;
    if (this.keyNames.length > 1) {
      const found = await this.model.find(
        { [this.pkName]: id } as Record<string, unknown>,
        undefined,
        1
      );
      const existing = found.data[0] as Record<string, unknown> | undefined;
      if (!existing) {
        return { status: 404 };
      }
      key = Object.fromEntries(this.keyNames.map((k) => [k, existing[k]]));
    }
    const deleted = await this.model.delete(key);
    return { status: 200, data: deleted };
  }
}
