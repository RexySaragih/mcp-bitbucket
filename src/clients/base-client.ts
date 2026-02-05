export interface BitbucketClientConfig {
  email: string;
  apiToken: string;
}

export class BaseClient {
  protected readonly apiBase = 'https://api.bitbucket.org/2.0';

  constructor(protected readonly config: BitbucketClientConfig) {
    if (!config.email) throw new Error('ATLASSIAN_EMAIL is required');
    if (!config.apiToken) throw new Error('ATLASSIAN_API_TOKEN is required');
  }

  protected headers() {
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

  protected async assertOk(response: Response, context: string) {
    if (response.ok) return;
    const body = await response.text().catch(() => '');
    throw new Error(`${context}: ${response.status} ${response.statusText} ${body}`);
  }

  protected parseDiff(diffText: string) {
    const files: Array<{
      path: string;
      status: 'added' | 'removed' | 'modified' | 'renamed';
      oldPath?: string;
      additions?: number;
      deletions?: number;
    }> = [];
    const lines = diffText.split('\n');
    let currentFile: typeof files[0] | null = null;
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
}
