# Todo Example

This example shows a tiny todo application built with [DMVC](https://github.com/bishopandco/dmvc) (install via `npm i @bishop-and-co/dmvc`), [Hono](https://hono.dev) and DynamoDB.

## Prerequisites

- Node.js 18+
- [Docker](https://www.docker.com/) for the local DynamoDB instance

## Setup

```bash
# install dependencies
npm install
cd examples/todo
npm install

# start DynamoDB
npm run db:up
```

An `.env` file is provided that configures the table name and points the AWS SDK at the local DynamoDB endpoint exposed by `docker-compose`.

The helper scripts will automatically create the required table and indexes if they do not already exist.

## CRUD helpers

With DynamoDB running you can exercise the model directly from the command line:

```bash
npm run create
npm run read <todo>
npm run update <todo>
npm run destroy <todo>
npm run list [cursor] [limit]
```

The list command returns a page of todos and prints a `cursor` value that
can be supplied on subsequent runs to fetch the next page.

Shut down the local database with:

```bash
npm run db:down
```

## Table configuration

When defining the DynamoDB table in an SST app, include the additional indexes expected by this example:

```ts
const table = new sst.aws.Dynamo("SomeTableName", {
  fields: {
    pk: "string",
    sk: "string",
    gsi1pk: "string",
    gsi1sk: "string",
    gsi2pk: "string",
    gsi2sk: "string",
  },
  primaryIndex: {
    hashKey: "pk",
    rangeKey: "sk",
  },
  globalIndexes: {
    "gsi1pk-gsi1sk-index": {
      hashKey: "gsi1pk",
      rangeKey: "gsi1sk",
    },
    "gsi2pk-gsi2sk-index": {
      hashKey: "gsi2pk",
      rangeKey: "gsi2sk",
    },
  },
});
```

These fields and indexes mirror those referenced in `index.ts` and allow for more advanced query patterns.
