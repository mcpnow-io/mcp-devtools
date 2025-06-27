import { container } from 'tsyringe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServerActions } from '../server-actions';
import {
  createMockMcpServer,
  createMockServerConfig,
  createMockSessionManager,
  createTestEnvironment,
  resetAllMocks,
} from './utils';
import { loadMcpServerDefinition } from '@/utils/config';

// Mock the config loader
vi.mock('@/utils/config', () => ({
  loadMcpServerDefinition: vi.fn(),
}));

describe('ServerActions - Tools Management', () => {
  let serverActions: ServerActions;
  let testEnv: ReturnType<typeof createTestEnvironment>;
  let mockSessionManager: ReturnType<typeof createMockSessionManager>;
  let mockLoadConfig: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetAllMocks();
    testEnv = createTestEnvironment();
    mockSessionManager = createMockSessionManager();
    testEnv.mockServer.sessionManager = mockSessionManager as any;
    mockLoadConfig = vi.mocked(loadMcpServerDefinition);

    // Set up default config
    const defaultConfig = createMockServerConfig();
    mockLoadConfig.mockResolvedValue(defaultConfig);

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

    // Load config into serverActions
    (serverActions as any).currentConfig = defaultConfig;
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

  describe('addTool', () => {
    it('should successfully add tool from config', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      const toolName = 'test-tool';

      // Act
      await serverActions.addTool(toolName);

      // Assert
      expect(mockSession.server.tool).toHaveBeenCalledWith(
        'test-tool',
        'Test tool description',
        {},
        expect.any(Function),
      );
      expect(mockSession.server.server.sendToolListChanged).toHaveBeenCalled();
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith(
        `Tool '${toolName}' added from config and clients notified`,
      );
    });

    it('should fail when tool not found in config', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      const nonExistentTool = 'non-existent-tool';

      // Act
      await serverActions.addTool(nonExistentTool);

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(
        `Tool '${nonExistentTool}' not found in config file`,
      );
      expect(mockSession.server.tool).not.toHaveBeenCalled();
      expect(mockSession.server.server.sendToolListChanged).not.toHaveBeenCalled();
    });

    it('should show error when no current session selected', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue([]);

      // Act
      await serverActions.addTool('test-tool');

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith('No current session selected');
    });

    it('should handle tool with complex parameters', async () => {
      // Arrange
      const complexConfig = createMockServerConfig({
        tools: [
          {
            name: 'complex-tool',
            description: 'Tool with complex parameters',
            parameters: {
              type: 'object',
              properties: {
                input: { type: 'string', description: 'Input text' },
                options: {
                  type: 'object',
                  properties: {
                    format: { type: 'string', enum: ['json', 'xml'] },
                  },
                },
              },
              required: ['input'],
            },
            handler: vi.fn(),
          },
        ],
      });
      (serverActions as any).currentConfig = complexConfig;

      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.addTool('complex-tool');

      // Assert
      expect(mockSession.server.tool).toHaveBeenCalledWith(
        'complex-tool',
        'Tool with complex parameters',
        expect.objectContaining({
          type: 'object',
          properties: expect.any(Object),
          required: ['input'],
        }),
        expect.any(Function),
      );
    });

    it('should notify clients after successful tool addition', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.addTool('test-tool');

      // Assert
      expect(mockSession.server.server.sendToolListChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeTool', () => {
    it('should successfully remove existing tool', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      (mockSession.server._registeredTools as any) = {
        'existing-tool': { description: 'Tool to be removed' },
        'another-tool': { description: 'Tool to keep' },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.removeTool('existing-tool');

      // Assert
      expect((mockSession.server._registeredTools as any)['existing-tool']).toBeUndefined();
      expect((mockSession.server._registeredTools as any)['another-tool']).toBeDefined();
      expect(mockSession.server.server.sendToolListChanged).toHaveBeenCalled();
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith(
        `Tool 'existing-tool' removed and clients notified`,
      );
    });

    it('should handle removal of non-existent tool gracefully', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.removeTool('non-existent-tool');

      // Assert
      expect(mockSession.server.server.sendToolListChanged).toHaveBeenCalled();
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith(
        `Tool 'non-existent-tool' removed and clients notified`,
      );
    });

    it('should show error when no current session selected', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue([]);

      // Act
      await serverActions.removeTool('test-tool');

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith('No current session selected');
    });

    it('should notify clients after tool removal', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.removeTool('test-tool');

      // Assert
      expect(mockSession.server.server.sendToolListChanged).toHaveBeenCalledTimes(1);
    });

    it('should handle empty tools object', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      (mockSession.server._registeredTools as any) = {};
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.removeTool('any-tool');

      // Assert
      expect(mockSession.server.server.sendToolListChanged).toHaveBeenCalled();
    });
  });

  describe('Tool Configuration Management', () => {
    it('should work with multiple tools in config', async () => {
      // Arrange
      const multiToolConfig = createMockServerConfig({
        tools: [
          { name: 'tool1', description: 'First tool', parameters: {}, handler: vi.fn() },
          { name: 'tool2', description: 'Second tool', parameters: {}, handler: vi.fn() },
          { name: 'tool3', description: 'Third tool', parameters: {}, handler: vi.fn() },
        ],
      });
      (serverActions as any).currentConfig = multiToolConfig;

      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act - Add each tool
      await serverActions.addTool('tool1');
      await serverActions.addTool('tool2');
      await serverActions.addTool('tool3');

      // Assert
      expect(mockSession.server.tool).toHaveBeenCalledTimes(3);
      expect(mockSession.server.server.sendToolListChanged).toHaveBeenCalledTimes(3);
    });

    it('should handle tools with missing descriptions', async () => {
      // Arrange
      const configWithMissingDesc = createMockServerConfig({
        tools: [
          {
            name: 'minimal-tool',
            description: undefined as any,
            parameters: {},
            handler: vi.fn(),
          },
        ],
      });
      (serverActions as any).currentConfig = configWithMissingDesc;

      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.addTool('minimal-tool');

      // Assert
      expect(mockSession.server.tool).toHaveBeenCalledWith(
        'minimal-tool',
        undefined,
        {},
        expect.any(Function),
      );
    });

    it('should handle empty tools configuration', async () => {
      // Arrange
      const emptyConfig = createMockServerConfig({
        tools: [],
      });
      (serverActions as any).currentConfig = emptyConfig;

      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.addTool('any-tool');

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(
        `Tool 'any-tool' not found in config file`,
      );
    });
  });

  describe('Error Handling in Tool Operations', () => {
    it('should handle server tool registration failures', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSession.server.tool.mockImplementation(() => {
        throw new Error('Tool registration failed');
      });
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act & Assert - should not crash but exception propagates
      try {
        await serverActions.addTool('test-tool');
      } catch (error) {
        expect((error as Error).message).toBe('Tool registration failed');
      }

      // Verify the tool method was called
      expect(mockSession.server.tool).toHaveBeenCalled();
    });

    it('should handle sendToolListChanged failures', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSession.server.server.sendToolListChanged.mockRejectedValue(
        new Error('Failed to notify clients'),
      );
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act & Assert - should not crash but notification may fail
      try {
        await serverActions.addTool('test-tool');
      } catch (error) {
        expect((error as Error).message).toBe('Failed to notify clients');
      }

      // Verify the notification was attempted
      expect(mockSession.server.server.sendToolListChanged).toHaveBeenCalled();
    });

    it('should handle missing server properties gracefully', async () => {
      // Arrange
      const mockSession = {
        server: {} as any,
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act & Assert - should not crash
      expect(async () => await serverActions.listTools()).not.toThrow();
    });
  });

  describe('Tool Name Validation', () => {
    it('should handle empty tool name', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.addTool('');

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(`Tool '' not found in config file`);
    });

    it('should handle tool names with special characters', async () => {
      // Arrange
      const specialConfig = createMockServerConfig({
        tools: [
          {
            name: 'tool-with-dashes_and_underscores.ext',
            description: 'Tool with special name',
            parameters: {},
            handler: vi.fn(),
          },
        ],
      });
      (serverActions as any).currentConfig = specialConfig;

      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      await serverActions.addTool('tool-with-dashes_and_underscores.ext');

      // Assert
      expect(mockSession.server.tool).toHaveBeenCalledWith(
        'tool-with-dashes_and_underscores.ext',
        'Tool with special name',
        {},
        expect.any(Function),
      );
    });
  });
});
