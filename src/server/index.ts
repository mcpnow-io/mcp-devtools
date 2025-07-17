import { createTransportWithHooks } from '../transport/index.js';
import { container, inject, injectable } from 'tsyringe';
import type { SupportTransports } from '../options/index.js';
import { type Logger } from '../utils/logger.js';
import express from 'express';
import cors from 'cors';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { randomUUID } from 'node:crypto';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSessionManager } from './session-manager';

export interface ServerOptions {
  name: string;
  version: string;
  description: string;
  transport: SupportTransports;
  port: number;
  pingInterval: string;
  interactive: boolean;
}

const IGNORE_HTTP_HEADERS = [
  'host',
  'connection',
  'content-length',
  'content-type',
  'accept',
  'accept-language',
  'accept-encoding',
  'user-agent',
  'sentry-trace',
  'baggage',
  'sec-fetch-mode',
  'pragma',
  'cache-control',
];

const getEndpointBasicPath = (transport: SupportTransports) => {
  if (transport === 'http') {
    return '/mcp';
  } else if (transport === 'sse') {
    return '/sse';
  }
};

@injectable()
export class DevServer {
  httpServer?: express.Express;
  public sessionManager = createSessionManager();

  constructor(
    @inject('Logger') private logger: Logger,
    @inject('ServerOptions') private options: ServerOptions,
  ) {}

  async initializeServer(options: ServerOptions) {
    this.options = options;
    if (this.options.transport === 'stdio') {
      return this.initializeStdioServer();
    }
    return this.initializeHTTPServer();
  }

  private async initializeStdioServer() {
    if (this.options.transport !== 'stdio') {
      return;
    }
    const transport = new StdioServerTransport();
    await this.sessionManager.createNewServer(transport);
  }

  private initializeHTTPServer() {
    if (this.options.transport !== 'http' && this.options.transport !== 'sse') {
      return;
    }

    const app = express();
    app.use(cors());
    if (this.options.transport === 'http') {
      app.all('/mcp', this._handleStreamableHTTPRequest.bind(this));
    } else if (this.options.transport === 'sse') {
      app.get('/sse', this._handleSSEConnect.bind(this));
      app.post('/messages', this._handleSSEMessage.bind(this));
    }
    this.httpServer = app;
  }

  listen() {
    if (!this.httpServer) {
      throw new Error('HTTP server not initialized');
    }
    this.httpServer.listen(this.options.port, () => {
      this.logger.info(
        `MCP Server listening at http://localhost:${this.options.port}${getEndpointBasicPath(this.options.transport)}`,
      );
    });
  }

  private async _handleSSEConnect(req: express.Request, res: express.Response) {
    const logger = this.logger;
    const sessionManager = this.sessionManager;
    const transport = createTransportWithHooks<SSEServerTransport>(
      {
        serverType: 'sse',
        endpoint: '/messages',
        res,
      },
      {
        onReceiveMessage(message) {
          logger.logProtocolMessage('incoming', transport.sessionId!, message);
        },
        onAfterSendMessage(message) {
          logger.logProtocolMessage('outgoing', transport.sessionId!, message);
        },
        onClose() {
          logger.info(`SSE connection closed: ${transport.sessionId}`);
          sessionManager.removeSession(transport.sessionId);
        },
      },
    );
    await sessionManager.createNewServer(transport);
  }

  private async _handleSSEMessage(req: express.Request, res: express.Response) {
    this._logHeaders(req);
    const sessionId = req.query.sessionId as string;
    const transport = this.sessionManager.getSession(sessionId)?.transport;
    if (transport instanceof SSEServerTransport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send(`No SSE transport found for sessionId ${sessionId}`);
    }
  }

  private async _handleStreamableHTTPRequest(req: express.Request, res: express.Response) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    this.logger.debug(`${req.method} /mcp, sessionId: ${sessionId}`);
    try {
      // Check for existing session ID
      if (sessionId && this.sessionManager.getSession(sessionId)?.transport) {
        const transport = this.sessionManager.getSession(sessionId)?.transport;
        if (transport instanceof StreamableHTTPServerTransport) {
          this.logger.debug(`Reusing existing transport for session ${sessionId}`);
          await transport.handleRequest(req, res, req.body);
          return;
        } else {
          this.logger.debug(
            `Transport exists but is not a StreamableHTTPServerTransport (could be SSEServerTransport)`,
          );
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: Session exists but uses a different transport protocol',
            },
            id: null,
          });
          return;
        }
      } else {
        // create new session
        const logger = this.logger;
        const mcpServerManager = this.sessionManager;

        // Create base server transport
        const transport = createTransportWithHooks<StreamableHTTPServerTransport>(
          {
            serverType: 'http',
            sessionIdGenerator: () => sessionId || randomUUID(),
            eventStore: new InMemoryEventStore(),
            onsessioninitialized: (sessionId: string) => {
              logger.info(`StreamableHTTP session initialized with ID: ${sessionId}`);
              mcpServerManager.replaceSessionPartial(sessionId, { transport });
            },
          },
          {
            onReceiveMessage(message) {
              logger.logProtocolMessage('incoming', transport.sessionId!, message);
            },
            onAfterSendMessage(message) {
              logger.logProtocolMessage('outgoing', transport.sessionId!, message);
            },
            onClose() {
              const sessionId = transport.sessionId;
              if (sessionId && mcpServerManager.hasSession(sessionId)) {
                logger.info(`Transport closed for session ${sessionId}`);
                mcpServerManager.removeSession(sessionId);
              }
            },
            onError(error) {
              logger.error(`Error handling MCP request: ${String(error)}`);
            },
          },
        );

        await mcpServerManager.createNewServer(transport);
        await transport.handleRequest(req, res, req.body);
      }
    } catch (error) {
      this.logger.error(`Error handling MCP request: ${String(error)}`);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  }
  private _logHeaders(req: express.Request) {
    const headers = { ...req.headers };
    for (const header of IGNORE_HTTP_HEADERS) {
      delete headers[header];
    }
    this.logger.debug(`${req.method} ${req.url} Headers ${JSON.stringify(headers)}`);
  }

  public close() {
    this.sessionManager.close();
  }
}

export const createServer = async (options: ServerOptions) => {
  const server = container.resolve(DevServer);
  await server.initializeServer(options);
  return server;
};
