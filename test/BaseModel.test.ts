import { describe, it, expect } from 'vitest';
import {
  BaseModel,
  BeforeCreate,
  AfterCreate,
  BeforeUpdate,
  AfterUpdate,
  BeforeDelete,
  AfterDelete,
} from '../src';
import {
  FakeEntity,
  ItemSchema,
  KeySchema,
  CompositeKeySchema,
} from './utils';

class TestModel extends BaseModel<typeof ItemSchema> {
  static hooks: string[] = [];
  constructor(client: any, table: string) {
    super(new FakeEntity([], 5) as any, ItemSchema, KeySchema, client, table);
  }
  bc(data: any) {
    TestModel.hooks.push('bc');
  }
  ac(data: any) {
    TestModel.hooks.push('ac');
  }
  bu(data: any) {
    TestModel.hooks.push('bu');
  }
  au(data: any) {
    TestModel.hooks.push('au');
  }
  bd(data: any) {
    TestModel.hooks.push('bd');
  }
  ad(data: any) {
    TestModel.hooks.push('ad');
  }
}
BeforeCreate(TestModel.prototype, 'bc');
AfterCreate(TestModel.prototype, 'ac');
BeforeUpdate(TestModel.prototype, 'bu');
AfterUpdate(TestModel.prototype, 'au');
BeforeDelete(TestModel.prototype, 'bd');
AfterDelete(TestModel.prototype, 'ad');

describe('BaseModel', () => {
  it('initializes with env when not configured', () => {
    process.env.DYNAMODB_ENDPOINT = 'http://localhost';
    (TestModel as any)._instance = undefined;
    (TestModel as any)._client = undefined;
    (TestModel as any)._table = undefined;
    const ent = TestModel.entity;
    expect(ent).toBeDefined();
    delete process.env.DYNAMODB_ENDPOINT;
  });

  it('supports full lifecycle operations with hooks', async () => {
    const client = {} as any;
    TestModel.configure({ client, table: 'tbl' });

    const customEntity = new FakeEntity([], 5);
    TestModel.entity = customEntity as any;
    expect(TestModel.entity).toBe(customEntity as any);

    class OtherModel extends BaseModel<typeof ItemSchema> {
      constructor(c: any, t: string) {
        super(new FakeEntity([], 5) as any, ItemSchema, KeySchema, c, t);
      }
    }
    TestModel.register(OtherModel);
    expect((OtherModel as any)._client).toBe(client);

    const created = await TestModel.create({ id: '1', name: 'a' });
    expect(created.name).toBe('a');
    expect(TestModel.hooks.includes('bc')).toBe(true);
    expect(TestModel.hooks.includes('ac')).toBe(true);

    const fetched = await TestModel.get({ id: '1' });
    expect(fetched?.id).toBe('1');

    const updated = await TestModel.update({ id: '1', name: 'b' });
    expect(updated.name).toBe('b');
    expect(TestModel.hooks.includes('bu')).toBe(true);
    expect(TestModel.hooks.includes('au')).toBe(true);

    const del = await TestModel.delete('1');
    expect(del.data[0].id).toBe('1');
    expect(TestModel.hooks.includes('bd')).toBe(true);
    expect(TestModel.hooks.includes('ad')).toBe(true);

    for (let i = 0; i < 12; i++) {
      await TestModel.create({ id: String(i + 2), name: `n${i}` });
    }
    const list = await TestModel.list();
    expect(list.data.length).toBe(10);

    const find = await TestModel.find({ name: 'n0' });
    expect(find.data[0].id).toBe('2');

    const match = await TestModel.match({ name: 'n1' });
    expect(match.data[0].id).toBe('3');

    const countAll = await TestModel.count();
    expect(countAll).toBe(12);
    const countMatch = await TestModel.count({ name: 'n0' });
    expect(countMatch).toBe(1);

    const all = await TestModel.listAll();
    expect(all.length).toBe(12);
    const matchedAll = await TestModel.matchAll({ name: 'n2' });
    expect(matchedAll.length).toBe(1);

    const inst = (TestModel as any).getInstance();
    inst.entity.delete = (key: any) => ({
      go: async () => ({ data: [{ ...key }] }),
    });
    const delArr = await TestModel.delete('2');
    expect(Array.isArray(delArr.data)).toBe(true);

    await TestModel.find({}, '0');
    await TestModel.match({}, '0');

    inst.entity.scan.go = async () => ({
      data: { length: undefined },
      cursor: undefined,
    });
    const zero = await TestModel.count();
    expect(zero).toBe(0);
  });

  it('throws on composite key delete with string', async () => {
    class MultiModel extends BaseModel<typeof ItemSchema> {
      constructor(c: any, t: string) {
        super(new FakeEntity([], 5) as any, ItemSchema, CompositeKeySchema, c, t);
      }
    }
    MultiModel.configure({ client: {} as any, table: 'tbl' });
    await expect(MultiModel.delete('1')).rejects.toThrow(
      'Composite key delete requires an object containing all key attributes'
    );
  });

  it('handles delete when keySchema lacks shape', async () => {
    class OddModel extends BaseModel<typeof ItemSchema> {
      constructor(c: any, t: string) {
        super(new FakeEntity([], 5) as any, ItemSchema, { parse: (v: any) => v } as any, c, t);
      }
    }
    OddModel.configure({ client: {} as any, table: 't' });
    await expect(OddModel.delete('1')).rejects.toThrow();
  });
});
