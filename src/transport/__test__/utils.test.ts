import { describe, expect, it } from 'vitest';

import {
  isNetworkTransportCreateOptions,
  isStdioTransportCreateOptions,
  isSupportTransport,
  type NetworkTransportCreateOptions,
  type StdioTransportCreateOptions,
} from '../index';

describe('Transport Utils', () => {
  describe('isNetworkTransportCreateOptions', () => {
    it('should return true for valid network transport options', () => {
      const validOptions: NetworkTransportCreateOptions = {
        url: new URL('http://example.com'),
        requestInit: {
          headers: { 'Content-Type': 'application/json' },
        },
      };

      expect(isNetworkTransportCreateOptions(validOptions)).toBe(true);
    });

    it('should return true for network options with minimal config', () => {
      const minimalOptions = {
        url: new URL('http://example.com'),
      };

      expect(isNetworkTransportCreateOptions(minimalOptions)).toBe(true);
    });

    it('should return false for stdio transport options', () => {
      const stdioOptions: StdioTransportCreateOptions = {
        command: 'node',
        args: ['script.js'],
        env: {},
        cwd: '/tmp',
        stderr: 'pipe',
      };

      expect(isNetworkTransportCreateOptions(stdioOptions)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isNetworkTransportCreateOptions({} as any)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isNetworkTransportCreateOptions(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isNetworkTransportCreateOptions(undefined as any)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isNetworkTransportCreateOptions('string' as any)).toBe(false);
      expect(isNetworkTransportCreateOptions(123 as any)).toBe(false);
      expect(isNetworkTransportCreateOptions(true as any)).toBe(false);
      expect(isNetworkTransportCreateOptions([] as any)).toBe(false);
    });
  });

  describe('isStdioTransportCreateOptions', () => {
    it('should return true for valid stdio transport options', () => {
      const validOptions: StdioTransportCreateOptions = {
        command: 'node',
        args: ['script.js'],
        env: { NODE_ENV: 'test' },
        cwd: '/tmp',
        stderr: 'pipe',
      };

      expect(isStdioTransportCreateOptions(validOptions)).toBe(true);
    });

    it('should return true for stdio options with minimal config', () => {
      const minimalOptions = {
        command: 'node',
      };

      expect(isStdioTransportCreateOptions(minimalOptions)).toBe(true);
    });

    it('should return false for network transport options', () => {
      const networkOptions: NetworkTransportCreateOptions = {
        url: new URL('http://example.com'),
        requestInit: {
          headers: { 'Content-Type': 'application/json' },
        },
      };

      expect(isStdioTransportCreateOptions(networkOptions)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isStdioTransportCreateOptions({} as any)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isStdioTransportCreateOptions(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isStdioTransportCreateOptions(undefined as any)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isStdioTransportCreateOptions('string' as any)).toBe(false);
      expect(isStdioTransportCreateOptions(123 as any)).toBe(false);
      expect(isStdioTransportCreateOptions(true as any)).toBe(false);
      expect(isStdioTransportCreateOptions([] as any)).toBe(false);
    });
  });

  describe('isSupportTransport', () => {
    it('should return true for supported transport types', () => {
      expect(isSupportTransport('stdio')).toBe(true);
      expect(isSupportTransport('http')).toBe(true);
      expect(isSupportTransport('sse')).toBe(true);
    });

    it('should return false for unsupported transport types', () => {
      expect(isSupportTransport('websocket')).toBe(false);
      expect(isSupportTransport('tcp')).toBe(false);
      expect(isSupportTransport('udp')).toBe(false);
      expect(isSupportTransport('unknown')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isSupportTransport('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isSupportTransport(null as any)).toBe(false);
      expect(isSupportTransport(undefined as any)).toBe(false);
      expect(isSupportTransport(123 as any)).toBe(false);
      expect(isSupportTransport({} as any)).toBe(false);
      expect(isSupportTransport([] as any)).toBe(false);
    });
  });

  describe('Edge Cases and Exception Handling', () => {
    it('should handle objects with extra properties', () => {
      const mixedObject = {
        url: new URL('http://example.com'),
        command: 'test',
        extraProperty: 'should not affect result',
      };

      // Should be identified as network transport (because it has url property)
      expect(isNetworkTransportCreateOptions(mixedObject)).toBe(true);
      // Should also be identified as stdio transport (because it has command property)
      expect(isStdioTransportCreateOptions(mixedObject)).toBe(true);
    });

    it('should handle objects with prototype chain', () => {
      class NetworkConfig {
        url = new URL('http://example.com');
        requestInit = {};
      }

      class StdioConfig {
        command = 'test-command';
      }

      const networkInstance = new NetworkConfig();
      const stdioInstance = new StdioConfig();

      expect(isNetworkTransportCreateOptions(networkInstance)).toBe(true);
      expect(isStdioTransportCreateOptions(stdioInstance)).toBe(true);
    });

    it('should handle objects with getter properties', () => {
      const networkObj = {
        get url() {
          return new URL('http://example.com');
        },
        requestInit: {},
      };

      const stdioObj = {
        get command() {
          return 'test-command';
        },
      };

      expect(isNetworkTransportCreateOptions(networkObj)).toBe(true);
      expect(isStdioTransportCreateOptions(stdioObj)).toBe(true);
    });
  });
});
