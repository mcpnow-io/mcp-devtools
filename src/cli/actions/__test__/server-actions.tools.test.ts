import { container } from 'tsyringe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServerActions } from '../server-actions';
import {
  createMockMcpServer,
  createMockSessionManager,
  createTestEnvironment,
  resetAllMocks,
} from './utils';

describe('ServerActions - Tools Management', () => {
  let serverActions: ServerActions;
  let testEnv: ReturnType<typeof createTestEnvironment>;
  let mockSessionManager: ReturnType<typeof createMockSessionManager>;
  beforeEach(() => {
    resetAllMocks();
    testEnv = createTestEnvironment();
    mockSessionManager = createMockSessionManager();
    testEnv.mockServer.sessionManager = mockSessionManager as any;
    // Register dependencies in container
    container.clearInstances();
    container.register('CLIServerOptions', { useValue: testEnv.mockOptions });
    container.register('Logger', { useValue: testEnv.mockLogger });
    container.register('Server', { useValue: testEnv.mockServer });

    serverActions = new ServerActions(
      testEnv.mockOptions,
      testEnv.mockLogger as any,
      testEnv.mockServer,
    );
  });

  describe('listTools', () => {
    it('should list all registered tools with descriptions', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      (mockSession.server._registeredTools as any) = {
        calculator: { description: 'Basic calculator operations' },
        'file-reader': { description: 'Read file contents' },
        weather: { description: undefined },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.listTools();

      // Assert
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('Registered tools:');
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith(
        '    calculator: Basic calculator operations',
      );
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    file-reader: Read file contents');
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    weather');
      expect(testEnv.mockLogger.flushPrint).toHaveBeenCalled();
    });

    it('should handle empty tools list', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      (mockSession.server._registeredTools as any) = {};
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.listTools();

      // Assert
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('Registered tools:');
      expect(testEnv.mockLogger.flushPrint).toHaveBeenCalled();
    });

    it('should show error when no current session selected', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue([]);

      // Act
      await serverActions.listTools();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith('No current session selected');
      expect(testEnv.mockLogger.print).not.toHaveBeenCalled();
      expect(testEnv.mockLogger.flushPrint).not.toHaveBeenCalled();
    });

    it('should handle missing _registeredTools property gracefully', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      delete (mockSession.server as any)._registeredTools;
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.listTools();

      // Assert
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('Registered tools:');
      expect(testEnv.mockLogger.flushPrint).toHaveBeenCalled();
    });
  });
});
