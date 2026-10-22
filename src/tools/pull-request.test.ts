import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleReadPullRequest } from './pull-request.js';
import type { BitbucketClient } from '../clients/bitbucket-client.js';
import type { PullRequestComment, PullRequestDiff } from '../types/index.js';

const lines = (start: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    type: 'context' as const,
    content: `code ${start + i}`,
    newLine: start + i,
    oldLine: start + i,
  }));

const diff: PullRequestDiff = {
  files: [
    {
      path: 'src/a.ts',
      status: 'modified',
      hunks: [
        {
          header: '@@ -10,7 +10,8 @@',
          lines: [
            ...lines(10, 3),
            { type: 'add', content: 'added line', newLine: 13 },
            ...lines(14, 4),
          ],
        },
      ],
    },
  ],
};

const comment = (overrides: Partial<PullRequestComment>): PullRequestComment => ({
  id: 1,
  content: { raw: 'review text' },
  author: { displayName: 'Reviewer' },
  ...overrides,
});

async function render(comments: PullRequestComment[], diffError = false): Promise<string> {
  const client = {
    getPullRequest: async () => ({ id: 7, title: 'PR', state: 'OPEN' }),
    getPullRequestComments: async () => comments,
    getPullRequestDiff: async () => {
      if (diffError) throw new Error('boom');
      return diff;
    },
  } as unknown as BitbucketClient;

  const result = await handleReadPullRequest(client, {
    workspace: 'ws',
    repository: 'repo',
    pullRequestId: 7,
    includeComments: true,
  });
  return result.content[0].text;
}

test('inline comment shows file, line and the anchored snippet with 2 lines of context', async () => {
  const text = await render([comment({ inline: { path: 'src/a.ts', to: 13 } })]);

  assert.match(text, /\*\*File:\*\* src\/a\.ts \(Line 13\)/);
  const expected = [
    '```diff',
    '       11 | code 11',
    '       12 | code 12',
    '> +    13 | added line',
    '       14 | code 14',
    '       15 | code 15',
    '```',
  ].join('\n');
  assert.ok(text.includes(expected), text);
  assert.doesNotMatch(text, /code 10|code 16/);
});

test('inline comment with only `from` is anchored on the old line number', async () => {
  const text = await render([comment({ inline: { path: 'src/a.ts', from: 11 } })]);

  assert.ok(text.includes('>      11 | code 11'), text);
});

test('inline comment outside the diff shows file and line only', async () => {
  const text = await render([comment({ inline: { path: 'src/a.ts', to: 99 } })]);

  assert.match(text, /\*\*File:\*\* src\/a\.ts \(Line 99\)/);
  assert.doesNotMatch(text, /```diff/);
});

test('inline comment falls back to file and line when the diff fetch fails', async () => {
  const text = await render([comment({ inline: { path: 'src/a.ts', to: 13 } })], true);

  assert.match(text, /\*\*File:\*\* src\/a\.ts \(Line 13\)/);
  assert.doesNotMatch(text, /```diff/);
  assert.doesNotMatch(text, /Could not fetch comments/);
});

test('general comment and reply output is unchanged', async () => {
  const text = await render([
    comment({ id: 1 }),
    comment({ id: 2, parent: { id: 1 } }),
  ]);

  assert.doesNotMatch(text, /\*\*File:\*\*/);
  assert.doesNotMatch(text, /```diff/);
  assert.ok(text.endsWith('**Comment ID:** 1\nreview text\n\n---\n\n### Reviewer ()\n**Comment ID:** 2\n**Reply to Comment:** #1\nreview text'), text);
});
