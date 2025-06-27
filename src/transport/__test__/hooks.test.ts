import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Hooks } from '../hooks';
import { injectTransportHooks } from '../index';

describe('Transport Hooks', () => {
  let mockTransport: Transport;
  let originalStart: any;
  let originalSend: any;
  let originalClose: any;
  let originalSetProtocolVersion: any;

  beforeEach(() => {
    // Create mock methods
    originalStart = vi.fn().mockResolvedValue(undefined);
    originalSend = vi.fn().mockResolvedValue(undefined);
    originalClose = vi.fn().mockResolvedValue(undefined);
    originalSetProtocolVersion = vi.fn();

    // Create mock transport
    mockTransport = {
      start: originalStart,
      send: originalSend,
      close: originalClose,
      setProtocolVersion: originalSetProtocolVersion,
      onclose: undefined,
      onerror: undefined,
      onmessage: undefined,
    } as any;
  });

  describe('injectTransportHooks', () => {
    it('should inject hooks into transport methods', () => {
      const hooks: Hooks = {
        onStart: vi.fn(),
        onAfterStart: vi.fn(),
        onBeforeSendMessage: vi.fn(),
        onAfterSendMessage: vi.fn(),
        onClose: vi.fn(),
        onAfterClose: vi.fn(),
      };

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      expect(enhancedTransport).toBe(mockTransport);
      expect(typeof enhancedTransport.start).toBe('function');
      expect(typeof enhancedTransport.send).toBe('function');
      expect(typeof enhancedTransport.close).toBe('function');
    });

    it('should work without hooks', () => {
      const enhancedTransport = injectTransportHooks(mockTransport);

      expect(enhancedTransport).toBe(mockTransport);
    });

    it('should work with empty hooks object', () => {
      const enhancedTransport = injectTransportHooks(mockTransport, {});

      expect(enhancedTransport).toBe(mockTransport);
    });
  });

  describe('Method Enhancement', () => {
    it('should enhance start method with hooks', async () => {
      const callOrder: string[] = [];
      const onStart = vi.fn(() => callOrder.push('onStart'));
      const onAfterStart = vi.fn(() => callOrder.push('onAfterStart'));
      originalStart.mockImplementation(async () => callOrder.push('start'));

      const hooks: Hooks = { onStart, onAfterStart };

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      await enhancedTransport.start();

      expect(onStart).toHaveBeenCalledOnce();
      expect(originalStart).toHaveBeenCalledOnce();
      expect(onAfterStart).toHaveBeenCalledOnce();

      // Verify execution order
      expect(callOrder).toEqual(['onStart', 'start', 'onAfterStart']);
    });

    it('should enhance send method with hooks', async () => {
      const onBeforeSendMessage = vi.fn();
      const onAfterSendMessage = vi.fn();
      const hooks: Hooks = { onBeforeSendMessage, onAfterSendMessage };

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      const message: JSONRPCMessage = { jsonrpc: '2.0', method: 'test', id: 1 };
      const options = undefined;

      await enhancedTransport.send(message, options);

      expect(onBeforeSendMessage).toHaveBeenCalledWith(message, options);
      expect(originalSend).toHaveBeenCalledWith(message, options);
      expect(onAfterSendMessage).toHaveBeenCalledWith(message, options);
    });

    it('should enhance close method with hooks', async () => {
      const onClose = vi.fn();
      const onAfterClose = vi.fn();
      const hooks: Hooks = { onClose, onAfterClose };

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      await enhancedTransport.close();

      expect(onClose).toHaveBeenCalledOnce();
      expect(originalClose).toHaveBeenCalledOnce();
      expect(onAfterClose).toHaveBeenCalledOnce();
    });

    it('should enhance setProtocolVersion method with hooks', () => {
      const onSetProtocolVersion = vi.fn();
      const hooks: Hooks = { onSetProtocolVersion };

      // Set initial protocol version
      (mockTransport as any).protocolVersion = '1.0';

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      enhancedTransport.setProtocolVersion!('2.0');

      expect(onSetProtocolVersion).toHaveBeenCalledWith('1.0', '2.0');
      expect(originalSetProtocolVersion).toHaveBeenCalledWith('2.0');
    });

    it('should handle missing setProtocolVersion method', () => {
      const hooks: Hooks = { onSetProtocolVersion: vi.fn() };
      const transportWithoutSetProtocolVersion = { ...mockTransport };
      delete (transportWithoutSetProtocolVersion as any).setProtocolVersion;

      expect(() => {
        injectTransportHooks(transportWithoutSetProtocolVersion, hooks);
      }).not.toThrow();
    });
  });

  describe('Event Handler Enhancement', () => {
    it('should enhance onclose event handler', () => {
      const onClose = vi.fn();
      const hooks: Hooks = { onClose };

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      const userCloseHandler = vi.fn();
      enhancedTransport.onclose = userCloseHandler;

      // Trigger the enhanced onclose handler
      enhancedTransport.onclose!();

      expect(onClose).toHaveBeenCalledOnce();
      expect(userCloseHandler).toHaveBeenCalledOnce();
    });

    it('should enhance onerror event handler', () => {
      const onError = vi.fn();
      const hooks: Hooks = { onError };

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      const userErrorHandler = vi.fn();
      enhancedTransport.onerror = userErrorHandler;

      const error = new Error('Test error');
      enhancedTransport.onerror!(error);

      expect(onError).toHaveBeenCalledWith(error);
      expect(userErrorHandler).toHaveBeenCalledWith(error);
    });

    it('should enhance onmessage event handler', () => {
      const onReceiveMessage = vi.fn();
      const hooks: Hooks = { onReceiveMessage };

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      const userMessageHandler = vi.fn();
      enhancedTransport.onmessage = userMessageHandler;

      const message: JSONRPCMessage = { jsonrpc: '2.0', method: 'test' };
      enhancedTransport.onmessage!(message);

      expect(onReceiveMessage).toHaveBeenCalledWith(message);
      expect(userMessageHandler).toHaveBeenCalledWith(message);
    });

    it('should handle undefined event handlers', () => {
      const hooks: Hooks = {
        onClose: vi.fn(),
        onError: vi.fn(),
        onReceiveMessage: vi.fn(),
      };

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      // Set handlers to undefined
      enhancedTransport.onclose = undefined;
      enhancedTransport.onerror = undefined;
      enhancedTransport.onmessage = undefined;

      expect(enhancedTransport.onclose).toBeUndefined();
      expect(enhancedTransport.onerror).toBeUndefined();
      expect(enhancedTransport.onmessage).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in start method', async () => {
      const onError = vi.fn();
      const hooks: Hooks = { onError };
      const error = new Error('Start failed');

      originalStart.mockRejectedValue(error);

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      await expect(enhancedTransport.start()).rejects.toThrow('Start failed');
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to start transport: Error: Start failed',
        }),
      );
    });

    it('should handle errors in send method', async () => {
      const onError = vi.fn();
      const hooks: Hooks = { onError };
      const error = new Error('Send failed');

      originalSend.mockRejectedValue(error);

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      const message: JSONRPCMessage = { jsonrpc: '2.0', method: 'test' };

      await expect(enhancedTransport.send(message)).rejects.toThrow('Send failed');
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to send message: Error: Send failed',
        }),
      );
    });

    it('should handle POST /messages 501 error as warning', async () => {
      const onWarning = vi.fn();
      const onError = vi.fn();
      const hooks: Hooks = { onWarning, onError };
      const error = new Error('POST /messages returned 501');

      originalSend.mockRejectedValue(error);

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      const message: JSONRPCMessage = { jsonrpc: '2.0', method: 'test' };

      await enhancedTransport.send(message);

      expect(onWarning).toHaveBeenCalledWith(
        'Received 501 error about POST /messages, attempting to work around...',
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle errors in close method', async () => {
      const onError = vi.fn();
      const hooks: Hooks = { onError };
      const error = new Error('Close failed');

      originalClose.mockRejectedValue(error);

      const enhancedTransport = injectTransportHooks(mockTransport, hooks);

      await expect(enhancedTransport.close()).rejects.toThrow('Close failed');
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to close transport: Error: Close failed',
        }),
      );
    });
  });
});
