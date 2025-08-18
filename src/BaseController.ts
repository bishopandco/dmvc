import { Hono, Context } from "hono";
import * as z from "zod";
import { BaseModel } from "./BaseModel";
import { QueryService } from "./QueryService";
import { requireAuth, AuthCheckFn } from "./requireAuth";
export { requireAuth };

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

  constructor(options: ControllerOptions<M>) {
    this.model = options.model;
    this.options = options;
    const schemaShape =
      (
        this.model.keySchema as z.ZodObject<Record<string, z.ZodType>>
      )._def?.shape() ?? {};
    this.keyNames = Object.keys(schemaShape);
    this.pkName = options.idParam || this.keyNames[0];
  }

  public static register<M extends BaseModelClass>(
    app: Hono,
    options: ControllerOptions<M>
  ) {
    const controller = new BaseController(options);
    const { basePath, roles = {}, authCheckFn } = options;
    const pkName = controller.pkName;

    const queryService = new QueryService(
      options.model as unknown as typeof BaseModel,
      options.pageSize
    );

    app.get(
      `${basePath}`,
      requireAuth(roles.list || [], authCheckFn),
      (c: Context) => queryService.list(c)
    );

    app.get(
      `${basePath}/_count`,
      requireAuth(roles.list || [], authCheckFn),
      (c: Context) => queryService.count(c)
    );

    app.get(
      `${basePath}/:${pkName}`,
      requireAuth(roles.get || [], authCheckFn),
      (c: Context) => controller.get(c)
    );

    app.post(
      `${basePath}`,
      requireAuth(roles.create || [], authCheckFn),
      (c: Context) => controller.create(c)
    );

    app.patch(
      `${basePath}`,
      requireAuth(roles.update || [], authCheckFn),
      (c: Context) => controller.update(c)
    );

    app.delete(
      `${basePath}/:${pkName}`,
      requireAuth(roles.delete || [], authCheckFn),
      (c: Context) => controller.delete(c)
    );
  }

  public async get(c: Context) {
    const id = c.req.param(this.pkName) as string;
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
      return c.notFound();
    }
    return c.json(item);
  }

  public async create(c: Context) {
    let body: Record<string, unknown> = {};
    try {
      const parsed = await c.req.json();
      body = (parsed as Record<string, unknown>) || {};
    } catch {
      // ignore JSON parse errors (no body)
    }
    const user = c.get("user");
    if (user) {
      const createdBy = user.id ?? user.user ?? user.sub;
      if (createdBy) {
        (body as Record<string, unknown>).createdBy = createdBy;
      }
    }
    const created = await this.model.create(body);
    return c.json(created, 201);
  }

  public async update(c: Context) {
    const updates = (await c.req.json()) as Record<string, unknown>;
    if (this.keyNames.length > 1) {
      const missing = this.keyNames.filter((k) => !(k in updates));
      if (missing.length > 0 && typeof updates[this.keyNames[0]] === "string") {
        const pkVal = updates[this.keyNames[0]] as string;
        const found = await this.model.find(
          { [this.keyNames[0]]: pkVal } as Record<string, unknown>,
          undefined,
          1
        );
        const existing = found.data[0] as Record<string, unknown> | undefined;
        if (existing) {
          for (const k of missing) {
            if (existing[k] !== undefined) {
              updates[k] = existing[k];
            }
          }
        }
      }
    }
    const updated = await this.model.update(updates);
    return c.json(updated, 200);
  }

  public async delete(c: Context) {
    const id = c.req.param(this.pkName) as string;
    let key: Record<string, unknown> | string = id;
    if (this.keyNames.length > 1) {
      const found = await this.model.find(
        { [this.pkName]: id } as Record<string, unknown>,
        undefined,
        1
      );
      const existing = found.data[0] as Record<string, unknown> | undefined;
      if (!existing) {
        return c.notFound();
      }
      key = Object.fromEntries(this.keyNames.map((k) => [k, existing[k]]));
    }
    const deleted = await this.model.delete(key);
    return c.json(deleted, 200);
  }
}
