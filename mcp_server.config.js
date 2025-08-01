import { z } from 'zod';

/** @type {import('@mcp-now/mcp-devtools/dist/src/utils/config.d.ts').ServerConfig} */
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
          case '+':
            result = a + b;
            break;
          case '-':
            result = a - b;
            break;
          case '*':
            result = a * b;
            break;
          case '/':
            result = a / b;
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
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
    {
      name: 'echo',
      description: 'Echo back the input message',
      parameters: {
        message: z.string().describe('Message to echo'),
      },
      handler: async (args, extra) => {
        return {
          content: [
            {
              type: 'text',
              text: `Echo: ${args.message}`,
            },
          ],
        };
      },
    },
    {
      name: 'long-time-run',
      description: 'Wait for specified seconds before returning (for testing timeouts)',
      parameters: {
        timeSecs: z.number().describe('Time to wait in seconds'),
      },
      handler: async (args, extra) => {
        const { timeSecs } = args;
        
        // Wait for the specified time
        await new Promise(resolve => setTimeout(resolve, timeSecs * 1000));
        
        return {
          content: [
            {
              type: 'text',
              text: `Waited for ${timeSecs} seconds`,
            },
          ],
        };
      },
    },
    {
      name: 'long-response',
      description: 'Return a response of specified length in bytes (for testing different response sizes)',
      parameters: {
        length: z.number().describe('Response length in bytes'),
      },
      handler: async (args, extra) => {
        const { length } = args;
        
        // Generate a response of the specified length
        // Using a pattern to make it somewhat readable
        const pattern = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let response = '';
        
        while (response.length < length) {
          response += pattern;
        }
        
        // Trim to exact length
        response = response.substring(0, length);
        
        return {
          content: [
            {
              type: 'text',
              text: response,
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
    {
      name: 'memory',
      description: 'In-memory data storage',
      uri: 'memory://data',
      handler: async (uri) => {
        return {
          contents: [
            {
              uri: uri,
              mimeType: 'application/json',
              text: JSON.stringify({ data: 'sample memory data' }),
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
    {
      name: 'code-review',
      description: 'Generate a code review prompt',
      parameters: {
        language: z.string().describe('Programming language'),
        code: z.string().describe('Code to review'),
      },
      handler: async (args) => {
        return {
          description: `Code review for ${args.language} code`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Please review this ${args.language} code:\n\n\`\`\`${args.language}\n${args.code}\n\`\`\`\n\nProvide feedback on code quality, potential issues, and suggestions for improvement.`,
              },
            },
          ],
        };
      },
    },
  ],
};
