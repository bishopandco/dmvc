#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

function toPascalCase(str: string): string {
  return str
    .replace(/[-_]+/g, ' ')
    .replace(/\s+(\w)/g, (_, c) => c.toUpperCase())
    .replace(/^(\w)/, (_, c) => c.toUpperCase());
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function generateModel(name: string, baseDir: string = process.cwd()) {
  const className = toPascalCase(name);
  const idName = name.toLowerCase();
  const dir = path.join(baseDir, 'src', 'models');
  const filePath = path.join(dir, `${className}.ts`);
  ensureDir(dir);
  if (existsSync(filePath)) {
    throw new Error(`Model already exists: ${filePath}`);
  }
  const content = `import { BaseModel } from "@bishop-and-co/dmvc";
import { Entity } from "electrodb";
import { z } from "zod";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const ${className}Schema = z.object({
  ${idName}: z.string(),
  // define additional attributes here
});

const ${className}KeySchema = z.object({
  ${idName}: z.string(),
});

export class ${className}Model extends BaseModel<typeof ${className}Schema> {
  constructor(client: DynamoDBDocumentClient, table: string) {
    const entity = new Entity(
      {
        model: { entity: "${className}", version: "1", service: "app" },
        attributes: {
          ${idName}: { type: "string", required: true },
        },
        indexes: {
          primary: {
            pk: { field: "pk", composite: ["${idName}"] },
            sk: { field: "sk", composite: ["${idName}"] },
          },
        },
      },
      { client, table }
    );
    super(entity, ${className}Schema, ${className}KeySchema, client, table);
  }
}
`;
  writeFileSync(filePath, content);
  return filePath;
}

export function generateController(
  name: string,
  baseDir: string = process.cwd()
) {
  const className = toPascalCase(name);
  const dir = path.join(baseDir, 'src', 'controllers');
  const filePath = path.join(dir, `${className}Controller.ts`);
  ensureDir(dir);
  if (existsSync(filePath)) {
    throw new Error(`Controller already exists: ${filePath}`);
  }
  const modelImport = `${className}Model`;
  const basePath = `/${name.toLowerCase()}s`;
  const content = `import { Hono } from "hono";
import { BaseController } from "@bishop-and-co/dmvc";
import { ${modelImport} } from "../models/${className}";

export function register${className}Controller(app: Hono) {
  BaseController.register(app, { model: ${modelImport}, basePath: "${basePath}" });
}
`;
  writeFileSync(filePath, content);
  return filePath;
}

if (require.main === module) {
  const [command, type, name] = process.argv.slice(2);
  if (command !== 'generate' || !type || !name) {
    console.error('Usage: dmvc generate [model|controller] Name');
    process.exit(1);
  }
  try {
    if (type === 'model') {
      const fp = generateModel(name);
      console.log(`Created model: ${path.relative(process.cwd(), fp)}`);
    } else if (type === 'controller') {
      const fp = generateController(name);
      console.log(`Created controller: ${path.relative(process.cwd(), fp)}`);
    } else {
      console.error('Unknown type: ' + type);
      process.exit(1);
    }
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
}
