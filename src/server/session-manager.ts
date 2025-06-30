import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import type { ServerOptions } from '.';
import type { Logger } from '../utils/logger.js';
import { container, inject, injectable } from 'tsyringe';
import { loadMcpServerDefinition } from '../utils/config.js';
import { randomUUID } from 'node:crypto';
import type {
  ReadResourceCallback,
  ReadResourceTemplateCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

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
    let config: Awaited<ReturnType<typeof loadMcpServerDefinition>>;
    try {
      config = await loadMcpServerDefinition(this.serverOptions.configPath);
    } catch (error) {
      this.logger.error('Error loading configuration: ' + String(error));
      throw new Error(`Failed to load MCP server configuration: ${String(error)}`);
    }

    const server = new McpServer(
      {
        name: this.serverOptions.name,
        version: this.serverOptions.version,
      },
      {
        capabilities: {
          logging: {},
          experimental: {},
          resources: {
            listChanged: true,
            subscribe: true,
          },
          prompts: {
            listChanged: true,
          },
          tools: {
            listChanged: true,
          },
        },
        instructions: 'MCP test server for development and testing.',
      },
    );

    const mcpServer = server.server;

    if (mcpServer) {
      mcpServer.oninitialized = () => {
        this.logger.info(`session initialized: ${mcpServer.transport?.sessionId}`);
      };

      mcpServer.onerror = (error) => {
        this.logger.error(`session error: ${mcpServer.transport?.sessionId} ${error}`);
      };
    }

    server.tool('roots', 'List roots', {}, async () => {
      const roots = await server.server.listRoots();
      return {
        content: [{ type: 'text', text: JSON.stringify(roots) }],
      };
    });

    server.tool('sample', 'Sample', {}, async () => {
      const message = await server.server.createMessage({
        messages: [{ role: 'user', content: { type: 'text', text: 'Hello, world!' } }],
        maxTokens: 100,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(message) }],
      };
    });

    server.tool('resources-change', 'Send resources change notification', {}, async () => {
      await server.server.sendResourceListChanged();
      return {
        content: [{ type: 'text', text: 'Resource list changed sent' }],
      };
    });

    server.tool('prompts-change', 'Send prompts change notification', {}, async () => {
      await server.server.sendPromptListChanged();
      return {
        content: [{ type: 'text', text: 'Prompt list changed sent' }],
      };
    });

    if (config.tools) {
      for (const tool of config.tools) {
        if (!tool.name || !tool.description || !tool.parameters || !tool.handler) {
          this.logger.warn(`Skipping invalid tool configuration: ${tool.name}`);
          continue;
        }
        server.tool(tool.name, tool.description, tool.parameters, tool.handler);
      }
    }

    if (config.resources) {
      for (const resource of config.resources) {
        if (!resource.name || !resource.description || !resource.handler) {
          this.logger.warn(`Skipping invalid resource configuration: ${resource.name}`);
          continue;
        }

        // Check that resource must have template or uri
        if (!resource.template && !resource.uri) {
          this.logger.warn(`Skipping invalid resource configuration: ${resource.name}`);
          continue;
        }

        if (resource.template) {
          const template = new ResourceTemplate(
            resource.template.uri,
            resource.template.options as any,
          );
          server.resource(
            resource.name,
            template,
            { description: resource.description },
            resource.handler as ReadResourceTemplateCallback,
          );
          this.logger.debug(`Registered resource template: ${resource.name}`);
        } else if (resource.uri) {
          server.resource(
            resource.name,
            resource.uri,
            { description: resource.description },
            resource.handler as ReadResourceCallback,
          );
          this.logger.debug(`Registered resource: ${resource.name} with URI: ${resource.uri}`);
        }
      }
    }

    // Register prompts from config
    if (config.prompts) {
      for (const prompt of config.prompts) {
        if (!prompt.name || !prompt.description || !prompt.parameters || !prompt.handler) {
          this.logger.warn(`Skipping invalid prompt configuration: ${prompt.name}`);
          continue;
        }
        server.prompt(prompt.name, prompt.description, prompt.parameters, prompt.handler);
      }
    }

    await server.connect(transport);

    // Generate unique ID for transports without session ID
    const sessionId =
      mcpServer.transport?.sessionId ?? `${transport.constructor.name}-${randomUUID()}`;
    this.replaceSessionPartial(sessionId, {
      server,
      transport,
      pingIntervalId: this.setupPing(server),
    });

    return server;
  }

  private setupPing(server: McpServer) {
    const innerServer = server.server;
    const pingIntervalMs = parseInt(this.serverOptions.pingInterval, 10);
    if (!isFinite(pingIntervalMs) || pingIntervalMs <= 0) {
      this.logger.info(
        'Server-to-client ping is disabled',
        undefined,
        this.serverOptions.interactive,
      );
      return;
    }
    this.logger.info(
      `Starting server-to-client ping with interval: ${pingIntervalMs}ms to ${innerServer.transport?.sessionId}`,
      undefined,
      this.serverOptions.interactive,
    );
    const id = setInterval(async () => {
      try {
        await innerServer.ping();

        this.logger.debug(`ping sent to ${innerServer.transport?.sessionId}`);
      } catch (pingError) {
        this.logger.error(`Error sending ping: ${String(pingError)}, clearing interval`);
        clearInterval(id);
        const sessionId = innerServer.transport?.sessionId ?? `unknown-transport-${randomUUID()}`;
        this.replaceSessionPartial(sessionId, {
          pingIntervalId: undefined,
        });
      }
    }, pingIntervalMs);
    return id;
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
