# Generator Example

This example shows how to use the `dmvc` generator to scaffold model and controller files.

## CLI

Run the generator from the root of your project:

```bash
npx dmvc generate model widget
npx dmvc generate controller widget
```

These commands create `src/models/Widget.ts` and `src/controllers/WidgetController.ts`. Edit the generated files to define attributes, validation schemas, and routes for your app.

## Programmatic usage

You can also invoke the generator functions directly:

```ts
import { generateModel, generateController } from "@bishop-and-co/dmvc";

generateModel("widget");
generateController("widget");
```

Running this script will produce the same files in the current working directory.
