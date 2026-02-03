/**
 * Utility functions for parsing Bitbucket URLs
 */

/**
 * Extract workspace and repository from a Bitbucket URL
 * Supports various URL formats:
 * - https://bitbucket.org/workspace/repo
 * - https://bitbucket.org/workspace/repo/pull-requests/123
 * - https://bitbucket.org/workspace/repo/src/branch/path
 * - https://bitbucket.org/workspace/repo/commits/hash
 */
export function extractFromBitbucketUrl(url: string): {
  workspace: string;
  repository: string;
  prId?: number;
  branch?: string;
  commitHash?: string;
} | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    // Expected format: /workspace/repo/...
    if (pathParts.length >= 2) {
      const workspace = pathParts[0];
      const repository = pathParts[1];

      const result: ReturnType<typeof extractFromBitbucketUrl> = {
        workspace,
        repository
      };

      // Try to extract PR ID if present
      const prIndex = pathParts.indexOf('pull-requests');
      if (prIndex !== -1 && pathParts[prIndex + 1]) {
        const prId = parseInt(pathParts[prIndex + 1], 10);
        if (!isNaN(prId)) {
          result.prId = prId;
        }
      }

      // Try to extract branch if present
      const srcIndex = pathParts.indexOf('src');
      if (srcIndex !== -1 && pathParts[srcIndex + 1]) {
        result.branch = pathParts[srcIndex + 1];
      }

      // Try to extract commit hash if present
      const commitsIndex = pathParts.indexOf('commits');
      const commitIndex = pathParts.indexOf('commit');
      if (commitsIndex !== -1 && pathParts[commitsIndex + 1]) {
        result.commitHash = pathParts[commitsIndex + 1];
      } else if (commitIndex !== -1 && pathParts[commitIndex + 1]) {
        result.commitHash = pathParts[commitIndex + 1];
      }

      return result;
    }
  } catch (error) {
    // Invalid URL, return null
  }
  return null;
}

/**
 * Get workspace and repository with fallbacks to environment variables and URL extraction
 */
export function getWorkspaceAndRepo(args: {
  workspace?: string;
  repository?: string;
  prUrl?: string;
  repoUrl?: string;
}): { workspace: string; repository: string } {
  let workspace = args.workspace;
  let repository = args.repository;

  // Try to extract from URL if provided (prUrl or repoUrl)
  const url = args.prUrl || args.repoUrl;
  if (url) {
    const extracted = extractFromBitbucketUrl(url);
    if (extracted) {
      workspace = workspace || extracted.workspace;
      repository = repository || extracted.repository;
    }
  }

  // Fall back to environment variables
  workspace = workspace || process.env.BITBUCKET_WORKSPACE;
  repository = repository || process.env.BITBUCKET_REPOSITORY;

  if (!workspace || !repository) {
    const missing = [];
    if (!workspace) missing.push('workspace');
    if (!repository) missing.push('repository');

    throw new Error(
      `Missing required parameter(s): ${missing.join(', ')}.\n\n` +
      `Please provide them in one of these ways:\n` +
      `1. Extract from a Bitbucket URL (e.g., https://bitbucket.org/workspace/repo/pull-requests/123)\n` +
      `   - Use the 'prUrl' or 'repoUrl' parameter with the full URL\n` +
      `2. Provide directly as parameters: workspace="${workspace || '<workspace>'}", repository="${repository || '<repository>'}"\n` +
      `3. Set environment variables: BITBUCKET_WORKSPACE and BITBUCKET_REPOSITORY\n\n` +
      `💡 Tip: If you have a Bitbucket URL, extract the workspace and repository from it and provide them as parameters.`
    );
  }

  return { workspace, repository };
}
