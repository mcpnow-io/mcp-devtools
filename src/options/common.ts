export const CurrentSupportTransports = ['http', 'sse', 'stdio'] as const;
export type SupportTransports = NonNullable<typeof CurrentSupportTransports>[number];

export interface BasicOptions {
  [x: string]: unknown;
  clientType?: SupportTransports;
  serverType?: SupportTransports;
}
