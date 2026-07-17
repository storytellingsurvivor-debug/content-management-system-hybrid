/*!
 * Happy Milo — blog view tracker (drop-in, no dependencies)
 * ---------------------------------------------------------------------------
 * Records one anonymous view event per article page load: browser (derived
 * server-side from the user-agent), referrer / landing URL and UTM source.
 * No cookies, no IP, no PII — only a random opaque id in localStorage to
 * approximate unique visitors.
 *
 * Usage on an article page:
 *
 *   <script
 *     src="https://<your-cms-domain>/blog-tracker.js"
 *     data-slug="tu-nes-pas-seul"      <!-- or omit to infer from the URL -->
 *     data-article-id="42"             <!-- optional -->
 *     data-language="fr"               <!-- optional -->
 *     data-env="prod"                  <!-- "prod" (default) | "staging" -->
 *     defer
 *   ></script>
 *
 * The endpoint defaults to "<origin of this script>/api/blog/track". Override
 * with data-endpoint="https://.../api/blog/track" if the CMS lives elsewhere.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  function attr(name, fallback) {
    var v = script.getAttribute(name);
    return v && v.trim() ? v.trim() : fallback;
  }

  // Resolve the ingestion endpoint from this script's own origin by default.
  function defaultEndpoint() {
    try {
      return new URL("/api/blog/track", script.src).href;
    } catch {
      return "/api/blog/track";
    }
  }

  // Infer the slug from the last non-empty path segment when not provided.
  function inferSlug() {
    try {
      var parts = location.pathname.split("/").filter(Boolean);
      return parts.length ? decodeURIComponent(parts[parts.length - 1]) : "";
    } catch {
      return "";
    }
  }

  // A stable, opaque, random per-browser id — not derived from any PII.
  function visitorHash() {
    var KEY = "hm_blog_visitor";
    try {
      var existing = localStorage.getItem(KEY);
      if (existing) return existing;
      var id =
        (crypto && crypto.randomUUID && crypto.randomUUID()) ||
        String(Date.now()) + "-" + Math.random().toString(36).slice(2);
      localStorage.setItem(KEY, id);
      return id;
    } catch {
      return null; // storage blocked (private mode) — just skip uniqueness
    }
  }

  function param(name) {
    try {
      return new URLSearchParams(location.search).get(name);
    } catch {
      return null;
    }
  }

  var slug = attr("data-slug", "") || inferSlug();
  if (!slug) return; // nothing to attribute the view to

  var payload = {
    slug: slug,
    article_id: attr("data-article-id", null),
    language: attr("data-language", null),
    env: attr("data-env", "prod"),
    landing_url: location.href,
    referrer: document.referrer || null,
    utm_source: param("utm_source"),
    utm_medium: param("utm_medium"),
    utm_campaign: param("utm_campaign"),
    visitor_hash: visitorHash(),
  };

  var endpoint = attr("data-endpoint", defaultEndpoint());
  var data = JSON.stringify(payload);

  // Prefer sendBeacon (survives page unload); fall back to keepalive fetch.
  try {
    if (navigator.sendBeacon) {
      var blob = new Blob([data], { type: "application/json" });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }
  } catch {
    /* fall through */
  }

  try {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
      keepalive: true,
      mode: "cors",
    }).catch(function () {});
  } catch {
    /* tracking must never break the page */
  }
})();
