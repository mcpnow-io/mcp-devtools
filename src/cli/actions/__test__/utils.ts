import { vi } from 'vitest';

import type { CLIServerOptions } from '../server-actions';
import type { DevServer } from '@/server';
import type { ILogger, Logger } from '@/utils/logger';

// Mock CLIServerOptions
export const createMockCLIServerOptions = (
  overrides: Partial<CLIServerOptions> = {},
): CLIServerOptions => ({
  name: 'test-server',
  version: '1.0.0',
  description: 'Test server',
  transport: 'stdio',
  port: 8010,
  interactive: false,
  verbose: false,
  pingInterval: '30',
  ...overrides,
});

// Mock Logger
export const createMockLogger = (): ILogger => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  protocol: vi.fn(),
  print: vi.fn(),
  flushPrint: vi.fn(),
  logProtocolMessage: vi.fn(),
});

// Mock MCP Server
export const createMockMcpServer = () => {
  const mockServer = {
    _registeredTools: {
      'existing-tool': {
        description: 'Existing tool',
      },
    },
    _registeredResources: {
      'test://existing': {
        name: 'existing-resource',
        metadata: { description: 'Existing resource' },
      },
    },
    _registeredPrompts: {
      'existing-prompt': {
        description: 'Existing prompt',
      },
    },
    tool: vi.fn(),
    resource: vi.fn(),
    prompt: vi.fn(),
    server: {
      getClientVersion: vi.fn().mockReturnValue({
        name: 'test-client',
        version: '1.0.0',
      }),
      getClientCapabilities: vi.fn().mockReturnValue({}),
      transport: {
        sessionId: 'test-session-123',
      },
      sendToolListChanged: vi.fn(),
      sendResourceListChanged: vi.fn(),
      sendPromptListChanged: vi.fn(),
      sendResourceUpdated: vi.fn(),
      ping: vi.fn(),
      createMessage: vi.fn(),
      listRoots: vi.fn(),
      sendLoggingMessage: vi.fn(),
    },
  };
  return mockServer;
};

// Mock Session Manager
export const createMockSessionManager = () => ({
  listServers: vi.fn().mockReturnValue(['session-1', 'session-2']),
  getSession: vi.fn().mockImplementation((sessionId: string) => {
    if (sessionId === 'session-1' || sessionId === 'session-2') {
      return {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
    }
    return null;
  }),
  hasSession: vi
    .fn()
    .mockImplementation(
      (sessionId: string) => sessionId === 'session-1' || sessionId === 'session-2',
    ),
});

// Mock DevServer
export const createMockDevServer = (): DevServer =>
  ({
    sessionManager: createMockSessionManager(),
    close: vi.fn(),
  }) as any;

// Helper to reset all mocks
export const resetAllMocks = () => {
  vi.clearAllMocks();
  vi.resetAllMocks();
};

// Helper to create isolated test environment
export const createTestEnvironment = () => {
  const mockOptions = createMockCLIServerOptions();
  const mockLogger = createMockLogger();
  const mockServer = createMockDevServer();

  return {
    mockOptions,
    mockLogger,
    mockServer
  };
};
