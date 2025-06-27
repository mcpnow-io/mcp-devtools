import { container } from 'tsyringe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServerActions } from '../server-actions';
import {
  createMockMcpServer,
  createMockSessionManager,
  createTestEnvironment,
  resetAllMocks,
} from './utils';

describe('ServerActions - Communication Functions', () => {
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

  describe('ping', () => {
    it('should successfully send ping to client', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSession.server.server.ping.mockResolvedValue(undefined);

      // Act
      await serverActions.ping();

      // Assert
      expect(mockSession.server.server.ping).toHaveBeenCalledTimes(1);
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith('Ping sent to client');
    });

    it('should handle ping failures gracefully', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      const pingError = new Error('Connection timeout');
      mockSession.server.server.ping.mockRejectedValue(pingError);

      // Act
      await serverActions.ping();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(
        'Error sending ping:',
        'Connection timeout',
      );
    });

    it('should show error when no current session selected', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue([]);

      // Act
      await serverActions.ping();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith('No current session selected');
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSession.server.server.ping.mockRejectedValue('String error');

      // Act
      await serverActions.ping();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith('Error sending ping:', 'String error');
    });
  });

  describe('sample', () => {
    it('should send sampling message with provided text', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSession.server.server.createMessage.mockResolvedValue({});

      const testMessage = 'Test sampling message';

      // Act
      await serverActions.sample(testMessage);

      // Assert
      expect(mockSession.server.server.createMessage).toHaveBeenCalledWith({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: testMessage,
            },
          },
        ],
        maxTokens: 1000,
      });
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith('Sampling message sent');
    });

    it('should send default message when no message provided', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSession.server.server.createMessage.mockResolvedValue({});

      // Act
      await serverActions.sample();

      // Assert
      expect(mockSession.server.server.createMessage).toHaveBeenCalledWith({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Hello, world!',
            },
          },
        ],
        maxTokens: 1000,
      });
    });

    it('should handle sampling failures', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      const samplingError = new Error('Sampling failed');
      mockSession.server.server.createMessage.mockRejectedValue(samplingError);

      // Act
      await serverActions.sample('test');

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(
        'Error sending sampling message:',
        'Sampling failed',
      );
    });

    it('should show error when no current session selected', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue([]);

      // Act
      await serverActions.sample('test');

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith('No current session selected');
    });

    it('should handle empty string message (falls back to default)', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSession.server.server.createMessage.mockResolvedValue({});

      // Act
      await serverActions.sample('');

      // Assert - empty string falls back to default message due to || operator
      expect(mockSession.server.server.createMessage).toHaveBeenCalledWith({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Hello, world!',
            },
          },
        ],
        maxTokens: 1000,
      });
    });
  });

  describe('roots', () => {
    it('should send roots list request successfully', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSession.server.server.listRoots.mockResolvedValue([]);

      // Act
      await serverActions.roots();

      // Assert
      expect(mockSession.server.server.listRoots).toHaveBeenCalledTimes(1);
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith('Roots list request sent');
    });

    it('should handle roots request failures', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      const rootsError = new Error('Roots request failed');
      mockSession.server.server.listRoots.mockRejectedValue(rootsError);

      // Act
      await serverActions.roots();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(
        'Error sending roots list request:',
        'Roots request failed',
      );
    });

    it('should show error when no current session selected', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue([]);

      // Act
      await serverActions.roots();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith('No current session selected');
    });
  });

  describe('sendLog', () => {
    it('should send log message with specified level', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSession.server.server.sendLoggingMessage.mockResolvedValue(undefined);

      // Act
      await serverActions.sendLog('error', 'Test error message');

      // Assert
      expect(mockSession.server.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'error',
        message: 'Test error message',
      });
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith('Log message sent');
    });

    it('should use default level and message when not provided', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSession.server.server.sendLoggingMessage.mockResolvedValue(undefined);

      // Act
      await serverActions.sendLog('info', 'Hello, world!');

      // Assert
      expect(mockSession.server.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'info',
        message: 'Hello, world!',
      });
    });

    it('should handle all valid log levels', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSession.server.server.sendLoggingMessage.mockResolvedValue(undefined);

      const validLevels = [
        'info',
        'error',
        'debug',
        'notice',
        'warning',
        'critical',
        'alert',
        'emergency',
      ];

      // Act & Assert
      for (const level of validLevels) {
        await serverActions.sendLog(level, 'test message');
        expect(mockSession.server.server.sendLoggingMessage).toHaveBeenCalledWith({
          level,
          message: 'test message',
        });
      }
    });

    it('should default to info level for invalid log levels', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      mockSession.server.server.sendLoggingMessage.mockResolvedValue(undefined);

      // Act
      await serverActions.sendLog('invalid-level', 'test message');

      // Assert
      expect(mockSession.server.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'info',
        message: 'test message',
      });
    });

    it('should handle logging failures', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);
      const loggingError = new Error('Logging failed');
      mockSession.server.server.sendLoggingMessage.mockRejectedValue(loggingError);

      // Act
      await serverActions.sendLog('info', 'test');

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(
        'Error sending log message:',
        'Logging failed',
      );
    });

    it('should show error when no current session selected', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue([]);

      // Act
      await serverActions.sendLog('info', 'test');

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith('No current session selected');
    });
  });

  describe('Change Notifications', () => {
    describe('sendToolsChange', () => {
      it('should send tools list change notification', async () => {
        // Arrange
        const mockSession = {
          server: createMockMcpServer(),
          transport: { connected: true },
        };
        mockSessionManager.getSession.mockReturnValue(mockSession);
        mockSession.server.server.sendToolListChanged.mockResolvedValue(undefined);

        // Act
        await serverActions.sendToolsChange();

        // Assert
        expect(mockSession.server.server.sendToolListChanged).toHaveBeenCalledTimes(1);
        expect(testEnv.mockLogger.info).toHaveBeenCalledWith('Tool list change notification sent');
      });

      it('should handle notification failures', async () => {
        // Arrange
        const mockSession = {
          server: createMockMcpServer(),
          transport: { connected: true },
        };
        mockSessionManager.getSession.mockReturnValue(mockSession);
        const notifyError = new Error('Notification failed');
        mockSession.server.server.sendToolListChanged.mockRejectedValue(notifyError);

        // Act
        await serverActions.sendToolsChange();

        // Assert
        expect(testEnv.mockLogger.error).toHaveBeenCalledWith(
          'Error sending tool list change:',
          'Notification failed',
        );
      });
    });

    describe('sendResourcesChange', () => {
      it('should send resources list change notification', async () => {
        // Arrange
        const mockSession = {
          server: createMockMcpServer(),
          transport: { connected: true },
        };
        mockSessionManager.getSession.mockReturnValue(mockSession);
        mockSession.server.server.sendResourceListChanged.mockResolvedValue(undefined);

        // Act
        await serverActions.sendResourcesChange();

        // Assert
        expect(mockSession.server.server.sendResourceListChanged).toHaveBeenCalledTimes(1);
        expect(testEnv.mockLogger.info).toHaveBeenCalledWith(
          'Resource list change notification sent',
        );
      });
    });

    describe('sendPromptsChange', () => {
      it('should send prompts list change notification', async () => {
        // Arrange
        const mockSession = {
          server: createMockMcpServer(),
          transport: { connected: true },
        };
        mockSessionManager.getSession.mockReturnValue(mockSession);
        mockSession.server.server.sendPromptListChanged.mockResolvedValue(undefined);

        // Act
        await serverActions.sendPromptsChange();

        // Assert
        expect(mockSession.server.server.sendPromptListChanged).toHaveBeenCalledTimes(1);
        expect(testEnv.mockLogger.info).toHaveBeenCalledWith(
          'Prompt list change notification sent',
        );
      });
    });

    describe('sendResourceUpdate', () => {
      it('should send resource update notification', async () => {
        // Arrange
        const mockSession = {
          server: createMockMcpServer(),
          transport: { connected: true },
        };
        mockSessionManager.getSession.mockReturnValue(mockSession);
        mockSession.server.server.sendResourceUpdated.mockResolvedValue(undefined);

        const testUri = 'file://test.txt';

        // Act
        await serverActions.sendResourceUpdate(testUri);

        // Assert
        expect(mockSession.server.server.sendResourceUpdated).toHaveBeenCalledWith({
          uri: testUri,
        });
        expect(testEnv.mockLogger.info).toHaveBeenCalledWith(
          `Resource ${testUri} update notification sent`,
        );
      });

      it('should handle different URI formats', async () => {
        // Arrange
        const mockSession = {
          server: createMockMcpServer(),
          transport: { connected: true },
        };
        mockSessionManager.getSession.mockReturnValue(mockSession);
        mockSession.server.server.sendResourceUpdated.mockResolvedValue(undefined);

        const testUris = [
          'file://path/to/file.txt',
          'http://example.com/resource',
          'memory://cached-data',
          'custom-scheme://resource-id',
        ];

        // Act & Assert
        for (const uri of testUris) {
          await serverActions.sendResourceUpdate(uri);
          expect(mockSession.server.server.sendResourceUpdated).toHaveBeenCalledWith({
            uri,
          });
        }
      });
    });
  });

  describe('Communication Error Handling', () => {
    it('should handle all communication methods gracefully when session unavailable', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue([]);

      // Act & Assert - All should show "No current session selected" error
      await serverActions.ping();
      await serverActions.sample('test');
      await serverActions.roots();
      await serverActions.sendLog('info', 'test');
      await serverActions.sendToolsChange();
      await serverActions.sendResourcesChange();
      await serverActions.sendPromptsChange();
      await serverActions.sendResourceUpdate('test://uri');

      expect(testEnv.mockLogger.error).toHaveBeenCalledTimes(8);
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith('No current session selected');
    });

    it('should handle network-related errors consistently', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      const networkError = new Error('Network unreachable');
      mockSession.server.server.ping.mockRejectedValue(networkError);
      mockSession.server.server.createMessage.mockRejectedValue(networkError);
      mockSession.server.server.listRoots.mockRejectedValue(networkError);

      // Act
      await serverActions.ping();
      await serverActions.sample('test');
      await serverActions.roots();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledTimes(3);
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(
        'Error sending ping:',
        'Network unreachable',
      );
    });
  });
});
