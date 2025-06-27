import { container } from 'tsyringe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServerActions } from '../server-actions';
import {
  createMockMcpServer,
  createMockSessionManager,
  createTestEnvironment,
  resetAllMocks,
} from './utils';

describe('ServerActions - Session Management', () => {
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

  describe('listSessions', () => {
    it('should list all active sessions when sessions exist', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue(['session-1', 'session-2', 'session-3']);
      mockSessionManager.getSession.mockImplementation((sessionId: string) => ({
        server: createMockMcpServer(),
        transport: { connected: true },
      }));

      // Act
      await serverActions.listSessions();

      // Assert
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('Active sessions:');
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    0: session-1 connected');
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    1: session-2 connected');
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    2: session-3 connected');
      expect(testEnv.mockLogger.flushPrint).toHaveBeenCalled();
    });

    it('should show disconnected status for sessions without transport', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue(['session-1']);
      mockSessionManager.getSession.mockReturnValue({
        server: createMockMcpServer(),
        transport: null,
      });

      // Act
      await serverActions.listSessions();

      // Assert
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    0: session-1 disconnected');
    });

    it('should mark current session when one is selected', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue(['session-1', 'session-2']);
      mockSessionManager.getSession.mockImplementation((sessionId: string) => ({
        server: createMockMcpServer(),
        transport: { connected: true },
      }));

      // Set current session
      (serverActions as any).currentSessionId = 'session-2';

      // Act
      await serverActions.listSessions();

      // Assert
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    0: session-1 connected');
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    1: session-2 connected (current)');
    });

    it('should display message when no active sessions exist', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue([]);

      // Act
      await serverActions.listSessions();

      // Assert
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith('No active sessions');
      expect(testEnv.mockLogger.print).not.toHaveBeenCalled();
      expect(testEnv.mockLogger.flushPrint).not.toHaveBeenCalled();
    });

    it('should handle null session gracefully', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue(['session-1']);
      mockSessionManager.getSession.mockReturnValue(null);

      // Act
      await serverActions.listSessions();

      // Assert
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    0: session-1 disconnected');
    });
  });

  describe('switchSession', () => {
    it('should successfully switch to existing session', async () => {
      // Arrange
      const targetSessionId = 'session-2';
      mockSessionManager.hasSession.mockReturnValue(true);

      // Act
      await serverActions.switchSession(targetSessionId);

      // Assert
      expect(mockSessionManager.hasSession).toHaveBeenCalledWith(targetSessionId);
      expect((serverActions as any).currentSessionId).toBe(targetSessionId);
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith(
        `Switched to session ${targetSessionId}`,
      );
    });

    it('should fail when trying to switch to non-existent session', async () => {
      // Arrange
      const nonExistentSessionId = 'non-existent-session';
      mockSessionManager.hasSession.mockReturnValue(false);

      // Act
      await serverActions.switchSession(nonExistentSessionId);

      // Assert
      expect(mockSessionManager.hasSession).toHaveBeenCalledWith(nonExistentSessionId);
      expect((serverActions as any).currentSessionId).toBeUndefined();
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith(
        `Session ${nonExistentSessionId} not found`,
      );
    });

    it('should update current session ID on successful switch', async () => {
      // Arrange
      (serverActions as any).currentSessionId = 'session-1';
      mockSessionManager.hasSession.mockReturnValue(true);

      // Act
      await serverActions.switchSession('session-2');

      // Assert
      expect((serverActions as any).currentSessionId).toBe('session-2');
    });

    it('should preserve current session ID on failed switch', async () => {
      // Arrange
      (serverActions as any).currentSessionId = 'session-1';
      mockSessionManager.hasSession.mockReturnValue(false);

      // Act
      await serverActions.switchSession('invalid-session');

      // Assert
      expect((serverActions as any).currentSessionId).toBe('session-1');
    });
  });

  describe('getCurrentSession', () => {
    it('should return current session when one is selected', () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      (serverActions as any).currentSessionId = 'session-1';
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      const result = (serverActions as any).getCurrentSession();

      // Assert
      expect(result).toBe(mockSession);
      expect(mockSessionManager.getSession).toHaveBeenCalledWith('session-1');
    });

    it('should auto-select first available session when no current session', () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSessionManager.listServers.mockReturnValue(['session-1', 'session-2']);
      mockSessionManager.getSession.mockReturnValue(mockSession);

      // Act
      const result = (serverActions as any).getCurrentSession();

      // Assert
      expect(result).toBe(mockSession);
      expect((serverActions as any).currentSessionId).toBe('session-1');
      expect(testEnv.mockLogger.info).toHaveBeenCalledWith('Auto-selected session: session-1');
    });

    it('should return null when no sessions are available', () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue([]);

      // Act
      const result = (serverActions as any).getCurrentSession();

      // Assert
      expect(result).toBeNull();
      expect((serverActions as any).currentSessionId).toBeUndefined();
    });

    it('should return null when current session no longer exists', () => {
      // Arrange
      (serverActions as any).currentSessionId = 'invalid-session';
      mockSessionManager.getSession.mockReturnValue(null);

      // Act
      const result = (serverActions as any).getCurrentSession();

      // Assert
      expect(result).toBeNull();
      expect(mockSessionManager.getSession).toHaveBeenCalledWith('invalid-session');
    });

    it('should not auto-select when current session is explicitly set but invalid', () => {
      // Arrange
      (serverActions as any).currentSessionId = 'invalid-session';
      mockSessionManager.listServers.mockReturnValue(['session-1']);
      mockSessionManager.getSession.mockReturnValue(null);

      // Act
      const result = (serverActions as any).getCurrentSession();

      // Assert
      expect(result).toBeNull();
      expect((serverActions as any).currentSessionId).toBe('invalid-session');
    });
  });

  describe('showInfo', () => {
    it('should display client info when session has client', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      (serverActions as any).currentSessionId = 'session-1';
      mockSessionManager.getSession.mockReturnValue(mockSession);

      mockSession.server.server.getClientVersion.mockReturnValue({
        name: 'test-client',
        version: '1.2.3',
      });
      mockSession.server.server.getClientCapabilities.mockReturnValue({
        sampling: true,
        roots: { listChanged: true },
      });

      // Act
      await serverActions.showInfo();

      // Assert
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('Client info:');
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    Client name: test-client');
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    Client version: 1.2.3');
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith(
        '    Client capabilities: {"sampling":true,"roots":{"listChanged":true}}',
      );
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith(
        '    Client sessionId: test-session-123',
      );
      expect(testEnv.mockLogger.flushPrint).toHaveBeenCalled();
    });

    it('should display no client info message when no client version available', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      (serverActions as any).currentSessionId = 'session-1';
      mockSessionManager.getSession.mockReturnValue(mockSession);

      mockSession.server.server.getClientVersion.mockReturnValue(null);

      // Act
      await serverActions.showInfo();

      // Assert
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('No client info found');
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith(
        '    Client sessionId: test-session-123',
      );
      expect(testEnv.mockLogger.flushPrint).toHaveBeenCalled();
    });

    it('should show error when no current session selected', async () => {
      // Arrange
      mockSessionManager.listServers.mockReturnValue([]);

      // Act
      await serverActions.showInfo();

      // Assert
      expect(testEnv.mockLogger.error).toHaveBeenCalledWith('No current session selected');
      expect(testEnv.mockLogger.print).not.toHaveBeenCalled();
      expect(testEnv.mockLogger.flushPrint).not.toHaveBeenCalled();
    });

    it('should handle missing transport gracefully', async () => {
      // Arrange
      const mockSession = {
        server: createMockMcpServer(),
        transport: { connected: true },
      };
      mockSession.server.server.transport = null as any;
      (serverActions as any).currentSessionId = 'session-1';
      mockSessionManager.getSession.mockReturnValue(mockSession);

      mockSession.server.server.getClientVersion.mockReturnValue({
        name: 'test-client',
        version: '1.0.0',
      });

      // Act
      await serverActions.showInfo();

      // Assert
      expect(testEnv.mockLogger.print).toHaveBeenCalledWith('    Client sessionId: undefined');
    });
  });

  describe('Session State Persistence', () => {
    it('should maintain session state across multiple operations', async () => {
      // Arrange
      const sessionId = 'persistent-session';
      mockSessionManager.hasSession.mockReturnValue(true);

      // Act
      await serverActions.switchSession(sessionId);

      // Assert - session should persist
      expect((serverActions as any).currentSessionId).toBe(sessionId);

      // Act - perform another operation
      mockSessionManager.getSession.mockReturnValue({
        server: createMockMcpServer(),
        transport: { connected: true },
      });

      const result = (serverActions as any).getCurrentSession();

      // Assert - should still use the same session
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(sessionId);
      expect(result).toBeTruthy();
    });

    it('should reset session state when switching to different session', async () => {
      // Arrange
      (serverActions as any).currentSessionId = 'session-1';
      mockSessionManager.hasSession.mockReturnValue(true);

      // Act
      await serverActions.switchSession('session-2');

      // Assert
      expect((serverActions as any).currentSessionId).toBe('session-2');
    });
  });

  describe('Error Handling in Session Operations', () => {
    it('should handle session manager exceptions gracefully', async () => {
      // Arrange
      mockSessionManager.listServers.mockImplementation(() => {
        throw new Error('Session manager error');
      });

      // Act & Assert - should not crash but exception propagates
      try {
        await serverActions.listSessions();
      } catch (error) {
        expect((error as Error).message).toBe('Session manager error');
      }

      // Verify the method was called
      expect(mockSessionManager.listServers).toHaveBeenCalled();
    });

    it('should handle session lookup exceptions', async () => {
      // Arrange
      mockSessionManager.hasSession.mockImplementation(() => {
        throw new Error('Session lookup error');
      });

      // Act & Assert - should not crash but exception propagates
      try {
        await serverActions.switchSession('test-session');
      } catch (error) {
        expect((error as Error).message).toBe('Session lookup error');
      }

      // Verify the method was called
      expect(mockSessionManager.hasSession).toHaveBeenCalled();
    });
  });
});
