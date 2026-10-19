"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FolderIcon from "@mui/icons-material/Folder";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SectionHeader } from "@/components/SectionHeader";
import { convertImageToWebp, ONE_MB } from "@/lib/imageToWebp";
import type { SectionControls } from "@/lib/sectionLayout";
import {
  breadcrumbRowSx,
  entryCardSx,
  entryGridSx,
  folderButtonSx,
  layoutGridSx,
  panelBoxSx,
  sectionPaperSx,
  thumbBoxSx,
} from "./styles";

interface BucketSectionProps {
  isConnected: boolean;
  client: SupabaseClient | null;
  number?: number;
  controls?: SectionControls;
}

interface StorageEntry {
  name: string;
  id: string | null;
  metadata: { size?: number; mimetype?: string } | null;
}

const DEFAULT_BUCKET = "milo-channel";

function sanitizeSegment(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function joinPath(prefix: string, name: string): string {
  const clean = sanitizeSegment(prefix);
  return clean ? `${clean}/${name}` : name;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < ONE_MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / ONE_MB).toFixed(2)} MB`;
}

export function BucketSection({
  isConnected,
  client,
  number = 4,
  controls,
}: BucketSectionProps) {
  const [bucket, setBucket] = useState(DEFAULT_BUCKET);
  const [prefix, setPrefix] = useState("");
  const [entries, setEntries] = useState<StorageEntry[]>([]);
  const [isListing, setIsListing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [uploadPrefix, setUploadPrefix] = useState("");
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const publicUrl = useCallback(
    (path: string): string =>
      client?.storage.from(bucket).getPublicUrl(path).data.publicUrl ?? "",
    [client, bucket],
  );

  const loadEntries = useCallback(async () => {
    if (!client) return;
    setIsListing(true);
    setListError(null);

    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 200,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      setEntries([]);
      setListError(error.message);
      setIsListing(false);
      return;
    }

    const rows = (data ?? []) as StorageEntry[];
    setEntries(rows.filter((entry) => !entry.name.startsWith(".")));
    setIsListing(false);
  }, [client, bucket, prefix]);

  useEffect(() => {
    if (!isConnected || !client) {
      setEntries([]);
      return;
    }
    void loadEntries();
  }, [isConnected, client, loadEntries]);

  const folders = entries.filter((entry) => entry.id === null);
  const files = entries.filter((entry) => entry.id !== null);
  const breadcrumbs = prefix ? prefix.split("/") : [];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      window.setTimeout(
        () => setCopied((current) => (current === text ? null : current)),
        1500,
      );
    } catch {
      setCopied(null);
    }
  };

  const handleUpload = async () => {
    if (!client) return;
    setUploadError(null);
    setUploadInfo(null);
    setUploadedUrl(null);

    if (!file) {
      setUploadError("Choose an image first.");
      return;
    }

    const cleanName = sanitizeSegment(fileName).replace(/\.[^.]+$/, "");
    if (!cleanName) {
      setUploadError("Provide a file name (without extension).");
      return;
    }

    const folder = sanitizeSegment(uploadPrefix);
    const path = folder ? `${folder}/${cleanName}.webp` : `${cleanName}.webp`;

    setIsUploading(true);
    try {
      const result = await convertImageToWebp(file);
      const { error } = await client.storage
        .from(bucket)
        .upload(path, result.blob, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: overwrite,
        });
      if (error) throw error;

      setUploadedUrl(publicUrl(path));
      setUploadInfo(
        `Stored ${path} — ${formatBytes(result.originalBytes)} → ` +
          `${formatBytes(result.bytes)} (webp, ${result.width}×${result.height}).`,
      );

      if (sanitizeSegment(uploadPrefix) === sanitizeSegment(prefix)) {
        void loadEntries();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload failed.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Paper elevation={2} sx={sectionPaperSx}>
      <SectionHeader
        title={`${number}. Bucket / Media`}
        controls={controls}
        actions={
          <TextField
            label="Bucket"
            size="small"
            value={bucket}
            onChange={(event) => setBucket(event.target.value)}
            disabled={!isConnected}
          />
        }
      />

      {/* Kept mounted while hidden so the folder and upload state survive. */}
      <Collapse in={controls?.open ?? true}>
        {!isConnected ? (
          <Alert severity="info">
            Connect to Supabase first to browse and upload bucket media.
          </Alert>
        ) : (
          <Box sx={layoutGridSx}>
            <Box sx={panelBoxSx}>
              <Box sx={breadcrumbRowSx}>
                <Tooltip title="Up one folder">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!prefix || isListing}
                      onClick={() =>
                        setPrefix(breadcrumbs.slice(0, -1).join("/"))
                      }
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setPrefix("")}
                  disabled={isListing}
                  sx={{ minWidth: 0, textTransform: "none" }}
                >
                  {bucket}
                </Button>
                {breadcrumbs.map((segment, index) => {
                  const target = breadcrumbs.slice(0, index + 1).join("/");
                  return (
                    <Box
                      key={target}
                      component="span"
                      sx={{ display: "inline-flex", alignItems: "center" }}
                    >
                      <Typography component="span" sx={{ mx: 0.25 }}>
                        /
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => setPrefix(target)}
                        disabled={isListing}
                        sx={{ minWidth: 0, textTransform: "none" }}
                      >
                        {segment}
                      </Button>
                    </Box>
                  );
                })}
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title="Refresh">
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => void loadEntries()}
                      disabled={isListing}
                    >
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {listError && <Alert severity="error">{listError}</Alert>}

              {isListing ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : entries.length === 0 ? (
                <Alert severity="info">This folder is empty.</Alert>
              ) : (
                <Box sx={entryGridSx}>
                  {folders.map((folder) => (
                    <Button
                      key={`folder:${folder.name}`}
                      variant="outlined"
                      color="inherit"
                      sx={folderButtonSx}
                      onClick={() => setPrefix(joinPath(prefix, folder.name))}
                    >
                      <FolderIcon />
                      <Typography
                        variant="caption"
                        sx={{ wordBreak: "break-word", textAlign: "center" }}
                      >
                        {folder.name}
                      </Typography>
                    </Button>
                  ))}

                  {files.map((entry) => {
                    const path = joinPath(prefix, entry.name);
                    const url = publicUrl(path);
                    const size = entry.metadata?.size;
                    return (
                      <Paper key={`file:${entry.name}`} sx={entryCardSx}>
                        <Box
                          component="img"
                          src={url}
                          alt={entry.name}
                          loading="lazy"
                          sx={thumbBoxSx}
                        />
                        <Typography
                          variant="caption"
                          sx={{ wordBreak: "break-word" }}
                        >
                          {entry.name}
                        </Typography>
                        {typeof size === "number" && (
                          <Typography variant="caption" color="text.secondary">
                            {formatBytes(size)}
                          </Typography>
                        )}
                        <Button
                          size="small"
                          startIcon={<ContentCopyIcon fontSize="small" />}
                          onClick={() => void copyToClipboard(url)}
                        >
                          {copied === url ? "Copied" : "Copy URL"}
                        </Button>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Box>

            <Box sx={panelBoxSx}>
              <Typography variant="subtitle1">Upload image</Typography>
              <Alert severity="info">
                Any image is converted to webp and compressed under 1 MB in your
                browser before upload.
              </Alert>

              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <TextField
                  label="Folder (path)"
                  placeholder="blog/my-article/cover"
                  value={uploadPrefix}
                  onChange={(event) => setUploadPrefix(event.target.value)}
                  fullWidth
                />
                <Button
                  variant="outlined"
                  onClick={() => setUploadPrefix(prefix)}
                  sx={{ whiteSpace: "nowrap", mt: 1 }}
                >
                  Use current
                </Button>
              </Box>

              <TextField
                label="File name (without extension)"
                placeholder="cover"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                helperText=".webp is added automatically"
                fullWidth
              />

              <Button variant="outlined" component="label">
                {file ? `Selected: ${file.name}` : "Choose image"}
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(event) => {
                    const next = event.target.files?.[0] ?? null;
                    setFile(next);
                    setUploadError(null);
                    setUploadInfo(null);
                    setUploadedUrl(null);
                  }}
                />
              </Button>

              <FormControlLabel
                control={
                  <Switch
                    checked={overwrite}
                    onChange={(event) => setOverwrite(event.target.checked)}
                  />
                }
                label="Overwrite if a file with the same path exists"
              />

              <Box>
                <Button
                  variant="contained"
                  onClick={() => void handleUpload()}
                  disabled={isUploading}
                  startIcon={
                    isUploading ? <CircularProgress size={16} /> : undefined
                  }
                >
                  {isUploading ? "Uploading..." : "Convert & Upload"}
                </Button>
              </Box>

              {uploadError && <Alert severity="error">{uploadError}</Alert>}
              {uploadInfo && <Alert severity="success">{uploadInfo}</Alert>}

              {uploadedUrl && (
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 1,
                    }}
                  >
                    <Chip label="Public URL" size="small" color="success" />
                    <Box sx={{ flexGrow: 1 }} />
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon fontSize="small" />}
                      onClick={() => void copyToClipboard(uploadedUrl)}
                    >
                      {copied === uploadedUrl ? "Copied" : "Copy"}
                    </Button>
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ wordBreak: "break-all" }}
                    component="a"
                    href={uploadedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {uploadedUrl}
                  </Typography>
                </Paper>
              )}
            </Box>
          </Box>
        )}
      </Collapse>
    </Paper>
  );
}
