import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientActions, type ClientActionsOptions } from '../client-actions';

// Mock the logger
const mockLogger = {
  print: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  flushPrint: vi.fn(),
};

// Mock tsyringe container
vi.mock('tsyringe', () => ({
  container: {
    resolve: vi.fn(() => mockLogger),
  },
}));

// Mock other dependencies
vi.mock('../../client');
vi.mock('../../utils/logger');
vi.mock('reflect-metadata');

describe('ClientActions Pagination Logic', () => {
  let clientActions: ClientActions;
  let mockClient: any;
  let options: ClientActionsOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    options = {
      version: '1.0.0',
      transport: 'http',
      url: 'http://localhost:3000',
      command: '',
      env: '',
      pipeStderr: false,
      headers: '',
      name: 'test',
      interactive: false,
      verbose: false,
      pingInterval: 30,
      toolArgs: '',
      readResource: '',
      getPrompt: '',
      promptArgs: '',
      listTools: false,
      listResources: false,
      listPrompts: false,
      callTool: '',
    };

    mockClient = {
      listTools: vi.fn(),
      listResources: vi.fn(),
      listPrompts: vi.fn(),
      listResourceTemplates: vi.fn(),
    };

    clientActions = new ClientActions(options);
    clientActions.client = mockClient;
  });

  describe('listTools pagination', () => {
    it('should handle single page of tools', async () => {
      const mockTools = [
        { name: 'tool1', description: 'desc1', inputSchema: { properties: {} } },
        { name: 'tool2', description: 'desc2', inputSchema: { properties: {} } },
      ];

      mockClient.listTools.mockResolvedValueOnce({
        tools: mockTools,
        nextCursor: undefined,
      });

      await clientActions.listTools();

      expect(mockClient.listTools).toHaveBeenCalledTimes(1);
      expect(mockClient.listTools).toHaveBeenCalledWith();
      expect(mockLogger.print).toHaveBeenCalledWith('\nAvailable Tools:');
    });

    it('should handle multiple pages of tools', async () => {
      const page1Tools = [{ name: 'tool1', description: 'desc1', inputSchema: { properties: {} } }];
      const page2Tools = [{ name: 'tool2', description: 'desc2', inputSchema: { properties: {} } }];

      mockClient.listTools
        .mockResolvedValueOnce({
          tools: page1Tools,
          nextCursor: 'cursor1',
        })
        .mockResolvedValueOnce({
          tools: page2Tools,
          nextCursor: undefined,
        });

      await clientActions.listTools();

      expect(mockClient.listTools).toHaveBeenCalledTimes(2);
      expect(mockClient.listTools).toHaveBeenNthCalledWith(1);
      expect(mockClient.listTools).toHaveBeenNthCalledWith(2, { cursor: 'cursor1' });
    });

    it('should handle empty tools list', async () => {
      mockClient.listTools.mockResolvedValueOnce({
        tools: [],
        nextCursor: undefined,
      });

      await clientActions.listTools();

      expect(mockClient.listTools).toHaveBeenCalledTimes(1);
      expect(mockLogger.print).toHaveBeenCalledWith('    No tools available.');
    });

    it('should handle pagination error', async () => {
      const error = new Error('Network error');
      mockClient.listTools.mockRejectedValueOnce(error);

      await clientActions.listTools();

      expect(mockClient.listTools).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith('Error listing tools: ' + error);
    });
  });

  describe('listResources pagination', () => {
    it('should handle single page of resources', async () => {
      const mockResources = [
        { name: 'resource1', description: 'desc1' },
        { name: 'resource2', description: 'desc2' },
      ];

      mockClient.listResources.mockResolvedValueOnce({
        resources: mockResources,
        nextCursor: undefined,
      });

      await clientActions.listResources();

      expect(mockClient.listResources).toHaveBeenCalledTimes(1);
      expect(mockClient.listResources).toHaveBeenCalledWith();
    });

    it('should handle multiple pages of resources', async () => {
      const page1Resources = [{ name: 'resource1', description: 'desc1' }];
      const page2Resources = [{ name: 'resource2', description: 'desc2' }];

      mockClient.listResources
        .mockResolvedValueOnce({
          resources: page1Resources,
          nextCursor: 'cursor1',
        })
        .mockResolvedValueOnce({
          resources: page2Resources,
          nextCursor: undefined,
        });

      await clientActions.listResources();

      expect(mockClient.listResources).toHaveBeenCalledTimes(2);
      expect(mockClient.listResources).toHaveBeenNthCalledWith(1);
      expect(mockClient.listResources).toHaveBeenNthCalledWith(2, { cursor: 'cursor1' });
    });

    it('should handle empty resources list', async () => {
      mockClient.listResources.mockResolvedValueOnce({
        resources: [],
        nextCursor: undefined,
      });

      await clientActions.listResources();

      expect(mockLogger.print).toHaveBeenCalledWith('    No resources available.');
    });
  });

  describe('listPrompts pagination', () => {
    it('should handle single page of prompts', async () => {
      const mockPrompts = [
        { name: 'prompt1', description: 'desc1' },
        { name: 'prompt2', description: 'desc2' },
      ];

      mockClient.listPrompts.mockResolvedValueOnce({
        prompts: mockPrompts,
        nextCursor: undefined,
      });

      await clientActions.listPrompts();

      expect(mockClient.listPrompts).toHaveBeenCalledTimes(1);
      expect(mockClient.listPrompts).toHaveBeenCalledWith();
    });

    it('should handle multiple pages of prompts', async () => {
      const page1Prompts = [{ name: 'prompt1', description: 'desc1' }];
      const page2Prompts = [{ name: 'prompt2', description: 'desc2' }];
      const page3Prompts = [{ name: 'prompt3', description: 'desc3' }];

      mockClient.listPrompts
        .mockResolvedValueOnce({
          prompts: page1Prompts,
          nextCursor: 'cursor1',
        })
        .mockResolvedValueOnce({
          prompts: page2Prompts,
          nextCursor: 'cursor2',
        })
        .mockResolvedValueOnce({
          prompts: page3Prompts,
          nextCursor: undefined,
        });

      await clientActions.listPrompts();

      expect(mockClient.listPrompts).toHaveBeenCalledTimes(3);
      expect(mockClient.listPrompts).toHaveBeenNthCalledWith(1);
      expect(mockClient.listPrompts).toHaveBeenNthCalledWith(2, { cursor: 'cursor1' });
      expect(mockClient.listPrompts).toHaveBeenNthCalledWith(3, { cursor: 'cursor2' });
    });

    it('should handle empty prompts list', async () => {
      mockClient.listPrompts.mockResolvedValueOnce({
        prompts: [],
        nextCursor: undefined,
      });

      await clientActions.listPrompts();

      expect(mockLogger.print).toHaveBeenCalledWith('    No prompts available.');
    });
  });

  describe('listResourceTemplates pagination', () => {
    it('should handle single page of resource templates', async () => {
      const mockTemplates = [{ name: 'template1' }, { name: 'template2' }];

      mockClient.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: mockTemplates,
        nextCursor: undefined,
      });

      await clientActions.listResourceTemplates();

      expect(mockClient.listResourceTemplates).toHaveBeenCalledTimes(1);
      expect(mockClient.listResourceTemplates).toHaveBeenCalledWith();
    });

    it('should handle multiple pages of resource templates', async () => {
      const page1Templates = [{ name: 'template1' }];
      const page2Templates = [{ name: 'template2' }];

      mockClient.listResourceTemplates
        .mockResolvedValueOnce({
          resourceTemplates: page1Templates,
          nextCursor: 'cursor1',
        })
        .mockResolvedValueOnce({
          resourceTemplates: page2Templates,
          nextCursor: undefined,
        });

      await clientActions.listResourceTemplates();

      expect(mockClient.listResourceTemplates).toHaveBeenCalledTimes(2);
      expect(mockClient.listResourceTemplates).toHaveBeenNthCalledWith(1);
      expect(mockClient.listResourceTemplates).toHaveBeenNthCalledWith(2, { cursor: 'cursor1' });
    });

    it('should handle empty templates list', async () => {
      mockClient.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [],
        nextCursor: undefined,
      });

      await clientActions.listResourceTemplates();

      expect(mockLogger.print).toHaveBeenCalledWith('    No resource templates available.');
    });
  });

  describe('pagination edge cases', () => {
    it('should handle null nextCursor in tools', async () => {
      mockClient.listTools.mockResolvedValueOnce({
        tools: [{ name: 'tool1', description: 'desc1', inputSchema: { properties: {} } }],
        nextCursor: null,
      });

      await clientActions.listTools();

      expect(mockClient.listTools).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined nextCursor in resources', async () => {
      mockClient.listResources.mockResolvedValueOnce({
        resources: [{ name: 'resource1', description: 'desc1' }],
        nextCursor: undefined,
      });

      await clientActions.listResources();

      expect(mockClient.listResources).toHaveBeenCalledTimes(1);
    });

    it('should handle error during pagination continuation', async () => {
      mockClient.listPrompts
        .mockResolvedValueOnce({
          prompts: [{ name: 'prompt1', description: 'desc1' }],
          nextCursor: 'cursor1',
        })
        .mockRejectedValueOnce(new Error('Pagination error'));

      await clientActions.listPrompts();

      expect(mockClient.listPrompts).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error listing prompts: Error: Pagination error',
      );
    });

    it('should handle empty string as nextCursor', async () => {
      mockClient.listResourceTemplates.mockResolvedValueOnce({
        resourceTemplates: [{ name: 'template1' }],
        nextCursor: '',
      });

      await clientActions.listResourceTemplates();

      expect(mockClient.listResourceTemplates).toHaveBeenCalledTimes(1);
    });
  });

  describe('pagination result aggregation', () => {
    it('should correctly aggregate tools from multiple pages', async () => {
      const page1Tools = [
        {
          name: 'tool1',
          description: 'desc1',
          inputSchema: { properties: { param1: { type: 'string' } } },
        },
      ];
      const page2Tools = [
        {
          name: 'tool2',
          description: 'desc2',
          inputSchema: { properties: { param2: { type: 'number' } } },
        },
      ];

      mockClient.listTools
        .mockResolvedValueOnce({
          tools: page1Tools,
          nextCursor: 'cursor1',
        })
        .mockResolvedValueOnce({
          tools: page2Tools,
          nextCursor: undefined,
        });

      await clientActions.listTools();

      // Verify both tools are processed
      expect(mockLogger.print).toHaveBeenCalledWith('    tool1');
      expect(mockLogger.print).toHaveBeenCalledWith('    tool2');
      expect(mockLogger.print).toHaveBeenCalledWith('        Arguments:');
      expect(mockLogger.print).toHaveBeenCalledWith('          param1: string');
      expect(mockLogger.print).toHaveBeenCalledWith('          param2: number');
    });

    it('should correctly aggregate resources from multiple pages', async () => {
      const page1Resources = [
        { name: 'file1.txt', description: 'First file', uri: 'file://file1.txt' },
      ];
      const page2Resources = [
        { name: 'file2.txt', description: 'Second file', uri: 'file://file2.txt' },
      ];

      mockClient.listResources
        .mockResolvedValueOnce({
          resources: page1Resources,
          nextCursor: 'cursor1',
        })
        .mockResolvedValueOnce({
          resources: page2Resources,
          nextCursor: undefined,
        });

      await clientActions.listResources();

      // Verify both resources are processed
      expect(mockLogger.print).toHaveBeenCalledWith('\n    file1.txt');
      expect(mockLogger.print).toHaveBeenCalledWith('\n    file2.txt');
      expect(mockLogger.print).toHaveBeenCalledWith('      URI: file://file1.txt');
      expect(mockLogger.print).toHaveBeenCalledWith('      URI: file://file2.txt');
    });
  });
});
