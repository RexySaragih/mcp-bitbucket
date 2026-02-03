import z from 'zod';
import { BitbucketClient } from '../clients/bitbucket-client.js';
import { getWorkspaceAndRepo } from '../utils/url-parser.js';

// Schema definitions
export const readRepositorySchema = z.object({
  workspace: z.string().optional().describe('Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)'),
  repository: z.string().optional().describe('Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)'),
});

export const readBranchSchema = z.object({
  workspace: z.string().optional().describe('Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)'),
  repository: z.string().optional().describe('Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)'),
  branch: z.string().describe('Branch name'),
  compareWithMain: z.boolean().optional().describe('Compare branch with main/master'),
});

export const readCommitSchema = z.object({
  workspace: z.string().optional().describe('Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)'),
  repository: z.string().optional().describe('Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)'),
  commitHash: z.string().describe('Commit hash'),
  includeDiff: z.boolean().optional().describe('Include diff in response'),
});

export const readFileSchema = z.object({
  workspace: z.string().optional().describe('Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)'),
  repository: z.string().optional().describe('Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)'),
  filePath: z.string().describe('Path to file in repository'),
  ref: z.string().optional().describe('Branch, tag, or commit hash (default: default branch)'),
});

export const searchCodeSchema = z.object({
  workspace: z.string().optional().describe('Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)'),
  repository: z.string().optional().describe('Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)'),
  query: z.string().describe('Search query'),
  filePath: z.string().optional().describe('Filter by file path pattern'),
  branch: z.string().optional().describe('Search in specific branch'),
});

// Tool definitions
export const readRepositoryTool = {
  name: 'read_repository',
  description:
    'Get repository information including name, description, default branch, branches, tags, and recent commits',
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
    },
    required: [],
  },
};

export const readBranchTool = {
  name: 'read_branch',
  description:
    'Get branch details including latest commit, author, date, and optionally compare with main/master branch',
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
      branch: { type: 'string', description: 'Branch name' },
      compareWithMain: {
        type: 'boolean',
        description: 'Compare branch with main/master',
      },
    },
    required: ['branch'],
  },
};

export const readCommitTool = {
  name: 'read_commit',
  description:
    'Get commit details including message, author, date, and optionally the diff. Extracts Jira ticket references from commit message.',
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
      commitHash: { type: 'string', description: 'Commit hash' },
      includeDiff: { type: 'boolean', description: 'Include diff in response' },
    },
    required: ['commitHash'],
  },
};

export const readFileTool = {
  name: 'read_file',
  description: 'Read file content from any branch, tag, or commit',
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
      filePath: { type: 'string', description: 'Path to file in repository' },
      ref: {
        type: 'string',
        description: 'Branch, tag, or commit hash (default: default branch)',
      },
    },
    required: ['filePath'],
  },
};

export const searchCodeTool = {
  name: 'search_code',
  description: 'Search code across repositories by content, file path, or extension',
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
      query: { type: 'string', description: 'Search query' },
      filePath: { type: 'string', description: 'Filter by file path pattern' },
      branch: { type: 'string', description: 'Search in specific branch' },
    },
    required: ['query'],
  },
};

// Handler functions
export async function handleReadRepository(
  client: BitbucketClient,
  args: unknown,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const parsed = readRepositorySchema.parse(args);
  const { workspace, repository } = getWorkspaceAndRepo(parsed);

  const repo = await client.getRepository(workspace, repository);
  const branches = await client.listBranches(workspace, repository, 1, 10);
  const tags = await client.listTags(workspace, repository, 1, 10);
  const commits = await client.listCommits(workspace, repository, repo.defaultBranch, 1, 10);

  const text = [
    `# Repository: ${repo.fullName}`,
    '',
    `**Name:** ${repo.name}`,
    repo.description ? `**Description:** ${repo.description}` : '',
    `**Workspace:** ${repo.workspace}`,
    `**Default Branch:** ${repo.defaultBranch || 'N/A'}`,
    `**Language:** ${repo.language || 'N/A'}`,
    `**Private:** ${repo.isPrivate ? 'Yes' : 'No'}`,
    repo.createdOn ? `**Created:** ${new Date(repo.createdOn).toLocaleString()}` : '',
    repo.updatedOn ? `**Updated:** ${new Date(repo.updatedOn).toLocaleString()}` : '',
    '',
    `## Branches (showing ${branches.values.length} of ${branches.pagelen || 'many'})`,
    ...branches.values.map((b) => `- ${b.name}`),
    '',
    `## Tags (showing ${tags.values.length} of ${tags.pagelen || 'many'})`,
    ...tags.values.map((t) => `- ${t.name}`),
    '',
    `## Recent Commits (${commits.values.length} shown)`,
    ...commits.values.map((c) => {
      const author = c.author?.user?.displayName || c.author?.raw || 'Unknown';
      const date = c.date ? new Date(c.date).toLocaleString() : 'Unknown date';
      const message = (c.message || '').split('\n')[0].substring(0, 80);
      return `- \`${c.hash.substring(0, 7)}\` ${message} - ${author} (${date})`;
    }),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    content: [{ type: 'text', text }],
  };
}

