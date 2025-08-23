import { describe, it, expect } from 'vitest';
import * as pkg from '../src';

describe('index exports', () => {
  it('should expose modules', () => {
    expect(pkg.BaseModel).toBeTypeOf('function');
    expect(pkg.BaseController).toBeTypeOf('function');
    expect(pkg.QueryService).toBeTypeOf('function');
    expect(pkg.requireAuth).toBeTypeOf('function');
  });
});
