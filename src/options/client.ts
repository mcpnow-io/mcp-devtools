import type { BasicOptions, SupportTransports } from './common';

export interface NetworkClientOptions extends BasicOptions {
  /** JSON string of headers for SSE transport */
  headers?: string;

  /** Interval for client-to-server pings in milliseconds (0 to disable) */
  pingInterval?: string;

  /** URL for SSE or StreamableHTTP transport */
  url?: string;
}

export interface StdioClientOptions extends BasicOptions {
  /** Full command line for stdio transport */
  command?: string;

  /** JSON string of environment variables for stdio transport */
  env?: string;

  /** Pipe stderr from the stdio child process (for debugging) */
  pipeStderr?: boolean;
}

export type ClientTransportOptions = {
  clientType: SupportTransports;
  networkOptions?: NetworkClientOptions;
  stdioOptions?: StdioClientOptions;
};
