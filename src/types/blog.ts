export type FieldUiType =
  | "text"
  | "number"
  | "boolean"
  | "markdown"
  | "url"
  | "datetime";

export interface BlogColumnDefinition {
  name: string;
  label: string;
  uiType: FieldUiType;
  required: boolean;
  readOnly: boolean;
}

export interface BlogRow {
  id?: number | string;
  [key: string]: unknown;
}

export type EditorMode = "create" | "edit";
export type SubmitAction = "create" | "update" | "delete";
