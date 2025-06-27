import type { SSEClientTransportOptions } from '@modelcontextprotocol/sdk/client/sse';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import type { StreamableHTTPClientTransportOptions } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { pick } from 'lodash-es';

import type {
  ClientTransportOptions,
  NetworkClientOptions,
  ServerTransportOptions,
  StdioClientOptions,
  SupportTransports,
} from '../options/index.js';
import {
  isClientTransportOptions,
  isServerTransportOptions,
  isSSEServerTransportOptions,
  isStdioServerTransportOptions,
  isStreamableHTTPServerTransportOptions,
} from '../utils/options.js';
import type { Hooks } from './hooks.js';

type TransportOptions = ClientTransportOptions | ServerTransportOptions;

export const DEFAULT_HTTP_HEADERS = {
  Accept: 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

export function initializeTransport(
  options: ClientTransportOptions | ServerTransportOptions,
  hooks: InitialHooks,
): Transport {
  if (isServerTransportOptions(options)) {
    return initializeServerTransport(options as ServerTransportOptions, hooks);
  }
  if (isClientTransportOptions(options)) {
    return initializeClientTransport(options as ClientTransportOptions, hooks);
  }
  throw new Error(`Unknown transport type`);
}

export function initializeServerTransport(
  options: ServerTransportOptions,
  hooks: InitialHooks,
): Transport {
  let transport: Transport;
  hooks.onBeforeCreate?.(options);
  if (isSSEServerTransportOptions(options)) {
    const { endpoint, res } = options;
    transport = new SSEServerTransport(endpoint, res);
  } else if (isStreamableHTTPServerTransportOptions(options)) {
    const { sessionIdGenerator, eventStore, onsessioninitialized } = options;
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator,
      eventStore,
      onsessioninitialized,
    });
  } else if (isStdioServerTransportOptions(options)) {
    transport = new StdioServerTransport();
  } else {
    throw new Error(`Unknown server transport type: ${(options as any).type}`);
  }
  hooks.onCreated?.(transport);
  return transport;
}

function initializeClientTransport(
  options: ClientTransportOptions,
  hooks: InitialHooks,
): Transport {
  if (options.clientType === 'sse' || options.clientType === 'http') {
    if (!options.networkOptions) {
      throw new Error('Network options are required for SSE/HTTP transport');
    }
    return initializeNetworkTransport(options.clientType, options.networkOptions!, hooks);
  } else if (options.clientType === 'stdio') {
    if (!options.stdioOptions) {
      throw new Error('Stdio options are required for stdio transport');
    }
    return initializeStdioTransport(options.stdioOptions!, hooks);
  }
  throw new Error(`Unknown client transport type: ${(options as any).clientType}`);
}
function initializeNetworkTransport(
  clientType: 'sse' | 'http',
  options: NetworkClientOptions,
  hooks: InitialHooks,
): Transport {
  console.log('initializeNetworkTransport', options);
  if (!options.url) {
    throw new Error('URL is required for SSE/HTTP transport');
  }

  const headers: Record<string, string> = {
    ...DEFAULT_HTTP_HEADERS,
  };

  if (options.headers) {
    try {
      Object.assign(headers, JSON.parse(options.headers));
    } catch (error) {
      throw new Error('Error parsing headers JSON: ' + error);
    }
  }

  const transportOptions: NetworkTransportCreateOptions = {
    requestInit: {
      headers,
      cache: 'no-store' as RequestCache,
      credentials: 'include',
    },
    url: new URL(options.url),
  };

  if (hooks.onBeforeCreate) {
    hooks.onBeforeCreate(transportOptions);
  }

  const url = transportOptions.url;

  let transport: Transport;
  if (clientType === 'sse') {
    transport = new SSEClientTransport(url, transportOptions);
  } else if (clientType === 'http') {
    transport = new StreamableHTTPClientTransport(url, transportOptions);
  } else {
    throw new Error(`Unknown client transport type: ${clientType}`);
  }

  hooks.onCreated?.(transport);
  return transport;
}

function initializeStdioTransport(options: StdioClientOptions, hooks: InitialHooks): Transport {
  if (!options.command) {
    throw new Error('Command is required for stdio transport');
  }

  const command = process.env.SHELL ?? '/bin/sh';
  const commandArgs = ['-c', options.command];

  const env: Record<string, string> = {};

  Object.keys(process.env).forEach((key) => {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key]!;
    }
  });

  if (options.env) {
    try {
      Object.assign(env, JSON.parse(options.env));
    } catch (error) {
      throw new Error('Error parsing env JSON: ' + error);
    }
  }

  const stdioTransportOptions: StdioServerParameters = {
    command,
    args: commandArgs,
    env,
    cwd: process.cwd(),
    stderr: 'pipe' as const,
  };

  if (hooks.onBeforeCreate) {
    hooks.onBeforeCreate(stdioTransportOptions);
  }

  const transport = new StdioClientTransport(stdioTransportOptions);

  hooks.onCreated?.(transport);

  return transport;
}

