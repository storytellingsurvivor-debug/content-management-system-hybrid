"use client";

import { useMemo } from "react";
import { Alert, Box, Chip, Typography } from "@mui/material";
import type { BlogRow } from "@/types/blog";
import { HAPPY_TABLES } from "@/lib/happySpotSchema";
import { HappyTableEditor } from "./HappyTableEditor";
import type { HappyTableState } from "./useHappyTable";

interface SpotTagContentPanelProps {
  isConnected: boolean;
  spots: HappyTableState;
  tags: HappyTableState;
  tagContents: HappyTableState;
}

const numberOr = (value: unknown): number | null => {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
};

// Edit a spot's per-tag content without leaving the spot: pick one of the tags
// the spot is filed under, and fill the block shown when a visitor selects it.
// The main tag is what the page shows by default.
export function SpotTagContentPanel({
  isConnected,
  spots,
  tags,
  tagContents,
}: SpotTagContentPanelProps) {
  const spotId = numberOr(spots.selectedId.replace("id:", ""));

  const spotRow = useMemo(
    () => spots.rows.find((row) => Number(row.id) === spotId) ?? null,
    [spots.rows, spotId],
  );

  // The spot's own tags, main one first — the only ones it can hold content for.
  const spotTags = useMemo(() => {
    if (!spotRow) return [];
    const mainTagId = numberOr(spotRow.main_tag_id);
    const ids = Array.isArray(spotRow.tag_ids)
      ? (spotRow.tag_ids as number[])
      : [];
    const ordered = [
      ...(mainTagId ? [mainTagId] : []),
      ...ids.filter((id) => id !== mainTagId),
    ];
    return ordered
      .map((id) => tags.rows.find((row) => Number(row.id) === id))
      .filter((row): row is BlogRow => Boolean(row))
      .map((row) => ({
        id: Number(row.id),
        label: String(row.label ?? row.slug ?? row.id),
        language: String(row.language ?? ""),
        isMain: Number(row.id) === mainTagId,
      }));
  }, [spotRow, tags.rows]);

  const rowsForSpot = useMemo(
    () => tagContents.rows.filter((row) => Number(row.spot_id) === spotId),
    [tagContents.rows, spotId],
  );

  if (!spotId || !spotRow) {
    return (
      <Alert severity="info" sx={{ mt: 3 }}>
        Pick a spot above to edit what it shows for each of its tags.
      </Alert>
    );
  }

  const openTag = (tagId: number) => {
    const existing = rowsForSpot.find((row) => Number(row.tag_id) === tagId);
    if (existing) {
      tagContents.select(`id:${existing.id}`);
      return;
    }
    // No row yet: start a blank one already pointed at this spot and tag.
    tagContents.createNew();
    tagContents.changeField("spot_id", String(spotId));
    tagContents.changeField("tag_id", String(tagId));
  };

  const editingTagId = numberOr(tagContents.form.tag_id);
  const editingThisSpot = numberOr(tagContents.form.spot_id) === spotId;

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Content per tag — {String(spotRow.name ?? spotRow.slug ?? "")}
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
        The main tag is the default view of the page. The other tags become
        blocks the visitor can switch to.
      </Typography>

      {spotTags.length === 0 ? (
        <Alert severity="warning">
          This spot has no tag yet. Add tags to it above, then come back.
        </Alert>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
          {spotTags.map((tag) => {
            const filled = rowsForSpot.some(
              (row) => Number(row.tag_id) === tag.id,
            );
            const active = editingThisSpot && editingTagId === tag.id;
            return (
              <Chip
                key={tag.id}
                onClick={() => openTag(tag.id)}
                color={active ? "primary" : "default"}
                variant={filled ? "filled" : "outlined"}
                label={`${tag.isMain ? "★ " : ""}${tag.label} · ${tag.language}${
                  filled ? "" : " — empty"
                }`}
              />
            );
          })}
        </Box>
      )}

      {spotTags.length > 0 && (
        <HappyTableEditor
          title={
            editingThisSpot && editingTagId
              ? `Edit content for ${
                  spotTags.find((tag) => tag.id === editingTagId)?.label ??
                  "this tag"
                }`
              : "Pick a tag above"
          }
          isConnected={isConnected}
          isBusy={tagContents.submitting}
          mode={tagContents.mode}
          columns={HAPPY_TABLES.tagContents.columns}
          groups={HAPPY_TABLES.tagContents.groups}
          values={tagContents.form}
          validationError={tagContents.error}
          relationSelects={{}}
          onFieldChange={tagContents.changeField}
          onSubmit={tagContents.submit}
        />
      )}
    </Box>
  );
}
