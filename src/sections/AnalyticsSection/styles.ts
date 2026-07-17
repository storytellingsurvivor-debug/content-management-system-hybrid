import type { SxProps, Theme } from "@mui/material/styles";

export const sectionPaperSx: SxProps<Theme> = {
  p: 3,
  mb: 3,
};

export const sectionHeaderSx: SxProps<Theme> = {
  mb: 2,
};

export const controlsGridSx: SxProps<Theme> = {
  display: "grid",
  gap: 2,
  gridTemplateColumns: {
    xs: "1fr",
    md: "1fr auto auto",
  },
  alignItems: "end",
};

export const kpiGridSx: SxProps<Theme> = {
  mt: 3,
  display: "grid",
  gap: 2,
  gridTemplateColumns: {
    xs: "1fr 1fr",
    md: "repeat(4, 1fr)",
  },
};

export const kpiTileSx: SxProps<Theme> = {
  p: 2,
  display: "flex",
  flexDirection: "column",
  gap: 0.5,
};

export const distGridSx: SxProps<Theme> = {
  mt: 3,
  display: "grid",
  gap: 2,
  gridTemplateColumns: {
    xs: "1fr",
    md: "1fr 1fr",
  },
};

export const distCardSx: SxProps<Theme> = {
  p: 2,
};

export const barRowSx: SxProps<Theme> = {
  display: "flex",
  flexDirection: "column",
  gap: 0.4,
  mb: 1.25,
};

export const barLabelRowSx: SxProps<Theme> = {
  display: "flex",
  justifyContent: "space-between",
  gap: 1,
  fontSize: 13,
};

export const sparklineWrapSx: SxProps<Theme> = {
  mt: 3,
  p: 2,
};

export const sparklineRowSx: SxProps<Theme> = {
  display: "flex",
  alignItems: "flex-end",
  gap: "2px",
  height: 120,
  mt: 1.5,
};
