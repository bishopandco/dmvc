import 'dotenv/config';
import { randomUUID } from 'crypto';
import { TodoModel } from './index';

async function main() {
  const [, , command, id] = process.argv;
  try {
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
