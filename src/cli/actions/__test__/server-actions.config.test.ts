import { container } from 'tsyringe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServerActions } from '../server-actions';
import { createMockServerConfig, createTestEnvironment, resetAllMocks } from './utils';
import { loadMcpServerDefinition } from '@/utils/config';

// Mock the config loader
vi.mock('@/utils/config', () => ({
  loadMcpServerDefinition: vi.fn(),
}));

describe('ServerActions - Configuration Management', () => {
  let serverActions: ServerActions;
  let mockLoadConfig: ReturnType<typeof vi.fn>;
  let testEnv: ReturnType<typeof createTestEnvironment>;

  beforeEach(() => {
    resetAllMocks();
    testEnv = createTestEnvironment();
    mockLoadConfig = vi.mocked(loadMcpServerDefinition);

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

  describe('loadConfig', () => {
    it('should successfully load configuration file', async () => {
      // Arrange
      const expectedConfig = createMockServerConfig();
      mockLoadConfig.mockResolvedValue(expectedConfig);

      // Act
      await (serverActions as any).loadConfig();

      // Assert
      expect(mockLoadConfig).toHaveBeenCalledWith(testEnv.mockOptions.configPath);
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith(
        `📄 Configuration loaded from ${testEnv.mockOptions.configPath}`,
      );
      expect(container.resolve('ServerConfig')).toBe(expectedConfig);
    });

    it('should handle configuration file not found error', async () => {
      // Arrange
      const error = new Error('ENOENT: no such file or directory');
      mockLoadConfig.mockRejectedValue(error);

      // Act
      await (serverActions as any).loadConfig();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(`❌ Failed to load config: ${error}`);
      // Should set empty config as fallback
      expect((serverActions as any).currentConfig).toEqual({
        tools: [],
        resources: [],
        prompts: [],
      });
    });

    it('should handle malformed configuration file error', async () => {
      // Arrange
      const error = new Error('Invalid JSON format');
      mockLoadConfig.mockRejectedValue(error);

      // Act
      await (serverActions as any).loadConfig();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(`❌ Failed to load config: ${error}`);
      expect((serverActions as any).currentConfig).toEqual({
        tools: [],
        resources: [],
        prompts: [],
      });
    });

    it('should handle permission denied error', async () => {
      // Arrange
      const error = new Error('EACCES: permission denied');
      mockLoadConfig.mockRejectedValue(error);

      // Act
      await (serverActions as any).loadConfig();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(`❌ Failed to load config: ${error}`);
    });

    it('should register ServerConfig in container after successful load', async () => {
      // Arrange
      const expectedConfig = createMockServerConfig({
        tools: [
          { name: 'custom-tool', description: 'Custom tool', parameters: {}, handler: vi.fn() },
        ],
      });
      mockLoadConfig.mockResolvedValue(expectedConfig);

      // Act
      await (serverActions as any).loadConfig();

      // Assert
      expect(container.isRegistered('ServerConfig')).toBe(true);
      const registeredConfig = container.resolve('ServerConfig');
      expect(registeredConfig).toBe(expectedConfig);
    });
  });

  describe('reloadConfig', () => {
    it('should successfully reload configuration', async () => {
      // Arrange
      const initialConfig = createMockServerConfig();
      const reloadedConfig = createMockServerConfig({
        tools: [{ name: 'new-tool', description: 'New tool', parameters: {}, handler: vi.fn() }],
      });

      mockLoadConfig.mockResolvedValueOnce(initialConfig).mockResolvedValueOnce(reloadedConfig);

      // Load initial config
      await (serverActions as any).loadConfig();

      // Act
      await (serverActions as any).reloadConfig();

      // Assert
      expect(mockLoadConfig).toHaveBeenCalledTimes(2);
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith(
        '🔄 Configuration reloaded successfully',
      );
    });

    it('should handle reload failure gracefully', async () => {
      // Arrange
      const initialConfig = createMockServerConfig();
      const reloadError = new Error('Config file corrupted');

      mockLoadConfig.mockResolvedValueOnce(initialConfig).mockRejectedValueOnce(reloadError);

      // Load initial config
      await (serverActions as any).loadConfig();

      // Act
      await (serverActions as any).reloadConfig();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(
        `❌ Failed to load config: ${reloadError}`,
      );
      // Should still log reload attempt message
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith(
        '🔄 Configuration reloaded successfully',
      );
    });

    it('should update current config after reload', async () => {
      // Arrange
      const initialConfig = createMockServerConfig({
        tools: [{ name: 'tool1', description: 'Tool 1', parameters: {}, handler: vi.fn() }],
      });
      const reloadedConfig = createMockServerConfig({
        tools: [
          { name: 'tool1', description: 'Tool 1', parameters: {}, handler: vi.fn() },
          { name: 'tool2', description: 'Tool 2', parameters: {}, handler: vi.fn() },
        ],
      });

      mockLoadConfig.mockResolvedValueOnce(initialConfig).mockResolvedValueOnce(reloadedConfig);

      // Load initial config
      await (serverActions as any).loadConfig();
      expect((serverActions as any).currentConfig.tools).toHaveLength(1);

      // Act
      await (serverActions as any).reloadConfig();

      // Assert
      expect((serverActions as any).currentConfig.tools).toHaveLength(2);
      expect((serverActions as any).currentConfig).toBe(reloadedConfig);
    });
  });

  describe('Configuration State Management', () => {
    it('should initialize with empty configuration', () => {
      // Assert
      expect((serverActions as any).currentConfig).toEqual({
        tools: [],
        resources: [],
        prompts: [],
      });
    });

    it('should maintain configuration state across operations', async () => {
      // Arrange
      const config = createMockServerConfig();
      mockLoadConfig.mockResolvedValue(config);

      // Act
      await (serverActions as any).loadConfig();

      // Assert
      expect((serverActions as any).currentConfig).toBe(config);
      expect((serverActions as any).currentConfig.tools).toHaveLength(1);
      expect((serverActions as any).currentConfig.resources).toHaveLength(2);
      expect((serverActions as any).currentConfig.prompts).toHaveLength(1);
    });

    it('should preserve fallback config after load failure', async () => {
      // Arrange
      const error = new Error('Load failed');
      mockLoadConfig.mockRejectedValue(error);

      // Act
      await (serverActions as any).loadConfig();

      // Assert
      expect((serverActions as any).currentConfig).toEqual({
        tools: [],
        resources: [],
        prompts: [],
      });
    });
  });

  describe('Configuration File Path Handling', () => {
    it('should use provided config path from options', async () => {
      // Arrange
      const customPath = '/custom/config/path.json';
      const customOptions = { ...testEnv.mockOptions, configPath: customPath };

      serverActions = new ServerActions(
        customOptions,
        testEnv.mockLogger as any,
        testEnv.mockServer,
      );

      const config = createMockServerConfig();
      mockLoadConfig.mockResolvedValue(config);

      // Act
      await (serverActions as any).loadConfig();

      // Assert
      expect(mockLoadConfig).toHaveBeenCalledWith(customPath);
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith(
        `📄 Configuration loaded from ${customPath}`,
      );
    });

    it('should handle relative config paths', async () => {
      // Arrange
      const relativePath = './config/mcp.json';
      const customOptions = { ...testEnv.mockOptions, configPath: relativePath };

      serverActions = new ServerActions(
        customOptions,
        testEnv.mockLogger as any,
        testEnv.mockServer,
      );

      const config = createMockServerConfig();
      mockLoadConfig.mockResolvedValue(config);

      // Act
      await (serverActions as any).loadConfig();

      // Assert
      expect(mockLoadConfig).toHaveBeenCalledWith(relativePath);
    });
  });
});
