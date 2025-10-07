import 'reflect-metadata';

import { Command } from 'commander';
import { container } from 'tsyringe';

import { version as cliVersion } from '../../package.json';
import type { ClientActionsOptions } from './actions/client-actions';
import { ClientActions } from './actions/client-actions';
import { createLogger } from '@/utils/logger';

const CLIENT_NAME = 'mcp-dev-client';

async function main() {
  const program = new Command();

  // Setup CLI
  program.name(CLIENT_NAME).description('MCP client simulator for testing MCP servers');

  // Connection options
  program
    .option('-t, --transport <type>', 'Transport type: http/sse/stdio)', 'sse')
    .option('-u, --url <url>', 'URL for HTTP/SSE transport (e.g., http://localhost:8010/sse)')
    .option('-c, --command <command>', 'Full command line for stdio transport')
    .option('-e, --env <env>', 'JSON string of environment variables for stdio transport')
    .option('--pipe-stderr', 'Pipe stderr from the stdio child process (for debugging)')
    .option('-H, --headers <headers>', 'JSON string of headers for SSE transport')
    .option('-n, --name <name>', 'Client name', CLIENT_NAME)
    .option('-i, --interactive', 'Run in interactive mode')
    .option('-v, --verbose', 'Enable verbose logging including protocol messages', false)
    .option(
      '--ping-interval <ms>',
      'Interval for client-to-server pings in milliseconds (0 to disable)',
      '30000',
    );

  program
    .option('--list-tools', 'List available tools')
    .option('--list-resources', 'List available resources')
    .option('--list-prompts', 'List available prompts')
    .option('--call-tool <name>', 'Call a tool with the given name')
    .option('--tool-args <args>', 'JSON string of arguments for tool call')
    .option('--read-resource <uri>', 'Read a resource with the given URI')
    .option('--get-prompt <name>', 'Get a prompt with the given name')
    .option('--prompt-args <args>', 'JSON string of arguments for prompt');

  program.parse(process.argv);

  const options = program.opts() as ClientActionsOptions;
  options.version = cliVersion;

  if (options.transport === 'http') {
    options.url ??= 'http://localhost:8010/mcp';
  } else if (options.transport === 'sse') {
    options.url ??= 'http://localhost:8010/sse';
  }



  if (options.url?.endsWith('sse')){
    options.transport = 'sse'
  } else if (options.url){
    options.transport = 'http'
  }

  container.register('Logger', {
    useValue: createLogger({
      verbose: options.verbose,
      name: options.name,
      transport: 'stdio',
    }),
  });

  const actions = new ClientActions(options);
  await actions.initializeClient();

  // Check if any action flags are provided
  const hasActionFlags = options.listTools || options.listResources || options.listPrompts || 
                        options.callTool || options.readResource || options.getPrompt;

  // Default to interactive mode if no action flags are provided
  if (options.interactive || !hasActionFlags) {
    actions.runInteractiveMode();
  } else {
    try {
      if (options.listTools) {
        await actions.listTools();
      }
      if (options.listResources) {
        await actions.listResources();
      }
      if (options.listPrompts) {
        await actions.listPrompts();
      }
      if (options.callTool) {
        await actions.callTool(options.callTool, options.toolArgs);
      }
      if (options.readResource) {
        await actions.readResource(options.readResource);
      }
      if (options.getPrompt) {
        await actions.getPrompt(options.getPrompt, options.promptArgs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!actions.isInteractiveMode) {
        await actions.client.close();
        process.exit(0);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
