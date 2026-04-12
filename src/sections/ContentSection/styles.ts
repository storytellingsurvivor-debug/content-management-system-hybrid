import type { SxProps, Theme } from "@mui/material/styles";

export const sectionPaperSx: SxProps<Theme> = {
  p: 3,
};

export const contentGridSx: SxProps<Theme> = {
  display: "grid",
  gap: 2,
  gridTemplateColumns: {
    xs: "1fr",
    lg: "1fr 1fr",
  },
  alignItems: "stretch",
};

export const editorColumnSx: SxProps<Theme> = {
  display: "grid",
  gap: 1.5,
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

export const markdownPaperSx: SxProps<Theme> = {
  mt: 2,
  p: 2,
  borderRadius: 2,
  border: (theme) => `1px solid ${theme.palette.divider}`,
  bgcolor: "background.paper",
};

export const actionRowSx: SxProps<Theme> = {
  display: "flex",
  gap: 1.5,
  mt: 2,
  flexWrap: "wrap",
};
