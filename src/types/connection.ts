import type { BrandKey } from "@/lib/brands";

export type EnvironmentLabel = "STAGING" | "PROD";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface ConnectionFormValues {
  brand: BrandKey;
  environment: EnvironmentLabel;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface ConnectionViewState {
  status: ConnectionStatus;
  errorMessage: string | null;
}
