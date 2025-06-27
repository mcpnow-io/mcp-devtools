import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClientTransportOptions } from '../../options';
import { DEFAULT_HTTP_HEADERS, initializeTransport } from '../index';

// Mock all SDK transports
vi.mock('@modelcontextprotocol/sdk/client/sse');
vi.mock('@modelcontextprotocol/sdk/client/stdio');
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp');

// Mock process.env and process.cwd for stdio transport tests
const originalEnv = process.env;
const originalCwd = process.cwd;

describe('Client Transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.cwd = vi.fn().mockReturnValue('/test/cwd');
  });

  afterEach(() => {
    process.env = originalEnv;
    process.cwd = originalCwd;
  });

  describe('SSE Client Transport', () => {
    it('should create SSE client transport with correct configuration', () => {
      const options: ClientTransportOptions = {
        clientType: 'sse',
        networkOptions: {
          url: 'http://example.com/sse',
          headers: '{"Authorization": "Bearer token"}',
        },
      };

      const mockTransport = { start: vi.fn(), send: vi.fn(), close: vi.fn() } as any;
      vi.mocked(SSEClientTransport).mockReturnValue(mockTransport);
      const hooks = { onBeforeCreate: vi.fn(), onCreated: vi.fn() };

      const result = initializeTransport(options, hooks);

      expect(SSEClientTransport).toHaveBeenCalledWith(
        new URL('http://example.com/sse'),
        expect.objectContaining({
          requestInit: expect.objectContaining({
            headers: expect.any(Object),
            cache: 'no-store',
            credentials: 'include',
          }),
          url: new URL('http://example.com/sse'),
        }),
      );
      expect(result).toBe(mockTransport);
      expect(hooks.onCreated).toHaveBeenCalledWith(mockTransport);
    });

    it('should merge default HTTP headers with custom headers', () => {
      const options: ClientTransportOptions = {
        clientType: 'sse',
        networkOptions: {
          url: 'http://example.com/sse',
          headers: '{"Custom-Header": "value"}',
        },
      };

      const mockTransport = { start: vi.fn(), send: vi.fn(), close: vi.fn() } as any;
      vi.mocked(SSEClientTransport).mockReturnValue(mockTransport);

      initializeTransport(options, {});

      expect(SSEClientTransport).toHaveBeenCalledWith(
        new URL('http://example.com/sse'),
        expect.objectContaining({
          requestInit: expect.objectContaining({
            headers: {
              ...DEFAULT_HTTP_HEADERS,
              'Custom-Header': 'value',
            },
          }),
        }),
      );
    });

    it('should handle invalid JSON headers', () => {
      const options: ClientTransportOptions = {
        clientType: 'sse',
        networkOptions: {
          url: 'http://example.com/sse',
          headers: 'invalid json',
        },
      };

      expect(() => initializeTransport(options, {})).toThrow('Error parsing headers JSON');
    });

    it('should throw error when URL is missing', () => {
      const options: ClientTransportOptions = {
        clientType: 'sse',
        networkOptions: {},
      };

      expect(() => initializeTransport(options, {})).toThrow(
        'URL is required for SSE/HTTP transport',
      );
    });
  });

  describe('HTTP Client Transport', () => {
    it('should create StreamableHTTP client transport', () => {
      const options: ClientTransportOptions = {
        clientType: 'http',
        networkOptions: {
          url: 'http://example.com/http',
        },
      };

      const mockTransport = { start: vi.fn(), send: vi.fn(), close: vi.fn() } as any;
      vi.mocked(StreamableHTTPClientTransport).mockReturnValue(mockTransport);

      const result = initializeTransport(options, {});

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
        new URL('http://example.com/http'),
        expect.objectContaining({
          requestInit: expect.objectContaining({
            headers: DEFAULT_HTTP_HEADERS,
            cache: 'no-store',
            credentials: 'include',
          }),
          url: new URL('http://example.com/http'),
        }),
      );
      expect(result).toBe(mockTransport);
    });
  });

  describe('Stdio Client Transport', () => {
    it('should create Stdio client transport with correct command', () => {
      const options: ClientTransportOptions = {
        clientType: 'stdio',
        stdioOptions: {
          command: 'python script.py',
          env: '{"CUSTOM_VAR": "value"}',
        },
      };

      const mockTransport = { start: vi.fn(), send: vi.fn(), close: vi.fn() } as any;
      vi.mocked(StdioClientTransport).mockReturnValue(mockTransport);
      process.env.SHELL = '/bin/bash';
      process.env.PATH = '/usr/bin';

      const result = initializeTransport(options, {});

      expect(StdioClientTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          command: '/bin/bash',
          args: ['-c', 'python script.py'],
          env: expect.objectContaining({
            SHELL: '/bin/bash',
            PATH: '/usr/bin',
            CUSTOM_VAR: 'value',
          }),
          cwd: '/test/cwd',
          stderr: 'pipe',
        }),
      );
      expect(result).toBe(mockTransport);
    });

    it('should use default shell when SHELL environment variable is not set', () => {
      const options: ClientTransportOptions = {
        clientType: 'stdio',
        stdioOptions: {
          command: 'node index.js',
        },
      };

      const mockTransport = { start: vi.fn(), send: vi.fn(), close: vi.fn() } as any;
      vi.mocked(StdioClientTransport).mockReturnValue(mockTransport);
      delete process.env.SHELL;

      initializeTransport(options, {});

      expect(StdioClientTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          command: '/bin/sh',
          args: ['-c', 'node index.js'],
        }),
      );
    });

    it('should handle invalid environment variables JSON', () => {
      const options: ClientTransportOptions = {
        clientType: 'stdio',
        stdioOptions: {
          command: 'test command',
          env: 'invalid json',
        },
      };

      expect(() => initializeTransport(options, {})).toThrow('Error parsing env JSON');
    });

    it('should throw error when command is missing', () => {
      const options: ClientTransportOptions = {
        clientType: 'stdio',
        stdioOptions: {},
      };

      expect(() => initializeTransport(options, {})).toThrow(
        'Command is required for stdio transport',
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error when network options are missing', () => {
      const options: ClientTransportOptions = {
        clientType: 'sse',
      };

      expect(() => initializeTransport(options, {})).toThrow(
        'Network options are required for SSE/HTTP transport',
      );
    });

    it('should throw error when stdio options are missing', () => {
      const options: ClientTransportOptions = {
        clientType: 'stdio',
      };

      expect(() => initializeTransport(options, {})).toThrow(
        'Stdio options are required for stdio transport',
      );
    });

    it('should throw error for unknown client type', () => {
      const options = {
        clientType: 'unknown',
      } as any;

      expect(() => initializeTransport(options, {})).toThrow('Unknown transport type');
    });
  });
});
