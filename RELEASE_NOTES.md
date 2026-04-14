# Release Notes

## Unreleased

This release packages a maintenance sweep across the library, examples, and published metadata. The focus is package hygiene, generator correctness, and dependency freshness rather than API expansion.

### Highlights

- Updated runtime and development dependencies to current non-breaking releases and cleared the npm audit report.
- Added explicit package exports and a Node 18 engine requirement to make package resolution and environment expectations clearer for consumers.
- Updated the code generator to use `randomUUID()` from Node core, removing the need for a separate id-generation dependency in generated models.
- Fixed the pagination cursor shape returned by `BaseModel.list()` so it aligns with the library's declared types.
- Refreshed example and README documentation so generated filenames and local example setup match the current package layout.

### Developer Impact

- Consumers using Fastify can stay on Fastify 4 or move to Fastify 5 without falling outside the package's peer dependency range.
- Generated model scaffolds no longer assume `ulid`; projects can use the generated files without adding that package first.
- Package consumers get a cleaner import surface through `exports`, including a supported `@bishop-and-co/dmvc/generator` entrypoint.

### Validation

- `npm test`
- `npm run build`
- `npm audit --omit=dev`
