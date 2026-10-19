import type { SxProps, Theme } from "@mui/material/styles";

export const sectionPaperSx: SxProps<Theme> = {
  p: 3,
  mb: 3,
};

export const layoutGridSx: SxProps<Theme> = {
  display: "grid",
  gap: 3,
  gridTemplateColumns: {
    xs: "1fr",
    md: "1fr 1fr",
  },
  alignItems: "start",
};

export const panelBoxSx: SxProps<Theme> = {
  display: "flex",
  flexDirection: "column",
  gap: 1.5,
};

export const breadcrumbRowSx: SxProps<Theme> = {
  display: "flex",
  alignItems: "center",
  gap: 0.5,
  flexWrap: "wrap",
};

export const entryGridSx: SxProps<Theme> = {
  display: "grid",
  gap: 1.5,
  gridTemplateColumns: {
    xs: "repeat(2, 1fr)",
    sm: "repeat(3, 1fr)",
  },
};

export const entryCardSx: SxProps<Theme> = {
  p: 1,
  display: "flex",
  flexDirection: "column",
  gap: 0.75,
  border: (theme) => `1px solid ${theme.palette.divider}`,
  borderRadius: 1.5,
};

export const thumbBoxSx: SxProps<Theme> = {
  width: "100%",
  aspectRatio: "1 / 1",
  borderRadius: 1,
  objectFit: "cover",
  bgcolor: "action.hover",
};

export const folderButtonSx: SxProps<Theme> = {
  width: "100%",
  aspectRatio: "1 / 1",
  borderRadius: 1,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: 0.5,
  textTransform: "none",
};
