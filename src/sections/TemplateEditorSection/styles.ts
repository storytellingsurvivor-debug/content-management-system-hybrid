import type { SxProps, Theme } from "@mui/material/styles";

export const sectionPaperSx: SxProps<Theme> = {
  p: 3,
};

export const contentGridSx: SxProps<Theme> = {
  display: "grid",
  gap: 3,
  gridTemplateColumns: {
    xs: "1fr",
    lg: "1fr 1fr",
  },
  alignItems: "stretch",
};

export const editorColumnSx: SxProps<Theme> = {
  display: "flex",
  flexDirection: "column",
  gap: 2.5,
};

export const groupSx: SxProps<Theme> = {
  display: "grid",
  gap: 1.5,
};

export const groupHeaderSx: SxProps<Theme> = {
  fontWeight: 600,
  color: "text.secondary",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  fontSize: 12,
};

export const previewBoxSx: SxProps<Theme> = {
  p: 2,
  border: (theme) => `1px solid ${theme.palette.divider}`,
  borderRadius: 1.5,
  height: "100%",
  minHeight: 420,
  maxHeight: "none",
  overflowY: "auto",
  bgcolor: "background.default",
};

export const previewImageSx: SxProps<Theme> = {
  display: "block",
  width: "100%",
  maxHeight: 260,
  borderRadius: 1.5,
  objectFit: "cover",
  border: (theme) => `1px solid ${theme.palette.divider}`,
};

export const previewSectionSx: SxProps<Theme> = {
  mt: 2,
  pt: 2,
  borderTop: (theme) => `1px solid ${theme.palette.divider}`,
};

export const actionRowSx: SxProps<Theme> = {
  display: "flex",
  gap: 1.5,
  mt: 2,
  flexWrap: "wrap",
};
