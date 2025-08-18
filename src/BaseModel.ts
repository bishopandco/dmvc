import type { DocumentClient, Entity, Schema } from "electrodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z, ZodSchema, infer as ZodInfer, TypeOf } from "zod";

interface PaginationResult<T> {
  data: T[];
  cursor?: string;
}

type Hook = <T>(data: T) => Promise<void>;

export const beforeCreateHooks = new Map<string, Hook[]>();
export const afterCreateHooks = new Map<string, Hook[]>();
export const beforeUpdateHooks = new Map<string, Hook[]>();
export const afterUpdateHooks = new Map<string, Hook[]>();
export const beforeDeleteHooks = new Map<string, Hook[]>();
export const afterDeleteHooks = new Map<string, Hook[]>();

export function BeforeCreate(target: any, propertyKey: string) {
  const hooks = beforeCreateHooks.get(target.constructor.name) || [];
  hooks.push(target[propertyKey]);
  beforeCreateHooks.set(target.constructor.name, hooks);
}

export function AfterCreate(target: any, propertyKey: string) {
  const hooks = afterCreateHooks.get(target.constructor.name) || [];
  hooks.push(target[propertyKey]);
  afterCreateHooks.set(target.constructor.name, hooks);
}

export function BeforeUpdate(target: any, propertyKey: string) {
  const hooks = beforeUpdateHooks.get(target.constructor.name) || [];
  hooks.push(target[propertyKey]);
  beforeUpdateHooks.set(target.constructor.name, hooks);
}

export function AfterUpdate(target: any, propertyKey: string) {
  const hooks = afterUpdateHooks.get(target.constructor.name) || [];
  hooks.push(target[propertyKey]);
  afterUpdateHooks.set(target.constructor.name, hooks);
}

export function BeforeDelete(target: any, propertyKey: string) {
  const hooks = beforeDeleteHooks.get(target.constructor.name) || [];
  hooks.push(target[propertyKey]);
  beforeDeleteHooks.set(target.constructor.name, hooks);
}

export function AfterDelete(target: any, propertyKey: string) {
  const hooks = afterDeleteHooks.get(target.constructor.name) || [];
  hooks.push(target[propertyKey]);
  afterDeleteHooks.set(target.constructor.name, hooks);
}

export abstract class BaseModel<T extends ZodSchema<object>> {
  protected entity: Entity<
    string,
    string,
    string,
    Schema<string, string, string>
  >;
  protected schema: T;
  protected keySchema: z.ZodObject<Record<string, z.ZodType>>;

  private static _instance: BaseModel<any>;
  protected static _client?: DocumentClient;
  protected static _table?: string;

  protected static getInstance(this: any): any {
    if (!this._instance) {
      let client = this._client as DocumentClient | undefined;
      let table = this._table as string | undefined;
      if (!client) {
        const region = process.env.AWS_REGION || "us-east-1";
        const clientOptions: any = { region };
        if (process.env.DYNAMODB_ENDPOINT) {
          clientOptions.endpoint = process.env.DYNAMODB_ENDPOINT;
        }
        const raw = new DynamoDBClient(clientOptions);
        client = DynamoDBDocumentClient.from(raw) as unknown as DocumentClient;
      }
      if (!table) {
        table = process.env.DYNAMODB_TABLE_NAME || "test";
      }
      this._instance = new this(client, table);
    }
    return this._instance;
  }

  static configure(config: { client: DocumentClient; table: string }) {
    this._client = config.client;
    this._table = config.table;
    this._instance = undefined as any;
  }

  static register(...models: any[]) {
    models.forEach((model) => {
      model._client = this._client;
      model._table = this._table;
      model._instance = undefined as any;
    });
  }

  static get entity() {
    return this.getInstance().entity;
  }

  static set entity(value: any) {
    this.getInstance().entity = value;
  }

  static get keySchema() {
    return this.getInstance().keySchema;
  }

  static async create(data: any) {
    return this.getInstance().create(data);
  }

  static async get(key: any) {
    return this.getInstance().get(key);
  }

  static async update(updates: any) {
    return this.getInstance().update(updates);
  }

  static async delete(key: any) {
    return this.getInstance().delete(key);
  }

  static async list(cursor?: string, limit?: number) {
    return this.getInstance().list(cursor, limit);
  }

  static async find(facets: any = {}, cursor?: string, limit?: number) {
    return this.getInstance().find(facets, cursor, limit);
  }

  static async match(facets: any = {}, cursor?: string, limit?: number) {
    return this.getInstance().match(facets, cursor, limit);
  }

  static async count(facets: any = {}) {
    return this.getInstance().count(facets);
  }

  static async listAll() {
    return this.getInstance().listAll();
  }

  static async matchAll(facets: any = {}) {
    return this.getInstance().matchAll(facets);
  }

  constructor(
    entity: Entity<string, string, string, Schema<string, string, string>>,
    schema: T,
    keySchema: z.ZodObject<Record<string, z.ZodType>>,
    client: DocumentClient,
    table: string
  ) {
    this.entity = entity;
    this.schema = schema;
    this.keySchema = keySchema;
    this.entity.setClient(client);
    this.entity.setTableName(table);
  }

