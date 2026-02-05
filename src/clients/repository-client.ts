import { BaseClient } from './base-client.js';
import {
  Repository,
  Branch,
  Tag,
  Commit,
  CommitDiff,
  FileContent,
  CodeSearchResult,
  CodeSearchParams,
  PaginatedResponse,
} from '../types/index.js';

export class RepositoryClient extends BaseClient {
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

    return this.parseDiff(diffText);
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

    return this.parseDiff(diffText);
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

    await this.assertOk(
      response,
      `Failed to search code in ${params.workspace}/${params.repository}`,
    );
    const data = (await response.json()) as any;

    return (data?.values || []).map((result: any) => ({
      file: result?.file,
      content: result?.content,
      raw: result,
    }));
  }
}
