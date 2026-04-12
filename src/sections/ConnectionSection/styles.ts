import type { SxProps, Theme } from "@mui/material/styles";

export const sectionPaperSx: SxProps<Theme> = {
  p: 3,
  mb: 3,
};

export const sectionHeaderRowSx: SxProps<Theme> = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 2,
  mb: 2,
  flexWrap: "wrap",
};

export const connectionGridSx: SxProps<Theme> = {
  display: "grid",
  gap: 2,
  gridTemplateColumns: {
    xs: "1fr",
    md: "220px 1fr 1fr",
  },
  alignItems: "end",
};

export const actionsRowSx: SxProps<Theme> = {
  display: "flex",
  gap: 1.5,
  mt: 2,
  flexWrap: "wrap",
};
