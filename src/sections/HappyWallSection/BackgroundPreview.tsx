"use client";

import { Box, Chip, Typography } from "@mui/material";
import SmartphoneRounded from "@mui/icons-material/SmartphoneRounded";
import DesktopWindowsRounded from "@mui/icons-material/DesktopWindowsRounded";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

interface DeviceFrameProps {
  variant: "mobile" | "desktop";
  imageUrl: string;
  title: string;
  fieldName: string | null;
}

// A single device frame with the wall background cover-fitted inside it and the
// wall title overlaid, mirroring how the live wall renders the artwork.
function DeviceFrame({ variant, imageUrl, title, fieldName }: DeviceFrameProps) {
  const isMobile = variant === "mobile";
  const valid = isHttpUrl(imageUrl);
  return (
    <Box sx={{ textAlign: "center" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          mb: 0.75,
          color: "text.secondary",
        }}
      >
        {isMobile ? (
          <SmartphoneRounded fontSize="small" />
        ) : (
          <DesktopWindowsRounded fontSize="small" />
        )}
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {isMobile ? "Mobile" : "Desktop"}
        </Typography>
      </Box>

      <Box
        sx={{
          position: "relative",
          mx: "auto",
          width: isMobile ? 150 : 320,
          aspectRatio: isMobile ? "9 / 19.5" : "16 / 9",
          borderRadius: isMobile ? 3 : 1.5,
          overflow: "hidden",
          border: (theme) => `2px solid ${theme.palette.divider}`,
          bgcolor: "grey.900",
          boxShadow: 3,
        }}
      >
        {valid ? (
          <Box
            component="img"
            src={imageUrl}
            alt={`${variant} background`}
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              p: 1,
              background:
                "linear-gradient(135deg, #6366F1 0%, #EC4899 100%)",
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.85)", textAlign: "center" }}
            >
              {fieldName ? "No image set" : "No background column"}
            </Typography>
          </Box>
        )}

        {/* Legibility scrim + title, as on the live wall. */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)",
          }}
        />
        {title && (
          <Typography
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: isMobile ? 8 : 10,
              px: 1,
              color: "common.white",
              fontWeight: 700,
              fontSize: isMobile ? 11 : 14,
              textAlign: "center",
              textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          >
            {title}
          </Typography>
        )}
      </Box>

      {fieldName && (
        <Chip
          size="small"
          label={fieldName}
          variant="outlined"
          sx={{ mt: 0.75, maxWidth: isMobile ? 150 : 320 }}
        />
      )}
    </Box>
  );
}

export interface PreviewImage {
  name: string;
  url: string;
}

interface BackgroundPreviewProps {
  title: string;
  mobileUrl: string;
  desktopUrl: string;
  mobileField: string | null;
  desktopField: string | null;
  // Other image columns on the wall (uploaded cover/logo/hero…), shown as
  // labelled thumbnails below the device frames.
  extraImages?: PreviewImage[];
}

function ImageThumb({ name, url }: PreviewImage) {
  const valid = isHttpUrl(url);
  return (
    <Box sx={{ width: 140, textAlign: "center" }}>
      <Box
        sx={{
          width: "100%",
          aspectRatio: "4 / 3",
          borderRadius: 1.5,
          overflow: "hidden",
          border: (theme) => `1px solid ${theme.palette.divider}`,
          bgcolor: "action.hover",
          display: "grid",
          placeItems: "center",
        }}
      >
        {valid ? (
          <Box
            component="img"
            src={url}
            alt={name}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Typography variant="caption" color="text.secondary">
            No image
          </Typography>
        )}
      </Box>
      <Chip
        size="small"
        label={name}
        variant="outlined"
        sx={{ mt: 0.5, maxWidth: "100%" }}
      />
    </Box>
  );
}

export function BackgroundPreview({
  title,
  mobileUrl,
  desktopUrl,
  mobileField,
  desktopField,
  extraImages = [],
}: BackgroundPreviewProps) {
  return (
    <>
      <Box
        sx={{
          display: "flex",
          gap: 3,
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <DeviceFrame
          variant="mobile"
          imageUrl={mobileUrl}
          title={title}
          fieldName={mobileField}
        />
        <DeviceFrame
          variant="desktop"
          imageUrl={desktopUrl}
          title={title}
          fieldName={desktopField}
        />
      </Box>

      {extraImages.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            Uploaded images
          </Typography>
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              flexWrap: "wrap",
              mt: 0.75,
              justifyContent: "center",
            }}
          >
            {extraImages.map((image) => (
              <ImageThumb key={image.name} name={image.name} url={image.url} />
            ))}
          </Box>
        </Box>
      )}
    </>
  );
}
