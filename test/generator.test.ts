import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { generateModel, generateController } from '../src/generator';

describe('generators', () => {
  it('creates model and controller files', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dmvc-'));
    try {
      const modelPath = generateModel('widget', dir);
      const controllerPath = generateController('widget', dir);
      expect(existsSync(modelPath)).toBe(true);
      expect(existsSync(controllerPath)).toBe(true);
      const modelContent = readFileSync(modelPath, 'utf8');
      expect(modelContent).toContain('class WidgetModel');
      expect(modelContent).toContain('widget: z.string()');
      expect(modelContent).not.toContain('id: z.string()');
      expect(modelContent).toContain('composite: ["widget"]');
      const controllerContent = readFileSync(controllerPath, 'utf8');
      expect(controllerContent).toContain('registerWidgetController');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
