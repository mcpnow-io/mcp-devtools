import chalk from 'chalk';
import { singleton } from 'tsyringe';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  PROTOCOL = 'protocol',
}

export interface LoggerOptions {
  name?: string;
  transport: 'http' | 'sse' | 'stdio';
  verbose?: boolean;
  prompt?: string;
  promptColor?: (text: string) => string;
}

export interface ILogger {
  debug(message: string, sessionId?: string, succinct?: boolean): void;
  info(message: string, sessionId?: string, succinct?: boolean): void;
  warn(message: string, sessionId?: string, succinct?: boolean): void;
  error(message: string, sessionId?: string, succinct?: boolean): void;
  protocol(message: string, sessionId?: string, succinct?: boolean): void;
  print(message: string): void;
  flushPrint(): void;
  logProtocolMessage(direction: 'incoming' | 'outgoing', sessionId: string, message: any): void;
}

@singleton()
export class Logger implements ILogger {
  private options: LoggerOptions;
  private printBuffer: string[] = [];
  private coloredPrompt: string;

  constructor(options: LoggerOptions) {
    this.options = options;
    const prompt = options.prompt || 'mcp>';
    this.coloredPrompt = options.promptColor ? options.promptColor(prompt) : chalk.cyan(prompt);
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    sessionId?: string,
    succinct: boolean = false,
  ): string {
    if (succinct) {
      return message;
    }

    const timestamp = chalk.gray(`[${new Date().toISOString()}]`);
    const levelColor = {
      [LogLevel.DEBUG]: chalk.gray,
      [LogLevel.INFO]: chalk.blue,
      [LogLevel.WARN]: chalk.yellow,
      [LogLevel.ERROR]: chalk.red,
      [LogLevel.PROTOCOL]: chalk.magenta,
    }[level];

    const prefix = levelColor(`[${level.toUpperCase()}]`);
    const sessionPrefix = sessionId ? chalk.yellow(`(${sessionId})`) : '';

    return `${timestamp} ${this.options.name ? `${this.options.name} ` : ' '}${prefix}${sessionPrefix ? ' ' + sessionPrefix : ''} ${message}`;
  }

  private logMessage(
    level: LogLevel,
    message: string,
    sessionId?: string,
    succinct: boolean = false,
  ): void {
    const formattedMessage = this.formatMessage(level, message, sessionId, succinct);
    if (this.options.transport === 'stdio') {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  debug(message: string, sessionId?: string, succinct: boolean = false): void {
    if (!this.options.verbose) {
      return;
    }
    this.logMessage(LogLevel.DEBUG, message, sessionId, succinct);
  }

  info(message: string, sessionId?: string, succinct: boolean = false): void {
    this.logMessage(LogLevel.INFO, message, sessionId, succinct);
  }

  warn(message: string, sessionId?: string, succinct: boolean = false): void {
    this.logMessage(LogLevel.WARN, message, sessionId, succinct);
  }

  error(message: string, sessionId?: string, succinct: boolean = false): void {
    this.logMessage(LogLevel.ERROR, message, sessionId, succinct);
  }

  protocol(message: string, sessionId?: string, succinct: boolean = false): void {
    if (!this.options.verbose) {
      return;
    }
    this.logMessage(LogLevel.PROTOCOL, message, sessionId, succinct);
  }

  print(message: string): void {
    const lines = message.split('\n').filter((line) => line.trim());
    this.printBuffer.push(...lines);
  }

  flushPrint(): void {
    if (this.printBuffer.length > 0) {
      if (this.options.transport === 'stdio') {
        console.error(this.printBuffer.join('\n'));
      } else {
        console.log(this.printBuffer.join('\n'));
        process.stdout.write(this.coloredPrompt);
      }
      this.printBuffer = [];
    }
  }

  logProtocolMessage(direction: 'incoming' | 'outgoing', sessionId: string, message: any): void {
    if (!this.options.verbose) return;

    const arrow = direction === 'incoming' ? '←' : '→';
    const prefix = direction === 'incoming' ? 'RECV' : 'SEND';

    this.protocol(`${arrow} ${prefix}\n${chalk.cyan(JSON.stringify(message, null, 2))}`, sessionId);
  }
}

// Backward compatibility: keep original createLogger function
export function createLogger(options: LoggerOptions): ILogger {
  return new Logger(options);
}
