import type {
  ClientTransportOptions,
  NetworkClientOptions,
  ServerTransportOptions,
  SSEServerTransportOptions,
  StdioClientOptions,
  StdioServerTransportOptions,
  StreamableHTTPServerTransportOptions,
} from '@/options';

// Client
export function isClientTransportOptions(obj: any): obj is ClientTransportOptions {
  return (
    !!obj && (obj.clientType === 'sse' || obj.clientType === 'http' || obj.clientType === 'stdio')
  );
}
export function isNetworkClientOptions(obj: any): obj is NetworkClientOptions {
  return !!obj && (obj.clientType === 'sse' || obj.clientType === 'http');
}

export function isStdioClientOptions(obj: any): obj is StdioClientOptions {
  return !!obj && obj.clientType === 'stdio';
}

// Server
export function isServerTransportOptions(obj: any): obj is ServerTransportOptions {
  return (
    !!obj && (obj.serverType === 'sse' || obj.serverType === 'http' || obj.serverType === 'stdio')
  );
}
export function isSSEServerTransportOptions(obj: any): obj is SSEServerTransportOptions {
  return !!obj && obj.serverType === 'sse';
}
export function isStreamableHTTPServerTransportOptions(
  obj: any,
): obj is StreamableHTTPServerTransportOptions {
  return !!obj && obj.serverType === 'http';
}
export function isStdioServerTransportOptions(obj: any): obj is StdioServerTransportOptions {
  return !!obj && obj.serverType === 'stdio';
}

export function isNetworkTransport(tp: string): tp is 'sse' | 'http' {
  return ['sse', 'http'].includes(tp);
}

export function isStdioTransport(tp: string): tp is 'stdio' {
  return ['stdio'].includes(tp);
}
