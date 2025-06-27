export default {
  tools: [
    {
      name: 'test-tool',
      description: 'A test tool for unit testing',
      parameters: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Test input parameter',
          },
        },
        required: ['input'],
      },
      handler: async (params) => {
        return {
          content: [
            {
              type: 'text',
              text: `Test tool executed with input: ${params.input}`,
            },
          ],
        };
      },
    },
    {
      name: 'echo-tool',
      description: 'Echo tool that returns the input',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to echo',
          },
        },
        required: ['message'],
      },
      handler: async (params) => {
        return {
          content: [
            {
              type: 'text',
              text: params.message,
            },
          ],
        };
      },
    },
  ],
  resources: [
    {
      name: 'test-resource',
      description: 'A test resource for unit testing',
      uri: 'test://resource/data',
      handler: async () => {
        return {
          contents: [
            {
              uri: 'test://resource/data',
              mimeType: 'text/plain',
              text: 'Test resource content',
            },
          ],
        };
      },
    },
    {
      name: 'template-resource',
      description: 'A template resource for testing',
      template: {
        uri: 'test://template/{id}',
        options: {
          name: 'Template Resource',
          description: 'A parameterized resource',
        },
      },
      handler: async (uri) => {
        const id = uri.split('/').pop();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ id, data: `Template data for ${id}` }),
            },
          ],
        };
      },
    },
  ],
  prompts: [
    {
      name: 'test-prompt',
      description: 'A test prompt for unit testing',
      parameters: {
        type: 'object',
        properties: {
          context: {
            type: 'string',
            description: 'Context for the prompt',
          },
        },
        required: ['context'],
      },
      handler: async (params) => {
        return {
          description: 'Test prompt description',
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Test prompt with context: ${params.context}`,
              },
            },
          ],
        };
      },
    },
  ],
};
