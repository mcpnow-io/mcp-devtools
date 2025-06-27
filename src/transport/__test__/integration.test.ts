import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClientTransportOptions, ServerTransportOptions } from '../../options';
import type { Hooks } from '../hooks';
import { createTransportWithHooks } from '../index';

// Mock all SDK transports
vi.mock('@modelcontextprotocol/sdk/client/sse');
vi.mock('@modelcontextprotocol/sdk/client/stdio');
vi.mock('@modelcontextprotocol/sdk/server/sse');

describe('Transport Integration', () => {
  const originalEnv = process.env;
  const originalCwd = process.cwd;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.cwd = vi.fn().mockReturnValue('/test/cwd');
  });

  afterEach(() => {
    process.env = originalEnv;
    process.cwd = originalCwd;
  });

  describe('Complete Client Lifecycle', () => {
    it('should execute complete SSE client transport lifecycle', async () => {
      const lifecycleEvents: string[] = [];

      const mockTransport = {
        start: vi.fn().mockImplementation(async () => {
          lifecycleEvents.push('transport-start');
        }),
        send: vi.fn().mockImplementation(async () => {
          lifecycleEvents.push('transport-send');
        }),
        close: vi.fn().mockImplementation(async () => {
          lifecycleEvents.push('transport-close');
        }),
        onclose: undefined,
        onerror: undefined,
        onmessage: undefined,
      } as any;

      vi.mocked(SSEClientTransport).mockReturnValue(mockTransport);

      const options: ClientTransportOptions = {
        clientType: 'sse',
        networkOptions: {
          url: 'http://example.com/sse',
        },
      };

      const hooks: Hooks = {
        onBeforeCreate: () => lifecycleEvents.push('before-create'),
        onCreated: () => lifecycleEvents.push('created'),
        onStart: () => lifecycleEvents.push('start'),
        onAfterStart: () => lifecycleEvents.push('after-start'),
        onBeforeSendMessage: () => lifecycleEvents.push('before-send'),
        onAfterSendMessage: () => lifecycleEvents.push('after-send'),
        onClose: () => lifecycleEvents.push('close'),
        onAfterClose: () => lifecycleEvents.push('after-close'),
      };

      const transport = createTransportWithHooks(options, hooks);

      // Execute complete lifecycle
      await transport.start();
      await transport.send({ jsonrpc: '2.0', method: 'test' });
      await transport.close();

      expect(lifecycleEvents).toEqual([
        'before-create',
        'created',
        'start',
        'transport-start',
        'after-start',
        'before-send',
        'transport-send',
        'after-send',
        'close',
        'transport-close',
        'after-close',
      ]);
    });

    it('should execute complete Stdio client transport lifecycle', async () => {
      const lifecycleEvents: string[] = [];

      const mockTransport = {
        start: vi.fn().mockImplementation(async () => {
          lifecycleEvents.push('transport-start');
        }),
        send: vi.fn().mockImplementation(async () => {
          lifecycleEvents.push('transport-send');
        }),
        close: vi.fn().mockImplementation(async () => {
          lifecycleEvents.push('transport-close');
        }),
        onclose: undefined,
        onerror: undefined,
        onmessage: undefined,
      } as any;

      vi.mocked(StdioClientTransport).mockReturnValue(mockTransport);

      // Mock environment variables
      process.env.SHELL = '/bin/bash';

      const options: ClientTransportOptions = {
        clientType: 'stdio',
        stdioOptions: {
          command: 'python script.py',
        },
      };

      const hooks: Hooks = {
        onStart: () => lifecycleEvents.push('start'),
        onAfterStart: () => lifecycleEvents.push('after-start'),
        onClose: () => lifecycleEvents.push('close'),
        onAfterClose: () => lifecycleEvents.push('after-close'),
      };

      const transport = createTransportWithHooks(options, hooks);

      await transport.start();
      await transport.close();

      expect(lifecycleEvents).toEqual([
        'start',
        'transport-start',
        'after-start',
        'close',
        'transport-close',
        'after-close',
      ]);
    });
  });

  describe('Complete Server Lifecycle', () => {
    it('should execute complete SSE server transport lifecycle', async () => {
      const lifecycleEvents: string[] = [];

      const mockTransport = {
        start: vi.fn().mockImplementation(async () => {
          lifecycleEvents.push('transport-start');
        }),
        send: vi.fn().mockImplementation(async () => {
          lifecycleEvents.push('transport-send');
        }),
        close: vi.fn().mockImplementation(async () => {
          lifecycleEvents.push('transport-close');
        }),
        onclose: undefined,
        onerror: undefined,
        onmessage: undefined,
      } as any;

      vi.mocked(SSEServerTransport).mockReturnValue(mockTransport);

      const options: ServerTransportOptions = {
        serverType: 'sse',
        endpoint: '/events',
        res: {} as any,
      };

      const hooks: Hooks = {
        onBeforeCreate: () => lifecycleEvents.push('before-create'),
        onCreated: () => lifecycleEvents.push('created'),
        onStart: () => lifecycleEvents.push('start'),
        onAfterStart: () => lifecycleEvents.push('after-start'),
        onBeforeSendMessage: () => lifecycleEvents.push('before-send'),
        onAfterSendMessage: () => lifecycleEvents.push('after-send'),
        onClose: () => lifecycleEvents.push('close'),
        onAfterClose: () => lifecycleEvents.push('after-close'),
      };

      const transport = createTransportWithHooks(options, hooks);

      await transport.start();
      await transport.send({ jsonrpc: '2.0', method: 'notify', params: {} });
      await transport.close();

      expect(lifecycleEvents).toEqual([
        'before-create',
        'created',
        'start',
        'transport-start',
        'after-start',
        'before-send',
        'transport-send',
        'after-send',
        'close',
        'transport-close',
        'after-close',
      ]);
    });
  });

  describe('Error Handling Integration', () => {
    it('should properly handle errors when transport creation fails', () => {
      const hooks: Hooks = {
        onBeforeCreate: vi.fn(),
        onCreated: vi.fn(),
        onError: vi.fn(),
      };

      const invalidOptions = {
        clientType: 'invalid',
      } as any;

      expect(() => createTransportWithHooks(invalidOptions, hooks)).toThrow();
      expect(hooks.onError).not.toHaveBeenCalled(); // Creation stage errors don't trigger onError
    });

    it('should properly handle errors when transport methods fail', async () => {
      const errorEvents: string[] = [];

      const mockTransport = {
        start: vi.fn().mockRejectedValue(new Error('Start failed')),
        send: vi.fn().mockRejectedValue(new Error('Send failed')),
        close: vi.fn().mockRejectedValue(new Error('Close failed')),
        onclose: undefined,
        onerror: undefined,
        onmessage: undefined,
      } as any;

      vi.mocked(SSEClientTransport).mockReturnValue(mockTransport);

      const options: ClientTransportOptions = {
        clientType: 'sse',
        networkOptions: {
          url: 'http://example.com/sse',
        },
      };

      const hooks: Hooks = {
        onError: (error) => errorEvents.push(`error: ${error.message}`),
        onStart: () => errorEvents.push('start'),
        onBeforeSendMessage: () => errorEvents.push('before-send'),
        onClose: () => errorEvents.push('close'),
      };

      const transport = createTransportWithHooks(options, hooks);

      // Test start failure
      await expect(transport.start()).rejects.toThrow('Start failed');
      expect(errorEvents).toContain('start');
      expect(errorEvents).toContain('error: Failed to start transport: Error: Start failed');

      // Reset error events
      errorEvents.length = 0;

      // Test send failure
      await expect(transport.send({ jsonrpc: '2.0', method: 'test' })).rejects.toThrow(
        'Send failed',
      );
      expect(errorEvents).toContain('before-send');
      expect(errorEvents).toContain('error: Failed to send message: Error: Send failed');

      // Reset error events
      errorEvents.length = 0;

      // Test close failure
      await expect(transport.close()).rejects.toThrow('Close failed');
      expect(errorEvents).toContain('close');
      expect(errorEvents).toContain('error: Failed to close transport: Error: Close failed');
    });
  });

  describe('Event Handler Integration', () => {
    it('should properly integrate event handlers with hooks', () => {
      const events: string[] = [];

      const mockTransport = {
        start: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        onclose: undefined,
        onerror: undefined,
        onmessage: undefined,
      } as any;

      vi.mocked(SSEClientTransport).mockReturnValue(mockTransport);

      const options: ClientTransportOptions = {
        clientType: 'sse',
        networkOptions: {
          url: 'http://example.com/sse',
        },
      };

      const hooks: Hooks = {
        onReceiveMessage: () => events.push('hook-message'),
        onError: () => events.push('hook-error'),
        onClose: () => events.push('hook-close'),
      };

      const transport = createTransportWithHooks(options, hooks);

      // Set original event handlers
      transport.onmessage = () => events.push('original-message');
      transport.onerror = () => events.push('original-error');
      transport.onclose = () => events.push('original-close');

      // Simulate event triggers
      transport.onmessage!({ jsonrpc: '2.0', method: 'notification' });
      transport.onerror!(new Error('Test error'));
      transport.onclose!();

      expect(events).toEqual([
        'hook-message',
        'original-message',
        'hook-error',
        'original-error',
        'hook-close',
        'original-close',
      ]);
    });
  });

  describe('Performance and Memory Tests', () => {
    it('should properly handle multiple consecutive operations', async () => {
      const mockTransport = {
        start: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        onclose: undefined,
        onerror: undefined,
        onmessage: undefined,
      } as any;

      vi.mocked(SSEClientTransport).mockReturnValue(mockTransport);

      const options: ClientTransportOptions = {
        clientType: 'sse',
        networkOptions: {
          url: 'http://example.com/sse',
        },
      };

      const hooks: Hooks = {
        onBeforeSendMessage: vi.fn(),
        onAfterSendMessage: vi.fn(),
      };

      const transport = createTransportWithHooks(options, hooks);

      await transport.start();

      // Send multiple messages
      const messageCount = 10;
      for (let i = 0; i < messageCount; i++) {
        await transport.send({ jsonrpc: '2.0', method: 'test', id: i });
      }

      await transport.close();

      expect(hooks.onBeforeSendMessage).toHaveBeenCalledTimes(messageCount);
      expect(hooks.onAfterSendMessage).toHaveBeenCalledTimes(messageCount);
      // Verify all messages were sent (through hook call counts)
    });
  });
});
