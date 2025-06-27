import 'reflect-metadata';

import type { RequestOptions } from 'https';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import type {
  Implementation,
  JSONRPCMessage,
  Notification,
  Request,
  Result,
} from '@modelcontextprotocol/sdk/types';
import {
  CreateMessageRequestSchema,
  ListRootsRequestSchema,
  LoggingMessageNotificationSchema,
  ProgressNotificationSchema,
  PromptListChangedNotificationSchema,
  ResourceListChangedNotificationSchema,
  ToolListChangedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { noop } from 'lodash-es';
import { container } from 'tsyringe';
import type { z, ZodType } from 'zod';

import type { CreateTransportOptions } from '../transport';
import {
  createTransportWithHooks,
  isNetworkTransportCreateOptions,
  isStdioTransportCreateOptions,
} from '../transport';
import type { ClientTransportOptions } from './../options/client';
import type { ILogger } from '@/utils/logger';
import { isNetworkTransport, isStdioClientOptions } from '@/utils/options';

export type ClientOptions = {
  transport: ClientTransportOptions;
} & Implementation;

export const DEFAULT_CLIENT_PROTOCOL_VERSION = '2024-11-05';

export class DevClient<
  RequestT extends Request = Request,
  NotificationT extends Notification = Notification,
  ResultT extends Result = Result,
> extends Client<RequestT, NotificationT, ResultT> {
  private hookedTransport!: Transport;
  private pingIntervalId: NodeJS.Timeout | null = null;

  public protocolVersion: string = DEFAULT_CLIENT_PROTOCOL_VERSION;
  private logger: ILogger = container.resolve('Logger');

  constructor(private options: ClientOptions) {
    super(options, {
      capabilities: {
        sampling: {},
        roots: {
          listChanged: true,
        },
      },
    });
    this.protocolVersion = DEFAULT_CLIENT_PROTOCOL_VERSION;
    this.options = options;
  }

  async initialize() {
    this.initializeTransport();
    this.initializeClient();
    await this.connect(this.hookedTransport);
    this.setupPing();
  }

  initializeClient() {
    this.setNotificationHandler(ProgressNotificationSchema, async (notification) => {
      this.logger.info('Progress notification received: ' + JSON.stringify(notification, null, 2));
      // Can add progress update handling logic here
    });
    this.setNotificationHandler(ToolListChangedNotificationSchema, async (notification) => {
      this.logger.info('Tool list changed received: ' + JSON.stringify(notification, null, 2));
      const result = await this.listTools();
      this.logger.info('Tool list: ' + JSON.stringify(result, null, 2));
    });

    this.setNotificationHandler(ResourceListChangedNotificationSchema, async (notification) => {
      this.logger.info('Resource list changed received: ' + JSON.stringify(notification, null, 2));
      const result = await this.listResources();
      this.logger.info('Resource list: ' + JSON.stringify(result, null, 2));
    });

    this.setNotificationHandler(PromptListChangedNotificationSchema, async (notification) => {
      this.logger.info('Prompt list changed received: ' + JSON.stringify(notification, null, 2));
      const result = await this.listPrompts();
      this.logger.info('Prompt list: ' + JSON.stringify(result, null, 2));
    });

    this.setNotificationHandler(LoggingMessageNotificationSchema, async (notification) => {
      this.logger.debug('Logging message received: ' + JSON.stringify(notification, null, 2));
      // Handle server logs based on log level
      const { level, data } = notification.params;
      switch (level) {
        case 'error':
          this.logger.debug(`Server error: ${data}`);
          break;
        case 'warning':
          this.logger.debug(`Server warning: ${data}`);
          break;
        default:
          this.logger.debug(`Server info: ${data}`);
      }
    });

    this.setRequestHandler(ListRootsRequestSchema, async (request) => {
      this.logger.info('List roots request: ' + JSON.stringify(request, null, 2));
      return {
        roots: [
          {
            uri: 'file://roots/root1',
          },
        ],
      };
    });

    this.setRequestHandler(CreateMessageRequestSchema, async (request) => {
      this.logger.info('Create message request: ' + JSON.stringify(request, null, 2));
      return {
        model: 'mock-gpt',
        role: 'user',
        content: { type: 'text', text: 'Hello, world!' },
      };
    });

    this.onerror = (error) => {
      this.logger.error(`Client error: ${this.hookedTransport.sessionId ?? 'unknown'}`);
      this.logger.error(`Error details: ${error.message}`);
      this.logger.debug(`Error stack: ${error.stack}`);
    };

    this.onclose = () => {
      this.logger.info(`Client closed: ${this.hookedTransport.sessionId ?? 'unknown'}`);
    };
  }

  initializeTransport() {
    this.hookedTransport = createTransportWithHooks(this.options.transport, {
      onBeforeCreate: (options: CreateTransportOptions) => {
        if (isNetworkTransportCreateOptions(options)) {
          this.logger.info(
            `Using [${this.options.transport.clientType}] transport with URL: ${options.url.toString()}`,
          );
          if (options.requestInit) {
            this.logger.debug(JSON.stringify(options.requestInit, null, 2));
          }
        } else if (isStdioTransportCreateOptions(options)) {
          this.logger.info(
            `Using [${this.options.transport.clientType}] transport with command: ${options.command}`,
          );
          if (options.env) {
            this.logger.debug(JSON.stringify(options.env, null, 2));
          }
        } else {
          throw new Error('Unknown transport type');
        }
      },
      onCreated: async () => {
        this.logger.debug('create transport successful');
      },
      onBeforeSendMessage: (message: JSONRPCMessage) => {
        if (isNetworkTransport(this.options.transport.clientType)) {
          this.logger.logProtocolMessage('outgoing', this.sessionId, message);
        }
      },
      onReceiveMessage: (message: JSONRPCMessage) => {
        if (!isNetworkTransport(this.options.transport.clientType)) {
          return;
        }
        this.logger.logProtocolMessage('incoming', this.sessionId, message);
      },
      onError: (error: Error) => {
        this.logger.error(error.message);
      },
      onWarning: (message: string) => {
        this.logger.warn(message);
      },
      onSetProtocolVersion: (beforeVersion: string, afterVersion: string) => {
        this.logger.info(`Set protocol version from ${beforeVersion} to ${afterVersion}`);
      },
      onStart: () => {
        this.logger.info(`Session ${this.transport?.sessionId ?? 'unknown'} started`);
      },
      onClose: () => {
        this.logger.info(`Session ${this.transport?.sessionId ?? 'unknown'} closed`);
      },
    });
  }

  async request<T extends ZodType<object>>(
    request: RequestT,
    resultSchema: T,
    options?: RequestOptions,
  ): Promise<z.infer<T>> {
    const result = (await super.request(request, resultSchema, options)) as any;
    if (request?.method === 'initialize') {
      this.logger.debug(
        'Intercepted initialize request result: ' + JSON.stringify(result, null, 2),
      );
      if (result?.protocolVersion) {
        this.logger.debug(
          'Found protocol version via request intercept: ' + result.protocolVersion,
        );

        this.protocolVersion = result.protocolVersion;
      }
    }
    return result;
  }

  async connect(transport: Transport, options?: RequestOptions) {
    this.logger.info('Connecting to server...');

    let clearup: typeof noop = noop;
    if (isStdioClientOptions(this.options)) {
      clearup = this.setupStdioTimeoutDetection() || noop;
    }
    await super.connect(transport, options);
    clearup();
    this.logger.info('Connected to server!');
  }

  get sessionId() {
    if (!this.transport) {
      return 'unknown';
    }
    return this.transport.sessionId!;
  }

  private setupStdioTimeoutDetection() {
    if (isStdioClientOptions(this.options as any) && this.options.pingInterval !== 0) {
      const timer = setTimeout(() => {
        this.logger.error(
          `Connection timeout after ${(this.options.pingInterval as number) / 1000} seconds. The child process might not be responding.`,
        );
        this.logger.error(
          'Debug tip: Make sure the target command implements the MCP protocol and is listening on stdin/stdout.',
        );
        process.exit(1);
      }, this.options.pingInterval as number);
      return () => clearTimeout(timer);
    }
  }

  private setupPing() {
    if (!isNetworkTransport(this.options.transport.clientType)) {
      return;
    }

    const intervalMs = parseInt(String(this.options.pingInterval), 10);
    if (!isFinite(intervalMs)) {
      this.logger.error(`Invalid ping interval: ${this.options.pingInterval}`);
      return;
    }
    if (intervalMs <= 0) {
      this.logger.debug(`ping is disabled`);
      return;
    }

    this.pingIntervalId = setInterval(async () => {
      this.logger.debug(`pinging server...`);
      try {
        await this.ping();
        this.logger.debug(`ping server successfully`);
      } catch (error) {
        this.logger.error(`pinging server failed: ${error}`);
      }
    }, intervalMs);
  }

  async close() {
    await super.close();
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
    }
  }

  printClientInfo() {
    const serverVersion = this.getServerVersion();
    const serverCapabilities = this.getServerCapabilities();
    const instructions = this.getInstructions();
    this.logger.print('\nServer info:');
    this.logger.print('- Name: ' + serverVersion?.name);
    this.logger.print('- Version: ' + serverVersion?.version);
    this.logger.print('- Protocol Version: ' + this.protocolVersion);

    if (instructions) {
      this.logger.print('\nServer instructions:');
      this.logger.print(instructions);
    }

    this.logger.print('\nServer capabilities:');
    this.logger.print(JSON.stringify(serverCapabilities, null, 2));
    this.logger.flushPrint();
  }
}

export const createDevClient = async (options: ClientOptions) => {
  const client = new DevClient(options);
  await client.initialize();
  return client;
};
