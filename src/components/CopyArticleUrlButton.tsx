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

// Same look as the Bucket section's "Copy URL" buttons. Renders nothing when
// no public URL can be built (brand without a site, or empty slug).
export function CopyArticleUrlButton({
  brand,
  language,
  slug,
}: CopyArticleUrlButtonProps) {
  const [copied, setCopied] = useState(false);
  const url = buildArticlePublicUrl(brand, language, slug);
  if (!url) return null;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      size="small"
      startIcon={<ContentCopyIcon fontSize="small" />}
      onClick={() => void copyToClipboard()}
      title={url}
    >
      {copied ? "Copied" : "Copy URL"}
    </Button>
  );
}
