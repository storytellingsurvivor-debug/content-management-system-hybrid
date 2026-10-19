import type { SxProps, Theme } from "@mui/material/styles";

// Shared with the readership panel so KPI tiles look the same everywhere.
export { kpiGridSx, statsPanelSx } from "@/sections/ArticlesSection/styles";

export const sectionPaperSx: SxProps<Theme> = {
  p: 3,
  mb: 3,
};

export const sectionHeaderRowSx: SxProps<Theme> = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
  flexWrap: "wrap",
};

export const filtersRowSx: SxProps<Theme> = {
  mt: 2,
  display: "grid",
  gap: 2,
  gridTemplateColumns: {
    xs: "1fr",
    sm: "repeat(2, minmax(0, 240px))",
  },
};

// Ranking tables scroll inside, never the page.
export const perfTableWrapSx: SxProps<Theme> = {
  maxHeight: 480,
  overflowX: "auto",
};
