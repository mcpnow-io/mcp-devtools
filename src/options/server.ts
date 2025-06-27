import type { ServerResponse } from 'node:http';
import type { EventStore } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import type { BasicOptions } from './common';

// Server transport options
export interface SSEServerTransportOptions extends BasicOptions {
  serverType: 'sse';
  endpoint: string;
  res: ServerResponse;
}
export interface StreamableHTTPServerTransportOptions extends BasicOptions {
  serverType: 'http';
  sessionIdGenerator: () => string;
  eventStore: EventStore;
  onsessioninitialized?: (sessionId: string) => void;
  initialSessionId?: string;
}
export interface StdioServerTransportOptions extends BasicOptions {
  serverType: 'stdio';
}

export type ServerTransportOptions =
  | SSEServerTransportOptions
  | StreamableHTTPServerTransportOptions
  | StdioServerTransportOptions;
