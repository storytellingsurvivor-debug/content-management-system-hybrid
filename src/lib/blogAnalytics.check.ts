// Self-check for the blog analytics aggregation.
//   node --experimental-strip-types src/lib/blogAnalytics.check.ts
// ponytail: no test framework in this repo, one assert script is enough.

import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// The app is bundled by Next, which resolves extensionless imports; plain Node
// ESM does not. Teach it that trick so this file can import the real module.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch {
      return next(`${specifier}.ts`, context);
    }
  },
});

const { computeBlogAnalytics, isTrue, urlHost } = await import(
  "./blogAnalytics.ts"
);
type BlogViewRow = import("./blogAnalytics.ts").BlogViewRow;
type BrowserRow = import("./blogAnalytics.ts").BrowserRow;

const now = Date.now();
const daysAgo = (n: number) =>
  new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

const rows: BlogViewRow[] = [
  { blog_id: 1, browser_signature: "a", has_liked: "true", created_at: daysAgo(1) },
  { blog_id: 2, browser_signature: "a", has_liked: "false", created_at: daysAgo(3) },
  { blog_id: 1, browser_signature: "b", has_liked: "false", created_at: daysAgo(10) },
  { blog_id: 1, browser_signature: "c", has_liked: "false", created_at: daysAgo(0) },
];

const browsers = new Map<string, BrowserRow>([
  [
    "a",
    {
      browser_signature: "a",
      device: "mobile",
      user_agent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      url_source: "https://www.happy-milo.com/blog/hello",
    },
  ],
  [
    "b",
    {
      browser_signature: "b",
      device: "desktop",
      user_agent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
      url_source: "https://happy-milo.com/blog/hello",
    },
  ],
]);

const all = computeBlogAnalytics(rows, browsers);

assert.equal(all.readers, 4, "one row per (article, browser)");
assert.equal(all.uniqueVisitors, 3, "distinct browser_signature");
assert.equal(all.likes, 1, 'has_liked is text "true"');
assert.equal(all.readersLast7Days, 3);
assert.equal(all.readersLast30Days, 4);

// Distributions are weighted by readership, not by distinct visitor.
const safari = all.browsers.find((s) => s.label === "Safari");
assert.equal(safari?.count, 2, "visitor a read two articles");
assert.equal(all.os.find((s) => s.label === "iOS")?.count, 2);

// www. is stripped so both landing URLs collapse into one source.
assert.equal(all.sources.find((s) => s.label === "happy-milo.com")?.count, 3);
// Signature "c" has no browsers row -> counted, but labelled as unknown.
assert.equal(all.sources.find((s) => s.label === "Direct / none")?.count, 1);
assert.equal(all.browsers.find((s) => s.label === "Unknown")?.count, 1);

// Scoping to one article filters before aggregating.
const scoped = computeBlogAnalytics(
  rows.filter((r) => r.blog_id === 1),
  browsers,
);
assert.equal(scoped.readers, 3);
assert.equal(scoped.likes, 1);

assert.equal(all.perDay.length, 30, "dense 30-day series");
assert.equal(
  all.perDay.reduce((sum, d) => sum + d.count, 0),
  4,
  "every row lands in a bucket",
);

assert.equal(isTrue("TRUE"), true);
assert.equal(isTrue(null), false);
assert.equal(urlHost("not a url"), null);
assert.equal(urlHost(""), null);

console.log("blog analytics: ok");
