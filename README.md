```terminaloutput
██████╗   ███╗   ███╗ ██╗     ██╗  ██████╗ 
██╔══██╗  ████╗ ████║ ██║     ██║ ██╔════╝ 
██║  ██║  ██╔████╔██║ ██║     ██║ ██║           
██║  ██║  ██║╚██╔╝██║ ╚██╗   ██╔╝ ██║           
██████╔╝  ██║ ╚═╝ ██║  ╚██████╔╝  ╚██████╗ 
╚═════╝   ╚═╝     ╚═╝   ╚═════╝    ╚═════╝ 
```

# DMVC 

dmvc provides a minimal model/controller layer for building REST APIs on top of [Hono](https://hono.dev). It pairs [ElectroDB](https://github.com/tywalch/electrodb) for DynamoDB access with [Zod](https://zod.dev) schemas and exposes helpers to quickly register CRUD routes.

## Installation

`hono` is a peer dependency and must be installed in your application along with dmvc's runtime dependencies:

```bash
npm install dmvc hono zod electrodb @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

## Defining a model

Create a model by extending `BaseModel`. The model wires up a Zod schema and ElectroDB entity:

```ts
import { BaseModel } from "dmvc";
import { Entity } from "electrodb";
import { z } from "zod";

const UserSchema = z.object({
  userId: z.string(),
  name: z.string().optional(),
});

export class UserModel extends BaseModel<typeof UserSchema> {
  constructor(client: any, table: string) {
    super(client, table);
    this.schema = UserSchema;
    this.keySchema = UserSchema.pick({ userId: true });
    this.entity = new Entity(
      {
        model: { entity: "User", version: "1", service: "app" },
        attributes: { userId: { type: "string", required: true }, name: { type: "string" } },
        indexes: { primary: { pk: { field: "pk", composite: ["userId"] } } },
      },
      { client, table }
    );
  }
}
```

Configure the DynamoDB connection once during startup:

```ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { BaseModel } from "dmvc";

const raw = new DynamoDBClient({ region: "us-east-1" });
const client = DynamoDBDocumentClient.from(raw);
BaseModel.configure({ client, table: process.env.DYNAMODB_TABLE_NAME! });
```

## Registering routes

Use `BaseController.register` to expose CRUD endpoints for the model:

```ts
import { Hono } from "hono";
import { BaseController } from "dmvc";
import { UserModel } from "./UserModel";

const app = new Hono();

BaseController.register(app, {
  model: UserModel,
  basePath: "/users",
});

export default app;
```

You can optionally supply per-operation `roles`, a custom `authCheckFn`, or `pageSize` in the options.

## Hooks

`BaseModel` supports lifecycle hooks via decorators:

```ts
import { BeforeCreate, AfterDelete } from "dmvc";

class UserModel extends BaseModel<typeof UserSchema> {
  @BeforeCreate
  async setDefaults(data: any) {
    data.createdAt = new Date().toISOString();
  }

  @AfterDelete
  async logDeletion(deleted: any) {
    console.log("deleted", deleted);
  }
}
```

These hooks run automatically around the respective operations.

---

dmvc aims to stay minimal. See the source for additional helpers like `requireAuth` and `QueryService`.
