```terminaloutput
██████╗   ███╗   ███╗ ██╗     ██╗  ██████╗ 
██╔══██╗  ████╗ ████║ ██║     ██║ ██╔════╝ 
██║  ██║  ██╔████╔██║ ██║     ██║ ██║           
██║  ██║  ██║╚██╔╝██║ ╚██╗   ██╔╝ ██║           
██████╔╝  ██║ ╚═╝ ██║  ╚██████╔╝  ╚██████╗ 
╚═════╝   ╚═╝     ╚═╝   ╚═════╝    ╚═════╝ 
```

# dmvc

[![Tests](https://github.com/bishopco/dmvc/actions/workflows/test.yml/badge.svg)](https://github.com/bishopco/dmvc/actions/workflows/test.yml)

dmvc provides a minimal model/controller layer for building REST APIs on top of [Hono](https://hono.dev). It pairs [ElectroDB](https://github.com/tywalch/electrodb) for DynamoDB access with [Zod](https://zod.dev) schemas and exposes helpers to quickly register CRUD routes.

Install via `npm i @bishop-and-co/dmvc`. Source code is available on [GitHub](https://github.com/bishopandco/dmvc).

## Installation

`hono` is a peer dependency and must be installed in your application along with DMVC's runtime dependencies:

```bash
npm install @bishop-and-co/dmvc hono zod electrodb @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

## Defining a model

Create a model by extending `BaseModel`. The model wires up a Zod schema and ElectroDB entity:

```ts
import { BaseModel } from "@bishop-and-co/dmvc";
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
import { BaseModel } from "@bishop-and-co/dmvc";

const raw = new DynamoDBClient({ region: "us-east-1" });
const client = DynamoDBDocumentClient.from(raw);
BaseModel.configure({ client, table: process.env.DYNAMODB_TABLE_NAME! });
```

## Registering routes

Use `BaseController.register` to expose CRUD endpoints for the model:

```ts
import { Hono } from "hono";
import { BaseController, requireAuth } from "@bishop-and-co/dmvc";
import { UserModel } from "./UserModel";

const app = new Hono();

BaseController.register(app, {
  model: UserModel,
  basePath: "/users",
});

export default app;
```

You can optionally supply per-operation `roles`, a custom `authCheckFn`, or `pageSize` in the options.

## Authentication

`dmvc` expects an authenticated user to be attached to the `Hono` context as `c.set("user", ...)`.  
Routes registered through `BaseController` automatically use the `requireAuth` middleware which checks the user's role, supports a custom checker, and honours the `SKIP_AUTH` environment flag and the special `anonymous` role.

```ts
import { Hono } from "hono";
import { BaseController, requireAuth } from "@bishop-and-co/dmvc";
import { UserModel } from "./UserModel";

const app = new Hono();

// attach a user from your auth system (JWT, session, etc.)
app.use("*", async (c, next) => {
  const token = c.req.header("Authorization");
  if (token) {
    // decode token and set the user on the context
    c.set("user", { id: "u123", role: "admin" });
  }
  await next();
});

// optional custom authorization function
const authCheckFn = async (user: any, allowed: string[]) => {
  if (user.role === "admin") return true; // admins always allowed
  return allowed.includes(user.role);
};

BaseController.register(app, {
  model: UserModel,
  basePath: "/users",
  roles: {
    list: ["anonymous"],   // public route
    get: ["user", "admin"],
    create: ["admin"],
    update: ["admin"],
    delete: ["admin"],
  },
  authCheckFn,
});

app.get(
  "/reports",
  requireAuth(["admin"], authCheckFn),
  (c) => c.text("secret")
);
```

Set `SKIP_AUTH=true` in the environment to bypass all checks during local development.

## Hooks

`BaseModel` supports lifecycle hooks via decorators:

```ts
import { BeforeCreate, AfterDelete } from "@bishop-and-co/dmvc";

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

## Generator

dmvc ships with a tiny CLI that scaffolds boilerplate models and controllers for you.

```bash
npx dmvc generate model widget
# => creates src/models/Widget.ts

npx dmvc generate controller widget
# => creates src/controllers/WidgetController.ts
```

The generator creates the `src/models` and `src/controllers` directories if they do not exist and refuses to overwrite existing files.
Edit the generated files to flesh out schemas, attributes, and any custom logic for your application.

## Example

A minimal todo application built with dmvc lives in [examples/todo](./examples/todo). It defines a todo model and registers CRUD routes with Hono. The example's `package.json` also exposes scripts to create, read, update, and destroy todos, and includes a `docker-compose.yml` for spinning up a local DynamoDB instance. See its [README](examples/todo/README.md) for setup instructions.

---

dmvc aims to stay minimal. See the source for additional helpers like `requireAuth` and `QueryService`.
