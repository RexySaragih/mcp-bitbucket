import { BaseClient } from './base-client.js';
import {
  PullRequest,
  PullRequestDiff,
  PullRequestComment,
  CreatePullRequestParams,
  UpdatePullRequestParams,
  PaginatedResponse,
} from '../types/index.js';

export class PullRequestClient extends BaseClient {
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

    return this.parseDiff(diffText);
  }

  async getPullRequestComments(
    workspace: string,
    repository: string,
    pullRequestId: number,
  ): Promise<PullRequestComment[]> {
    const allComments: PullRequestComment[] = [];
    let url: string | null = `${this.apiBase}/repositories/${workspace}/${repository}/pullrequests/${pullRequestId}/comments`;

    // Fetch all pages of comments
    while (url) {
      const response = await fetch(url, { headers: this.headers() });
      await this.assertOk(response, `Failed to fetch comments for pull request ${pullRequestId}`);
      const data = (await response.json()) as any;

      const comments = (data?.values || []).map((comment: any) => ({
        id: comment?.id,
        content: comment?.content,
        author: comment?.user,
        createdOn: comment?.created_on,
        updatedOn: comment?.updated_on,
        parent: comment?.parent ? { id: comment.parent.id } : undefined,
        raw: comment,
      }));

      allComments.push(...comments);

      // Move to next page if available
      url = data?.next || null;
    }

    return allComments;
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
    if (filePath && filePath.trim() !== '' && lineNumber !== undefined && lineNumber !== null) {
      body.inline = {
        to: lineNumber,
        path: filePath,
      };
      console.error(`Creating INLINE comment on file: ${filePath}, line: ${lineNumber}`);
    } else {
      console.error(`Creating GENERAL comment (filePath: ${filePath}, lineNumber: ${lineNumber})`);
    }

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
      throw new Error(
        `Failed to add comment: ${response.status} ${response.statusText} - ${errorText}`,
      );
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

  async replyToPullRequestComment(
    workspace: string,
    repository: string,
    pullRequestId: number,
    parentCommentId: number,
    content: string,
  ): Promise<PullRequestComment> {
    const body: Record<string, unknown> = {
      content: {
        raw: content,
      },
      parent: {
        id: parentCommentId,
      },
    };

    console.error(`Creating REPLY to comment ID: ${parentCommentId}`);
    console.error('Creating reply with body:', JSON.stringify(body, null, 2));

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
      console.error(`Reply API Error (${response.status}):`, errorText);
      console.error('Request body:', JSON.stringify(body, null, 2));
      throw new Error(
        `Failed to reply to comment: ${response.status} ${response.statusText} - ${errorText}`,
      );
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
      parent: data?.parent ? { id: data.parent.id } : undefined,
      raw: data,
    };
  }

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
}
