#!/usr/bin/env node

import 'reflect-metadata';

import { Command } from 'commander';
import { container } from 'tsyringe';

import pkg from '../../package.json';
import { ServerActions, type CLIServerOptions } from './actions/server-actions';
import type { SupportTransports } from '@/options';
import { createServer, type ServerOptions } from '@/server';
import { isSupportTransport } from '@/transport/index.js';
import { loadMcpServerDefinition } from '@/utils/config.js';
import { createLogger } from '@/utils/logger.js';

// CLI option parsing
const program = new Command();

const cliVersion = pkg.version;

program
  .name('mcp-dev-server')
  .description('MCP server CLI with interactive commands')
  .version(cliVersion);

// Server options
program
  .requiredOption('-t, --transport <type>', 'Transport type (http/sse/stdio)')
  .option('-p, --port <port>', 'Port for HTTP server (http/sse transport)', '3000')
  .option('-n, --name <name>', 'Server name', 'mcp-test-server')
  .option('-i, --interactive', 'Enable interactive mode')
  .option('-v, --verbose', 'Enable verbose message logging', false)
  .option(
    '--ping-interval <ms>',
    'Interval for server-to-client pings in milliseconds (0 to disable)',
    '30000',
  );

program.parse(process.argv);
const cliOptions = program.opts();

// Convert to CLIServerOptions format
const serverOptions: CLIServerOptions = {
  name: cliOptions.name,
  version: cliVersion,
  description: 'MCP server CLI with interactive commands',
  transport: cliOptions.transport,
  port: parseInt(cliOptions.port),
  interactive: cliOptions.interactive,
  verbose: cliOptions.verbose,
  pingInterval: cliOptions.pingInterval,
};


async function main() {
  try {
    const transport = serverOptions.transport;
    if (!isSupportTransport(transport)) {
      throw new Error(`Invalid transport: ${transport}`);
    }

    // Configure dependency injection container
    const logger = createLogger({
      transport: serverOptions.transport as SupportTransports,
      interactive: serverOptions.interactive,
      verbose: serverOptions.verbose,
    });

    const serverConfig: ServerOptions = {
      name: serverOptions.name,
      version: serverOptions.version,
      description: serverOptions.description,
      transport,
      interactive: serverOptions.interactive,
      pingInterval: serverOptions.pingInterval,
      port: serverOptions.port,
    };

    const serverDefinition = loadMcpServerDefinition();

    container.register('Logger', { useValue: logger });
    container.register('ServerOptions', { useValue: serverConfig });
    container.register('CLIServerOptions', { useValue: serverOptions });
    container.register('ServerDefinition', { useValue: serverDefinition });

    // Create Server instance
    const server = await createServer(serverConfig);
    container.register('Server', { useValue: server });

    // Create ServerActions instance
    const serverActions = container.resolve(ServerActions);

    server.listen();
    // If interactive mode is enabled, start interactive command line
    if (serverOptions.interactive) {
      serverActions.runInteractiveMode();
    } else {
      console.log('🚀 Server started in non-interactive mode');
      console.log('Press Ctrl+C to exit');

      process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        process.exit(0);
      });
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start server
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
