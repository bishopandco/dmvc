import { describe, it, expect } from 'vitest';
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
    const res = await qs.list({});
    expect(res).toEqual({ data: ['idx'], cursor: 'n' });
  });

  it('matches with filters', async () => {
    const model: any = {
      match: async () => ({ data: ['m'], cursor: undefined }),
    };
    const qs = new QueryService(model);
    const res = await qs.list({ status: 'active' });
    expect(res).toEqual({ data: ['m'], cursor: undefined });
  });

  it('lists without filters', async () => {
    const model: any = {
      list: async () => ({ data: ['l'], cursor: 'x' }),
    };
    const qs = new QueryService(model);
    const res = await qs.list({ pageSize: '2' });
    expect(res).toEqual({ data: ['l'], cursor: 'x' });
  });

  it('sorts and searches', async () => {
    const model: any = {
      listAll: async () => baseItems,
    };
    const qs = new QueryService(model);
    const resDesc = await qs.list({ sortField: 'name', sortDir: 'desc', page: '1', limit: '2' });
    expect(resDesc).toEqual({ data: [{ id: '3', name: 'ca' }, { id: '4', name: 'ca' }], cursor: '2' });
    const resAsc = await qs.list({ sortField: 'name' });
    expect(resAsc.data).toEqual([
      { id: '2', name: 'aa' },
      { id: '1', name: 'ba' },
      { id: '3', name: 'ca' },
      { id: '4', name: 'ca' },
    ]);
    expect(resAsc.cursor).toBeUndefined();
    const resSearch = await qs.list({ q: 'a' });
    expect(resSearch.data).toHaveLength(4);
    expect(new Set(resSearch.data.map((i: any) => i.id))).toEqual(
      new Set(['1', '2', '3', '4'])
    );
    expect(resSearch.cursor).toBeUndefined();
    await qs.list({ q: 'z' });
  });

  it('uses matchAll when filters with sort', async () => {
    const model: any = {
      matchAll: async () => baseItems,
    };
    const qs = new QueryService(model);
    const res = await qs.list({ status: 'active', sortField: 'name' });
    expect(res.data.length).toBe(4);
  });

  it('normalizes filters and handles invalid numeric params', async () => {
    let captured: { filters: Record<string, unknown>; limit?: number } | undefined;
    const model: any = {
      match: async (
        filters: Record<string, unknown>,
        _cursor?: string,
        limit?: number
      ) => {
        captured = { filters, limit };
        return { data: [], cursor: undefined };
      },
    };
    const qs = new QueryService(model);
    await qs.list({ status: undefined, state: 'active', limit: 'abc' });
    expect(captured?.filters).toEqual({ state: 'active' });
    expect(captured?.limit).toBe(10);
  });

  it('falls back when limit is non-positive', async () => {
    let seenLimit: number | undefined;
    const model: any = {
      list: async (_cursor?: string, limit?: number) => {
        seenLimit = limit;
        return { data: [], cursor: undefined };
      },
    };
    const qs = new QueryService(model);
    await qs.list({ limit: '0' });
    expect(seenLimit).toBe(10);
  });

  it('sorts items with missing fields', async () => {
    const modelAsc: any = {
      listAll: async () => [
        { id: '1' },
        { id: '2', name: 'm' },
        { id: '3', name: 'a' },
      ],
    };
    const qsAsc = new QueryService(modelAsc);
    const asc = await qsAsc.list({ sortField: 'name', sortDir: 'asc' });
    expect(asc.data[0].id).toBe('1');

    const modelDesc: any = {
      listAll: async () => [
        { id: '1', name: 'a' },
        { id: '2', name: 'b' },
        { id: '3' },
      ],
    };
    const qsDesc = new QueryService(modelDesc);
    const desc = await qsDesc.list({ sortField: 'name', sortDir: 'desc' });
    expect(desc.data[desc.data.length - 1].id).toBe('3');
  });
});

describe('QueryService count', () => {
  it('counts simply', async () => {
    const model: any = { count: async () => 4 };
    const qs = new QueryService(model);
    const res = await qs.count({});
    expect(res).toEqual({ total: 4 });
  });

  it('counts with filters', async () => {
    const model: any = { count: async () => 1 };
    const qs = new QueryService(model);
    const res = await qs.count({ status: 'active' });
    expect(res).toEqual({ total: 1 });
  });

  it('counts with sort/search', async () => {
    const model: any = { listAll: async () => baseItems };
    const qs = new QueryService(model);
    const res = await qs.count({ sortField: 'name', q: 'a', dir: 'desc' });
    expect(res).toEqual({ total: 4 });
    await qs.count({ q: 'z' });
  });

  it('counts with filters and sort', async () => {
    const model: any = { matchAll: async () => baseItems };
    const qs = new QueryService(model);
    const res = await qs.count({ status: 'active', sortField: 'name' });
    expect(res).toEqual({ total: 4 });
  });

  it('covers comparator branches', async () => {
    const model1: any = { listAll: async () => [{ name: 'b' }, { name: 'a' }] };
    const qs1 = new QueryService(model1);
    await qs1.count({ sortField: 'name' });
    const model2: any = { listAll: async () => [{ name: 'b' }, { name: 'c' }, { name: 'a' }] };
    const qs2 = new QueryService(model2);
    await qs2.count({ sortField: 'name', dir: 'desc' });
  });

  it('sorts count with missing fields', async () => {
    const model: any = { listAll: async () => [{ name: 'a' }, {}, { name: 'b' }] };
    const qs = new QueryService(model);
    await qs.count({ sortField: 'name', dir: 'desc' });
  });
});
