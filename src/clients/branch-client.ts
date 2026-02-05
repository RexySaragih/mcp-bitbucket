import { BaseClient } from './base-client.js';
import { Branch, CreateBranchParams } from '../types/index.js';

export class BranchClient extends BaseClient {
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
}