  public async create(data: Partial<z.infer<T>>): Promise<z.infer<T>> {
    const validated = this.schema.parse(data);
    const beforeHooks = beforeCreateHooks.get(this.constructor.name) || [];
    for (const hook of beforeHooks) {
      await hook(validated);
    }
    const result = await this.entity.put(validated).go();
    const afterHooks = afterCreateHooks.get(this.constructor.name) || [];
    for (const hook of afterHooks) {
      await hook(result.data);
    }
    return result.data;
  }

  public async get(key: Record<string, unknown>): Promise<z.infer<T> | null> {
    const result = await this.entity.get(key).go();
    return result.data ?? null;
  }

  public async update(updates: Partial<z.infer<T>>): Promise<z.infer<T>> {
    const validated = (
      this.schema as unknown as z.ZodObject<Record<string, z.ZodType>>
    )
      .partial()
      .parse(updates);
    const key = this.keySchema.parse(validated);

    const updateData = Object.fromEntries(
      Object.entries(validated).filter(([k]) => !(k in key))
    );

    const beforeHooks = beforeUpdateHooks.get(this.constructor.name) || [];
    for (const hook of beforeHooks) {
      await hook(updateData);
    }

    const result = await this.entity
      .patch(key)
      .set(updateData as Partial<TypeOf<T>>)
      .go();

    const afterHooks = afterUpdateHooks.get(this.constructor.name) || [];
    for (const hook of afterHooks) {
      await hook(result.data);
    }

    return result.data;
  }

  public async delete(
    key: string | Record<string, unknown>
  ): Promise<PaginationResult<z.infer<T>>> {
    let keyObj: Record<string, unknown>;
    if (typeof key === "string") {
      const shape =
        (
          this.keySchema as z.ZodObject<Record<string, z.ZodType>>
        )._def?.shape() ?? {};
      const keyNames = Object.keys(shape);
      if (keyNames.length === 1) {
        keyObj = { [keyNames[0]]: key };
      } else {
        throw new Error(
          "Composite key delete requires an object containing all key attributes"
        );
      }
    } else {
      keyObj = key;
    }

    const beforeHooks = beforeDeleteHooks.get(this.constructor.name) || [];
    for (const hook of beforeHooks) {
      await hook(keyObj);
    }

    const result = await this.entity.delete(keyObj).go();

    const afterHooks = afterDeleteHooks.get(this.constructor.name) || [];
    for (const hook of afterHooks) {
      await hook(result.data);
    }

    return {
      data: Array.isArray(result.data) ? result.data : [result.data],
    };
  }

  public async list(
    cursor?: string,
    limit: number = 10
  ): Promise<PaginationResult<z.infer<T>>> {
    let allItems: z.infer<T>[] = [];
    let nextCursor = cursor;
    do {
      const opts: { cursor?: string; limit?: number } = {};
      if (nextCursor) opts.cursor = nextCursor;
      const remaining = limit - allItems.length;
      if (remaining > 0) opts.limit = remaining;
      const res = await this.entity.scan.go(opts);
      allItems = allItems.concat(res.data as z.infer<T>[]);
      nextCursor = res.cursor ?? undefined;
    } while (allItems.length < limit && nextCursor);
    return {
      data: allItems.slice(0, limit),
      cursor: nextCursor ?? null,
    };
  }

  public async find(
    facets: Partial<z.infer<T>> = {},
    cursor?: string,
    limit: number = 10
  ): Promise<PaginationResult<z.infer<T>>> {
    const opts: { cursor?: string; limit?: number } = {};
    if (cursor) opts.cursor = cursor;
    if (limit != null) opts.limit = limit;
    const result = await this.entity.find(facets).go(opts);
    return { data: result.data, cursor: result.cursor };
  }

  public async match(
    facets: Partial<z.infer<T>> = {},
    cursor?: string,
    limit: number = 10
  ): Promise<PaginationResult<z.infer<T>>> {
    const opts: { cursor?: string; limit?: number } = {};
    if (cursor) opts.cursor = cursor;
    if (limit != null) opts.limit = limit;
    const result = await this.entity.match(facets).go(opts);
    return { data: result.data, cursor: result.cursor };
  }

  public async count(facets: Partial<z.infer<T>> = {}): Promise<number> {
    let total = 0;
    let cursor: string | undefined;

    do {
      const query = Object.keys(facets).length
        ? this.entity.match(facets)
        : this.entity.scan;
      const res = await (query as any).go({
        cursor,
        select: "COUNT",
        consistent: true,
      });

      total += res.data.length ?? 0;
      cursor = res.cursor;
    } while (cursor);

    return total;
  }

  public async listAll(): Promise<z.infer<T>[]> {
    const items: z.infer<T>[] = [];
    let cursor: string | undefined;
    do {
      const result = await this.list(cursor);
      items.push(...result.data);
      cursor = result.cursor;
    } while (cursor);
    return items;
  }

  public async matchAll(
    facets: Partial<z.infer<T>> = {}
  ): Promise<z.infer<T>[]> {
    const items: z.infer<T>[] = [];
    let cursor: string | undefined;
    do {
      const result = await this.match(facets, cursor);
      items.push(...result.data);
      cursor = result.cursor;
    } while (cursor);
    return items;
  }
}
