// Self-check for the blog tab section layout (order + show/hide).
//   node --experimental-strip-types src/lib/sectionLayout.check.ts

import assert from "node:assert/strict";

const { DEFAULT_ORDER, moveSection, normalizeLayout } =
  await import("./sectionLayout.ts");

// Nothing stored → default order, performance closed.
assert.deepEqual(normalizeLayout(null), {
  order: ["content", "bucket", "performance"],
  closed: ["performance"],
});

// Unknown ids and duplicates dropped; missing sections appended.
assert.deepEqual(
  normalizeLayout({
    order: ["bucket", "nope", "bucket"],
    closed: ["x", "content"],
  }),
  { order: ["bucket", "content", "performance"], closed: ["content"] },
);

// An explicit empty `closed` means "everything open", not the default.
assert.deepEqual(normalizeLayout({ closed: [] }).closed, []);

assert.deepEqual(moveSection(DEFAULT_ORDER, "bucket", -1), [
  "bucket",
  "content",
  "performance",
]);
assert.deepEqual(moveSection(DEFAULT_ORDER, "bucket", 1), [
  "content",
  "performance",
  "bucket",
]);
// No-op at the ends, and the input is never mutated.
assert.equal(moveSection(DEFAULT_ORDER, "content", -1), DEFAULT_ORDER);
assert.equal(moveSection(DEFAULT_ORDER, "performance", 1), DEFAULT_ORDER);
assert.deepEqual(DEFAULT_ORDER, ["content", "bucket", "performance"]);

console.log("section layout: ok");
