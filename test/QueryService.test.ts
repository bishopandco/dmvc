import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { QueryService } from '../src';

const baseItems = [
  { id: '1', name: 'ba', desc: undefined },
  { id: '2', name: 'aa', desc: undefined },
  { id: '3', name: 'ca', desc: undefined },
  { id: '4', name: 'ca', desc: undefined },
];

describe('QueryService list', () => {
  it('uses listIndex when available', async () => {
    const model: any = {
      entity: { query: { idx: () => ({ go: async () => ({ data: ['idx'], cursor: 'n' }) }) } },
      listIndex: 'idx',
    };
    const qs = new QueryService(model);
    const app = new Hono();
    app.get('/', (c) => qs.list(c));
    const res = await app.request('/');
    expect(await res.json()).toEqual({ data: ['idx'], cursor: 'n' });
  });

  it('matches with filters', async () => {
    const model: any = {
      match: async () => ({ data: ['m'], cursor: undefined }),
    };
    const qs = new QueryService(model);
    const app = new Hono();
    app.get('/', (c) => qs.list(c));
    const res = await app.request('/?status=active');
    expect(await res.json()).toEqual({ data: ['m'], cursor: undefined });
  });

  it('lists without filters', async () => {
    const model: any = {
      list: async () => ({ data: ['l'], cursor: 'x' }),
    };
    const qs = new QueryService(model);
    const app = new Hono();
    app.get('/', (c) => qs.list(c));
    const res = await app.request('/?pageSize=2');
    expect(await res.json()).toEqual({ data: ['l'], cursor: 'x' });
  });

  it('sorts and searches', async () => {
    const model: any = {
      listAll: async () => baseItems,
    };
    const qs = new QueryService(model);
    const app = new Hono();
    app.get('/', (c) => qs.list(c));
    const resDesc = await app.request('/?sortField=name&sortDir=desc&page=1&limit=2');
    expect(await resDesc.json()).toEqual({ data: [{ id: '3', name: 'ca' }, { id: '4', name: 'ca' }], cursor: '2' });
    const resAsc = await app.request('/?sortField=name');
    const ascJson = await resAsc.json();
    expect(ascJson.data).toEqual([
      { id: '2', name: 'aa' },
      { id: '1', name: 'ba' },
      { id: '3', name: 'ca' },
      { id: '4', name: 'ca' },
    ]);
    expect(ascJson.cursor).toBeUndefined();
    const resSearch = await app.request('/?q=a');
    const searchJson = await resSearch.json();
    expect(searchJson.data).toHaveLength(4);
    expect(new Set(searchJson.data.map((i: any) => i.id))).toEqual(
      new Set(['1', '2', '3', '4'])
    );
    expect(searchJson.cursor).toBeUndefined();
    await app.request('/?q=z');
  });

  it('uses matchAll when filters with sort', async () => {
    const model: any = {
      matchAll: async () => baseItems,
    };
    const qs = new QueryService(model);
    const app = new Hono();
    app.get('/', (c) => qs.list(c));
    const res = await app.request('/?status=active&sortField=name');
    const json = await res.json();
    expect(json.data.length).toBe(4);
  });
});

describe('QueryService count', () => {
  it('counts simply', async () => {
    const model: any = { count: async () => 4 };
    const qs = new QueryService(model);
    const app = new Hono();
    app.get('/', (c) => qs.count(c));
    const res = await app.request('/');
    expect(await res.json()).toEqual({ total: 4 });
  });

  it('counts with filters', async () => {
    const model: any = { count: async () => 1 };
    const qs = new QueryService(model);
    const app = new Hono();
    app.get('/', (c) => qs.count(c));
    const res = await app.request('/?status=active');
    expect(await res.json()).toEqual({ total: 1 });
  });

  it('counts with sort/search', async () => {
    const model: any = { listAll: async () => baseItems };
    const qs = new QueryService(model);
    const app = new Hono();
    app.get('/', (c) => qs.count(c));
    const res = await app.request('/?sortField=name&q=a&dir=desc');
    expect(await res.json()).toEqual({ total: 4 });
    await app.request('/?q=z');
  });

  it('counts with filters and sort', async () => {
    const model: any = { matchAll: async () => baseItems };
    const qs = new QueryService(model);
    const app = new Hono();
    app.get('/', (c) => qs.count(c));
    const res = await app.request('/?status=active&sortField=name');
    expect(await res.json()).toEqual({ total: 4 });
  });

  it('covers comparator branches', async () => {
    const model1: any = { listAll: async () => [{ name: 'b' }, { name: 'a' }] };
    const qs1 = new QueryService(model1);
    const app1 = new Hono();
    app1.get('/', (c) => qs1.count(c));
    await app1.request('/?sortField=name');
    const model2: any = { listAll: async () => [{ name: 'b' }, { name: 'c' }, { name: 'a' }] };
    const qs2 = new QueryService(model2);
    const app2 = new Hono();
    app2.get('/', (c) => qs2.count(c));
    await app2.request('/?sortField=name&dir=desc');
  });
});
