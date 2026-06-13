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
    md: "1fr 1fr auto auto",
  },
  alignItems: "end",
};

export const infoRowSx: SxProps<Theme> = {
  mt: 2,
  display: "flex",
  gap: 1,
  flexWrap: "wrap",
};

export const scrollRowSx: SxProps<Theme> = {
  mt: 2,
  display: "flex",
  gap: 2,
  overflowX: "auto",
  overflowY: "hidden",
  pb: 1.5,
  pt: 0.5,
  px: 0.5,
  scrollSnapType: "x proximity",
  "&::-webkit-scrollbar": {
    height: 8,
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 4,
  },
};

export const cardSx: SxProps<Theme> = {
  flex: "0 0 240px",
  width: 240,
  scrollSnapAlign: "start",
  display: "flex",
  flexDirection: "column",
  cursor: "pointer",
  transition: "transform 120ms ease, box-shadow 120ms ease",
  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: 4,
  },
};

export const cardSelectedSx: SxProps<Theme> = {
  outline: "2px solid",
  outlineColor: "primary.main",
  outlineOffset: -2,
};

export const cardMediaWrapSx: SxProps<Theme> = {
  position: "relative",
  height: 130,
  width: "100%",
  overflow: "hidden",
  backgroundColor: "action.hover",
};

export const cardLiveBadgeSx: SxProps<Theme> = {
  position: "absolute",
  top: 8,
  right: 8,
  display: "flex",
  alignItems: "center",
  gap: 0.5,
  px: 0.75,
  py: 0.25,
  borderRadius: 1,
  backgroundColor: "rgba(0,0,0,0.55)",
  color: "common.white",
  fontSize: 12,
  lineHeight: 1,
};

export const cardBodySx: SxProps<Theme> = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  p: 1.5,
  flex: 1,
};

export const cardChipsRowSx: SxProps<Theme> = {
  display: "flex",
  gap: 0.5,
  flexWrap: "wrap",
};

export const cardTitleSx: SxProps<Theme> = {
  fontWeight: 600,
  fontSize: 14,
  lineHeight: 1.3,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

export const cardMetaRowSx: SxProps<Theme> = {
  mt: "auto",
  display: "flex",
  alignItems: "center",
  gap: 1,
  color: "text.secondary",
  fontSize: 12,
};
