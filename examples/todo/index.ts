import 'dotenv/config';
import { Hono } from 'hono';
import { BaseController, BaseModel } from 'dmvc';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Entity } from 'electrodb';
import { z } from 'zod';

// define the todo schema
const TodoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
});

// model backed by ElectroDB
class TodoModel extends BaseModel<typeof TodoSchema> {
  constructor(client: DynamoDBDocumentClient, table: string) {
    super(client, table);
    this.schema = TodoSchema;
    this.keySchema = TodoSchema.pick({ id: true });
    this.entity = new Entity(
      {
        model: { entity: 'Todo', version: '1', service: 'app' },
        attributes: {
          id: { type: 'string', required: true },
          title: { type: 'string', required: true },
          completed: { type: 'boolean', default: false },
          type: { type: 'string', required: true, default: 'todo' },
        },
        indexes: {
          primary: {
            pk: { field: 'pk', composite: ['type'] },
            sk: { field: 'sk', composite: ['id'] },
          },
          byTitle: {
            index: 'gsi1pk-gsi1sk-index',
            pk: { field: 'gsi1pk', composite: ['title'] },
            sk: { field: 'gsi1sk', composite: ['id'] },
          },
          byCompleted: {
            index: 'gsi2pk-gsi2sk-index',
            pk: { field: 'gsi2pk', composite: ['completed'] },
            sk: { field: 'gsi2sk', composite: ['id'] },
          },
        },
      },
      { client, table }
    );
  }
}

// initialize DynamoDB connection once
const raw = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: process.env.DYNAMODB_ENDPOINT
    ? { accessKeyId: 'local', secretAccessKey: 'local' }
    : undefined,
});
const client = DynamoDBDocumentClient.from(raw);
BaseModel.configure({ client, table: process.env.DYNAMODB_TABLE_NAME! });

// create a Hono app and register REST routes for the model
const app = new Hono();
BaseController.register(app, { model: TodoModel, basePath: '/todos' });

export { TodoModel };
export default app;
