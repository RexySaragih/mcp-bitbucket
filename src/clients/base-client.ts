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
      hunks?: Array<{
        header: string;
        lines: Array<{
          type: 'add' | 'remove' | 'context';
          content: string;
          newLine?: number;
          oldLine?: number;
        }>;
      }>;
    }> = [];
    const rawLines = diffText.split('\n');
    let currentFile: typeof files[0] | null = null;
    let additions = 0;
    let deletions = 0;
    let currentHunk: NonNullable<typeof files[0]['hunks']>[0] | null = null;
    let newLineNum = 0;
    let oldLineNum = 0;

    for (const line of rawLines) {
      if (line.startsWith('diff --git')) {
        // Finalize previous file
        if (currentFile) {
          if (currentHunk && currentHunk.lines.length > 0) {
            if (!currentFile.hunks) currentFile.hunks = [];
            currentFile.hunks.push(currentHunk);
          }
          currentFile.additions = additions;
          currentFile.deletions = deletions;
          files.push(currentFile);
        }
        currentHunk = null;
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
      } else if (line.startsWith('@@')) {
        // Save previous hunk
        if (currentHunk && currentHunk.lines.length > 0 && currentFile) {
          if (!currentFile.hunks) currentFile.hunks = [];
          currentFile.hunks.push(currentHunk);
        }
        // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const hunkMatch = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        oldLineNum = hunkMatch ? parseInt(hunkMatch[1], 10) : 1;
        newLineNum = hunkMatch ? parseInt(hunkMatch[2], 10) : 1;
        currentHunk = { header: line, lines: [] };
      } else if (currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
          currentHunk.lines.push({
            type: 'add',
            content: line.substring(1),
            newLine: newLineNum,
          });
          newLineNum++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
          currentHunk.lines.push({
            type: 'remove',
            content: line.substring(1),
            oldLine: oldLineNum,
          });
          oldLineNum++;
        } else if (!line.startsWith('\\')) {
          // Context line (starts with space or is empty)
          currentHunk.lines.push({
            type: 'context',
            content: line.startsWith(' ') ? line.substring(1) : line,
            newLine: newLineNum,
            oldLine: oldLineNum,
          });
          newLineNum++;
          oldLineNum++;
        }
      }
    }

    // Finalize last file
    if (currentFile) {
      if (currentHunk && currentHunk.lines.length > 0) {
        if (!currentFile.hunks) currentFile.hunks = [];
        currentFile.hunks.push(currentHunk);
      }
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
