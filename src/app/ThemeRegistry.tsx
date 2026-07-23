"use client";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import type { ReactNode } from "react";

// Single source of truth for the CMS look. Light-only on purpose: a backoffice
// reads best on a calm, consistent surface rather than following the OS theme.
const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#6366F1", dark: "#4F46E5", light: "#EEF2FF" },
    secondary: { main: "#EC4899", dark: "#DB2777", light: "#FCE7F3" },
    success: { main: "#16A34A" },
    error: { main: "#DC2626" },
    background: { default: "#F6F7FB", paper: "#FFFFFF" },
    text: { primary: "#1F2430", secondary: "#5B6472" },
    divider: "rgba(31, 36, 48, 0.10)",
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      "var(--font-geist-sans), system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    h4: { fontWeight: 800, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: "none", borderRadius: 10 } },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, minHeight: 44 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: { borderColor: "rgba(31, 36, 48, 0.10)" },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});

export function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
