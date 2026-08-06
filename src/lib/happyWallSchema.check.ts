// Self-check for the Happy Wall column inference.
//   node --experimental-strip-types src/lib/happyWallSchema.check.ts
// ponytail: no test framework in this repo, one assert script is enough.

import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Next resolves extensionless imports; plain Node ESM does not. Teach it that
// trick so this file can import the real module.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch {
      return next(`${specifier}.ts`, context);
    }
  },
});

const { inferWallColumns, detectImageFields } = await import(
  "./happyWallSchema.ts"
);
type BlogRow = import("../types/blog.ts").BlogRow;
type BlogColumnDefinition = import("../types/blog.ts").BlogColumnDefinition;

const byName = (columns: BlogColumnDefinition[], name: string) => {
  const col = columns.find((c) => c.name === name);
  assert.ok(col, `expected a column named ${name}`);
  return col;
};

// A wall row shaped like Happy-Milo's: a real card image URL alongside the
// layout attributes (height + x/y position) that used to be mis-typed as URLs.
const row: BlogRow = {
  id: 1,
  slug: "my-wall",
  card_image_url: "https://cdn.example.com/card.png",
  card_image_height: 320,
  card_image_position_x: 12,
  card_image_position_y: -4,
  background_image_url: "https://cdn.example.com/bg.png",
};

const columns = inferWallColumns(row);

// The genuine link columns stay URLs.
assert.equal(byName(columns, "card_image_url").uiType, "url");
assert.equal(byName(columns, "background_image_url").uiType, "url");

// The layout attributes are numbers, not URLs — this is the bug fix. A number
// field is never URL-validated on save, so the "… must be a valid URL." error
// can no longer fire for these.
assert.equal(byName(columns, "card_image_height").uiType, "number");
assert.equal(byName(columns, "card_image_position_x").uiType, "number");
assert.equal(byName(columns, "card_image_position_y").uiType, "number");

// Even when the wall row carries no value for the attribute, the name alone is
// enough to keep it off the URL path.
const emptyColumns = inferWallColumns({
  id: 2,
  card_image_height: null,
  card_image_position_x: null,
});
assert.equal(byName(emptyColumns, "card_image_height").uiType, "number");
assert.equal(byName(emptyColumns, "card_image_position_x").uiType, "number");

// The preview must not treat the layout attributes as images to render.
const imageFields = detectImageFields(columns);
assert.deepEqual(imageFields.sort(), ["background_image_url", "card_image_url"]);
assert.ok(!imageFields.includes("card_image_height"));
assert.ok(!imageFields.includes("card_image_position_x"));
assert.ok(!imageFields.includes("card_image_position_y"));

console.log("happyWallSchema.check.ts: all assertions passed");
