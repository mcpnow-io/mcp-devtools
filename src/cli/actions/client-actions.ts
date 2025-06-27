import * as readline from 'readline';
import chalk from 'chalk';
import { container } from 'tsyringe';

import { DEFAULT_CLIENT_PROTOCOL_VERSION } from './../../client/index';
import type { DevClient } from '@/client';
import { createDevClient } from '@/client';
import type { ClientTransportOptions } from '@/options';
import { safeParseJson } from '@/utils/json';
import type { ILogger } from '@/utils/logger';
import { isNetworkTransport, isStdioTransport } from '@/utils/options';

interface CommandInfo {
  desc: string;
  usage: string;
  example: string | string[] | null;
}

export const clientCommands: Record<string, CommandInfo> = {
  'list-tools': {
    desc: 'List available tools',
    usage: 'list-tools',
    example: null,
  },
  'list-resources': {
    desc: 'List available resources',
    usage: 'list-resources',
    example: null,
  },
  'list-resource-templates': {
    desc: 'List available resource templates',
    usage: 'list-resource-templates',
    example: null,
  },
  'list-prompts': {
    desc: 'List available prompts',
    usage: 'list-prompts',
    example: null,
  },
  'call-tool': {
    desc: 'Call a tool with arguments',
    usage: 'call-tool <name> <arguments>',
    example: ['call-tool echo {"message": "Hello World"}'],
  },
  'read-resource': {
    desc: 'Read a resource',
    usage: 'read-resource <uri>',
    example: 'read-resource templates/default.json',
  },
  'get-prompt': {
    desc: 'Get a prompt with arguments',
    usage: 'get-prompt <name> <arguments>',
    example: 'get-prompt template {"name": "John"}',
  },
  ping: {
    desc: 'Ping the server',
    usage: 'ping',
    example: null,
  },
  info: {
    desc: 'Show server info',
    usage: 'info',
    example: null,
  },
  exit: {
    desc: 'Exit the program',
    usage: 'exit',
    example: null,
  },
  kill: {
    desc: 'Kill the client',
    usage: 'kill',
    example: null,
  },
  reconnect: {
    desc: 'Reconnect to the server',
    usage: 'reconnect',
    example: null,
  },
};

// Add autocompletion helper functions before runInteractiveMode
function getCommandCompletions(line: string): string[] {
  const commandNames = Object.keys(clientCommands);

  const allCommands = [...commandNames];

  if (!line) {
    return allCommands;
  }

  return allCommands.filter((cmd) => cmd.startsWith(line));
}

