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
export const createBranchSchema = z.object({
  workspace: z.string().optional().describe('Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)'),
  repository: z.string().optional().describe('Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)'),
  name: z.string().optional().describe('Branch name'),
  sourceBranch: z.string().optional().describe('Source branch to create from (default: default branch)'),
  sourceCommit: z.string().optional().describe('Source commit hash to create from'),
  fromJiraTicket: z.string().optional().describe('Jira ticket key (e.g., PROJ-123) - will auto-format branch name'),
  description: z.string().optional().describe('Description for branch name (used with fromJiraTicket)'),
});

export const deleteBranchSchema = z.object({
  workspace: z.string().optional().describe('Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)'),
  repository: z.string().optional().describe('Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)'),
  branchName: z.string().describe('Branch name to delete'),
  onlyIfMerged: z.boolean().optional().describe('Only delete if branch is merged (safety check)'),
});

// Tool definitions
export const createBranchTool = {
  name: 'create_branch',
  description:
    'Create branch from source branch. Auto-name from Jira ticket: feature/PROJ-123-description. Validates branch name format.',
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
      name: { type: 'string', description: 'Branch name' },
      sourceBranch: {
        type: 'string',
        description: 'Source branch to create from (default: default branch)',
      },
      sourceCommit: {
        type: 'string',
        description: 'Source commit hash to create from',
      },
      fromJiraTicket: {
        type: 'string',
        description: 'Jira ticket key (e.g., PROJ-123) - will auto-format branch name',
      },
      description: {
        type: 'string',
        description: 'Description for branch name (used with fromJiraTicket)',
      },
    },
    required: [],
  },
};

export const deleteBranchTool = {
  name: 'delete_branch',
  description: 'Delete branch with safety checks. Can optionally only delete if merged.',
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
      branchName: { type: 'string', description: 'Branch name to delete' },
      onlyIfMerged: {
        type: 'boolean',
        description: 'Only delete if branch is merged (safety check)',
      },
    },
    required: ['branchName'],
  },
};

// Helper functions
function validateBranchName(name: string): { valid: boolean; error?: string } {
  // Bitbucket branch name rules:
  // - Cannot contain spaces
  // - Cannot start or end with /
  // - Cannot contain consecutive slashes
  // - Cannot contain special characters like .., @{, etc.
  // - Cannot be empty

  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Branch name cannot be empty' };
  }

  if (name.startsWith('/') || name.endsWith('/')) {
    return { valid: false, error: 'Branch name cannot start or end with /' };
  }

  if (name.includes('//')) {
    return { valid: false, error: 'Branch name cannot contain consecutive slashes' };
  }

  if (name.includes('..')) {
    return { valid: false, error: 'Branch name cannot contain ..' };
  }

  if (name.includes('@{')) {
    return { valid: false, error: 'Branch name cannot contain @{' };
  }

  if (/\s/.test(name)) {
    return { valid: false, error: 'Branch name cannot contain spaces' };
  }

  // Check for invalid characters
  const invalidChars = /[~^:?*\[\]\\]/;
  if (invalidChars.test(name)) {
    return {
      valid: false,
      error: 'Branch name contains invalid characters: ~ ^ : ? * [ ] \\',
    };
  }

  return { valid: true };
}

function formatBranchNameFromJira(
  ticketKey: string,
  description?: string,
  prefix: string = 'feature',
): string {
  // Extract ticket key (e.g., PROJ-123)
  const ticketMatch = ticketKey.match(/\b([A-Z]+-\d+)\b/);
  if (!ticketMatch) {
    throw new Error(`Invalid Jira ticket format: ${ticketKey}`);
  }

  const ticket = ticketMatch[1];
  let branchName = `${prefix}/${ticket}`;

  if (description) {
    // Clean description: lowercase, replace spaces with hyphens, remove special chars
    const cleanDesc = description
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50); // Limit length

    if (cleanDesc) {
      branchName += `-${cleanDesc}`;
    }
  }

  return branchName;
}

