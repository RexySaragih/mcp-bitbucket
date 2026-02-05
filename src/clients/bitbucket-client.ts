import { BitbucketClientConfig } from './base-client.js';
import { RepositoryClient } from './repository-client.js';
import { PullRequestClient } from './pull-request-client.js';
import { BranchClient } from './branch-client.js';
import { FileOperationsClient } from './file-operations-client.js';

export { BitbucketClientConfig };

/**
 * Main Bitbucket client that composes all domain-specific clients
 */
export class BitbucketClient {
  private readonly repositoryClient: RepositoryClient;
  private readonly pullRequestClient: PullRequestClient;
  private readonly branchClient: BranchClient;
  private readonly fileOperationsClient: FileOperationsClient;

  constructor(config: BitbucketClientConfig) {
    this.repositoryClient = new RepositoryClient(config);
    this.pullRequestClient = new PullRequestClient(config);
    this.branchClient = new BranchClient(config);
    this.fileOperationsClient = new FileOperationsClient(config);
  }

  // Repository operations
  getRepository(...args: Parameters<RepositoryClient['getRepository']>) {
    return this.repositoryClient.getRepository(...args);
  }
  listBranches(...args: Parameters<RepositoryClient['listBranches']>) {
    return this.repositoryClient.listBranches(...args);
  }
  listTags(...args: Parameters<RepositoryClient['listTags']>) {
    return this.repositoryClient.listTags(...args);
  }
  getBranch(...args: Parameters<RepositoryClient['getBranch']>) {
    return this.repositoryClient.getBranch(...args);
  }
  getCommit(...args: Parameters<RepositoryClient['getCommit']>) {
    return this.repositoryClient.getCommit(...args);
  }
  getCommitDiff(...args: Parameters<RepositoryClient['getCommitDiff']>) {
    return this.repositoryClient.getCommitDiff(...args);
  }
  listCommits(...args: Parameters<RepositoryClient['listCommits']>) {
    return this.repositoryClient.listCommits(...args);
  }
  getFileContent(...args: Parameters<RepositoryClient['getFileContent']>) {
    return this.repositoryClient.getFileContent(...args);
  }
  compareBranches(...args: Parameters<RepositoryClient['compareBranches']>) {
    return this.repositoryClient.compareBranches(...args);
  }
  searchCode(...args: Parameters<RepositoryClient['searchCode']>) {
    return this.repositoryClient.searchCode(...args);
  }

  // Pull Request operations
  listPullRequests(...args: Parameters<PullRequestClient['listPullRequests']>) {
    return this.pullRequestClient.listPullRequests(...args);
  }
  getPullRequest(...args: Parameters<PullRequestClient['getPullRequest']>) {
    return this.pullRequestClient.getPullRequest(...args);
  }
  getPullRequestDiff(...args: Parameters<PullRequestClient['getPullRequestDiff']>) {
    return this.pullRequestClient.getPullRequestDiff(...args);
  }
  getPullRequestComments(...args: Parameters<PullRequestClient['getPullRequestComments']>) {
    return this.pullRequestClient.getPullRequestComments(...args);
  }
  createPullRequest(...args: Parameters<PullRequestClient['createPullRequest']>) {
    return this.pullRequestClient.createPullRequest(...args);
  }
  updatePullRequest(...args: Parameters<PullRequestClient['updatePullRequest']>) {
    return this.pullRequestClient.updatePullRequest(...args);
  }
  mergePullRequest(...args: Parameters<PullRequestClient['mergePullRequest']>) {
    return this.pullRequestClient.mergePullRequest(...args);
  }
  addPullRequestComment(...args: Parameters<PullRequestClient['addPullRequestComment']>) {
    return this.pullRequestClient.addPullRequestComment(...args);
  }
  replyToPullRequestComment(...args: Parameters<PullRequestClient['replyToPullRequestComment']>) {
    return this.pullRequestClient.replyToPullRequestComment(...args);
  }

  // Branch operations
  createBranch(...args: Parameters<BranchClient['createBranch']>) {
    return this.branchClient.createBranch(...args);
  }
  deleteBranch(...args: Parameters<BranchClient['deleteBranch']>) {
    return this.branchClient.deleteBranch(...args);
  }

  // File operations
  writeFile(...args: Parameters<FileOperationsClient['writeFile']>) {
    return this.fileOperationsClient.writeFile(...args);
  }
  commitFiles(...args: Parameters<FileOperationsClient['commitFiles']>) {
    return this.fileOperationsClient.commitFiles(...args);
  }
}
