import { generateModel, generateController } from "@bishop-and-co/dmvc";

// generates src/models/Widget.ts and src/controllers/WidgetController.ts under this directory
generateModel("widget", __dirname);
generateController("widget", __dirname);
