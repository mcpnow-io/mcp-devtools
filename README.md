# MCP DevTools

A powerful Model Context Protocol (MCP) development toolkit that provides command-line tools for developing, testing, and debugging MCP servers.

## 🚀 Installation

You can install MCP DevTools in two ways:

### Global Installation
```bash
npm install -g @mcp-now/mcp-devtools
# Then use directly: mcp-server and mcp-client
```

### Local Installation (Recommended for projects)
```bash
npm install @mcp-now/mcp-devtools
# Then use with npx: npx mcp-server and npx mcp-client
```

## 📖 Overview

MCP DevTools provides two main command-line tools:

- **`mcp-server`**: MCP server for hosting and running MCP services
- **`mcp-client`**: MCP client for testing and interacting with MCP servers

These tools support multiple transport protocols (HTTP, SSE, stdio) and provide interactive modes for convenient development and debugging.

## 🛠️ Command Line Tools

### MCP Server (`mcp-server`)

Used to start and run MCP servers with support for multiple transport protocols.

#### Basic Usage

```bash
mcp-server -t <transport> [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --transport <type>` | Transport type (http/sse/stdio) | **Required** |
| `-p, --port <port>` | HTTP server port (http/sse transport) | `3000` |
| `-n, --name <name>` | Server name | `mcp-test-server` |
| `-c, --config <path>` | Server configuration file path | `./mcp_server.config.js` |
| `-i, --interactive` | Enable interactive mode | `false` |
| `-v, --verbose` | Enable verbose logging | `false` |
| `--ping-interval <ms>` | Ping interval in milliseconds | `30000` |

#### Usage Examples

```bash
# Start HTTP server in interactive mode
mcp-server -t http --interactive

# Start SSE server with custom port and verbose logging
mcp-server -t sse -p 8080 -v --interactive

# Start stdio server
mcp-server -t stdio -v --interactive

# Use custom configuration file
mcp-server -t http -c ./my-config.js --interactive
```

### MCP Client (`mcp-client`)

Used to connect to and test MCP servers, supporting various operations and interactive mode.

#### Basic Usage

```bash
mcp-client -t <transport> [options] [actions]
```

#### Connection Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --transport <type>` | Transport type (http/sse/stdio) | **Required** |
| `-u, --url <url>` | URL for HTTP/SSE transport | Auto-set based on transport type |
| `-c, --command <command>` | Full command line for stdio transport | - |
| `-e, --env <env>` | Environment variables for stdio transport (JSON string) | - |
| `--pipe-stderr` | Pipe stderr from stdio child process | `false` |
| `-H, --headers <headers>` | Request headers for SSE transport (JSON string) | - |
| `-n, --name <name>` | Client name | `mcp-dev-client` |
| `-i, --interactive` | Run in interactive mode | `false` |
| `-v, --verbose` | Enable verbose logging | `false` |
| `--ping-interval <ms>` | Ping interval in milliseconds | `30000` |

#### Action Options

| Option | Description |
|--------|-------------|
| `--list-tools` | List available tools |
| `--list-resources` | List available resources |
| `--list-prompts` | List available prompts |
| `--call-tool <name>` | Call specified tool |
| `--tool-args <args>` | Tool call arguments (JSON string) |
| `--read-resource <uri>` | Read specified resource |
| `--get-prompt <name>` | Get specified prompt |
| `--prompt-args <args>` | Prompt arguments (JSON string) |

#### Usage Examples

```bash
# Connect to HTTP server and enter interactive mode
mcp-client -t http -u http://localhost:3000/mcp --interactive

# Connect to SSE server
mcp-client -t sse -u http://localhost:3000/sse --interactive

# Connect to stdio server
mcp-client -t stdio -c "npx -y @modelcontextprotocol/server-everything" --interactive

# List server tools
mcp-client -t http --list-tools

# Call a tool
mcp-client -t http --call-tool calculator --tool-args '{"operation": "+", "a": 5, "b": 3}'

# Read a resource
mcp-client -t http --read-resource "file://resource/resource-file01"

# Get a prompt
mcp-client -t http --get-prompt greeting --prompt-args '{"name": "Alice", "language": "en"}'
```

## 📋 Interactive Mode

Both tools support interactive mode, providing real-time command-line interfaces:

