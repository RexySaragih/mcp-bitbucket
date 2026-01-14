// Repository types
export interface Repository {
  uuid: string;
  fullName: string;
  name: string;
  workspace: string;
  description?: string;
  isPrivate: boolean;
  defaultBranch?: string;
  language?: string;
  createdOn?: string;
  updatedOn?: string;
  raw?: Record<string, unknown>;
}

export interface Branch {
  name: string;
  target?: {
    hash: string;
    date?: string;
    author?: {
      raw?: string;
      user?: {
        displayName?: string;
        username?: string;
      };
    };
    message?: string;
  };
  raw?: Record<string, unknown>;
}

export interface Tag {
  name: string;
  target?: {
    hash: string;
    date?: string;
    author?: {
      raw?: string;
      user?: {
        displayName?: string;
        username?: string;
      };
    };
    message?: string;
  };
  raw?: Record<string, unknown>;
}

export interface Commit {
  hash: string;
  message?: string;
  author?: {
    raw?: string;
    user?: {
      displayName?: string;
      username?: string;
    };
  };
  date?: string;
  parents?: Array<{ hash: string }>;
  raw?: Record<string, unknown>;
}

export interface CommitDiff {
  files: Array<{
    path: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    oldPath?: string;
    additions?: number;
    deletions?: number;
  }>;
  stats?: {
    additions?: number;
    deletions?: number;
    total?: number;
  };
}

export interface FileContent {
  path: string;
  content?: string;
  size?: number;
  encoding?: string;
  raw?: Record<string, unknown>;
}

export interface FileHistory {
  path: string;
  commits: Array<{
    hash: string;
    message?: string;
    date?: string;
    author?: string;
  }>;
}

// Pull Request types
export interface PullRequest {
  id: number;
  title: string;
  description?: string;
  state: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED';
  source?: {
    branch?: { name: string };
    repository?: { fullName: string };
    commit?: { hash: string };
  };
  destination?: {
    branch?: { name: string };
    repository?: { fullName: string };
  };
  author?: {
    displayName?: string;
    username?: string;
    uuid?: string;
  };
  createdOn?: string;
  updatedOn?: string;
  reviewers?: Array<{
    displayName?: string;
    username?: string;
    uuid?: string;
    approved?: boolean;
  }>;
  raw?: Record<string, unknown>;
}

export interface PullRequestDiff {
  files: Array<{
    path: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    oldPath?: string;
    additions?: number;
    deletions?: number;
  }>;
  stats?: {
    additions?: number;
    deletions?: number;
    total?: number;
  };
}

export interface PullRequestComment {
  id: number;
  content?: {
    raw?: string;
    markup?: string;
  };
  author?: {
    displayName?: string;
    username?: string;
  };
  createdOn?: string;
  updatedOn?: string;
  inline?: {
    path?: string;
    to?: number;
    from?: number;
  };
  raw?: Record<string, unknown>;
}

export interface CreatePullRequestParams {
  workspace: string;
  repository: string;
  title: string;
  description?: string;
  sourceBranch: string;
  destinationBranch?: string;
  reviewers?: string[];
  closeSourceBranch?: boolean;
}

export interface UpdatePullRequestParams {
  workspace: string;
  repository: string;
  pullRequestId: number;
  title?: string;
  description?: string;
  reviewers?: string[];
  state?: 'OPEN' | 'MERGED' | 'DECLINED';
  mergeStrategy?: 'merge_commit' | 'squash' | 'fast_forward';
}

// Branch operation types
export interface CreateBranchParams {
  workspace: string;
  repository: string;
  name: string;
  sourceBranch?: string;
  sourceCommit?: string;
}

// Search types
export interface CodeSearchResult {
  file?: {
    path: string;
    type?: string;
  };
  content?: {
    lines?: Array<{
      line?: number;
      segment?: string;
    }>;
  };
  raw?: Record<string, unknown>;
}

export interface CodeSearchParams {
  workspace: string;
  repository: string;
  query: string;
  filePath?: string;
  branch?: string;
}

// Pagination types
export interface PaginatedResponse<T> {
  values: T[];
  page?: number;
  size?: number;
  pagelen?: number;
  next?: string;
  previous?: string;
}

