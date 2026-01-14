import {
  Repository,
  Branch,
  Tag,
  Commit,
  CommitDiff,
  FileContent,
  FileHistory,
  PullRequest,
  PullRequestDiff,
  PullRequestComment,
  CreatePullRequestParams,
  UpdatePullRequestParams,
  CreateBranchParams,
  CodeSearchResult,
  CodeSearchParams,
  PaginatedResponse,
} from '../types/index.js';

export interface BitbucketClientConfig {
  email: string;
  apiToken: string;
}

export class BitbucketClient {
  // Bitbucket Cloud API v2.0 endpoint (hardcoded - no URL configuration needed)
  private readonly apiBase = 'https://api.bitbucket.org/2.0';

  constructor(private readonly config: BitbucketClientConfig) {
    if (!config.email) throw new Error('ATLASSIAN_EMAIL is required');
    if (!config.apiToken) throw new Error('ATLASSIAN_API_TOKEN is required');
  }

  // Repository operations
  async getRepository(workspace: string, repository: string): Promise<Repository> {
    const response = await fetch(`${this.apiBase}/repositories/${workspace}/${repository}`, {
      headers: this.headers(),
    });

    await this.assertOk(response, `Failed to fetch repository ${workspace}/${repository}`);
    const data = (await response.json()) as any;

    return {
      uuid: data?.uuid,
      fullName: data?.full_name,
      name: data?.name,
      workspace: data?.workspace?.slug || workspace,
      description: data?.description,
      isPrivate: data?.is_private,
      defaultBranch: data?.mainbranch?.name,
      language: data?.language,
      createdOn: data?.created_on,
      updatedOn: data?.updated_on,
      raw: data,
    };
  }

  async listBranches(
    workspace: string,
    repository: string,
    page?: number,
    pageSize: number = 30,
  ): Promise<PaginatedResponse<Branch>> {
    const params = new URLSearchParams({
      pagelen: String(pageSize),
    });
    if (page) params.set('page', String(page));

    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/refs/branches?${params}`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to list branches for ${workspace}/${repository}`);
    const data = (await response.json()) as any;

