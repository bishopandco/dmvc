import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

vi.mock('readline-sync', () => ({
  default: { question: vi.fn() },
}));

import readlineSync from 'readline-sync';
import { generateModel, generateController } from '../src/generator';

describe('generators', () => {
  it('creates model and controller files', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dmvc-'));
    try {
      writeFileSync(
        path.join(dir, 'dmvc.config.ts'),
        "export default { modelFolder: 'app/models', controllerFolder: 'app/controllers' };\n",
      );
      const modelPath = generateModel('widget', dir);
      const controllerPath = generateController('widget', dir);
      expect(modelPath).toContain(path.join('app', 'models'));
      expect(controllerPath).toContain(path.join('app', 'controllers'));
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

  it('prompts to create config when missing', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dmvc-'));
    try {
      const rl = readlineSync as unknown as { question: ReturnType<typeof vi.fn> };
      (rl.question as any)
        .mockReturnValueOnce('app/models')
        .mockReturnValueOnce('app/controllers');
      const modelPath = generateModel('gadget', dir);
      const configPath = path.join(dir, 'dmvc.config.ts');
      expect(existsSync(configPath)).toBe(true);
      const configContent = readFileSync(configPath, 'utf8');
      expect(configContent).toContain("modelFolder: 'app/models'");
      expect(configContent).toContain("controllerFolder: 'app/controllers'");
      const controllerPath = generateController('gadget', dir);
      expect(rl.question).toHaveBeenCalledTimes(2);
      expect(modelPath).toContain(path.join('app', 'models'));
      expect(controllerPath).toContain(path.join('app', 'controllers'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