export const allSupportedCommands = Object.keys(clientCommands);
export const allSupportedCommandsVariables = allSupportedCommands.map((cmd) => {
  return cmd
    .split('-')
    .map((word, index) => {
      if (index === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
});

export type ClientActionsOptions = {
  version: string;
  transport: string;
  url: string;
  command: string;
  env: string;
  pipeStderr: boolean;
  headers: string;
  name: string;
  interactive: boolean;
  verbose: boolean;
  pingInterval: number;

  // action and action args
  toolArgs: string;
  readResource: string;
  getPrompt: string;
  promptArgs: string;
  listTools: boolean;
  listResources: boolean;
  listPrompts: boolean;
  callTool: string;
};

export class ClientActions {
  public client!: DevClient;
  public isInteractiveMode = false;
  private logger: ILogger = container.resolve('Logger');
  constructor(private options: ClientActionsOptions) {}

  async initializeClient() {
    const options = {
      ...this.options,
      transport: {
        clientType: this.options.transport,
        networkOptions: isNetworkTransport(this.options.transport)
          ? {
              url: (() => {
                try {
                  return new URL(this.options.url);
                } catch (error) {
                  throw new Error(`Invalid URL format: ${this.options.url}`);
                }
              })(),
              headers: this.options.headers,
              pingInterval: this.options.pingInterval,
            }
          : undefined,
        stdioOptions: isStdioTransport(this.options.transport)
          ? {
              command: this.options.command,
              pipeStderr: this.options.pipeStderr,
              env: this.options.env,
            }
          : undefined,
      } as ClientTransportOptions,
      name: this.options.name,
      version: this.options.version,
    };
    this.client = await createDevClient(options);
  }

  async listTools() {
    this.logger.print('\nAvailable Tools:');
    try {
      const tools = [];
      let result = await this.client.listTools();
      tools.push(...result.tools);
      while (result.nextCursor) {
        result = await this.client.listTools({ cursor: result.nextCursor });
        tools.push(...result.tools);
      }

      if (tools.length === 0) {
        this.logger.print('    No tools available.');
      } else {
        tools.forEach((tool) => {
          this.logger.print(`    ${tool.name}`);
          this.logger.print(`        Description: ${tool.description}`);

          const inputSchema = tool.inputSchema!;
          const args = inputSchema.properties || {};
          if (Object.keys(args).length > 0) {
            this.logger.print(`        Arguments:`);
            Object.entries(args).forEach(([key, value]) => {
              this.logger.print(`          ${key}: ${(value as any).type}`);
            });
          }
        });
      }
    } catch (error) {
      this.logger.error('Error listing tools: ' + error);
    }
    this.logger.flushPrint();
  }

  async listResources() {
    this.logger.print('\nAvailable Resources:');
    try {
      const resources = [];
      let result = await this.client.listResources();
      resources.push(...result.resources);
      while (result.nextCursor) {
        result = await this.client.listResources({ cursor: result.nextCursor });
        resources.push(...result.resources);
      }

      if (resources.length === 0) {
        this.logger.print('    No resources available.');
      } else {
        resources.forEach((resource) => {
          this.logger.print(`\n    ${resource.name}`);
          if (resource.description) {
            this.logger.print(`      Description: ${resource.description}`);
          }
          const uri = resource.name === 'server-info' ? 'server-info://stats' : `${resource.uri}`;
          this.logger.print(`      URI: ${uri}`);
        });

        this.logger.print('\nUsage:');
        this.logger.print('    read-resource <uri>       # Read a specific resource');
        this.logger.print('    Example: read-resource file://README.md');
      }
    } catch (error) {
      this.logger.error('Error listing resources: ' + error);
    }
    this.logger.flushPrint();
  }

  async listPrompts() {
    this.logger.print('\nAvailable Prompts:');
    try {
      const prompts = [];
      let result = await this.client.listPrompts();
      prompts.push(...result.prompts);
      while (result.nextCursor) {
        result = await this.client.listPrompts({ cursor: result.nextCursor });
        prompts.push(...result.prompts);
      }

      if (prompts.length === 0) {
        this.logger.print('    No prompts available.');
      } else {
        prompts.forEach((prompt) => {
          this.logger.print(`    ${prompt.name.padEnd(20)} ${prompt.description}`);
        });

        this.logger.print('\nUsage:');
        this.logger.print('    get-prompt <name> <arguments>');
        this.logger.print('    Example: get-prompt template {"name": "John", "role": "developer"}');
      }
    } catch (error) {
      this.logger.error('Error listing prompts: ' + error);
    }
    this.logger.flushPrint();
  }

  async listResourceTemplates() {
    this.logger.print('\nAvailable Resource Templates:');
    try {
      const templates = [];
      let result = await this.client.listResourceTemplates();
      templates.push(...result.resourceTemplates);
      while (result.nextCursor) {
        result = await this.client.listResourceTemplates({ cursor: result.nextCursor });
        templates.push(...result.resourceTemplates);
      }

      if (templates.length === 0) {
        this.logger.print('    No resource templates available.');
      } else {
        templates.forEach((template) => {
          this.logger.print(`    ${template.name}`);
        });
      }
    } catch (error) {
      this.logger.error('Error listing resource templates: ' + error);
    }
    this.logger.flushPrint();
  }

  async callTool(name: string, argsStr?: string) {
    if (!name?.trim()) {
      throw new Error('Tool name is required');
    }
    try {
      const args = argsStr ? safeParseJson(argsStr) || {} : {};
      this.logger.debug('Tool Arguments:', undefined, true);
      this.logger.debug(JSON.stringify(args, null, 2), undefined, true);

      const result = await this.client.callTool({
        name,
        arguments: args,
      });

      // Format the output based on content type
      if (result && Array.isArray(result.content)) {
        result.content.forEach((content: any) => {
          if (content.type === 'text') {
            this.logger.print(`${content.text}`);
          } else if (content.type === 'error') {
            this.logger.error(content.text);
          } else {
            this.logger.print(JSON.stringify(content, null, 2));
          }
        });
      } else {
        this.logger.print(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      this.logger.error('Error calling tool: ' + error);
    }
    this.logger.flushPrint();
  }

  async readResource(uri: string) {
    this.logger.print(`\nReading resource: ${uri}`);
    try {
      const result = await this.client.readResource({ uri });
      console.log('@@result', result);

      if (result.content === null) {
        this.logger.print('    Content: null');
      } else if (Array.isArray(result.contents)) {
        this.logger.print('\nContent:');
        // Try to parse as JSON for prettier printing
        try {
          const jsonContent = result.contents;
          this.logger.print(JSON.stringify(jsonContent, null, 2));
        } catch {
          this.logger.print(String(result.contents));
        }
      } else if (typeof result.content === 'string') {
        this.logger.print('\nContent:');
        this.logger.print(result.content);
      } else {
        this.logger.print('\nContent Type: Binary');
        if (result.content && result.content instanceof Uint8Array) {
          this.logger.print(`    Size: ${result.content.byteLength} bytes`);
        }
      }

      if (result.metadata && Object.keys(result.metadata).length > 0) {
        this.logger.print('\nMetadata:');
        Object.entries(result.metadata).forEach(([key, value]) => {
          this.logger.print(`    ${key.padEnd(15)} ${JSON.stringify(value)}`);
        });
      }
    } catch (error) {
      this.logger.error('Error reading resource: ' + error);
    }
    this.logger.flushPrint();
  }

  async getPrompt(name: string, argsStr?: string) {
    this.logger.print(`\nGetting prompt: ${name}`);
    try {
      const args = argsStr ? safeParseJson(argsStr) || {} : {};
      this.logger.debug('Arguments: ' + JSON.stringify(args, null, 2));

      const result = await this.client.getPrompt({
        name,
        arguments: args,
      });

      this.logger.print('\nMessages:');
      try {
        const messages = result.messages;
        this.logger.print(JSON.stringify(messages, null, 2));
      } catch {
        this.logger.print(String(result.messages));
      }
    } catch (error) {
      this.logger.error('Error getting prompt: ' + error);
    }
    this.logger.flushPrint();
  }

  async runInteractiveMode() {
    try {
      this.isInteractiveMode = true;
      this._runInteractiveMode();
    } catch (error) {
      this.logger.error('Error running interactive mode: ' + error);
      this.isInteractiveMode = false;
    } finally {
      if (!this.isInteractiveMode) {
        await this.client?.close();
        process.exit(0);
      }
    }
  }

  _runInteractiveMode() {
    this.logger.info(
      '\nEntering interactive mode. Type "help" for available commands, "exit" to quit.',
      undefined,
      true,
    );

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.magenta(`${this.options.name}> `),
      completer: function (line: string) {
        const completions = getCommandCompletions(line);
        return [completions, line];
      },
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        rl.prompt();
        return;
      }

      // Extract the command and the rest of the input
      const parts = trimmedLine.split(/\s+/);
      const command = parts[0].toLowerCase();
      const restOfInput = parts.slice(1).join(' ');

      try {
        if (command === 'exit' || command === 'quit') {
          rl.close(); // This will trigger the 'close' event
          return; // Exit the line handler
        } else if (command === 'help') {
          this.logger.print('\nAvailable Commands:');
          Object.entries(clientCommands).forEach(([cmd, info]) => {
            this.logger.print(`\n    ${cmd}`);
            this.logger.print(`      Description: ${info.desc}`);
            this.logger.print(`      Usage: ${info.usage}`);
            if (info.example) {
              if (Array.isArray(info.example)) {
                this.logger.print('      Examples:');
                info.example.forEach((ex) => this.logger.print(`        ${ex}`));
              } else {
                this.logger.print(`      Example: ${info.example}`);
              }
            }
          });

          this.logger.print('\n');
          this.logger.print(`
Shortcuts:
  Mathematical Operations:
    add <a> <b>         # Shortcut for calculate with add operation
    subtract <a> <b>     # Shortcut for calculate with subtract operation
    multiply <a> <b>     # Shortcut for calculate with multiply operation
    divide <a> <b>       # Shortcut for calculate with divide operation
  Tips:
    - Use -v or --verbose to see protocol messages
    - Arguments can be provided as JSON or space-separated values
    - Use quotes for arguments containing spaces
`);
          this.logger.flushPrint();
          return;
        } else if (command === 'kill') {
          try {
            await this.client?.close();
            this.logger.info('Client killed');
          } catch (error) {
            this.logger.error('Error killing client: ' + error);
          }
        } else if (command === 'reconnect') {
          try {
            await this.client?.close();
            this.logger.info('Client killed');
          } catch (error) {
            this.logger.error('Error killing client: ' + error);
          }

          await this.initializeClient();
          this.logger.info('Client reconnected');
        } else if (command === 'list-tools') {
          await this.listTools();
        } else if (command === 'list-resources') {
          await this.listResources();
        } else if (command === 'list-resource-templates') {
          await this.listResourceTemplates();
        } else if (command === 'list-prompts') {
          await this.listPrompts();
        } else if (command === 'call-tool') {
          if (!restOfInput) {
            this.logger.print('Usage: call-tool <name> <arguments>');
            this.logger.print('Example: call-tool echo {"message":"Hello, world!"}');
            this.logger.print('Example: call-tool calculator {"operation":"add","a":3,"b":4}');
            this.logger.flushPrint();
          } else {
            // Simplified parsing - just find the first space and take everything after it as potential JSON
            const parts = restOfInput.split(' ');
            const toolName = parts[0];
            // For all other cases, join everything after the tool name as the JSON string
            const argsJsonString = parts.slice(1).join(' ');

            try {
              await this.callTool(toolName, argsJsonString);
            } catch (error) {
              this.logger.error('Error processing command: ' + error);
            }
          }
        } else if (command === 'read-resource') {
          if (!restOfInput) {
            this.logger.print('Usage: read-resource <uri>');
            this.logger.flushPrint();
          } else {
            await this.readResource(restOfInput);
          }
        } else if (command === 'get-prompt') {
          if (!restOfInput) {
            this.logger.print('Usage: get-prompt <name> <arguments>');
            this.logger.print('Example: get-prompt template {"name":"John","role":"developer"}');
            this.logger.flushPrint();
          } else {
            // Simplified parsing similar to call-tool
            const parts = restOfInput.split(' ');
            const promptName = parts[0];

            if (parts.length < 2) {
              this.logger.print('Usage: get-prompt <name> <arguments>');
              this.logger.print('Example: get-prompt template {"name":"John","role":"developer"}');
              this.logger.flushPrint();
              rl.prompt();
              return;
            }

            const argsJsonString = parts.slice(1).join(' ');

            try {
              await this.getPrompt(promptName, argsJsonString);
            } catch (error) {
              this.logger.error('Error processing command: ' + error);
            }
          }
        } else if (command === 'ping') {
          this.logger.print('Pinging server...');
          this.logger.flushPrint();
          await this.client.ping();
          this.logger.print('Server responded to ping!');
          this.logger.flushPrint();
        } else if (command === 'info') {
          const serverCapabilities = this.client.getServerCapabilities();
          const serverVersion = this.client.getServerVersion();
          const serverProtocolVersion =
            this.client.protocolVersion || DEFAULT_CLIENT_PROTOCOL_VERSION;

          this.logger.print('\nServer info:');
          this.logger.print('- Name: ' + serverVersion?.name);
          this.logger.print('- Version: ' + serverVersion?.version);
          this.logger.print('- Protocol Version: ' + serverProtocolVersion);
          this.logger.print('\nServer capabilities:');
          this.logger.print(JSON.stringify(serverCapabilities, null, 2));
          this.logger.print(`Server sessionId: ${this.client.sessionId}`);
          this.logger.flushPrint();
        } else {
          this.logger.info(`Unknown command: ${command}. Type "help" for available commands.`);
        }
      } catch (error) {
        this.logger.error('Interactive Error: ' + error);
      }

      // Only prompt again if not closing
      if (command !== 'exit' && command !== 'quit') {
        rl.prompt();
      }
    });

    rl.on('close', async () => {
      this.logger.info('Exiting interactive mode.', undefined, true);
      try {
        // Close the client connection when readline closes
        await this.client.close();
        this.logger.info('Disconnected from server.', undefined, true);
      } catch (closeError) {
        this.logger.error('Error disconnecting client: ' + closeError);
      } finally {
        process.exit(0);
      }
    });
  }
}
