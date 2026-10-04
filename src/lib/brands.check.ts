// Self-check for the article public-URL builder.
//   node --experimental-strip-types src/lib/brands.check.ts

import assert from "node:assert/strict";
import { buildArticlePublicUrl, toSiteLanguage } from "./brands.ts";

assert.equal(toSiteLanguage("fr"), "fr");
assert.equal(toSiteLanguage("en"), "en");
assert.equal(toSiteLanguage(" FR "), "fr");
assert.equal(toSiteLanguage("fr-FR"), "fr");
assert.equal(toSiteLanguage("en_US"), "en");
assert.equal(toSiteLanguage(""), null);
assert.equal(toSiteLanguage("es"), null);
assert.equal(toSiteLanguage("french"), null);

assert.deepEqual(buildArticlePublicUrl("happy", "fr", "mon-article"), {
  url: "https://www.happy-milo.com/fr/blog/mon-article",
  error: null,
});
assert.deepEqual(buildArticlePublicUrl("happy", "en-US", "/my-post/"), {
  url: "https://www.happy-milo.com/en/blog/my-post",
  error: null,
});
// Never guess a language: an empty or unknown one must not yield a link.
assert.equal(buildArticlePublicUrl("happy", "", "x")?.url, null);
assert.equal(buildArticlePublicUrl("happy", "es", "x")?.url, null);
assert.equal(buildArticlePublicUrl("happy", "fr", " ")?.url, null);
assert.equal(buildArticlePublicUrl("forever", "fr", "x"), null);

console.log("brands.check: ok");
