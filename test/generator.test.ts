import { describe, it, expect, vi } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs';
import path from 'path';
import { tmpdir } from 'os';

vi.mock('readline-sync', () => ({
  default: { question: vi.fn() },
}));

import readlineSync from 'readline-sync';
import { generateModel, generateController, runCli, runCliIfMain } from '../src/generator';

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
      expect(path.basename(modelPath)).toBe('WidgetModel.ts');
      expect(controllerPath).toContain(path.join('app', 'controllers'));
      expect(existsSync(modelPath)).toBe(true);
      expect(existsSync(controllerPath)).toBe(true);
      const modelContent = readFileSync(modelPath, 'utf8');
      expect(modelContent).toContain('class WidgetModel');
      expect(modelContent).toContain('import { ulid } from "ulid"');
      expect(modelContent).toContain('widget: z.string().default(() => ulid())');
      expect(modelContent).toContain(
        'createdAt: z\n    .string()\n    .default(() => new Date().toISOString())',
      );
      expect(modelContent).toContain(
        'updatedAt: z\n    .string()\n    .default(() => new Date().toISOString())',
      );
      expect(modelContent).not.toContain('id: z.string()');
      expect(modelContent).toContain('widget: { type: "string", required: true, default: () => ulid() },');
      expect(modelContent).toContain(
        'createdAt: { type: "string", default: () => new Date().toISOString() },',
      );
      expect(modelContent).toContain(
        'updatedAt: { type: "string", default: () => new Date().toISOString() },',
      );
      expect(modelContent).toContain('composite: ["widget"]');
      const controllerContent = readFileSync(controllerPath, 'utf8');
      expect(controllerContent).toContain('registerWidgetController');
      expect(controllerContent).toContain('import { WidgetModel } from "../models/WidgetModel"');
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
      expect(path.basename(modelPath)).toBe('GadgetModel.ts');
      expect(controllerPath).toContain(path.join('app', 'controllers'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses default folders when prompt returns empty', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dmvc-'));
    try {
      const rl = readlineSync as unknown as { question: ReturnType<typeof vi.fn> };
      (rl.question as any).mockReturnValueOnce('').mockReturnValueOnce('');
      const modelPath = generateModel('thing', dir);
      const configPath = path.join(dir, 'dmvc.config.ts');
      const configContent = readFileSync(configPath, 'utf8');
      expect(configContent).toContain("modelFolder: 'src/models'");
      expect(configContent).toContain("controllerFolder: 'src/controllers'");
      expect(modelPath).toContain(path.join('src', 'models'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws when model file already exists', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dmvc-'));
    try {
      writeFileSync(
        path.join(dir, 'dmvc.config.ts'),
        "export default { modelFolder: 'app/models' };\n",
      );
      const existingPath = path.join(dir, 'app', 'models', 'WidgetModel.ts');
      mkdirSync(path.dirname(existingPath), { recursive: true });
      writeFileSync(existingPath, 'export {};\n');
      expect(() => generateModel('widget', dir)).toThrow(/Model already exists/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws when controller file already exists', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dmvc-'));
    try {
      writeFileSync(
        path.join(dir, 'dmvc.config.ts'),
        "export default { controllerFolder: 'app/controllers' };\n",
      );
      const existingPath = path.join(dir, 'app', 'controllers', 'WidgetController.ts');
      mkdirSync(path.dirname(existingPath), { recursive: true });
      writeFileSync(existingPath, 'export {};\n');
      expect(() => generateController('widget', dir)).toThrow(/Controller already exists/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('supports config without default export', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dmvc-'));
    try {
      writeFileSync(
        path.join(dir, 'dmvc.config.ts'),
        "export = { modelFolder: 'app/models', controllerFolder: 'app/controllers' };\n",
      );
      const modelPath = generateModel('widget', dir);
      expect(modelPath).toContain(path.join('app', 'models'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to default model folder when missing in config', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dmvc-'));
    try {
      writeFileSync(
        path.join(dir, 'dmvc.config.ts'),
        "export default { controllerFolder: 'app/controllers' };\n",
      );
      const modelPath = generateModel('widget', dir);
      expect(modelPath).toContain(path.join('src', 'models'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to default controller folder when missing in config', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dmvc-'));
    try {
      writeFileSync(
        path.join(dir, 'dmvc.config.ts'),
        "export default { modelFolder: 'app/models' };\n",
      );
      const controllerPath = generateController('widget', dir);
      expect(controllerPath).toContain(path.join('src', 'controllers'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('runCli prints usage with invalid args', () => {
    const exit = vi.fn() as unknown as (code?: number) => never;
    const logger = { error: vi.fn(), log: vi.fn() };
    runCli({ argv: ['node', 'dmvc'], exit, logger });
    expect(logger.error).toHaveBeenCalledWith('Usage: dmvc generate [model|controller] Name');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('runCli handles unknown type', () => {
    const exit = vi.fn() as unknown as (code?: number) => never;
    const logger = { error: vi.fn(), log: vi.fn() };
    runCli({ argv: ['node', 'dmvc', 'generate', 'weird', 'Thing'], exit, logger });
    expect(logger.error).toHaveBeenCalledWith('Unknown type: weird');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('runCli creates model and controller', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dmvc-'));
    try {
      writeFileSync(
        path.join(dir, 'dmvc.config.ts'),
        "export default { modelFolder: 'app/models', controllerFolder: 'app/controllers' };\n",
      );
      const exit = vi.fn() as unknown as (code?: number) => never;
      const logger = { error: vi.fn(), log: vi.fn() };
      runCli({ argv: ['node', 'dmvc', 'generate', 'model', 'widget'], baseDir: dir, exit, logger });
      runCli({
        argv: ['node', 'dmvc', 'generate', 'controller', 'widget'],
        baseDir: dir,
        exit,
        logger,
      });
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalled();
      expect(existsSync(path.join(dir, 'app', 'models', 'WidgetModel.ts'))).toBe(true);
      expect(existsSync(path.join(dir, 'app', 'controllers', 'WidgetController.ts'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('runCli reports errors from generators', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dmvc-'));
    try {
      writeFileSync(
        path.join(dir, 'dmvc.config.ts'),
        "export default { modelFolder: 'app/models' };\n",
      );
      const existingPath = path.join(dir, 'app', 'models', 'WidgetModel.ts');
      mkdirSync(path.dirname(existingPath), { recursive: true });
      writeFileSync(existingPath, 'export {};\n');
      const exit = vi.fn() as unknown as (code?: number) => never;
      const logger = { error: vi.fn(), log: vi.fn() };
      runCli({ argv: ['node', 'dmvc', 'generate', 'model', 'widget'], baseDir: dir, exit, logger });
      expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/Model already exists/));
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('runCliIfMain runs when module is main', () => {
    const run = vi.fn();
    runCliIfMain({ mainModule: module, requireMain: module, run });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