### Server Interactive Commands

- `help` - Show help information, get more information

### Client Interactive Commands

- `help` - Show help information

## ⚙️ Configuration

### Server Configuration File

Before creating the configuration file, you need to set up a Node.js project and install the required dependencies:

```bash
# Create a new directory for your MCP server
mkdir my-mcp-server
cd my-mcp-server

# Initialize npm project
npm init -y

# Enable ES6 modules (required for the config file)
npm pkg set type=module

# Install required dependencies
npm install zod

#optional, if global has not installed
npm install @mcp-now/mcp-devtools
```

Then create a `mcp_server.config.js` file to define server tools, resources, and prompts:

```javascript
import { z } from 'zod';

export default {
  tools: [
    {
      name: 'calculator',
      description: 'A simple calculator tool',
      parameters: {
        operation: z.enum(['+', '-', '*', '/']).describe('Math operation (+, -, *, /)'),
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
      },
      handler: async (args, extra) => {
        const { operation, a, b } = args;
        let result;

        switch (operation) {
          case '+': result = a + b; break;
          case '-': result = a - b; break;
          case '*': result = a * b; break;
          case '/': result = a / b; break;
          default: throw new Error(`Unknown operation: ${operation}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Result: ${a} ${operation} ${b} = ${result}`,
            },
          ],
        };
      },
    },
  ],

  resources: [
    {
      name: 'file-system',
      description: 'Access to file system resources',
      uri: 'file://resource/resource-file01',
      handler: async (uri) => {
        return {
          contents: [
            {
              uri: uri,
              mimeType: 'text/plain',
              text: `Content of ${uri}`,
            },
          ],
        };
      },
    },
  ],

  prompts: [
    {
      name: 'greeting',
      description: 'Generate a greeting message',
      parameters: {
        name: z.string().describe('Name of the person to greet'),
        language: z.string().default('en').describe('Language for greeting'),
      },
      handler: async (args) => {
        const greetings = {
          en: 'Hello',
          es: 'Hola',
          fr: 'Bonjour',
          de: 'Hallo',
        };

        const greeting = greetings[args.language] || greetings.en;

        return {
          description: `A greeting for ${args.name}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `${greeting}, ${args.name}! How are you today?`,
              },
            },
          ],
        };
      },
    },
  ],
}
```

> **Note**: The configuration file uses ES6 modules and requires the `zod` package for parameter validation. Make sure your `package.json` includes `"type": "module"` or use `.mjs` extension for the config file.

## 🔄 Transport Protocols

### HTTP Transport

Suitable for HTTP-based RESTful API communication:

```bash
# Server
mcp-server -t http -p 3000

# Client
mcp-client -t http -u http://localhost:3000/mcp
```

### SSE (Server-Sent Events) Transport

Suitable for real-time data streaming:

```bash
# Server
mcp-server -t sse -p 3000

# Client
mcp-client -t sse -u http://localhost:3000/sse
```

### stdio Transport

Suitable for inter-process communication:

```bash
# Server
mcp-server -t stdio

# Client connecting to external MCP server
mcp-client -t stdio -c "npx -y @modelcontextprotocol/server-everything"
```

## 🛠️ Development & Testing

### Quick Start

1. Set up your MCP server project:
```bash
# Create and initialize your project
mkdir my-mcp-server
cd my-mcp-server
npm init -y

# Install dependencies
npm install zod @mcp-now/mcp-devtools

# Create configuration file (see Configuration section above)
# Then copy the example mcp_server.config.js
```

2. Start the server:
```bash
npx mcp-server -t http --interactive
```

3. Connect the client in another terminal:
```bash
npx mcp-client -t http --interactive
```

4. Test in client interactive mode:
```
mcp-client> list-tools
mcp-client> call-tool calculator {"operation": "+", "a": 5, "b": 3}
```

### Debugging Tips

- Use `-v` or `--verbose` flag to see detailed protocol messages
- Use interactive mode for real-time testing and debugging
- Check server configuration file syntax and logic
- Test compatibility with different transport protocols

## 📄 License

Copyright (c) 2025 mpcnow.io. All rights reserved.

Licensed under the MIT license.

## 🔗 Related Links

- [Model Context Protocol Official Documentation](https://modelcontextprotocol.io/)
