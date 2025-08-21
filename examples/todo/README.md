# Todo Example

This example shows a tiny todo application built with [dmvc](../../README.md), [Hono](https://hono.dev) and DynamoDB.

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

## CRUD helpers

With DynamoDB running you can exercise the model directly from the command line:

```bash
npm run create
npm run read <id>
npm run update <id>
npm run destroy <id>
```

Shut down the local database with:

```bash
npm run db:down
```
