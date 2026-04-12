export type EnvironmentLabel = "STAGING" | "PROD";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface ConnectionFormValues {
  environment: EnvironmentLabel;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface ConnectionViewState {
  status: ConnectionStatus;
  errorMessage: string | null;
}
