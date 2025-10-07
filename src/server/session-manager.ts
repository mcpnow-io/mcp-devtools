import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import type { ServerOptions } from './index.js';
import type { Logger } from '../utils/logger.js';
import { container, inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpServer } from './mcp-server.js';

export type SessionInfo = {
  server: McpServer;
  transport?: Transport;
  pingIntervalId?: NodeJS.Timeout;
};

@injectable()
export class SessionManager {
  private sessions: Map<string, SessionInfo> = new Map();

  constructor(
    @inject('Logger') private logger: Logger,
    @inject('ServerOptions') private serverOptions: ServerOptions,
  ) {}

  removeSession(name: string) {
    const server = this.sessions.get(name);
    if (server) {
      if (server.pingIntervalId) {
        clearInterval(server.pingIntervalId);
        this.logger.info(`ping interval for ${name} is cleared`);
      }
      this.sessions.delete(name);
      this.logger.info(`session ${name} is removed`);
    }
  }

  getSession(name: string): SessionInfo | undefined {
    return this.sessions.get(name);
  }

  hasSession(name: string): boolean {
    return this.sessions.has(name);
  }

  replaceSessionPartial(name: string, partial: Partial<SessionInfo>) {
    const server = this.sessions.get(name) || ({} as any);
    this.sessions.set(name, { ...server, ...partial });
  }

  listServers(): string[] {
    return Array.from(this.sessions.keys());
  }

  async createNewServer(transport: Transport) {
    const { server, pingIntervalId } = await createMcpServer(
      transport,
      this.logger,
      this.serverOptions,
    );

    const mcpServer = server.server;

    // Generate unique ID for transports without session ID
    const sessionId =
      mcpServer.transport?.sessionId ?? `${transport.constructor.name}-${randomUUID()}`;
    this.replaceSessionPartial(sessionId, {
      server,
      transport,
      pingIntervalId,
    });

    return server;
  }


  close() {
    this.sessions.forEach((session, sessionId) => {
      session.transport?.close?.();
      session.server?.close?.();
      this.removeSession(sessionId);
      this.logger.info(`Session ${sessionId} is closed`);
    });
    this.sessions.clear();
  }
}

export const createSessionManager = () => {
  return container.resolve(SessionManager);
};
