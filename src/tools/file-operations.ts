import z from 'zod';
import { BitbucketClient } from '../clients/bitbucket-client.js';

// Helper function to get workspace/repository with env fallbacks
function getWorkspaceAndRepo(args: { workspace?: string; repository?: string }) {
  const workspace = args.workspace || process.env.BITBUCKET_WORKSPACE;
  const repository = args.repository || process.env.BITBUCKET_REPOSITORY;

  if (!workspace) {
    throw new Error(
      'Workspace is required. Provide it as a parameter or set BITBUCKET_WORKSPACE environment variable.',
    );
  }
  if (!repository) {
    throw new Error(
      'Repository is required. Provide it as a parameter or set BITBUCKET_REPOSITORY environment variable.',
    );
  }

  return { workspace, repository };
}

// Schema definitions
export const writeFileSchema = z.object({
  workspace: z.string().optional().describe('Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)'),
  repository: z.string().optional().describe('Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)'),
  filePath: z.string().describe('Path where the file should be created/updated in the repository'),
  content: z.string().describe('File content to write'),
  branch: z.string().describe('Branch name where the file should be written'),
  message: z.string().describe('Commit message'),
  author: z.string().optional().describe('Author name (optional, defaults to authenticated user)'),
});

export const commitFilesSchema = z.object({
  workspace: z.string().optional().describe('Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)'),
  repository: z.string().optional().describe('Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)'),
  branch: z.string().describe('Branch name where files should be committed'),
  message: z.string().describe('Commit message'),
  files: z.array(
    z.object({
      path: z.string().describe('File path in repository'),
      content: z.string().describe('File content'),
    })
  ).describe('Array of files to commit'),
  author: z.string().optional().describe('Author name (optional, defaults to authenticated user)'),
});

// Tool definitions
export const writeFileTool = {
  name: 'write_file',
  description:
    'Write or update a file in a Bitbucket repository. Creates a new commit with the file changes on the specified branch.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace: {
        type: 'string',
        description: 'Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)',
      },
      repository: {
        type: 'string',
        description: 'Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)',
      },
      filePath: {
        type: 'string',
        description: 'Path where the file should be created/updated in the repository',
      },
      content: {
        type: 'string',
        description: 'File content to write',
      },
      branch: {
        type: 'string',
        description: 'Branch name where the file should be written',
      },
      message: {
        type: 'string',
        description: 'Commit message',
      },
      author: {
        type: 'string',
        description: 'Author name (optional, defaults to authenticated user)',
      },
    },
    required: ['filePath', 'content', 'branch', 'message'],
  },
};

export const commitFilesTool = {
  name: 'commit_files',
  description:
    'Commit multiple files to a Bitbucket repository in a single commit. Useful for atomic multi-file changes.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace: {
        type: 'string',
        description: 'Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)',
      },
      repository: {
        type: 'string',
        description: 'Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)',
      },
      branch: {
        type: 'string',
        description: 'Branch name where files should be committed',
      },
      message: {
        type: 'string',
        description: 'Commit message',
      },
      files: {
        type: 'array',
        description: 'Array of files to commit',
        items: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path in repository',
            },
            content: {
              type: 'string',
              description: 'File content',
            },
          },
          required: ['path', 'content'],
        },
      },
      author: {
        type: 'string',
        description: 'Author name (optional, defaults to authenticated user)',
      },
    },
    required: ['branch', 'message', 'files'],
  },
};

// Handler functions
export async function handleWriteFile(
  client: BitbucketClient,
  args: unknown,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const parsed = writeFileSchema.parse(args);
  const { workspace, repository } = getWorkspaceAndRepo(parsed);
  const { filePath, content, branch, message, author } = parsed;

  try {
    const result = await client.writeFile({
      workspace,
      repository,
      filePath,
      content,
      branch,
      message,
      author,
    });

    const text = [
      `# File Written Successfully`,
      '',
      `**File:** ${filePath}`,
      `**Branch:** ${branch}`,
      `**Commit:** \`${result.hash.substring(0, 7)}\``,
      `**Message:** ${message}`,
      result.author ? `**Author:** ${result.author.user?.displayName || result.author.raw || 'Unknown'}` : '',
      result.date ? `**Date:** ${new Date(result.date).toLocaleString()}` : '',
      '',
      `✅ File has been committed to the repository`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      content: [{ type: 'text', text }],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error writing file ${filePath}: ${error.message}`,
        },
      ],
    };
  }
}

export async function handleCommitFiles(
  client: BitbucketClient,
  args: unknown,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const parsed = commitFilesSchema.parse(args);
  const { workspace, repository } = getWorkspaceAndRepo(parsed);
  const { branch, message, files, author } = parsed;

  try {
    const result = await client.commitFiles({
      workspace,
      repository,
      branch,
      message,
      files,
      author,
    });

    const text = [
      `# Files Committed Successfully`,
      '',
      `**Branch:** ${branch}`,
      `**Commit:** \`${result.hash.substring(0, 7)}\``,
      `**Message:** ${message}`,
      result.author ? `**Author:** ${result.author.user?.displayName || result.author.raw || 'Unknown'}` : '',
      result.date ? `**Date:** ${new Date(result.date).toLocaleString()}` : '',
      '',
      `**Files committed (${files.length}):**`,
      ...files.map((f) => `- ${f.path}`),
      '',
      `✅ All files have been committed to the repository`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      content: [{ type: 'text', text }],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error committing files: ${error.message}`,
        },
      ],
    };
  }
}
