import { BaseClient } from './base-client.js';
import { Commit, PaginatedResponse } from '../types/index.js';

export class FileOperationsClient extends BaseClient {
  async writeFile(params: {
    workspace: string;
    repository: string;
    filePath: string;
    content: string;
    branch: string;
    message: string;
    author?: string;
  }): Promise<Commit> {
    // Bitbucket API uses form-data for file uploads
    const formData = new URLSearchParams();
    formData.append(params.filePath, params.content);
    formData.append('message', params.message);
    formData.append('branch', params.branch);
    if (params.author) {
      formData.append('author', params.author);
    }

    const response = await fetch(
      `${this.apiBase}/repositories/${params.workspace}/${params.repository}/src`,
      {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      },
    );

    await this.assertOk(response, `Failed to write file ${params.filePath}`);

    // The response doesn't return commit details directly, so we need to fetch the latest commit
    const commits = await this.listCommits(
      params.workspace,
      params.repository,
      params.branch,
      1,
      1,
    );
    if (commits.values.length === 0) {
      throw new Error('Failed to retrieve commit information after file write');
    }

    return commits.values[0];
  }

  async commitFiles(params: {
    workspace: string;
    repository: string;
    branch: string;
    message: string;
    files: Array<{ path: string; content: string }>;
    author?: string;
  }): Promise<Commit> {
    // Bitbucket API uses form-data for file uploads
    const formData = new URLSearchParams();

    // Add each file to the form data
    for (const file of params.files) {
      formData.append(file.path, file.content);
    }

    formData.append('message', params.message);
    formData.append('branch', params.branch);
    if (params.author) {
      formData.append('author', params.author);
    }

    const response = await fetch(
      `${this.apiBase}/repositories/${params.workspace}/${params.repository}/src`,
      {
        method: 'POST',
        headers: {
          ...this.headers(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      },
    );

    await this.assertOk(response, `Failed to commit files`);

    // The response doesn't return commit details directly, so we need to fetch the latest commit
    const commits = await this.listCommits(
      params.workspace,
      params.repository,
      params.branch,
      1,
      1,
    );
    if (commits.values.length === 0) {
      throw new Error('Failed to retrieve commit information after committing files');
    }

    return commits.values[0];
  }

  // Helper method to list commits (needed for writeFile and commitFiles)
  private async listCommits(
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
}
