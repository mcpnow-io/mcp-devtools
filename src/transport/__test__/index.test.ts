import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClientTransportOptions, ServerTransportOptions } from '../../options';
import {
  createTransportWithHooks,
  DEFAULT_HTTP_HEADERS,
  initializeServerTransport,
  initializeTransport,
} from '../index';

// Mock all SDK transports
vi.mock('@modelcontextprotocol/sdk/client/sse');
vi.mock('@modelcontextprotocol/sdk/client/stdio');
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp');
vi.mock('@modelcontextprotocol/sdk/server/sse');
vi.mock('@modelcontextprotocol/sdk/server/stdio');
vi.mock('@modelcontextprotocol/sdk/server/streamableHttp');

describe('Transport Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DEFAULT_HTTP_HEADERS', () => {
    it('should contain correct default HTTP headers', () => {
      expect(DEFAULT_HTTP_HEADERS).toEqual({
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
    });
  });

  describe('initializeTransport', () => {
    it('should call initializeServerTransport for server config', () => {
      const serverOptions: ServerTransportOptions = {
        serverType: 'sse',
        endpoint: '/sse',
        res: {} as any,
      };

      const hooks = { onBeforeCreate: vi.fn(), onCreated: vi.fn() };
      const mockTransport = { start: vi.fn(), send: vi.fn(), close: vi.fn() } as any;
      vi.mocked(SSEServerTransport).mockReturnValue(mockTransport);

      const result = initializeTransport(serverOptions, hooks);

      expect(result).toBe(mockTransport);
      expect(hooks.onBeforeCreate).toHaveBeenCalledWith(serverOptions);
      expect(hooks.onCreated).toHaveBeenCalledWith(mockTransport);
    });

    it('should call initializeClientTransport for client config', () => {
      const clientOptions: ClientTransportOptions = {
        clientType: 'sse',
        networkOptions: { url: 'http://test.com' },
      };

      const hooks = { onBeforeCreate: vi.fn(), onCreated: vi.fn() };
      const mockTransport = { start: vi.fn(), send: vi.fn(), close: vi.fn() } as any;
      vi.mocked(SSEClientTransport).mockReturnValue(mockTransport);

      const result = initializeTransport(clientOptions, hooks);

      expect(result).toBe(mockTransport);
      expect(hooks.onCreated).toHaveBeenCalledWith(mockTransport);
    });

    it('should throw error for unknown config type', () => {
      const invalidOptions = { unknownType: 'invalid' } as any;
      const hooks = {};

      expect(() => initializeTransport(invalidOptions, hooks)).toThrow('Unknown transport type');
    });
  });

  describe('initializeServerTransport', () => {
    it('should create SSE server transport', () => {
      const options: ServerTransportOptions = {
        serverType: 'sse',
        endpoint: '/test-endpoint',
        res: {} as any,
      };
      const hooks = { onBeforeCreate: vi.fn(), onCreated: vi.fn() };
      const mockTransport = { start: vi.fn(), send: vi.fn(), close: vi.fn() } as any;
      vi.mocked(SSEServerTransport).mockReturnValue(mockTransport);

      const result = initializeServerTransport(options, hooks);

      expect(SSEServerTransport).toHaveBeenCalledWith('/test-endpoint', options.res);
      expect(hooks.onBeforeCreate).toHaveBeenCalledWith(options);
      expect(hooks.onCreated).toHaveBeenCalledWith(mockTransport);
      expect(result).toBe(mockTransport);
    });

    it('should create StreamableHTTP server transport', () => {
      const options: ServerTransportOptions = {
        serverType: 'http',
        sessionIdGenerator: vi.fn(),
        eventStore: {} as any,
        onsessioninitialized: vi.fn(),
      };
      const hooks = { onBeforeCreate: vi.fn(), onCreated: vi.fn() };
      const mockTransport = { start: vi.fn(), send: vi.fn(), close: vi.fn() } as any;
      vi.mocked(StreamableHTTPServerTransport).mockReturnValue(mockTransport);

      const result = initializeServerTransport(options, hooks);

      expect(StreamableHTTPServerTransport).toHaveBeenCalledWith({
        sessionIdGenerator: options.sessionIdGenerator,
        eventStore: options.eventStore,
        onsessioninitialized: options.onsessioninitialized,
      });
      expect(hooks.onCreated).toHaveBeenCalledWith(mockTransport);
      expect(result).toBe(mockTransport);
    });

    it('should create Stdio server transport', () => {
      const options: ServerTransportOptions = {
        serverType: 'stdio',
      };
      const hooks = { onBeforeCreate: vi.fn(), onCreated: vi.fn() };
      const mockTransport = { start: vi.fn(), send: vi.fn(), close: vi.fn() } as any;
      vi.mocked(StdioServerTransport).mockReturnValue(mockTransport);

      const result = initializeServerTransport(options, hooks);

      expect(StdioServerTransport).toHaveBeenCalledWith();
      expect(hooks.onCreated).toHaveBeenCalledWith(mockTransport);
      expect(result).toBe(mockTransport);
    });

    it('should throw error for unknown server transport type', () => {
      const options = { type: 'unknown' } as any;
      const hooks = {};

      expect(() => initializeServerTransport(options, hooks)).toThrow(
        'Unknown server transport type: unknown',
      );
    });
  });

  describe('createTransportWithHooks', () => {
    it('should create transport with hooks and return enhanced transport', () => {
      const options: ClientTransportOptions = {
        clientType: 'sse',
        networkOptions: { url: 'http://test.com' },
      };
      const hooks = {
        onBeforeCreate: vi.fn(),
        onCreated: vi.fn(),
        onStart: vi.fn(),
        onError: vi.fn(),
      };

      const mockTransport = {
        start: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        onclose: undefined,
        onerror: undefined,
        onmessage: undefined,
      } as any;
      vi.mocked(SSEClientTransport).mockReturnValue(mockTransport);

      const result = createTransportWithHooks(options, hooks);

      expect(result).toBe(mockTransport);
      expect(hooks.onCreated).toHaveBeenCalledWith(mockTransport);
      // Verify transport is enhanced with hooks
      expect(typeof result.start).toBe('function');
      expect(typeof result.send).toBe('function');
      expect(typeof result.close).toBe('function');
    });

    it('should work properly without hooks', () => {
      const options: ClientTransportOptions = {
        clientType: 'sse',
        networkOptions: { url: 'http://test.com' },
      };

      const mockTransport = {
        start: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        onclose: undefined,
        onerror: undefined,
        onmessage: undefined,
      } as any;
      vi.mocked(SSEClientTransport).mockReturnValue(mockTransport);

      const result = createTransportWithHooks(options);

      expect(result).toBe(mockTransport);
    });
  });
});
