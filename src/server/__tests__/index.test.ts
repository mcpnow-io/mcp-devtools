import express from 'express';
import { container } from 'tsyringe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ILogger } from '../../utils/logger.js';
import { createServer, DevServer } from '../index.js';
import {
  cleanupTestContainer,
  createMockLogger,
  createMockRequest,
  createMockResponse,
  createTestServerOptions,
  setupTestContainer,
} from './helpers';

describe('DevServer', () => {
  let devServer: DevServer;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    const serverOptions = createTestServerOptions();
    setupTestContainer(serverOptions, mockLogger);
    devServer = container.resolve(DevServer);
  });

  afterEach(() => {
    devServer.close();
    cleanupTestContainer();
    vi.clearAllMocks();
  });

  describe('Server Initialization', () => {
    it('should initialize HTTP server', async () => {
      const options = createTestServerOptions({ transport: 'http' });
      await devServer.initializeServer(options);

      expect(devServer.httpServer).toBeDefined();
      expect(devServer.sessionManager).toBeDefined();
    });

    it('should initialize SSE server', async () => {
      const options = createTestServerOptions({ transport: 'sse' });
      await devServer.initializeServer(options);

      expect(devServer.httpServer).toBeDefined();
      expect(devServer.sessionManager).toBeDefined();
    });

    it('should initialize Stdio server', async () => {
      const options = createTestServerOptions({ transport: 'stdio' });
      const createNewServerSpy = vi.spyOn(devServer.sessionManager, 'createNewServer');

      await devServer.initializeServer(options);

      expect(createNewServerSpy).toHaveBeenCalled();
    });
  });

  describe('HTTP Server Lifecycle', () => {
    beforeEach(async () => {
      await devServer.initializeServer(createTestServerOptions({ transport: 'http' }));
    });

    it('should start HTTP server listening', () => {
      const mockListen = vi.fn((port, callback) => {
        if (typeof callback === 'function') callback();
      });

      // Mock Express application
      if (devServer.httpServer) {
        devServer.httpServer.listen = mockListen as any;
      }

      devServer.listen();

      expect(mockListen).toHaveBeenCalledWith(0, expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('MCP Server listening at http://localhost:0/mcp'),
      );
    });

    it('should throw error when not initialized', () => {
      const newServer = container.resolve(DevServer);

      expect(() => newServer.listen()).toThrow('HTTP server not initialized');
    });
  });

  describe('HTTP Request Handling', () => {
    beforeEach(async () => {
      await devServer.initializeServer(createTestServerOptions({ transport: 'http' }));
    });

    it('should handle new HTTP session', async () => {
      const req = createMockRequest({
        method: 'POST',
        headers: {},
        body: { jsonrpc: '2.0', method: 'ping', id: 1 },
      });
      const res = createMockResponse();

      const createNewServerSpy = vi.spyOn(devServer.sessionManager, 'createNewServer');
      createNewServerSpy.mockResolvedValue({
        connect: vi.fn(),
        close: vi.fn(),
      } as any);

      await devServer['_handleStreamableHTTPRequest'](req as any, res as any);

      expect(createNewServerSpy).toHaveBeenCalled();
    });

    it('should reuse existing HTTP session', async () => {
      const sessionId = 'existing-session-id';
      const req = createMockRequest({
        headers: { 'mcp-session-id': sessionId },
        body: { jsonrpc: '2.0', method: 'ping', id: 1 },
      });
      const res = createMockResponse();

      const { createMockHTTPTransport } = await import('./helpers');
      const mockTransport = createMockHTTPTransport(sessionId);

      vi.spyOn(devServer.sessionManager, 'getSession').mockReturnValue({
        server: {} as any,
        transport: mockTransport,
      });

      await devServer['_handleStreamableHTTPRequest'](req as any, res as any);

      expect(mockTransport.handleRequest).toHaveBeenCalledWith(req, res, req.body);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Reusing existing transport for session ${sessionId}`,
      );
    });

    it('should handle transport protocol mismatch', async () => {
      const sessionId = 'sse-session-id';
      const req = createMockRequest({
        headers: { 'mcp-session-id': sessionId },
      });
      const res = createMockResponse();

      // Mock an SSE transport instead of HTTP transport
      const mockSSETransport = {
        constructor: { name: 'SSEServerTransport' },
        sessionId,
      };

      vi.spyOn(devServer.sessionManager, 'getSession').mockReturnValue({
        server: {} as any,
        transport: mockSSETransport as any,
      });

      await devServer['_handleStreamableHTTPRequest'](req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: Session exists but uses a different transport protocol',
        },
        id: null,
      });
    });

    it('should handle errors during request processing', async () => {
      const req = createMockRequest();
      const res = createMockResponse();

      const createNewServerSpy = vi.spyOn(devServer.sessionManager, 'createNewServer');
      createNewServerSpy.mockRejectedValue(new Error('Test error'));

      await devServer['_handleStreamableHTTPRequest'](req as any, res as any);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error handling MCP request: Error: Test error',
      );
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should avoid duplicate sending when response already sent', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      res.headersSent = true; // Mock already sent response

      const createNewServerSpy = vi.spyOn(devServer.sessionManager, 'createNewServer');
      createNewServerSpy.mockRejectedValue(new Error('Test error'));

      await devServer['_handleStreamableHTTPRequest'](req as any, res as any);

      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('SSE Request Handling', () => {
    beforeEach(async () => {
      await devServer.initializeServer(createTestServerOptions({ transport: 'sse' }));
    });

    it('should handle SSE connection', async () => {
      const req = createMockRequest({ method: 'GET', url: '/sse' });
      const res = createMockResponse();

      const createNewServerSpy = vi.spyOn(devServer.sessionManager, 'createNewServer');
      createNewServerSpy.mockResolvedValue({
        connect: vi.fn(),
        close: vi.fn(),
      } as any);

      await devServer['_handleSSEConnect'](req as any, res as any);

      expect(createNewServerSpy).toHaveBeenCalled();
    });

    it('should handle SSE messages', async () => {
      const sessionId = 'sse-session-id';
      const req = createMockRequest({
        method: 'POST',
        url: '/messages',
        query: { sessionId },
      });
      const res = createMockResponse();

      const { createMockSSETransport } = await import('./helpers.js');
      const mockTransport = createMockSSETransport(sessionId);

      vi.spyOn(devServer.sessionManager, 'getSession').mockReturnValue({
        server: {} as any,
        transport: mockTransport,
      });

      await devServer['_handleSSEMessage'](req as any, res as any);

      expect(mockTransport.handlePostMessage).toHaveBeenCalledWith(req, res);
    });

    it('should handle invalid SSE session', async () => {
      const sessionId = 'invalid-session-id';
      const req = createMockRequest({
        method: 'POST',
        url: '/messages',
        query: { sessionId },
      });
      const res = createMockResponse();

      vi.spyOn(devServer.sessionManager, 'getSession').mockReturnValue(undefined);

      await devServer['_handleSSEMessage'](req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(`No SSE transport found for sessionId ${sessionId}`);
    });
  });

  describe('Request Header Filtering', () => {
    it('should filter sensitive request headers', () => {
      const req = createMockRequest({
        method: 'POST',
        url: '/mcp',
        headers: {
          host: 'localhost',
          'content-type': 'application/json',
          'x-custom-header': 'value',
          connection: 'keep-alive',
          'user-agent': 'test-agent',
          'sentry-trace': 'trace-id',
        },
      });

      devServer['_logHeaders'](req as any);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'POST /mcp Headers {"x-custom-header":"value"}',
      );
    });
  });

  describe('Server Shutdown', () => {
    it('should properly close session manager', () => {
      const closeSpy = vi.spyOn(devServer.sessionManager, 'close');

      devServer.close();

      expect(closeSpy).toHaveBeenCalled();
    });
  });
});

describe('createServer Function', () => {
  afterEach(() => {
    cleanupTestContainer();
  });

  it('should create and initialize server', async () => {
    const mockLogger = createMockLogger();
    const serverOptions = createTestServerOptions();
    setupTestContainer(serverOptions, mockLogger);

    const server = await createServer(serverOptions);

    expect(server).toBeInstanceOf(DevServer);
    expect(server.sessionManager).toBeDefined();

    server.close();
  });
});
