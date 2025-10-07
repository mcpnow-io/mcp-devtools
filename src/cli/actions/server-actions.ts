import * as readline from "readline";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  McpServer,
  ReadResourceCallback,
  ReadResourceTemplateCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import chalk from "chalk";

import type { DevServer } from "@/server";
import type { Logger } from "@/utils/logger";
import { container, inject, injectable } from "tsyringe";

const SERVER_PROMPT = "mcp-server> ";

// CLI specific options interface
export interface CLIServerOptions {
  name: string;
  version: string;
  description: string;
  transport: string;
  port: number;
  interactive: boolean;
  verbose: boolean;
  pingInterval: string;
}

export const serverCommands = {
  help: {
    desc: "Show this help message",
    usage: "help",
    example: null,
  },
  info: {
    desc: "Show server and client info",
    usage: "info",
    example: null,
  },
  "list-sessions": {
    desc: "List all active sessions",
    usage: "list-sessions",
    example: null,
  },
  "switch-session": {
    desc: "Switch to a different session by ID",
    usage: "switch-session <sessionId>",
    example: "switch-session abc123",
  },
  "list-tools": {
    desc: "List registered tools",
    usage: "list-tools",
    example: null,
  },
  "list-resources": {
    desc: "List registered resources",
    usage: "list-resources",
    example: null,
  },
  "list-prompts": {
    desc: "List registered prompts",
    usage: "list-prompts",
    example: null,
  },
  ping: {
    desc: "Send ping to current session client",
    usage: "ping",
    example: null,
  },
  sample: {
    desc: "Send sampling/createMessage request",
    usage: "sample [message]",
    example: "sample Hello, world!",
  },
  roots: {
    desc: "Send roots/list request",
    usage: "roots",
    example: null,
  },
  "tools-change": {
    desc: "Send tools list changed notification",
    usage: "tools-change",
    example: null,
  },
  "resources-change": {
    desc: "Send resources list changed notification",
    usage: "resources-change",
    example: null,
  },
  "prompts-change": {
    desc: "Send prompts list changed notification",
    usage: "prompts-change",
    example: null,
  },
  "resource-update": {
    desc: "Send resource updated notification",
    usage: "resource-update <uri>",
    example: "resource-update file://README.md",
  },
  log: {
    desc: "Send log message to clients",
    usage: "log [level] <message>",
    example: ["log info Hello", "log error Something went wrong"],
  },
  "reload-config": {
    desc: "Reload configuration file",
    usage: "reload-config",
    example: null,
  },
  exit: {
    desc: "Exit the server",
    usage: "exit",
    example: null,
  },
} as const;

function getCommandCompletions(line: string): string[] {
  const commandNames = Object.keys(serverCommands);
  if (!line) {
    return commandNames;
  }
  return commandNames.filter((cmd) => cmd.startsWith(line));
}

export const allSupportedServerCommands = Object.keys(serverCommands);

function getRegisteredTools(server: McpServer): string[] {
  const tools = (server as any)["_registeredTools"] as Record<string, any>;
  return Object.keys(tools || {});
}

function getRegisteredResources(server: McpServer): string[] {
  const resources = (server as any)["_registeredResources"] as Record<
    string,
    any
  >;
  return Object.keys(resources || {});
}

function getRegisteredPrompts(server: McpServer): string[] {
  const prompts = (server as any)["_registeredPrompts"] as Record<string, any>;
  return Object.keys(prompts || {});
}

function getConfigTools(config: any): string[] {
  return config.tools?.map((t: any) => t.name) || [];
}

function getConfigResources(config: any): string[] {
  return config.resources?.map((r: any) => r.name) || [];
}

function getConfigPrompts(config: any): string[] {
  return config.prompts?.map((p: any) => p.name) || [];
}

@injectable()
export class ServerActions {
  public isInteractiveMode = false;
  private currentSessionId?: string;
  private currentConfig: any = { tools: [], resources: [], prompts: [] };

  constructor(
    @inject("CLIServerOptions") private options: CLIServerOptions,
    @inject("Logger") private logger: Logger,
    @inject("Server") private server: DevServer
  ) {}

  async listSessions() {
    const sessionIds = this.server.sessionManager.listServers();
    if (sessionIds.length === 0) {
      this.logger.info("No active sessions");
      return;
    }

    this.logger.print("Active sessions:");
    sessionIds.forEach((sessionId, index) => {
      const session = this.server.sessionManager.getSession(sessionId);
      const status = session?.transport ? "connected" : "disconnected";
      const current = sessionId === this.currentSessionId ? " (current)" : "";
      this.logger.print(`    ${index}: ${sessionId} ${status}${current}`);
    });
    this.logger.flushPrint();
  }