export async function handleReadBranch(
  client: BitbucketClient,
  args: unknown,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const parsed = readBranchSchema.parse(args);
  const { workspace, repository } = getWorkspaceAndRepo(parsed);
  const { branch, compareWithMain } = parsed;

  const branchData = await client.getBranch(workspace, repository, branch);
  const repo = await client.getRepository(workspace, repository);
  const defaultBranch = repo.defaultBranch || 'main';

  let text = [
    `# Branch: ${branch}`,
    '',
    branchData.target
      ? [
        `**Latest Commit:** \`${branchData.target.hash.substring(0, 7)}\``,
        branchData.target.message
          ? `**Message:** ${branchData.target.message.split('\n')[0]}`
          : '',
        branchData.target.author?.user?.displayName
          ? `**Author:** ${branchData.target.author.user.displayName}`
          : branchData.target.author?.raw
            ? `**Author:** ${branchData.target.author.raw}`
            : '',
        branchData.target.date
          ? `**Date:** ${new Date(branchData.target.date).toLocaleString()}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
      : 'No commit information available',
  ].join('\n');

  if (compareWithMain && branch !== defaultBranch) {
    try {
      const diff = await client.compareBranches(workspace, repository, branch, defaultBranch);
      text += '\n\n## Comparison with ' + defaultBranch + '\n\n';
      text += `**Files Changed:** ${diff.files.length}\n`;
      text += `**Additions:** +${diff.stats?.additions || 0}\n`;
      text += `**Deletions:** -${diff.stats?.deletions || 0}\n\n`;
      text += '### Changed Files:\n';
      text += diff.files
        .map((f) => {
          const status = f.status === 'added' ? '+' : f.status === 'removed' ? '-' : 'M';
          return `- ${status} ${f.path}${f.oldPath && f.oldPath !== f.path ? ` (from ${f.oldPath})` : ''}`;
        })
        .join('\n');
    } catch (error: any) {
      text += `\n\n**Note:** Could not compare with ${defaultBranch}: ${error.message}`;
    }
  }

  return {
    content: [{ type: 'text', text }],
  };
}

function extractJiraTickets(text: string): string[] {
  const jiraPattern = /\b([A-Z]+-\d+)\b/g;
  const matches = text.match(jiraPattern);
  return matches ? [...new Set(matches)] : [];
}

export async function handleReadCommit(
  client: BitbucketClient,
  args: unknown,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const parsed = readCommitSchema.parse(args);
  const { workspace, repository } = getWorkspaceAndRepo(parsed);
  const { commitHash, includeDiff } = parsed;

  const commit = await client.getCommit(workspace, repository, commitHash);
  const jiraTickets = commit.message ? extractJiraTickets(commit.message) : [];

  let text = [
    `# Commit: \`${commitHash.substring(0, 7)}\``,
    '',
    commit.message ? `**Message:**\n${commit.message}` : 'No commit message',
    '',
    commit.author?.user?.displayName
      ? `**Author:** ${commit.author.user.displayName} (${commit.author.user.username || ''})`
      : commit.author?.raw
        ? `**Author:** ${commit.author.raw}`
        : '',
    commit.date ? `**Date:** ${new Date(commit.date).toLocaleString()}` : '',
    commit.parents && commit.parents.length > 0
      ? `**Parents:** ${commit.parents.map((p) => p.hash.substring(0, 7)).join(', ')}`
      : '',
    jiraTickets.length > 0 ? `**Jira Tickets:** ${jiraTickets.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (includeDiff) {
    try {
      const diff = await client.getCommitDiff(workspace, repository, commitHash);
      text += '\n\n## Diff\n\n';
      text += `**Files Changed:** ${diff.files.length}\n`;
      text += `**Additions:** +${diff.stats?.additions || 0}\n`;
      text += `**Deletions:** -${diff.stats?.deletions || 0}\n\n`;
      text += '### Changed Files:\n';
      text += diff.files
        .map((f) => {
          const status = f.status === 'added' ? '+' : f.status === 'removed' ? '-' : 'M';
          return `- ${status} ${f.path}${f.oldPath && f.oldPath !== f.path ? ` (from ${f.oldPath})` : ''} (+${f.additions || 0}/-${f.deletions || 0})`;
        })
        .join('\n');
    } catch (error: any) {
      text += `\n\n**Note:** Could not fetch diff: ${error.message}`;
    }
  }

  return {
    content: [{ type: 'text', text }],
  };
}

export async function handleReadFile(
  client: BitbucketClient,
  args: unknown,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const parsed = readFileSchema.parse(args);
  const { workspace, repository } = getWorkspaceAndRepo(parsed);
  const { filePath, ref } = parsed;

  try {
    const file = await client.getFileContent(workspace, repository, filePath, ref);
    const refInfo = ref ? ` (ref: ${ref})` : '';

    const text = [
      `# File: ${filePath}${refInfo}`,
      '',
      file.size ? `**Size:** ${file.size} bytes` : '',
      file.encoding ? `**Encoding:** ${file.encoding}` : '',
      '',
      '## Content',
      '',
      '```',
      file.content || '(empty file)',
      '```',
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
          text: `Error reading file ${filePath}: ${error.message}`,
        },
      ],
    };
  }
}

export async function handleSearchCode(
  client: BitbucketClient,
  args: unknown,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const parsed = searchCodeSchema.parse(args);
  const { workspace, repository } = getWorkspaceAndRepo(parsed);
  const { query, filePath, branch } = parsed;

  const results = await client.searchCode({
    workspace,
    repository,
    query,
    filePath,
    branch,
  });

  const text = [
    `# Code Search Results`,
    '',
    `**Query:** ${query}`,
    filePath ? `**File Pattern:** ${filePath}` : '',
    branch ? `**Branch:** ${branch}` : '',
    '',
    `**Found ${results.length} result(s)**`,
    '',
    ...results.map((result, idx) => {
      const path = result.file?.path || 'Unknown file';
      const lines = result.content?.lines || [];
      return [
        `## Result ${idx + 1}: ${path}`,
        '',
        lines.length > 0
          ? lines
            .map((l) => `  ${l.line}: ${l.segment || ''}`)
            .join('\n')
          : 'No content preview available',
      ].join('\n');
    }),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    content: [{ type: 'text', text }],
  };
}

