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
  display: "flex",
  flexDirection: "column",
  gap: 1.5,
  minWidth: 0,
  height: "100%",
};

// The content editor is the last input and grows to fill the remaining height
// of the left column, so its bottom lines up with the end of the live preview
// on the right. The CTA row then sits directly beneath it.
export const contentFieldSx: SxProps<Theme> = {
  flexGrow: 1,
  minHeight: 320,
  "& .MuiInputBase-root": {
    height: "100%",
    alignItems: "flex-start",
  },
  "& .MuiInputBase-inputMultiline": {
    height: "100% !important",
    overflowY: "auto !important",
  },
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
  mt: 1,
  flexWrap: "wrap",
  justifyContent: "space-between",
};
