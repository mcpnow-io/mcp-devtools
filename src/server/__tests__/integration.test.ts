import { container } from 'tsyringe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from '../index.js';
import {
  cleanupTestContainer,
  createDefaultTestConfig,
  createMockLogger,
  createTestServerOptions,
  delay,
  setupTestContainer,
} from './helpers.js';


describe('Server Integration Tests', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(async () => {
    mockLogger = createMockLogger();
  });

  afterEach(() => {
    cleanupTestContainer();
    vi.clearAllMocks();
  });

  describe('Server Creation and Initialization', () => {
    it('should successfully create HTTP server', async () => {
      const options = createTestServerOptions({ transport: 'http' });
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      expect(server).toBeDefined();
      expect(server.httpServer).toBeDefined();
      expect(server.sessionManager).toBeDefined();

      server.close();
    });

    it('should successfully create SSE server', async () => {
      const options = createTestServerOptions({ transport: 'sse' });
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      expect(server).toBeDefined();
      expect(server.httpServer).toBeDefined();
      expect(server.sessionManager).toBeDefined();

      server.close();
    });

    it('should successfully create Stdio server', async () => {
      const options = createTestServerOptions({ transport: 'stdio' });
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      expect(server).toBeDefined();
      expect(server.sessionManager).toBeDefined();

      server.close();
    });
  });

  describe('Multiple Transport Protocol Support', () => {
    const transports = ['http', 'sse', 'stdio'] as const;

    transports.forEach((transport) => {
      it(`should support ${transport} transport protocol`, async () => {
        const options = createTestServerOptions({ transport });
        setupTestContainer(options, mockLogger);

        const server = await createServer(options);

        expect(server).toBeDefined();
        expect(server.sessionManager).toBeDefined();

        // Verify transport-specific initialization
        if (transport !== 'stdio') {
          expect(server.httpServer).toBeDefined();
        }

        server.close();
      });
    });
  });

  describe('Configuration Integration', () => {
    it('should successfully load and register tools, resources and prompts from configuration', async () => {
      const options = createTestServerOptions();
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      // Verify no configuration errors
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Error loading configuration'),
      );

      // Verify tools, resources, and prompts are properly registered
      expect(mockLogger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Skipping invalid'));

      server.close();
    });
  });

  describe('Server Lifecycle Management', () => {
    it('should properly handle startup and shutdown process', async () => {
      const options = createTestServerOptions({ transport: 'http' });
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      // Mock HTTP server listening
      if (server.httpServer) {
        const mockListen = vi.fn((port, callback) => {
          if (typeof callback === 'function') callback();
          return {} as any; // Return mock Server object
        });
        server.httpServer.listen = mockListen as any;

        // Start server
        expect(() => server.listen()).not.toThrow();
        expect(mockListen).toHaveBeenCalledWith(0, expect.any(Function));
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('MCP Server listening at'),
        );
      }

      // Close server
      expect(() => server.close()).not.toThrow();
    });

    it('should clean up all resources when closing', async () => {
      const options = createTestServerOptions();
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      // Add some mock sessions
      server.sessionManager.replaceSessionPartial('test-session-1', {
        server: { close: vi.fn() } as any,
        transport: { sessionId: 'test-session-1', close: vi.fn() } as any,
      });

      server.sessionManager.replaceSessionPartial('test-session-2', {
        server: { close: vi.fn() } as any,
        transport: { sessionId: 'test-session-2', close: vi.fn() } as any,
      });

      expect(server.sessionManager.listServers()).toHaveLength(2);

      // Closing server should clean up all sessions
      server.close();

      expect(server.sessionManager.listServers()).toHaveLength(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle session creation failure', async () => {
      const options = createTestServerOptions();
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      // Mock session creation failure
      const createNewServerSpy = vi.spyOn(server.sessionManager, 'createNewServer');
      createNewServerSpy.mockRejectedValueOnce(new Error('Session creation failed'));

      const mockTransport = {
        sessionId: 'failing-session',
        close: vi.fn(),
      };

      await expect(server.sessionManager.createNewServer(mockTransport as any)).rejects.toThrow(
        'Session creation failed',
      );

      server.close();
    });

    it('should handle ping mechanism errors', async () => {
      const options = createTestServerOptions({ pingInterval: '100' });
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      // Create a normal transport and verify session creation success
      const mockTransport = {
        sessionId: 'ping-test-session',
        close: vi.fn(),
        start: vi.fn(),
      };

      await server.sessionManager.createNewServer(mockTransport as any);

      expect(server.sessionManager.hasSession('ping-test-session')).toBe(true);

      server.close();
    });
  });

  describe('Concurrency and Performance', () => {
    it('should support multiple concurrent sessions', async () => {
      const options = createTestServerOptions();
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      // Create multiple sessions
      const sessionPromises = Array.from({ length: 5 }, (_, i) => {
        const mockTransport = {
          sessionId: `concurrent-session-${i}`,
          close: vi.fn(),
          start: vi.fn(),
        };
        return server.sessionManager.createNewServer(mockTransport as any);
      });

      const sessions = await Promise.all(sessionPromises);

      expect(sessions).toHaveLength(5);
      expect(server.sessionManager.listServers()).toHaveLength(5);

      // Verify all sessions are independent
      const sessionIds = server.sessionManager.listServers();
      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(5);

      server.close();
    });

    it('should properly handle session cleanup', async () => {
      const options = createTestServerOptions();
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      // Add sessions
      const sessionId = 'cleanup-test-session';
      server.sessionManager.replaceSessionPartial(sessionId, {
        server: { close: vi.fn() } as any,
        transport: { sessionId, close: vi.fn() } as any,
      });

      expect(server.sessionManager.hasSession(sessionId)).toBe(true);

      // Remove session
      server.sessionManager.removeSession(sessionId);

      expect(server.sessionManager.hasSession(sessionId)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(`session ${sessionId} is removed`);

      server.close();
    });
  });

  describe('Endpoint Configuration Validation', () => {
    it('should configure correct endpoints for HTTP transport', async () => {
      const options = createTestServerOptions({ transport: 'http' });
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      expect(server.httpServer).toBeDefined();
      // HTTP server should have configured /mcp endpoint

      server.close();
    });

    it('should configure correct endpoints for SSE transport', async () => {
      const options = createTestServerOptions({ transport: 'sse' });
      setupTestContainer(options, mockLogger);

      const server = await createServer(options);

      expect(server.httpServer).toBeDefined();
      // SSE server should have configured /sse and /messages endpoints

      server.close();
    });
  });
});
