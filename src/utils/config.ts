import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

export const ToolConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.any()),
  handler: z.function().args(z.any()).returns(z.promise(z.any())),
});
export type ToolConfig = z.infer<typeof ToolConfigSchema>;

export const ResourceConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  uri: z.string().optional(),
  template: z
    .object({
      uri: z.string(),
      options: z.object({
        list: z.function().optional(),
        complete: z.record(z.function()).optional(),
      }),
    })
    .optional(),
  handler: z.function().args(z.any()).returns(z.promise(z.any())),
});
export type ResourceConfig = z.infer<typeof ResourceConfigSchema>;

export const PromptConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.any()),
  handler: z.function().args(z.any()).returns(z.promise(z.any())),
});
export type PromptConfig = z.infer<typeof PromptConfigSchema>;

export const ServerConfigSchema = z.object({
  tools: z.array(ToolConfigSchema),
  resources: z.array(ResourceConfigSchema),
  prompts: z.array(PromptConfigSchema),
});
export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export const loadMcpServerDefinition = async (configPath: string): Promise<ServerConfig> => {
  const absPath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Config file ${absPath} not found`);
  }
  try {
    const config = await import(absPath);
    return ServerConfigSchema.parse(config.default);
  } catch (e) {
    throw new Error(`Error importing config file ${configPath}: ${e}`);
  }
};
