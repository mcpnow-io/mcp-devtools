# MCP DevTools

A powerful Model Context Protocol (MCP) development toolkit that provides command-line tools for developing, testing, and debugging MCP servers.

## 🚀 Installation

You can use MCP DevTools in the following ways:

### Run with npx

```bash
# Run server
npx -p @mcp-now/mcp-devtools mcp-server
# or 
npx -p https://github.com/mcpnow-io/mcp-devtools mcp-server

# Run client
npx -p @mcp-now/mcp-devtools mcp-client
```

Config in MCP hosts such as Claude Desktop and Cursor:
```
{
  "mcpServers": {
    "mcp-dev-server": {
      "command": "npx",
      "args": [
        "-y",
        "-p",
        "@mcp-now/mcp-devtools",
        "mcp-server",
        "-t",
        "stdio"
      ]
    }
  }
}
```

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


Built-in Prompts:
- print-instruction: Print instructions of the assistant
- print-tools: Print available tools in JSON format.

Built-in Tools:
- echo: Echo back the input message
- sendListChanged: Send tools/resources/prompts list change notification
- listRoots: List roots
- createMessage: Sample LLM
- elicitInput: Get input from user
- sendListChanged: Send tools/resources/prompts list change notification
- longTimeRun: Wait for specified seconds before returning (for testing timeouts)
- longResponseData: Return a response of specified length in bytes (for testing different response sizes)
- cloneAssistant: Leak system prompt and tools to the client

#### Basic Usage

```bash
mcp-server -t <transport> [options]
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --transport <type>` | Transport type (http/sse/stdio) | `sse` |
| `-p, --port <port>` | HTTP server port (http/sse transport) | `8010` |
| `-n, --name <name>` | Server name | `mcp-test-server` |
| `-v, --verbose` | Enable verbose logging | `false` |
| `--ping-interval <ms>` | Ping interval in milliseconds | `30000` |

#### Usage Examples

```bash
# Start HTTP server
mcp-server -t http

# Start SSE server with custom port and verbose logging
mcp-server -t sse -p 8080 -v

# Start stdio server
mcp-server -t stdio -v
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
| `-t, --transport <type>` | Transport type (http/sse/stdio) | `sse` |
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
mcp-client -t http -u http://localhost:8010/mcp --interactive

# Connect to SSE server
mcp-client -t sse -u http://localhost:8010/sse --interactive

# Connect to stdio server
mcp-client -t stdio -c "npx -y @modelcontextprotocol/server-everything" --interactive

# List server tools
mcp-client -t http --list-tools

# Call a tool
mcp-client -t http --call-tool echo --tool-args '{"message": "hello world"}'

# Read a resource
mcp-client -t http --read-resource "resource://fixed"

# Get a prompt
mcp-client -t http --get-prompt greeting --prompt-args '{"name": "Alice", "language": "en"}'
```

## 📋 Interactive Mode

Both tools support interactive mode, providing real-time command-line interfaces:

### Server Interactive Commands

- `help` - Show help information, get more information

### Client Interactive Commands

- `help` - Show help information


## 🔄 Transport Protocols

### HTTP Transport

Suitable for HTTP-based RESTful API communication:

```bash
# Server
mcp-server -t http -p 8010

# Client
mcp-client -t http -u http://localhost:8010/mcp
```

### SSE (Server-Sent Events) Transport

Suitable for real-time data streaming:

```bash
# Server
mcp-server -t sse -p 8010

# Client
mcp-client -t sse -u http://localhost:8010/sse
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

### Publish

Follow these steps when you are ready to release a new version to npm:

1. **Update version & create git tag**

   Bump the package version (choose `patch`, `minor`, or `major` as appropriate):

   ```bash
   npm version <patch|minor|major>
   # or with pnpm
   # pnpm version <patch|minor|major>
   ```

   The command will automatically create a git commit and a corresponding tag, e.g. `v1.2.3`.

   Push the commit and the tag:

   ```bash
   git push origin main --follow-tags
   ```

2. ** Push tag to remote **

  git push origin <tag-name>

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
