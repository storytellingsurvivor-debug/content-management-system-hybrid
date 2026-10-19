"use client";

import type { ReactNode } from "react";
import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { SectionControls } from "@/lib/sectionLayout";

interface SectionHeaderProps {
  title: string;
  subtitle?: ReactNode;
  // Section-specific controls (bucket picker, refresh…), shown when open.
  actions?: ReactNode;
  // Show/hide and move up/down. Without it the header is a plain title.
  controls?: SectionControls;
}

// Title row shared by the arrangeable sections: number + title on the left,
// the section's own actions, then move up / move down and show / hide.
export function SectionHeader({
  title,
  subtitle,
  actions,
  controls,
}: SectionHeaderProps) {
  const open = controls?.open ?? true;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        flexWrap: "wrap",
        mb: open ? 2 : 0,
      }}
    >
      <Box>
        <Typography variant="h6">{title}</Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {open && actions}
        {controls && (controls.onMoveUp || controls.onMoveDown) && (
          <>
            <Tooltip title="Move up">
              <span>
                <IconButton
                  size="small"
                  onClick={controls.onMoveUp}
                  disabled={!controls.onMoveUp}
                  aria-label={`Move ${title} up`}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move down">
              <span>
                <IconButton
                  size="small"
                  onClick={controls.onMoveDown}
                  disabled={!controls.onMoveDown}
                  aria-label={`Move ${title} down`}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}
        {controls && (
          <Button
            variant="outlined"
            size="small"
            onClick={controls.onToggle}
            startIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            aria-expanded={open}
          >
            {open ? "Hide" : "Show"}
          </Button>
        )}
      </Box>
    </Box>
  );
}
