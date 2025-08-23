import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { BaseController, BaseModel } from '../src';
import { FakeEntity, ItemSchema, KeySchema, CompositeKeySchema } from './utils';

class CtrlModel extends BaseModel<typeof ItemSchema> {
  constructor(c: any, t: string) {
    super(new FakeEntity([], 5) as any, ItemSchema, KeySchema, c, t);
  }
}

class CompModel extends BaseModel<typeof ItemSchema> {
  constructor(c: any, t: string) {
    super(new FakeEntity([{ id: '1', sort: 'A', name: 'a' }], 5) as any, ItemSchema, CompositeKeySchema, c, t);
  }
}

beforeEach(() => {
  process.env.SKIP_AUTH = 'true';
});

it('handles missing keySchema shape', () => {
  class NoShapeModel extends BaseModel<typeof ItemSchema> {
    static get keySchema(): any {
      return { parse: (v: any) => v };
    }
    constructor(c: any, t: string) {
      super(new FakeEntity([], 5) as any, ItemSchema, KeySchema, c, t);
    }
  }
  const controller = new BaseController({
    model: NoShapeModel as any,
    basePath: '/test',
    idParam: 'id',
  });
  expect(controller).toBeInstanceOf(BaseController);
});

describe('BaseController with single key', () => {
  it('handles CRUD operations', async () => {
    CtrlModel.configure({ client: {} as any, table: 't' });
    const app = new Hono();
    app.use(async (c, next) => {
      c.set('user', { id: 'u1', role: 'admin' });
      await next();
    });
    BaseController.register(app, { model: CtrlModel as any, basePath: '/items' });

    const created = await app.request('/items', { method: 'POST', body: JSON.stringify({ id: '1', name: 'x' }) });
    expect(created.status).toBe(201);
    const data = await created.json();
    expect(data.createdBy).toBe('u1');

    const origCreate = CtrlModel.create;
    (CtrlModel as any).create = async () => ({ id: 'x' });
    const bad = await app.request('/items', {
      method: 'POST',
      body: 'bad',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(bad.status).toBe(201);
    const nullBody = await app.request('/items', {
      method: 'POST',
      body: 'null',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(nullBody.status).toBe(201);
    const appAlt = new Hono();
    appAlt.use(async (c, next) => {
      c.set('user', { user: 'alt' });
      await next();
    });
    BaseController.register(appAlt, { model: CtrlModel as any, basePath: '/alt' });
    const altRes = await appAlt.request('/alt', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(altRes.status).toBe(201);
    const appNoUser = new Hono();
    BaseController.register(appNoUser, { model: CtrlModel as any, basePath: '/nouser' });
    const noUserRes = await appNoUser.request('/nouser', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(noUserRes.status).toBe(201);
    const appSub = new Hono();
    appSub.use(async (c, next) => {
      c.set('user', { sub: 'sid' });
      await next();
    });
    BaseController.register(appSub, { model: CtrlModel as any, basePath: '/sub' });
    const subRes = await appSub.request('/sub', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(subRes.status).toBe(201);
    (CtrlModel as any).create = origCreate;

    const got = await app.request('/items/1');
    expect(got.status).toBe(200);

    const missing = await app.request('/items/2');
    expect(missing.status).toBe(404);

    const updated = await app.request('/items', { method: 'PATCH', body: JSON.stringify({ id: '1', name: 'y' }) });
    expect(updated.status).toBe(200);

    const deleted = await app.request('/items/1', { method: 'DELETE' });
    expect(deleted.status).toBe(200);
  });
});

describe('BaseController with composite key', () => {
  it('supports multi-key operations', async () => {
    CompModel.configure({ client: {} as any, table: 't' });
    const app = new Hono();
    app.use(async (c, next) => {
      c.set('user', { id: 'u1', role: 'admin' });
      await next();
    });
    BaseController.register(app, { model: CompModel as any, basePath: '/multi' });

    const getRes = await app.request('/multi/1');
    expect(getRes.status).toBe(200);
    const getNot = await app.request('/multi/999');
    expect(getNot.status).toBe(404);

    const upd = await app.request('/multi', { method: 'PATCH', body: JSON.stringify({ id: '1', name: 'b' }) });
    expect(upd.status).toBe(200);

    const del = await app.request('/multi/1', { method: 'DELETE' });
    expect(del.status).toBe(200);

    const notFound = await app.request('/multi/1', { method: 'DELETE' });
    expect(notFound.status).toBe(404);
  });
});