  async switchSession(sessionId: string) {
    if (!this.server.sessionManager.hasSession(sessionId)) {
      this.logger.error(`Session ${sessionId} not found`);
      return;
    }
    this.currentSessionId = sessionId;
    this.logger.info(`Switched to session ${sessionId}`);
  }

  async showInfo() {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    const impl = currentSession.server.server.getClientVersion();
    if (impl) {
      this.logger.print("Client info:");
      this.logger.print(`    Client name: ${impl?.name}`);
      this.logger.print(`    Client version: ${impl?.version}`);
      this.logger.print(
        `    Client capabilities: ${JSON.stringify(
          currentSession.server.server.getClientCapabilities()
        )}`
      );
    } else {
      this.logger.print("No client info found");
    }
    this.logger.print(
      `    Client sessionId: ${currentSession.server.server.transport?.sessionId}`
    );
    this.logger.flushPrint();
  }

  async listTools() {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    this.logger.print("Registered tools:");
    const tools = (currentSession.server as any)["_registeredTools"] as Record<
      string,
      { description?: string }
    >;
    Object.entries(tools || {}).forEach(([name, tool]) => {
      this.logger.print(
        `    ${name}${tool.description ? ": " + tool.description : ""}`
      );
    });
    this.logger.flushPrint();
  }

  async listResources() {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    this.logger.print("Registered resources:");
    const resources = (currentSession.server as any)[
      "_registeredResources"
    ] as Record<string, { name: string; metadata?: { description?: string } }>;
    Object.entries(resources || {}).forEach(([uri, resource]) => {
      this.logger.print(
        `    ${resource.name}${
          resource.metadata?.description
            ? ": " + resource.metadata.description
            : ""
        }`
      );
    });
    this.logger.flushPrint();
  }

  async listPrompts() {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    this.logger.print("Registered prompts:");
    const prompts = (currentSession.server as any)[
      "_registeredPrompts"
    ] as Record<string, { description?: string }>;
    Object.entries(prompts || {}).forEach(([name, prompt]) => {
      this.logger.print(
        `    ${name}${prompt.description ? ": " + prompt.description : ""}`
      );
    });
    this.logger.flushPrint();
  }

