// Self-check for which blog columns are writable.
//   node --experimental-strip-types src/lib/blogFormSchema.check.ts
// ponytail: no test framework in this repo, one assert script is enough.

import assert from "node:assert/strict";
import {
  inferColumnsFromRow,
  toWritablePayload,
} from "./blogFormSchema.ts";

const row = {
  id: 12,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-02-02T00:00:00.000Z",
  slug: "hello-world",
  content: "# hi",
};

const columns = inferColumnsFromRow(row);
const readOnly = new Set(
  columns.filter((c) => c.readOnly).map((c) => c.name),
);

// The DB owns id and the updated_at trigger; everything else is the editor's.
assert.deepEqual([...readOnly].sort(), ["id", "updated_at"]);

const payload = toWritablePayload(
  { ...row, created_at: "2025-06-01T10:00:00.000Z" },
  columns,
);

// Back-dating an article must survive an update, not be silently dropped.
assert.equal(payload.created_at, "2025-06-01T10:00:00.000Z");
assert.equal(payload.slug, "hello-world");
assert.equal("id" in payload, false);
assert.equal("updated_at" in payload, false);

// created_at renders as a date-time picker, not a free-text field.
assert.equal(
  columns.find((c) => c.name === "created_at")?.uiType,
  "datetime",
);

// Same guarantees when the table is empty and we fall back to the defaults.
const defaults = inferColumnsFromRow(null);
const createdAt = defaults.find((c) => c.name === "created_at");
assert.equal(createdAt?.readOnly, false);
assert.equal(defaults.find((c) => c.name === "id")?.readOnly, true);

console.log("blog form schema: ok");
