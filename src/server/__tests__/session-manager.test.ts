import { container } from 'tsyringe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ILogger } from '../../utils/logger.js';
import type { ServerOptions } from '../index.js';
import { createSessionManager, SessionManager } from '../session-manager.js';
import {
  cleanupTestContainer,
  createDefaultTestConfig,
  createMockLogger,
  createMockTransport,
  createTestServerOptions,
  setupTestContainer,
} from './helpers.js';

// Mock config loading module so we can control config content
vi.mock('../../utils/config.js', async () => {
  const actual = await vi.importActual('../../utils/config.js');
  return {
    ...actual,
    loadMcpServerDefinition: vi.fn(),
  };
});

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

  describe('Configuration Loading and Server Creation', () => {
    beforeEach(async () => {
      // Dynamically import config module and set up mock
      const configModule = await import('../../utils/config.js');
      vi.mocked(configModule.loadMcpServerDefinition).mockResolvedValue(createDefaultTestConfig());

      // Ensure McpServer mock contains all necessary methods
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp');
      // @ts-expect-error for test
      vi.mocked(McpServer).mockImplementation(() => {
        return {
          server: {
            transport: null, // This will be set after connect
            oninitialized: null,
            onerror: null,
            ping: vi.fn(),
            listRoots: vi.fn(),
            createMessage: vi.fn(),
            sendResourceListChanged: vi.fn(),
            sendPromptListChanged: vi.fn(),
          },
          tool: vi.fn().mockReturnValue(undefined),
          resource: vi.fn().mockReturnValue(undefined),
          prompt: vi.fn().mockReturnValue(undefined),
          connect: vi.fn().mockImplementation(async function (transport) {
            // Mock connect behavior: set transport
            // @ts-expect-error for test
            this.server.transport = transport;
          }),
          close: vi.fn().mockReturnValue(undefined),
        };
      });
    });

    it('should be able to create new MCP server', async () => {
      const mockTransport = createMockTransport();

      const server = await sessionManager.createNewServer(mockTransport as any);

      expect(server).toBeDefined();
      expect(server.connect).toHaveBeenCalledWith(mockTransport);
      expect(sessionManager.hasSession(mockTransport.sessionId)).toBe(true);
    });

    it('should skip invalid tool configurations', async () => {
      const configModule = await import('../../utils/config.js');
      vi.mocked(configModule.loadMcpServerDefinition).mockResolvedValue({
        tools: [
          // @ts-expect-error for test
          { name: '', description: 'Invalid tool' }, // Missing required fields
          { name: 'valid-tool', description: 'Valid', parameters: {}, handler: vi.fn() },
        ],
      });

      const mockTransport = createMockTransport();
      await sessionManager.createNewServer(mockTransport as any);

      expect(mockLogger.warn).toHaveBeenCalledWith('Skipping invalid tool configuration: ');
    });

    it('should skip invalid resource configurations', async () => {
      const configModule = await import('../../utils/config.js');
      vi.mocked(configModule.loadMcpServerDefinition).mockResolvedValue({
        resources: [
          // @ts-expect-error for test
          { name: 'no-uri-or-template', description: 'Invalid' }, // Missing URI and template
          { name: 'valid-resource', description: 'Valid', uri: 'test://valid', handler: vi.fn() },
        ],
      });

      const mockTransport = createMockTransport();
      await sessionManager.createNewServer(mockTransport as any);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Skipping invalid resource configuration: no-uri-or-template',
      );
    });
  });

  describe('Ping Mechanism Tests', () => {
    it('should set ping timer', async () => {
      vi.useFakeTimers();

      const configModule = await import('../../utils/config.js');
      // @ts-expect-error for test
      vi.mocked(configModule.loadMcpServerDefinition).mockResolvedValue({});

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

      const configModule = await import('../../utils/config.js');
      // @ts-expect-error for test
      vi.mocked(configModule.loadMcpServerDefinition).mockResolvedValue({});

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
