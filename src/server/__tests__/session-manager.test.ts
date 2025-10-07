import { container } from 'tsyringe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ILogger } from '../../utils/logger.js';
import type { ServerOptions } from '../index.js';
import { createSessionManager, SessionManager } from '../session-manager.js';
import {
  cleanupTestContainer,
  createMockLogger,
  createMockTransport,
  createTestServerOptions,
  setupTestContainer,
} from './helpers.js';


// Mock McpServer
vi.mock('@modelcontextprotocol/sdk/server/mcp', () => ({
  McpServer: vi.fn().mockImplementation(() => {
    const mockServer = {
      transport: null,
      oninitialized: null,
      onerror: null,
      ping: vi.fn(),
      listRoots: vi.fn(),
      createMessage: vi.fn(),
      sendResourceListChanged: vi.fn(),
      sendPromptListChanged: vi.fn(),
    };
    return {
      server: mockServer,
      tool: vi.fn().mockReturnValue(undefined),
      resource: vi.fn().mockReturnValue(undefined),
      prompt: vi.fn().mockReturnValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockReturnValue(undefined),
    };
  }),
  ResourceTemplate: vi.fn(),
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockLogger: ILogger;
  let serverOptions: ServerOptions;

  beforeEach(() => {
    mockLogger = createMockLogger();
    serverOptions = createTestServerOptions();
    setupTestContainer(serverOptions, mockLogger);
    sessionManager = container.resolve(SessionManager);
  });

  afterEach(() => {
    sessionManager.close();
    cleanupTestContainer();
    vi.clearAllMocks();
  });

  describe('Basic Session Management Functions', () => {
    it('should be able to add and get sessions', () => {
      const sessionId = 'test-session';
      const mockTransport = createMockTransport(sessionId);
      const sessionInfo = {
        server: {} as any,
        transport: mockTransport as any,
      };

      sessionManager.replaceSessionPartial(sessionId, sessionInfo);

      expect(sessionManager.hasSession(sessionId)).toBe(true);
      expect(sessionManager.getSession(sessionId)).toEqual(sessionInfo);
    });

    it('should be able to list all sessions', () => {
      sessionManager.replaceSessionPartial('session1', { server: {} as any });
      sessionManager.replaceSessionPartial('session2', { server: {} as any });

      const sessions = sessionManager.listServers();
      expect(sessions).toContain('session1');
      expect(sessions).toContain('session2');
      expect(sessions).toHaveLength(2);
    });

    it('should be able to delete sessions', () => {
      const sessionId = 'test-session';
      sessionManager.replaceSessionPartial(sessionId, { server: {} as any });

      expect(sessionManager.hasSession(sessionId)).toBe(true);

      sessionManager.removeSession(sessionId);

      expect(sessionManager.hasSession(sessionId)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(`session ${sessionId} is removed`);
    });
  });

  describe('Ping Mechanism Tests', () => {
    it('should set ping timer', async () => {
      vi.useFakeTimers();

      const mockTransport = createMockTransport();
      const mockServer = {
        connect: vi.fn(),
        close: vi.fn(),
        server: {
          ping: vi.fn().mockResolvedValue(undefined),
          transport: mockTransport,
        },
      };

      // Mock McpServer constructor but keep tool/resource/prompt methods
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp');
      vi.mocked(McpServer).mockReturnValue({
        ...mockServer,
        tool: vi.fn().mockReturnValue(undefined),
        resource: vi.fn().mockReturnValue(undefined),
        prompt: vi.fn().mockReturnValue(undefined),
      } as any);

      await sessionManager.createNewServer(mockTransport as any);

      // Fast forward time to trigger ping, but avoid infinite loop
      vi.advanceTimersByTime(1000);
      await vi.runOnlyPendingTimersAsync();

      expect(mockServer.server.ping).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should clean up timer on ping error', async () => {
      vi.useFakeTimers();

      const mockTransport = createMockTransport();
      const mockServer = {
        connect: vi.fn(),
        close: vi.fn(),
        server: {
          ping: vi.fn().mockRejectedValue(new Error('Ping failed')),
          transport: mockTransport,
        },
      };

      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp');
      vi.mocked(McpServer).mockReturnValue({
        ...mockServer,
        tool: vi.fn().mockReturnValue(undefined),
        resource: vi.fn().mockReturnValue(undefined),
        prompt: vi.fn().mockReturnValue(undefined),
      } as any);

      await sessionManager.createNewServer(mockTransport as any);

      // Fast forward time to trigger ping error
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error sending ping: Error: Ping failed, clearing interval',
      );

      vi.useRealTimers();
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up all sessions', () => {
      const mockServer1 = { close: vi.fn() };
      const mockServer2 = { close: vi.fn() };
      const mockTransport1 = { sessionId: 'session1', close: vi.fn() };
      const mockTransport2 = { sessionId: 'session2', close: vi.fn() };

      sessionManager.replaceSessionPartial('session1', {
        server: mockServer1 as any,
        transport: mockTransport1 as any,
      });
      sessionManager.replaceSessionPartial('session2', {
        server: mockServer2 as any,
        transport: mockTransport2 as any,
      });

      sessionManager.close();

      expect(mockServer1.close).toHaveBeenCalled();
      expect(mockServer2.close).toHaveBeenCalled();
      expect(mockTransport1.close).toHaveBeenCalled();
      expect(mockTransport2.close).toHaveBeenCalled();
      expect(sessionManager.listServers()).toHaveLength(0);
    });

    it('should handle sessions without transport', () => {
      const mockServer = { close: vi.fn() };

      sessionManager.replaceSessionPartial('stdio-session', {
        server: mockServer as any,
      });

      expect(() => sessionManager.close()).not.toThrow();
      expect(mockServer.close).toHaveBeenCalled();
    });
  });
});

describe('createSessionManager', () => {
  it('should create SessionManager instance', () => {
    const mockLogger = createMockLogger();
    const serverOptions = createTestServerOptions();
    setupTestContainer(serverOptions, mockLogger);

    const sessionManager = createSessionManager();

    expect(sessionManager).toBeInstanceOf(SessionManager);

    cleanupTestContainer();
  });
});
