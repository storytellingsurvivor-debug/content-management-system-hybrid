"use client";

import {
  Alert,
  Box,
  LinearProgress,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import type { BlogAnalytics, DistributionSlice } from "@/lib/blogAnalytics";
import {
  barLabelRowSx,
  barRowSx,
  distCardSx,
  distGridSx,
  kpiGridSx,
  kpiTileSx,
  sparklineRowSx,
  sparklineWrapSx,
  statsPanelSx,
} from "./styles";

interface ArticleAnalyticsProps {
  title: string;
  analytics: BlogAnalytics | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export function BarList({
  title,
  slices,
}: {
  title: string;
  slices: DistributionSlice[];
}) {
  const max = slices.reduce((m, s) => Math.max(m, s.count), 0) || 1;
  return (
    <Paper variant="outlined" sx={distCardSx}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {slices.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No data yet
        </Typography>
      ) : (
        slices.map((slice) => (
          <Box key={slice.label} sx={barRowSx}>
            <Box sx={barLabelRowSx}>
              <Box
                component="span"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  pr: 1,
                }}
                title={slice.label}
              >
                {slice.label}
              </Box>
              <Box
                component="span"
                sx={{ color: "text.secondary", flexShrink: 0 }}
              >
                {slice.count} · {slice.percent}%
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(slice.count / max) * 100}
              aria-label={`${title}: ${slice.label}, ${slice.count} readers (${slice.percent}%)`}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        ))
      )}
    </Paper>
  );
}

export function KpiTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Paper variant="outlined" sx={kpiTileSx}>
      <Typography variant="h5" component="div">
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

export function ArticleAnalytics({ title, analytics }: ArticleAnalyticsProps) {
  if (!analytics || analytics.readers === 0) {
    return (
      <Box sx={statsPanelSx}>
        <Alert severity="info">
          No readers recorded yet for <strong>{title}</strong>.
        </Alert>
      </Box>
    );
  }

  const sparkMax =
    analytics.perDay.reduce((m, d) => Math.max(m, d.count), 0) || 1;

  return (
    <Box sx={statsPanelSx}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Analytics · {title}
      </Typography>

      <Box sx={kpiGridSx}>
        <KpiTile label="Reads" value={analytics.readers} />
        <KpiTile label="Unique visitors" value={analytics.uniqueVisitors} />
        <KpiTile label="Likes" value={analytics.likes} />
        <KpiTile label="Last 7 days" value={analytics.readersLast7Days} />
        <KpiTile label="Last 30 days" value={analytics.readersLast30Days} />
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1, display: "block" }}
      >
        Last read: {formatDate(analytics.lastViewedAt)} · one read = one browser,
        repeat visits are not counted twice.
      </Typography>

      <Paper variant="outlined" sx={sparklineWrapSx}>
        <Typography variant="subtitle2">First reads · last 30 days</Typography>
        <Box
          sx={sparklineRowSx}
          role="img"
          aria-label="Daily first reads over the last 30 days"
        >
          {analytics.perDay.map((day) => (
            <Tooltip key={day.day} title={`${day.day}: ${day.count} reads`}>
              <Box
                sx={{
                  flex: 1,
                  minWidth: 3,
                  height: `${Math.max((day.count / sparkMax) * 100, day.count > 0 ? 4 : 1)}%`,
                  backgroundColor:
                    day.count > 0
                      ? "primary.main"
                      : "action.disabledBackground",
                  borderRadius: "2px 2px 0 0",
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Paper>

      <Box sx={distGridSx}>
        <BarList title="Browsers" slices={analytics.browsers} />
        <BarList title="Devices" slices={analytics.devices} />
        <BarList title="Traffic sources" slices={analytics.sources} />
        <BarList title="Operating systems" slices={analytics.os} />
        <BarList title="Landing URLs" slices={analytics.landingUrls} />
      </Box>
    </Box>
  );
}