    return {
      values: (data?.values || []).map((branch: any) => ({
        name: branch?.name,
        target: branch?.target
          ? {
              hash: branch.target.hash,
              date: branch.target.date,
              author: branch.target.author,
              message: branch.target.message,
            }
          : undefined,
        raw: branch,
      })),
      page: data?.page,
      size: data?.size,
      pagelen: data?.pagelen,
      next: data?.next,
      previous: data?.previous,
    };
  }

  async listTags(
    workspace: string,
    repository: string,
    page?: number,
    pageSize: number = 30,
  ): Promise<PaginatedResponse<Tag>> {
    const params = new URLSearchParams({
      pagelen: String(pageSize),
    });
    if (page) params.set('page', String(page));

    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/refs/tags?${params}`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to list tags for ${workspace}/${repository}`);
    const data = (await response.json()) as any;

    return {
      values: (data?.values || []).map((tag: any) => ({
        name: tag?.name,
        target: tag?.target
          ? {
              hash: tag.target.hash,
              date: tag.target.date,
              author: tag.target.author,
              message: tag.target.message,
            }
          : undefined,
        raw: tag,
      })),
      page: data?.page,
      size: data?.size,
      pagelen: data?.pagelen,
      next: data?.next,
      previous: data?.previous,
    };
  }

  async getBranch(workspace: string, repository: string, branchName: string): Promise<Branch> {
    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/refs/branches/${branchName}`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to fetch branch ${branchName}`);
    const data = (await response.json()) as any;

    return {
      name: data?.name,
      target: data?.target
        ? {
            hash: data.target.hash,
            date: data.target.date,
            author: data.target.author,
            message: data.target.message,
          }
        : undefined,
      raw: data,
    };
  }

  async getCommit(workspace: string, repository: string, commitHash: string): Promise<Commit> {
    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/commit/${commitHash}`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to fetch commit ${commitHash}`);
    const data = (await response.json()) as any;

    return {
      hash: data?.hash,
      message: data?.message,
      author: data?.author,
      date: data?.date,
      parents: data?.parents?.map((p: any) => ({ hash: p.hash })),
      raw: data,
    };
  }

  async getCommitDiff(
    workspace: string,
    repository: string,
    commitHash: string,
  ): Promise<CommitDiff> {
    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/diff/${commitHash}`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to fetch diff for commit ${commitHash}`);
    const diffText = await response.text();

    // Parse unified diff format
    const files: CommitDiff['files'] = [];
    const lines = diffText.split('\n');
    let currentFile: CommitDiff['files'][0] | null = null;
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          currentFile.additions = additions;
          currentFile.deletions = deletions;
          files.push(currentFile);
        }
        const match = line.match(/a\/(.+?)\s+b\/(.+?)$/);
        if (match) {
          currentFile = {
            path: match[2],
            oldPath: match[1] !== match[2] ? match[1] : undefined,
            status: match[1] !== match[2] ? 'renamed' : 'modified',
            additions: 0,
            deletions: 0,
          };
          additions = 0;
          deletions = 0;
        }
      } else if (line.startsWith('new file')) {
        if (currentFile) currentFile.status = 'added';
      } else if (line.startsWith('deleted file')) {
        if (currentFile) currentFile.status = 'removed';
      } else if (line.startsWith('+++')) {
        // New file path
      } else if (line.startsWith('---')) {
        // Old file path
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    if (currentFile) {
      currentFile.additions = additions;
      currentFile.deletions = deletions;
      files.push(currentFile);
    }

    const totalAdditions = files.reduce((sum, f) => sum + (f.additions || 0), 0);
    const totalDeletions = files.reduce((sum, f) => sum + (f.deletions || 0), 0);

    return {
      files,
      stats: {
        additions: totalAdditions,
        deletions: totalDeletions,
        total: totalAdditions + totalDeletions,
      },
    };
  }

  async listCommits(
    workspace: string,
    repository: string,
    branch?: string,
    page?: number,
    pageSize: number = 30,
  ): Promise<PaginatedResponse<Commit>> {
    const params = new URLSearchParams({
      pagelen: String(pageSize),
    });
    if (branch) params.set('include', branch);
    if (page) params.set('page', String(page));

    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/commits?${params}`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to list commits for ${workspace}/${repository}`);
    const data = (await response.json()) as any;

    return {
      values: (data?.values || []).map((commit: any) => ({
        hash: commit?.hash,
        message: commit?.message,
        author: commit?.author,
        date: commit?.date,
        parents: commit?.parents?.map((p: any) => ({ hash: p.hash })),
        raw: commit,
      })),
      page: data?.page,
      size: data?.size,
      pagelen: data?.pagelen,
      next: data?.next,
      previous: data?.previous,
    };
  }

  async getFileContent(
    workspace: string,
    repository: string,
    filePath: string,
    ref?: string,
  ): Promise<FileContent> {
    // Bitbucket API: /repositories/{workspace}/{repo_slug}/src/{commit}/{path}
    // The ref can be in the path or as query param 'at'
    const refPath = ref || 'HEAD';
    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/src/${refPath}/${filePath}`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to fetch file ${filePath}`);
    const content = await response.text();

    return {
      path: filePath,
      content,
      size: content.length,
      encoding: 'utf-8',
    };
  }

  async compareBranches(
    workspace: string,
    repository: string,
    sourceBranch: string,
    targetBranch: string,
  ): Promise<CommitDiff> {
    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/diff/${targetBranch}..${sourceBranch}`,
      { headers: this.headers() },
    );

    await this.assertOk(
      response,
      `Failed to compare branches ${sourceBranch} and ${targetBranch}`,
    );
    const diffText = await response.text();

    // Parse unified diff format (same logic as getCommitDiff)
    const files: CommitDiff['files'] = [];
    const lines = diffText.split('\n');
    let currentFile: CommitDiff['files'][0] | null = null;
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          currentFile.additions = additions;
          currentFile.deletions = deletions;
          files.push(currentFile);
        }
        const match = line.match(/a\/(.+?)\s+b\/(.+?)$/);
        if (match) {
          currentFile = {
            path: match[2],
            oldPath: match[1] !== match[2] ? match[1] : undefined,
            status: match[1] !== match[2] ? 'renamed' : 'modified',
            additions: 0,
            deletions: 0,
          };
          additions = 0;
          deletions = 0;
        }
      } else if (line.startsWith('new file')) {
        if (currentFile) currentFile.status = 'added';
      } else if (line.startsWith('deleted file')) {
        if (currentFile) currentFile.status = 'removed';
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    if (currentFile) {
      currentFile.additions = additions;
      currentFile.deletions = deletions;
      files.push(currentFile);
    }

    const totalAdditions = files.reduce((sum, f) => sum + (f.additions || 0), 0);
    const totalDeletions = files.reduce((sum, f) => sum + (f.deletions || 0), 0);

    return {
      files,
      stats: {
        additions: totalAdditions,
        deletions: totalDeletions,
        total: totalAdditions + totalDeletions,
      },
    };
  }

  async searchCode(params: CodeSearchParams): Promise<CodeSearchResult[]> {
    const searchParams = new URLSearchParams({
      search_query: params.query,
    });
    if (params.filePath) searchParams.set('file', params.filePath);
    if (params.branch) searchParams.set('branch', params.branch);

    const response = await fetch(
      `${this.apiBase}/repositories/${params.workspace}/${params.repository}/search/code?${searchParams}`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to search code in ${params.workspace}/${params.repository}`);
    const data = (await response.json()) as any;

    return (data?.values || []).map((result: any) => ({
      file: result?.file,
      content: result?.content,
      raw: result,
    }));
  }

  // Pull Request operations
  async listPullRequests(
    workspace: string,
    repository: string,
    state?: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED',
    page?: number,
    pageSize: number = 30,
  ): Promise<PaginatedResponse<PullRequest>> {
    const params = new URLSearchParams({
      pagelen: String(pageSize),
    });
    if (state) params.set('state', state);
    if (page) params.set('page', String(page));

    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/pullrequests?${params}`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to list pull requests for ${workspace}/${repository}`);
    const data = (await response.json()) as any;

    return {
      values: (data?.values || []).map((pr: any) => this.mapPullRequest(pr)),
      page: data?.page,
      size: data?.size,
      pagelen: data?.pagelen,
      next: data?.next,
      previous: data?.previous,
    };
  }

  async getPullRequest(
    workspace: string,
    repository: string,
    pullRequestId: number,
  ): Promise<PullRequest> {
    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/pullrequests/${pullRequestId}`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to fetch pull request ${pullRequestId}`);
    const data = (await response.json()) as any;

    return this.mapPullRequest(data);
  }

  async getPullRequestDiff(
    workspace: string,
    repository: string,
    pullRequestId: number,
  ): Promise<PullRequestDiff> {
    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/pullrequests/${pullRequestId}/diff`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to fetch diff for pull request ${pullRequestId}`);
    const diffText = await response.text();

    // Parse unified diff format
    const files: PullRequestDiff['files'] = [];
    const lines = diffText.split('\n');
    let currentFile: PullRequestDiff['files'][0] | null = null;
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          currentFile.additions = additions;
          currentFile.deletions = deletions;
          files.push(currentFile);
        }
        const match = line.match(/a\/(.+?)\s+b\/(.+?)$/);
        if (match) {
          currentFile = {
            path: match[2],
            oldPath: match[1] !== match[2] ? match[1] : undefined,
            status: match[1] !== match[2] ? 'renamed' : 'modified',
            additions: 0,
            deletions: 0,
          };
          additions = 0;
          deletions = 0;
        }
      } else if (line.startsWith('new file')) {
        if (currentFile) currentFile.status = 'added';
      } else if (line.startsWith('deleted file')) {
        if (currentFile) currentFile.status = 'removed';
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    if (currentFile) {
      currentFile.additions = additions;
      currentFile.deletions = deletions;
      files.push(currentFile);
    }

    const totalAdditions = files.reduce((sum, f) => sum + (f.additions || 0), 0);
    const totalDeletions = files.reduce((sum, f) => sum + (f.deletions || 0), 0);

    return {
      files,
      stats: {
        additions: totalAdditions,
        deletions: totalDeletions,
        total: totalAdditions + totalDeletions,
      },
    };
  }

  async getPullRequestComments(
    workspace: string,
    repository: string,
    pullRequestId: number,
  ): Promise<PullRequestComment[]> {
    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/pullrequests/${pullRequestId}/comments`,
      { headers: this.headers() },
    );

    await this.assertOk(response, `Failed to fetch comments for pull request ${pullRequestId}`);
    const data = (await response.json()) as any;

    return (data?.values || []).map((comment: any) => ({
      id: comment?.id,
      content: comment?.content,
      author: comment?.user,
      createdOn: comment?.created_on,
      updatedOn: comment?.updated_on,
      raw: comment,
    }));
  }

  async createPullRequest(params: CreatePullRequestParams): Promise<PullRequest> {
    const body: Record<string, unknown> = {
      title: params.title,
      source: {
        branch: {
          name: params.sourceBranch,
        },
      },
      destination: {
        branch: {
          name: params.destinationBranch || 'main',
        },
      },
    };

    if (params.description) {
      body.description = params.description;
    }

    if (params.reviewers && params.reviewers.length > 0) {
      body.reviewers = params.reviewers.map((username) => ({ username }));
    }

    if (params.closeSourceBranch !== undefined) {
      body.close_source_branch = params.closeSourceBranch;
    }

    const response = await fetch(
      `${this.apiBase}/repositories/${params.workspace}/${params.repository}/pullrequests`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      },
    );

    await this.assertOk(response, `Failed to create pull request`);
    const data = (await response.json()) as any;

    return this.mapPullRequest(data);
  }

  async updatePullRequest(params: UpdatePullRequestParams): Promise<PullRequest> {
    const body: Record<string, unknown> = {};

    if (params.title) body.title = params.title;
    if (params.description !== undefined) body.description = params.description;
    if (params.reviewers) {
      body.reviewers = params.reviewers.map((username) => ({ username }));
    }
    if (params.state) body.state = params.state;

    const response = await fetch(
      `${this.apiBase}/repositories/${params.workspace}/${params.repository}/pullrequests/${params.pullRequestId}`,
      {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify(body),
      },
    );

    await this.assertOk(response, `Failed to update pull request ${params.pullRequestId}`);
    const data = (await response.json()) as any;

    return this.mapPullRequest(data);
  }

  async mergePullRequest(
    workspace: string,
    repository: string,
    pullRequestId: number,
    mergeStrategy: 'merge_commit' | 'squash' | 'fast_forward' = 'merge_commit',
  ): Promise<PullRequest> {
    const body: Record<string, unknown> = {
      close_source_branch: true,
    };

    if (mergeStrategy === 'merge_commit') {
      body.merge_strategy = 'merge_commit';
    } else if (mergeStrategy === 'squash') {
      body.merge_strategy = 'squash';
    } else if (mergeStrategy === 'fast_forward') {
      body.merge_strategy = 'fast_forward';
    }

    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/pullrequests/${pullRequestId}/merge`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      },
    );

    await this.assertOk(response, `Failed to merge pull request ${pullRequestId}`);
    const data = (await response.json()) as any;

    return this.mapPullRequest(data);
  }

  async addPullRequestComment(
    workspace: string,
    repository: string,
    pullRequestId: number,
    content: string,
    filePath?: string,
    lineNumber?: number,
  ): Promise<PullRequestComment> {
    const body: Record<string, unknown> = {
      content: {
        raw: content,
      },
    };

    // Add inline comment support (line-specific)
    // Both filePath and lineNumber must be provided for inline comments
    if (filePath && filePath.trim() !== '' && lineNumber !== undefined && lineNumber !== null) {
      body.inline = {
        to: lineNumber,
        path: filePath,
      };
      console.error(`Creating INLINE comment on file: ${filePath}, line: ${lineNumber}`);
    } else {
      console.error(`Creating GENERAL comment (filePath: ${filePath}, lineNumber: ${lineNumber})`);
    }

    // Log the request body for debugging
    console.error('Creating comment with body:', JSON.stringify(body, null, 2));

    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/pullrequests/${pullRequestId}/comments`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`Comment API Error (${response.status}):`, errorText);
      console.error('Request body:', JSON.stringify(body, null, 2));
      throw new Error(`Failed to add comment: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = (await response.json()) as any;

    return {
      id: data?.id,
      content: data?.content,
      author: data?.user,
      createdOn: data?.created_on,
      updatedOn: data?.updated_on,
      inline: data?.inline
        ? {
            path: data.inline.path,
            to: data.inline.to,
            from: data.inline.from,
          }
        : undefined,
      raw: data,
    };
  }

  // Branch operations
  async createBranch(params: CreateBranchParams): Promise<Branch> {
    const body: Record<string, unknown> = {
      name: params.name,
    };

    if (params.sourceBranch) {
      body.target = {
        branch: {
          name: params.sourceBranch,
        },
      };
    } else if (params.sourceCommit) {
      body.target = {
        commit: {
          hash: params.sourceCommit,
        },
      };
    }

    const response = await fetch(
      `${this.apiBase}/repositories/${params.workspace}/${params.repository}/refs/branches`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      },
    );

    await this.assertOk(response, `Failed to create branch ${params.name}`);
    const data = (await response.json()) as any;

    return {
      name: data?.name,
      target: data?.target
        ? {
            hash: data.target.hash,
            date: data.target.date,
            author: data.target.author,
            message: data.target.message,
          }
        : undefined,
      raw: data,
    };
  }

  async deleteBranch(workspace: string, repository: string, branchName: string): Promise<void> {
    const response = await fetch(
      `${this.apiBase}/repositories/${workspace}/${repository}/refs/branches/${branchName}`,
      {
        method: 'DELETE',
        headers: this.headers(),
      },
    );

    await this.assertOk(response, `Failed to delete branch ${branchName}`);
  }

  // Helper methods
  private mapPullRequest(data: any): PullRequest {
    return {
      id: data?.id,
      title: data?.title,
      description: data?.description,
      state: data?.state,
      source: data?.source
        ? {
            branch: data.source.branch ? { name: data.source.branch.name } : undefined,
            repository: data.source.repository
              ? { fullName: data.source.repository.full_name }
              : undefined,
            commit: data.source.commit ? { hash: data.source.commit.hash } : undefined,
          }
        : undefined,
      destination: data?.destination
        ? {
            branch: data.destination.branch ? { name: data.destination.branch.name } : undefined,
            repository: data.destination.repository
              ? { fullName: data.destination.repository.full_name }
              : undefined,
          }
        : undefined,
      author: data?.author
        ? {
            displayName: data.author.display_name,
            username: data.author.username,
            uuid: data.author.uuid,
          }
        : undefined,
      createdOn: data?.created_on,
      updatedOn: data?.updated_on,
      reviewers: data?.reviewers?.map((r: any) => ({
        displayName: r.display_name,
        username: r.username,
        uuid: r.uuid,
        approved: r.approved,
      })),
      raw: data,
    };
  }

  private headers() {
    const token = Buffer.from(
      `${this.config.email}:${this.config.apiToken}`,
      'utf8',
    ).toString('base64');
    return {
      Authorization: `Basic ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  private async assertOk(response: Response, context: string) {
    if (response.ok) return;
    const body = await response.text().catch(() => '');
    throw new Error(`${context}: ${response.status} ${response.statusText} ${body}`);
  }
}