type MixinURL<T> = T & { url: URL };
export type NetworkTransportCreateOptions =
  | MixinURL<SSEClientTransportOptions>
  | MixinURL<StreamableHTTPClientTransportOptions>;
export type StdioTransportCreateOptions = StdioServerParameters;

export type CreateTransportOptions = StdioTransportCreateOptions | NetworkTransportCreateOptions;
export const isNetworkTransportCreateOptions = (
  options: CreateTransportOptions,
): options is NetworkTransportCreateOptions => {
  return options != null && typeof options === 'object' && 'url' in options;
};
export const isStdioTransportCreateOptions = (
  options: CreateTransportOptions,
): options is StdioTransportCreateOptions => {
  return options != null && typeof options === 'object' && 'command' in options;
};

export const isSupportTransport = (transport: string): transport is SupportTransports => {
  return ['stdio', 'http', 'sse'].includes(transport);
};

type InitialHooks = Pick<Hooks, 'onBeforeCreate' | 'onCreated'>;

/**
 * Inject hooks callbacks into transport object to enhance its behavior
 */
export function injectTransportHooks(transport: Transport, hooks: Hooks = {}): Transport {
  // Save references to original methods
  const originalStart = transport.start.bind(transport);
  const originalSend = transport.send.bind(transport);
  const originalClose = transport.close.bind(transport);
  const originalSetProtocolVersion = transport.setProtocolVersion?.bind(transport);

  // Wrap start method
  transport.start = async (): Promise<void> => {
    try {
      hooks.onStart?.();
      await originalStart();
      hooks.onAfterStart?.();
    } catch (error) {
      hooks.onError?.(new Error(`Failed to start transport: ${error}`));
      throw error;
    }
  };

  // Wrap send method
  transport.send = async (
    message: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> => {
    try {
      hooks.onBeforeSendMessage?.(message, options);
      await originalSend(message, options);
      hooks.onAfterSendMessage?.(message, options);
    } catch (error: any) {
      // Special handling for 501 errors with POST /messages
      if (error && typeof error.message === 'string' && error.message.includes('POST /messages')) {
        hooks.onWarning?.('Received 501 error about POST /messages, attempting to work around...');
        return;
      }
      hooks.onError?.(new Error(`Failed to send message: ${error}`));
      throw error;
    }
  };

  // Wrap close method
  transport.close = async (): Promise<void> => {
    try {
      hooks.onClose?.();
      await originalClose();
      hooks.onAfterClose?.();
    } catch (error) {
      hooks.onError?.(new Error(`Failed to close transport: ${error}`));
      throw error;
    }
  };

  // Wrap setProtocolVersion method
  if (originalSetProtocolVersion) {
    transport.setProtocolVersion = (version: string): void => {
      const currentVersion = (transport as any).protocolVersion;
      hooks.onSetProtocolVersion?.(currentVersion, version);
      originalSetProtocolVersion(version);
    };
  }

  // Save original event handler properties
  let _onclose = transport.onclose;
  let _onerror = transport.onerror;
  let _onmessage = transport.onmessage;

  // Redefine onclose setter
  Object.defineProperty(transport, 'onclose', {
    get: () => _onclose,
    set: function (value: (() => void) | undefined) {
      _onclose = value
        ? () => {
            hooks.onClose?.();
            value();
          }
        : value;
    },
    configurable: true,
  });

  // Redefine onerror setter
  Object.defineProperty(transport, 'onerror', {
    get: () => _onerror,
    set: function (value: ((error: Error) => void) | undefined) {
      _onerror = value
        ? (error: Error) => {
            hooks.onError?.(error);
            value(error);
          }
        : value;
    },
    configurable: true,
  });

  // Redefine onmessage setter
  Object.defineProperty(transport, 'onmessage', {
    get: () => _onmessage,
    set: function (value: ((message: JSONRPCMessage) => void) | undefined) {
      _onmessage = value
        ? (message: JSONRPCMessage) => {
            hooks.onReceiveMessage?.(message);
            value(message);
          }
        : value;
    },
    configurable: true,
  });

  return transport;
}

export const createTransportWithHooks = <T extends Transport>(
  options: TransportOptions,
  hooks: Hooks = {},
): T => {
  const transport = initializeTransport(options, pick(hooks, ['onBeforeCreate', 'onCreated']));
  return injectTransportHooks(transport, hooks) as T;
};
