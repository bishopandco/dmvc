# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

- Added explicit package `exports` for the root module, generator entrypoint, and `package.json`.
- Added a Node.js engine declaration requiring Node 18 or newer.
- Added a root changelog and draft release notes for the current package sweep.

### Changed

- Refreshed dependency ranges across the package, including AWS SDK, ElectroDB, Hono, Fastify, Zod, TypeScript, and Node types.
- Broadened Fastify peer support to `^4.29.1 || ^5.8.5` and moved local verification to Fastify 5.
- Updated the generator scaffold to use Node's built-in `randomUUID()` instead of a third-party id generator.
- Updated example and README references so generated model filenames and example dependency usage match the current package behavior.

### Fixed

- Fixed `BaseModel.list()` to return an `undefined` cursor when pagination is exhausted, matching the declared TypeScript contract.
- Tightened generator typings so the emitted declarations do not expose `NodeModule`-specific types unnecessarily.
- Extended tests to cover the generator id scaffold and pagination cursor behavior after the cleanup.
