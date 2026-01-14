import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { BitbucketClient } from './clients/bitbucket-client.js';

// Repository tools
import {
  readRepositoryTool,
  readBranchTool,
  readCommitTool,
  readFileTool,
  searchCodeTool,
  handleReadRepository,
  handleReadBranch,
  handleReadCommit,
  handleReadFile,
  handleSearchCode,
} from './tools/repository.js';

// Pull Request tools
import {
  listPullRequestsTool,
  readPullRequestTool,
  createPullRequestTool,
  updatePullRequestTool,
  handleListPullRequests,
  handleReadPullRequest,
  handleCreatePullRequest,
  handleUpdatePullRequest,
} from './tools/pull-request.js';

// Branch tools
import {
  createBranchTool,
  deleteBranchTool,
  handleCreateBranch,
  handleDeleteBranch,
} from './tools/branch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env') });

type Content = { type: 'text'; text: string };
type ToolResponse = { content: Content[] };

const server = new Server(
  {
    name: 'bitbucket-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

function buildClient() {
  const email = requireEnv('ATLASSIAN_EMAIL');
  const apiToken = requireEnv('ATLASSIAN_API_TOKEN');

  return new BitbucketClient({ email, apiToken });
}

async function start() {
  try {
    const client = buildClient();
    const tools = [
      // Repository tools
      readRepositoryTool,
      readBranchTool,
      readCommitTool,
      readFileTool,
      searchCodeTool,
      // Pull Request tools
      listPullRequestsTool,
      readPullRequestTool,
      createPullRequestTool,
      updatePullRequestTool,
      // Branch tools
      createBranchTool,
      deleteBranchTool,
    ];

    const toolHandlers: Record<string, (args: unknown) => Promise<ToolResponse>> = {
      // Repository handlers
      read_repository: (args) => handleReadRepository(client, args),
      read_branch: (args) => handleReadBranch(client, args),
      read_commit: (args) => handleReadCommit(client, args),
      read_file: (args) => handleReadFile(client, args),
      search_code: (args) => handleSearchCode(client, args),
      // Pull Request handlers
      list_pull_requests: (args) => handleListPullRequests(client, args),
      read_pull_request: (args) => handleReadPullRequest(client, args),
      create_pull_request: (args) => handleCreatePullRequest(client, args),
      update_pull_request: (args) => handleUpdatePullRequest(client, args),
      // Branch handlers
      create_branch: (args) => handleCreateBranch(client, args),
      delete_branch: (args) => handleDeleteBranch(client, args),
    };

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const handler = toolHandlers[name];
      if (!handler) {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
      try {
        return await handler(args);
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        throw new McpError(ErrorCode.InternalError, error?.message ?? 'Unknown tool error');
      }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Bitbucket MCP server ready (stdio)');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

start();

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

