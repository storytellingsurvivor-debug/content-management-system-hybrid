"use client";

import { useState } from "react";
import { Button } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { buildArticlePublicUrl, type BrandKey } from "@/lib/brands";

interface CopyArticleUrlButtonProps {
  brand: BrandKey;
  language: string;
  slug: string;
}

// Same look as the Bucket section's "Copy URL" buttons. Renders nothing for a
// brand without a public site; disabled (reason on hover) when the article's
// slug or language can't produce a valid link.
export function CopyArticleUrlButton({
  brand,
  language,
  slug,
}: CopyArticleUrlButtonProps) {
  const [copied, setCopied] = useState(false);
  const result = buildArticlePublicUrl(brand, language, slug);
  if (!result) return null;
  const { url, error } = result;

  const copyToClipboard = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    // Span wrapper so the tooltip still shows while the button is disabled.
    <span title={url ?? error}>
      <Button
        size="small"
        startIcon={<ContentCopyIcon fontSize="small" />}
        onClick={() => void copyToClipboard()}
        disabled={!url}
      >
        {copied ? "Copied" : "Copy URL"}
      </Button>
    </span>
  );
}
