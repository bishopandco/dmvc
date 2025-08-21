import 'dotenv/config';
import { randomUUID } from 'crypto';
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import { TodoModel } from './index';

async function ensureTable() {
  if (!process.env.DYNAMODB_TABLE_NAME) return;

  const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: process.env.DYNAMODB_ENDPOINT
      ? { accessKeyId: 'local', secretAccessKey: 'local' }
      : undefined,
  });

  try {
    await client.send(
      new DescribeTableCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME,
      }),
    );
  } catch (err: any) {
    if (err.name !== 'ResourceNotFoundException') throw err;

    await client.send(
      new CreateTableCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME,
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
          { AttributeName: 'gsi1pk', AttributeType: 'S' },
          { AttributeName: 'gsi1sk', AttributeType: 'S' },
          { AttributeName: 'gsi2pk', AttributeType: 'S' },
          { AttributeName: 'gsi2sk', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        GlobalSecondaryIndexes: [
          {
            IndexName: 'gsi1pk-gsi1sk-index',
            KeySchema: [
              { AttributeName: 'gsi1pk', KeyType: 'HASH' },
              { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
          {
            IndexName: 'gsi2pk-gsi2sk-index',
            KeySchema: [
              { AttributeName: 'gsi2pk', KeyType: 'HASH' },
              { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    );
  }
}

async function main() {
  const [, , command, id] = process.argv;
  try {
    await ensureTable();
    switch (command) {
      case 'create': {
        const todo = await TodoModel.create({ id: randomUUID(), title: 'demo todo' });
        console.log(todo);
        break;
      }
      case 'read': {
        if (!id) throw new Error('ID required');
        const todo = await TodoModel.get({ id });
        console.log(todo);
        break;
      }
      case 'update': {
        if (!id) throw new Error('ID required');
        const todo = await TodoModel.update({ id, completed: true });
        console.log(todo);
        break;
      }
      case 'destroy': {
        if (!id) throw new Error('ID required');
        const result = await TodoModel.delete({ id });
        console.log(result);
        break;
      }
      default:
        console.log('Usage: tsx scripts.ts <create|read|update|destroy> [id]');
    }
  } catch (err) {
    console.error(err);
  }
}

main();
