import { z } from 'zod';

export interface Item {
  id: string;
  sort?: string;
  name?: string;
  createdBy?: string;
  [key: string]: any;
}

export class FakeEntity {
  store: Item[] = [];
  query: Record<string, any> = {};
  pageSize: number;
  constructor(initial: Item[] = [], pageSize = 50) {
    this.store = initial;
    this.pageSize = pageSize;
  }
  setClient(_: any) {}
  setTableName(_: string) {}
  put = (item: Item) => ({
    go: async () => {
      this.store.push(item);
      return { data: item };
    },
  });
  get = (key: Record<string, any>) => ({
    go: async () => ({
      data: this.store.find((i) => matchKey(i, key)),
    }),
  });
  patch = (key: Record<string, any>) => ({
    set: (update: Partial<Item>) => ({
      go: async () => {
        const idx = this.store.findIndex((i) => matchKey(i, key));
        const updated = { ...this.store[idx], ...update };
        this.store[idx] = updated;
        return { data: updated };
      },
    }),
  });
  delete = (key: Record<string, any>) => ({
    go: async () => {
      const idx = this.store.findIndex((i) => matchKey(i, key));
      const [deleted] = this.store.splice(idx, 1);
      return { data: deleted };
    },
  });
  private paginate(arr: Item[], cursor?: string, limit?: number) {
    const start = cursor ? parseInt(cursor, 10) : 0;
    const lim = Math.min(limit ?? this.pageSize, this.pageSize);
    const end = start + lim;
    const data = arr.slice(start, end);
    const next = end < arr.length ? String(end) : undefined;
    return { data, cursor: next };
  }
  scan = {
    go: async ({ cursor, limit }: { cursor?: string; limit?: number } = {}) =>
      this.paginate(this.store, cursor, limit),
  };
  find = (facets: Record<string, any>) => ({
    go: async ({ cursor, limit }: { cursor?: string; limit?: number } = {}) => {
      const filtered = this.store.filter((i) => matches(i, facets));
      return this.paginate(filtered, cursor, limit);
    },
  });
  match = (facets: Record<string, any>) => ({
    go: async ({ cursor, limit }: { cursor?: string; limit?: number } = {}) => {
      const filtered = this.store.filter((i) => matches(i, facets));
      return this.paginate(filtered, cursor, limit);
    },
  });
}

export const ItemSchema = z.object({
  id: z.string(),
  sort: z.string().optional(),
  name: z.string().optional(),
  createdBy: z.string().optional(),
});

export const KeySchema = z.object({ id: z.string() });
export const CompositeKeySchema = z.object({ id: z.string(), sort: z.string() });

function matchKey(item: Item, key: Record<string, any>) {
  return Object.entries(key).every(([k, v]) => item[k] === v);
}

function matches(item: Item, facets: Record<string, any>) {
  return Object.entries(facets).every(([k, v]) => item[k] === v);
}
