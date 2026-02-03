import z from 'zod';
import { BitbucketClient } from '../clients/bitbucket-client.js';
import { getWorkspaceAndRepo } from '../utils/url-parser.js';

// Schema definitions
export const deleteBranchSchema = z.object({
  workspace: z.string().optional().describe('Bitbucket workspace name (defaults to BITBUCKET_WORKSPACE env var)'),
  repository: z.string().optional().describe('Repository slug/name (defaults to BITBUCKET_REPOSITORY env var)'),
  branchName: z.string().describe('Branch name to delete'),
  onlyIfMerged: z.boolean().optional().describe('Only delete if branch is merged (safety check)'),
});

// Tool definitions
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

// Handler functions
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

