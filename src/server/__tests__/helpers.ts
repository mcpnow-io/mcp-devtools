import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { container } from 'tsyringe';
import { vi } from 'vitest';

import type { ILogger } from '../../utils/logger.js';
import type { ServerOptions } from '../index.js';

/**
 * Create Logger mock object for testing
 */
export function createMockLogger(): ILogger {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    protocol: vi.fn(),
    logProtocolMessage: vi.fn(),
    print: vi.fn(),
    flushPrint: vi.fn(),
  };
}

/**
 * Create server configuration for testing
 */
export function createTestServerOptions(overrides: Partial<ServerOptions> = {}): ServerOptions {
  return {
    name: 'test-server',
    version: '1.0.0',
    description: 'Test MCP server',
    transport: 'http',
    port: 0,
    configPath: 'src/server/__tests__/fixtures/test-config.js',
    pingInterval: '1000', // Shorter interval for testing
    interactive: false,
    ...overrides,
  };
}

/**
 * Create transport mock object for testing
 */
export function createMockTransport(sessionId: string = randomUUID()) {
  const emitter = new EventEmitter();
  return {
    sessionId,
    close: vi.fn(),
    onClose: vi.fn((callback) => emitter.on('close', callback)),
    onError: vi.fn((callback) => emitter.on('error', callback)),
    onMessage: vi.fn((callback) => emitter.on('message', callback)),
    send: vi.fn(),
    start: vi.fn(),
    handleRequest: vi.fn(), // Add for HTTP transport
    handlePostMessage: vi.fn(), // Add for SSE transport
    // Methods for testing event triggering
    _emit: (event: string, ...args: any[]) => emitter.emit(event, ...args),
  };
}

/**
 * Create StreamableHTTPServerTransport mock
 */
export function createMockHTTPTransport(sessionId: string = randomUUID()) {
  const transport = createMockTransport(sessionId);
  // Set correct constructor.name to pass instanceof checks
  Object.setPrototypeOf(transport, StreamableHTTPServerTransport.prototype);
  return transport as any;
}

/**
 * Create SSEServerTransport mock
 */
export function createMockSSETransport(sessionId: string = randomUUID()) {
  const transport = createMockTransport(sessionId);
  // Set correct constructor.name to pass instanceof checks
  Object.setPrototypeOf(transport, SSEServerTransport.prototype);
  return transport as any;
}

/**
 * Create default test configuration
 */
export function createDefaultTestConfig() {
  return {
    tools: [
      {
        name: 'test-tool',
        description: 'Test tool',
        parameters: { type: 'object' },
        handler: vi.fn(),
      },
    ],
    resources: [
      {
        name: 'test-resource',
        description: 'Test resource',
        uri: 'test://resource',
        handler: vi.fn(),
      },
      {
        name: 'test-resource-2',
        description: 'Test resource with template',
        template: {
          uri: 'test://template/{id}',
          options: {},
        },
        handler: vi.fn(),
      },
    ],
    prompts: [
      {
        name: 'test-prompt',
        description: 'Test prompt',
        parameters: { type: 'object' },
        handler: vi.fn(),
      },
    ],
  };
}

/**
 * Set up test container dependencies
 */
export function setupTestContainer(options: ServerOptions, logger: ILogger) {
  container.clearInstances();
  container.registerInstance('Logger', logger);
  container.registerInstance('ServerOptions', options);
}

/**
 * Clean up test container
 */
export function cleanupTestContainer() {
  container.clearInstances();
}

/**
 * Wait for specified time (for async testing)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create Express request mock object for testing
 */
export function createMockRequest(overrides: any = {}) {
  return {
    method: 'POST',
    url: '/mcp',
    headers: {},
    query: {},
    body: {},
    ...overrides,
  };
}

/**
 * Create Express response mock object for testing
 */
export function createMockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    headersSent: false,
    setHeader: vi.fn(),
    writeHead: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  };
  return res;
}

/**
 * Check if timers are properly cleaned up
 */
export function createTimerTracker() {
  const timers = new Set<NodeJS.Timeout>();
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;

  global.setInterval = vi.fn((callback, delay) => {
    const timer = originalSetInterval(callback, delay);
    timers.add(timer);
    return timer;
  }) as any;

  global.clearInterval = vi.fn((timer) => {
    timers.delete(timer);
    return originalClearInterval(timer);
  });

  return {
    getActiveTimers: () => Array.from(timers),
    clearAllTimers: () => {
      timers.forEach((timer) => originalClearInterval(timer));
      timers.clear();
    },
    restore: () => {
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    },
  };
}