// Handler functions
export async function handleCreateBranch(
  client: BitbucketClient,
  args: unknown,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const parsed = createBranchSchema.parse(args);
  const { workspace, repository } = getWorkspaceAndRepo(parsed);
  const { name, sourceBranch, sourceCommit, fromJiraTicket, description } = parsed;

  // Determine branch name
  let branchName: string;
  if (fromJiraTicket) {
    branchName = formatBranchNameFromJira(fromJiraTicket, description);
  } else if (name) {
    branchName = name;
  } else {
    throw new Error('Either name or fromJiraTicket must be provided');
  }

  // Validate branch name
  const validation = validateBranchName(branchName);
  if (!validation.valid) {
    throw new Error(`Invalid branch name: ${validation.error}`);
  }

  // Get default branch if sourceBranch not provided
  let actualSourceBranch = sourceBranch;
  if (!actualSourceBranch && !sourceCommit) {
    const repo = await client.getRepository(workspace, repository);
    actualSourceBranch = repo.defaultBranch || 'main';
  }

  // Create branch
  const branch = await client.createBranch({
    workspace,
    repository,
    name: branchName,
    sourceBranch: actualSourceBranch,
    sourceCommit,
  });

  const text = [
    `# Branch Created: ${branchName}`,
    '',
    `**Name:** ${branch.name}`,
    actualSourceBranch ? `**Created from:** ${actualSourceBranch}` : '',
    sourceCommit ? `**Created from commit:** ${sourceCommit.substring(0, 7)}` : '',
    branch.target?.hash ? `**Initial commit:** \`${branch.target.hash.substring(0, 7)}\`` : '',
    branch.target?.author?.user?.displayName
      ? `**Author:** ${branch.target.author.user.displayName}`
      : '',
    branch.target?.date
      ? `**Created:** ${new Date(branch.target.date).toLocaleString()}`
      : '',
    fromJiraTicket ? `**Jira Ticket:** ${fromJiraTicket}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    content: [{ type: 'text', text }],
  };
}

export async function handleDeleteBranch(
  client: BitbucketClient,
  args: unknown,
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const parsed = deleteBranchSchema.parse(args);
  const { workspace, repository } = getWorkspaceAndRepo(parsed);
  const { branchName, onlyIfMerged } = parsed;

  // Safety check: don't delete main/master branches
  const protectedBranches = ['main', 'master', 'develop', 'dev'];
  if (protectedBranches.includes(branchName.toLowerCase())) {
    throw new Error(
      `Cannot delete protected branch: ${branchName}. Protected branches: ${protectedBranches.join(', ')}`,
    );
  }

  // Check if branch is merged if onlyIfMerged is true
  if (onlyIfMerged) {
    try {
      const repo = await client.getRepository(workspace, repository);
      const defaultBranch = repo.defaultBranch || 'main';

      // Try to get the branch
      const branch = await client.getBranch(workspace, repository, branchName);

      // Compare with default branch to see if there are differences
      try {
        const diff = await client.compareBranches(
          workspace,
          repository,
          branchName,
          defaultBranch,
        );

        // If there are changes, the branch is not fully merged
        if (diff.files.length > 0 || (diff.stats && diff.stats.total && diff.stats.total > 0)) {
          throw new Error(
            `Branch ${branchName} has unmerged changes. It cannot be deleted. Use onlyIfMerged=false to force delete.`,
          );
        }
      } catch (error: any) {
        // If comparison fails, it might mean branches are identical (merged)
        // or there's an error. We'll proceed with deletion if it's a comparison error.
        if (!error.message.includes('unmerged changes')) {
          // It's a different error, re-throw
          throw error;
        }
        // Otherwise, the error already says it has unmerged changes
        throw error;
      }
    } catch (error: any) {
      // If branch doesn't exist or other error, check the error message
      if (error.message.includes('unmerged changes')) {
        throw error;
      }
      // If branch doesn't exist, we can't delete it anyway
      if (error.message.includes('404') || error.message.includes('not found')) {
        throw new Error(`Branch ${branchName} not found`);
      }
      // For other errors during merge check, we'll still try to delete
      // (the user might want to force delete)
    }
  }

  await client.deleteBranch(workspace, repository, branchName);

  const text = [
    `# Branch Deleted: ${branchName}`,
    '',
    `**Branch:** ${branchName}`,
    `**Repository:** ${workspace}/${repository}`,
    onlyIfMerged ? `**Safety Check:** Only deleted because branch was merged` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    content: [{ type: 'text', text }],
  };
}