  async ping() {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    try {
      await currentSession.server.server.ping();
      this.logger.info("Ping sent to client");
    } catch (error) {
      this.logger.error(
        "Error sending ping:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async sample(message?: string) {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    try {
      await currentSession.server.server.createMessage({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: message || "Hello, world!",
            },
          },
        ],
        maxTokens: 1000,
      });
      this.logger.info("Sampling message sent");
    } catch (error) {
      this.logger.error(
        "Error sending sampling message:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async roots() {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    try {
      await currentSession.server.server.listRoots();
      this.logger.info("Roots list request sent");
    } catch (error) {
      this.logger.error(
        "Error sending roots list request:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async sendToolsChange() {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    try {
      await currentSession.server.server.sendToolListChanged();
      this.logger.info("Tool list change notification sent");
    } catch (error) {
      this.logger.error(
        "Error sending tool list change:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async sendResourcesChange() {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    try {
      await currentSession.server.server.sendResourceListChanged();
      this.logger.info("Resource list change notification sent");
    } catch (error) {
      this.logger.error(
        "Error sending resource list change:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async sendPromptsChange() {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    try {
      await currentSession.server.server.sendPromptListChanged();
      this.logger.info("Prompt list change notification sent");
    } catch (error) {
      this.logger.error(
        "Error sending prompt list change:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async sendResourceUpdate(uri: string) {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    try {
      await currentSession.server.server.sendResourceUpdated({ uri });
      this.logger.info(`Resource '${uri}' update notification sent`);
    } catch (error) {
      this.logger.error(
        "Error sending resource update:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async sendLog(level: string = "info", message: string) {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    try {
      const validLevels = [
        "info",
        "error",
        "debug",
        "notice",
        "warning",
        "critical",
        "alert",
        "emergency",
      ] as const;
      const logLevel = (validLevels as readonly string[]).includes(level)
        ? level
        : "info";

      await currentSession.server.server.sendLoggingMessage({
        level: logLevel as any,
        message: message || "Hello, world!",
      });
      this.logger.info("Log message sent");
    } catch (error) {
      this.logger.error(
        "Error sending log message:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private getCurrentSession() {
    if (!this.currentSessionId) {
      // If no session selected, pick first if available
      const sessionIds = this.server.sessionManager.listServers();
      if (sessionIds.length > 0) {
        this.currentSessionId = sessionIds[0];
        this.logger.info(`Auto-selected session: ${this.currentSessionId}`);
      } else {
        return null;
      }
    }
    return this.server.sessionManager.getSession(this.currentSessionId);
  }

  runInteractiveMode() {
    this.isInteractiveMode = true;
    this.logger.info(
      'Entering interactive mode. Type "help" for available commands.',
      undefined,
      true
    );
    this.logger.info('Press Ctrl+D or type "exit" to quit', undefined, true);

    return this._runInteractiveMode();
  }

  private _runInteractiveMode() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan(SERVER_PROMPT),
      completer: (line: string) => {
        const words = line.split(" ");
        const lastWord = words[words.length - 1];
        const command = words[0];

        // Complete base commands
        if (words.length === 1) {
          const completions = getCommandCompletions(line);
          return [completions, line];
        }

        // Complete log levels
        if (command === "log" && words.length === 2) {
          const levels = [
            "info",
            "error",
            "debug",
            "notice",
            "warning",
            "critical",
            "alert",
            "emergency",
          ];
          return [
            levels.filter((level) => level.startsWith(lastWord)),
            lastWord,
          ];
        }

        return [[], line];
      },
    });

    let isExiting = false;

    // Handle clean exit
    const cleanExit = async () => {
      if (isExiting) return;
      isExiting = true;

      this.logger.info("Exiting interactive mode", undefined, true);
      rl.close();
      try {
        this.server.close();
        process.exit(0);
      } catch (error) {
        this.logger.error(`Error during cleanup: ${error}`);
        process.exit(1);
      }
    };

    // Add signal handlers
    process.on("SIGINT", async () => {
      this.logger.info("Received SIGINT. Cleaning up...", undefined, true);
      await cleanExit();
    });

    process.on("SIGTERM", async () => {
      this.logger.info("Received SIGTERM. Cleaning up...", undefined, true);
      await cleanExit();
    });

    rl.prompt();

    rl.on("line", async (line) => {
      const [_command, ...args] = line.trim().split(/\s+/);
      const command = _command as keyof typeof serverCommands;
      try {
        switch (command) {
          case "help": {
            this.logger.print("Available commands:");
            Object.entries(serverCommands).forEach(([cmd, info]) => {
              this.logger.print(`    ${cmd.padEnd(20)} ${info.desc}`);
            });
            this.logger.flushPrint();
            break;
          }

          case "info": {
            await this.showInfo();
            break;
          }

          case "list-sessions": {
            await this.listSessions();
            break;
          }

          case "switch-session": {
            if (!args[0]) {
              this.logger.error("Error: Session ID required");
              break;
            }
            await this.switchSession(args[0]);
            break;
          }

          case "list-tools": {
            await this.listTools();
            break;
          }

          case "list-resources": {
            await this.listResources();
            break;
          }

          case "list-prompts": {
            await this.listPrompts();
            break;
          }

          case "ping": {
            await this.ping();
            break;
          }

          case "sample": {
            await this.sample(args.join(" "));
            break;
          }

          case "roots": {
            await this.roots();
            break;
          }

          case "tools-change": {
            await this.sendToolsChange();
            break;
          }

          case "resources-change": {
            await this.sendResourcesChange();
            break;
          }

          case "prompts-change": {
            await this.sendPromptsChange();
            break;
          }

          case "resource-update": {
            if (!args[0]) {
              this.logger.error("Error: Resource URI required");
              break;
            }
            await this.sendResourceUpdate(args[0]);
            break;
          }

          case "log": {
            const level = args[0] || "info";
            const message = args.slice(1).join(" ") || "Hello, world!";
            await this.sendLog(level, message);
            break;
          }

          case "exit": {
            await cleanExit();
            return;
          }

          default: {
            if (command) {
              this.logger.warn(`Unknown command: ${command}`);
              this.logger.info('Type "help" for available commands');
            }
          }
        }
      } catch (error) {
        this.logger.error("Error executing command: " + error);
      }

      rl.prompt();
    });

    // Handle Ctrl+D (EOF)
    rl.on("close", async () => {
      await cleanExit();
    });
  }
}
