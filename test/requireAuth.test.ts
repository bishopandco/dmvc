import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { requireAuth } from '../src';

describe('requireAuth', () => {
  beforeEach(() => {
    delete process.env.SKIP_AUTH;
  });

  it('skips auth when SKIP_AUTH is true', async () => {
    process.env.SKIP_AUTH = 'true';
    const app = new Hono();
    app.use(requireAuth());
    app.get('/', (c) => c.text('ok'));
    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  it('allows anonymous role', async () => {
    const app = new Hono();
    app.use(requireAuth(['anonymous']));
    app.get('/', (c) => c.text('ok'));
    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  it('rejects without user', async () => {
    const app = new Hono();
    app.use(requireAuth(['user']));
    app.get('/', (c) => c.text('ok'));
    const res = await app.request('/');
    expect(res.status).toBe(401);
  });

  it('rejects when role not allowed', async () => {
    const app = new Hono();
    app.use(async (c, next) => {
      c.set('user', { role: 'guest' });
      await next();
    });
    app.use(requireAuth(['admin']));
    app.get('/', (c) => c.text('ok'));
    const res = await app.request('/');
    expect(res.status).toBe(403);
  });

  it('allows when role allowed', async () => {
    const app = new Hono();
    app.use(async (c, next) => {
      c.set('user', { role: 'admin' });
      await next();
    });
    app.use(requireAuth(['admin']));
    app.get('/', (c) => c.text('ok'));
    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  it('uses custom check function', async () => {
    const app = new Hono();
    app.use(async (c, next) => {
      c.set('user', { role: 'user' });
      await next();
    });
    const check = async () => true;
    app.use(requireAuth(['member'], check));
    app.get('/', (c) => c.text('ok'));
    const res = await app.request('/');
    expect(res.status).toBe(200);
  });

  it('custom check function can reject', async () => {
    const app = new Hono();
    app.use(async (c, next) => {
      c.set('user', { role: 'user' });
      await next();
    });
    const check = async () => false;
    app.use(requireAuth(['user'], check));
    app.get('/', (c) => c.text('ok'));
    const res = await app.request('/');
    expect(res.status).toBe(403);
  });
});
