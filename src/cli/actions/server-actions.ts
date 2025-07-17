import * as readline from "readline";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  McpServer,
  ReadResourceCallback,
  ReadResourceTemplateCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import chalk from "chalk";

import type { DevServer } from "@/server";
import { loadMcpServerDefinition } from "@/utils/config.js";
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
  "add-tool": {
    desc: "Add a tool defined in config",
    usage: "add-tool <name>",
    example: "add-tool calculator",
  },
  "remove-tool": {
    desc: "Remove a tool by name",
    usage: "remove-tool <name>",
    example: "remove-tool calculator",
  },
  "list-resources": {
    desc: "List registered resources",
    usage: "list-resources",
    example: null,
  },
  "add-resource": {
    desc: "Add a resource defined in config",
    usage: "add-resource <name>",
    example: "add-resource file-system",
  },
  "remove-resource": {
    desc: "Remove a resource by name",
    usage: "remove-resource <name>",
    example: "remove-resource file-system",
  },
  "update-resource": {
    desc: "Notify clients that a resource has been updated",
    usage: "update-resource <uri>",
    example: "update-resource file://README.md",
  },
  "list-prompts": {
    desc: "List registered prompts",
    usage: "list-prompts",
    example: null,
  },
  "add-prompt": {
    desc: "Add a prompt defined in config",
    usage: "add-prompt <name>",
    example: "add-prompt template",
  },
  "remove-prompt": {
    desc: "Remove a prompt by name",
    usage: "remove-prompt <name>",
    example: "remove-prompt template",
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

  private async loadConfig() {
    try {
      this.currentConfig = await loadMcpServerDefinition();
      this.logger.info(`📄 Configuration loaded successfully`);
      container.register("ServerConfig", { useValue: this.currentConfig });
    } catch (error) {
      this.logger.error(`❌ Failed to load config: ${error}`);
      this.currentConfig = { tools: [], resources: [], prompts: [] };
    }
  }

  private async reloadConfig() {
    await this.loadConfig();
    this.logger.info("🔄 Configuration reloaded successfully");
  }

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

  async addTool(name: string) {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    const toolConfig = this.currentConfig.tools?.find(
      (t: any) => t.name === name
    );
    if (!toolConfig) {
      this.logger.error(`Tool '${name}' not found in config file`);
      return;
    }

    currentSession.server.tool(
      toolConfig.name,
      toolConfig.description,
      toolConfig.parameters,
      toolConfig.handler
    );
    await currentSession.server.server.sendToolListChanged();
    this.logger.info(`Tool '${name}' added from config and clients notified`);
  }

  async removeTool(name: string) {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    delete (currentSession.server as any)["_registeredTools"][name];
    await currentSession.server.server.sendToolListChanged();
    this.logger.info(`Tool '${name}' removed and clients notified`);
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

  async addResource(name: string) {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    const resourceConfig = this.currentConfig.resources?.find(
      (r: any) => r.name === name
    );
    if (!resourceConfig) {
      this.logger.error(`Resource '${name}' not found in config file`);
      return;
    }

    if (resourceConfig.template) {
      const template = new ResourceTemplate(
        resourceConfig.template.uri,
        resourceConfig.template.options as any
      );
      currentSession.server.resource(
        resourceConfig.name,
        template,
        { description: resourceConfig.description },
        resourceConfig.handler as ReadResourceTemplateCallback
      );
    } else if (resourceConfig.uri) {
      currentSession.server.resource(
        resourceConfig.name,
        resourceConfig.uri,
        { description: resourceConfig.description },
        resourceConfig.handler as ReadResourceCallback
      );
    }
    await currentSession.server.server.sendResourceListChanged();
    this.logger.info(
      `Resource '${name}' added from config and clients notified`
    );
  }

  async removeResource(name: string) {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    delete (currentSession.server as any)["_registeredResources"][name];
    await currentSession.server.server.sendResourceListChanged();
    this.logger.info(`Resource '${name}' removed and clients notified`);
  }

  async updateResource(uri: string) {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    await currentSession.server.server.sendResourceUpdated({ uri });
    this.logger.info(`Resource '${uri}' update notification sent`);
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

  async addPrompt(name: string) {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    const promptConfig = this.currentConfig.prompts?.find(
      (p: any) => p.name === name
    );
    if (!promptConfig) {
      this.logger.error(`Prompt '${name}' not found in config file`);
      return;
    }

    currentSession.server.prompt(
      promptConfig.name,
      promptConfig.description,
      promptConfig.parameters,
      promptConfig.handler
    );
    await currentSession.server.server.sendPromptListChanged();
    this.logger.info(`Prompt '${name}' added from config and clients notified`);
  }

  async removePrompt(name: string) {
    const currentSession = this.getCurrentSession();
    if (!currentSession) {
      this.logger.error("No current session selected");
      return;
    }

    delete (currentSession.server as any)["_registeredPrompts"][name];
    await currentSession.server.server.sendPromptListChanged();
    this.logger.info(`Prompt '${name}' removed and clients notified`);
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

        // Complete tool names
        if (
          (command === "add-tool" || command === "remove-tool") &&
          words.length === 2
        ) {
          let completions: string[] = [];
          const currentSession = this.getCurrentSession();
          if (currentSession) {
            if (command === "add-tool") {
              completions = getConfigTools(this.currentConfig).filter(
                (name) =>
                  !getRegisteredTools(currentSession.server).includes(name)
              );
            } else {
              completions = getRegisteredTools(currentSession.server);
            }
          }
          return [
            completions.filter((name) => name.startsWith(lastWord)),
            lastWord,
          ];
        }

        // Complete resource names
        if (
          (command === "add-resource" ||
            command === "remove-resource" ||
            command === "update-resource" ||
            command === "resource-update") &&
          words.length === 2
        ) {
          let completions: string[] = [];
          const currentSession = this.getCurrentSession();
          if (currentSession) {
            if (command === "add-resource") {
              completions = getConfigResources(this.currentConfig).filter(
                (name) =>
                  !getRegisteredResources(currentSession.server).includes(name)
              );
            } else {
              completions = getRegisteredResources(currentSession.server);
            }
          }
          return [
            completions.filter((name) => name.startsWith(lastWord)),
            lastWord,
          ];
        }

        // Complete prompt names
        if (
          (command === "add-prompt" || command === "remove-prompt") &&
          words.length === 2
        ) {
          let completions: string[] = [];
          const currentSession = this.getCurrentSession();
          if (currentSession) {
            if (command === "add-prompt") {
              completions = getConfigPrompts(this.currentConfig).filter(
                (name) =>
                  !getRegisteredPrompts(currentSession.server).includes(name)
              );
            } else {
              completions = getRegisteredPrompts(currentSession.server);
            }
          }
          return [
            completions.filter((name) => name.startsWith(lastWord)),
            lastWord,
          ];
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

          case "add-tool": {
            if (!args[0]) {
              this.logger.error("Error: Tool name required");
              break;
            }
            await this.addTool(args[0]);
            break;
          }

          case "remove-tool": {
            if (!args[0]) {
              this.logger.error("Error: Tool name required");
              break;
            }
            await this.removeTool(args[0]);
            break;
          }

          case "list-resources": {
            await this.listResources();
            break;
          }

          case "add-resource": {
            if (!args[0]) {
              this.logger.error("Error: Resource name required");
              break;
            }
            await this.addResource(args[0]);
            break;
          }

          case "remove-resource": {
            if (!args[0]) {
              this.logger.error("Error: Resource name required");
              break;
            }
            await this.removeResource(args[0]);
            break;
          }

          case "update-resource": {
            if (!args[0]) {
              this.logger.error("Error: Resource URI required");
              break;
            }
            await this.updateResource(args[0]);
            break;
          }

          case "list-prompts": {
            await this.listPrompts();
            break;
          }

          case "add-prompt": {
            if (!args[0]) {
              this.logger.error("Error: Prompt name required");
              break;
            }
            await this.addPrompt(args[0]);
            break;
          }

          case "remove-prompt": {
            if (!args[0]) {
              this.logger.error("Error: Prompt name required");
              break;
            }
            await this.removePrompt(args[0]);
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

          case "reload-config": {
            await this.reloadConfig();
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
