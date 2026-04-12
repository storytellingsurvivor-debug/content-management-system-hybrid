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
    md: "1fr 2fr auto auto",
  },
  alignItems: "end",
};

export const infoRowSx: SxProps<Theme> = {
  mt: 2,
  display: "flex",
  gap: 1,
  flexWrap: "wrap",
};
