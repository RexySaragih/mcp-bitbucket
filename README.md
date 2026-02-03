# Bitbucket MCP Server

A TypeScript MCP server that enables Cursor to interact with Bitbucket Cloud repositories, pull requests, and branches.

## Features

### Smart Parameter Handling

The MCP server provides intelligent parameter handling with helpful error messages:

- **URL Extraction**: Automatically extracts workspace and repository from Bitbucket URLs
- **Environment Fallbacks**: Uses `BITBUCKET_WORKSPACE` and `BITBUCKET_REPOSITORY` environment variables as defaults
- **Helpful Error Messages**: When parameters are missing, the agent receives clear instructions on how to provide them

**Priority Order**: Direct parameters > URL extraction > Environment variables

**Example Error Message**:
```
Missing required parameter(s): workspace, repository.

Please provide them in one of these ways:
1. Extract from a Bitbucket URL (e.g., https://bitbucket.org/workspace/repo/pull-requests/123)
   - Use the 'prUrl' or 'repoUrl' parameter with the full URL
2. Provide directly as parameters: workspace="<workspace>", repository="<repository>"
3. Set environment variables: BITBUCKET_WORKSPACE and BITBUCKET_REPOSITORY

💡 Tip: If you have a Bitbucket URL, extract the workspace and repository from it and provide them as parameters.
```

This allows agents to intelligently handle missing parameters by asking the user for a URL or extracting the information themselves.

### Repository Operations

| Tool | Description |
|------|-------------|
| `read_repository` | Get repository info (name, description, default branch, permissions), list branches, tags, and recent commits |
| `read_branch` | Get branch details (name, latest commit, author, date), compare branch with main/master, list files changed |
| `read_commit` | Get commit details (message, author, date, diff), get commit files changed, parse commit message for Jira ticket references |
| `read_file` | Read file content from any branch/tag, get file history, check if file exists |
| `search_code` | Search across repositories, search by file path, content, or extension, filter by branch |

### Pull Request Operations

| Tool | Description |
|------|-------------|
| `list_pull_requests` | List PRs by status (open, merged, declined), filter by repository, author, or Jira ticket |
| `read_pull_request` | Get PR details (title, description, status, reviewers), get PR diff/files changed, get PR comments and approvals, extract linked Jira tickets |
| `create_pull_request` | Create PR with title, description, source/target branches, auto-generate description from commits, auto-link to Jira ticket if mentioned, set reviewers |
| `update_pull_request` | Update PR title, description, or status, add/remove reviewers, add comments (general or inline line-specific), merge PR (with merge strategy option) |

### Branch Operations

| Tool | Description |
|------|-------------|
| `create_branch` | Create branch from source branch, auto-name from Jira ticket: `feature/PROJ-123-description`, validate branch name format |
| `delete_branch` | Delete branch (with safety checks), clean up merged feature branches |

### File Operations

| Tool | Description |
|------|-------------|
| `write_file` | Write or update a single file in the repository, creates a commit with the change on the specified branch |
| `commit_files` | Commit multiple files in a single atomic commit, useful for related changes across multiple files |

## Prerequisites

- Node.js 18+ (uses built-in `fetch`)
- Bitbucket Cloud account (uses `https://api.bitbucket.org/2.0` - no URL configuration needed)
- Authentication: Atlassian API token (same as Confluence/Jira MCP servers)
  - **Email** - your Atlassian account email
  - **API Token** - generated from https://id.atlassian.com/manage-profile/security/api-tokens

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
ATLASSIAN_EMAIL=your-email@example.com
ATLASSIAN_API_TOKEN=your-api-token
BITBUCKET_WORKSPACE=your-workspace
BITBUCKET_REPOSITORY=your-repository
```

**Authentication:**
- `ATLASSIAN_EMAIL` - Your Atlassian account email address
- `ATLASSIAN_API_TOKEN` - API token from https://id.atlassian.com/manage-profile/security/api-tokens

**Default Workspace/Repository (Optional):**
- `BITBUCKET_WORKSPACE` - Default workspace name (can be omitted if provided in each tool call)
- `BITBUCKET_REPOSITORY` - Default repository name (can be omitted if provided in each tool call)

If you set `BITBUCKET_WORKSPACE` and `BITBUCKET_REPOSITORY`, you can omit these parameters from tool calls and they'll be used automatically.

### 3. Build

```bash
npm run build
```

### 4. Run (stdio MCP)

```bash
npm start
```

You should see: `Bitbucket MCP server ready (stdio)`.

## Cursor Configuration

Add the following to `~/.cursor/mcp.json`:

### Option 1: Inline environment variables

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-mcp-server/dist/index.js"],
      "env": {
        "ATLASSIAN_EMAIL": "your-email@example.com",
        "ATLASSIAN_API_TOKEN": "your-api-token",
        "BITBUCKET_WORKSPACE": "your-workspace",
        "BITBUCKET_REPOSITORY": "your-repository"
      }
    }
  }
}
```

### Option 2: Using `.env` file

If you prefer to keep credentials in a `.env` file (created during setup), you can omit the `env` block. The server automatically loads `.env` from the project root:

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-mcp-server/dist/index.js"]
    }
  }
}
```

Make sure your `.env` file exists in the project root:

```env
ATLASSIAN_EMAIL=your-email@example.com
ATLASSIAN_API_TOKEN=your-api-token
BITBUCKET_WORKSPACE=your-workspace
BITBUCKET_REPOSITORY=your-repository
```

> **Note:** Replace `/path/to/bitbucket-mcp-server` with the actual path to this project. Environment variables in `mcp.json` take precedence over `.env` if both are provided.

## Tool Usage Examples

### Using URLs for Workspace/Repository

All tools support extracting workspace and repository from Bitbucket URLs. This is especially useful when working with pull requests:

**Using PR URL:**
```json
{
  "prUrl": "https://bitbucket.org/myworkspace/myrepo/pull-requests/123",
  "includeDiff": true
}
```

**Using direct parameters:**
```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "pullRequestId": 123,
  "includeDiff": true
}
```

Both approaches work identically. The URL extraction automatically parses:
- `workspace` from the URL path
- `repository` from the URL path
- `pullRequestId` from the URL path (for PR operations)

### read_repository

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo"
}
```

> **Note:** `workspace` and `repository` are optional if `BITBUCKET_WORKSPACE` and `BITBUCKET_REPOSITORY` are set in environment variables.

### read_branch

```json
{
  "branch": "feature/new-feature",
  "compareWithMain": true
}
```

> **Note:** `workspace` and `repository` are optional if set in environment variables.

### read_commit

```json
{
  "commitHash": "abc123def456",
  "includeDiff": true
}
```

> **Note:** `workspace` and `repository` are optional if set in environment variables.

### read_file

```json
{
  "filePath": "src/index.ts",
  "ref": "main"
}
```

> **Note:** `workspace` and `repository` are optional if set in environment variables.

### search_code

```json
{
  "query": "function myFunction",
  "filePath": "*.ts",
  "branch": "main"
}
```

> **Note:** `workspace` and `repository` are optional if set in environment variables.

### list_pull_requests

```json
{
  "state": "OPEN",
  "author": "username"
}
```

> **Note:** `workspace` and `repository` are optional if set in environment variables.

### read_pull_request

**Using PR URL (recommended):**
```json
{
  "prUrl": "https://bitbucket.org/myworkspace/myrepo/pull-requests/123",
  "includeDiff": true,
  "includeComments": true
}
```

**Using direct parameters:**
```json
{
  "pullRequestId": 123,
  "includeDiff": true,
  "includeComments": true
}
```

> **Note:** When using `prUrl`, workspace, repository, and pullRequestId are automatically extracted. Direct parameters are optional if set in environment variables.

### create_pull_request

```json
{
  "title": "Add new feature",
  "description": "Implements PROJ-123",
  "sourceBranch": "feature/new-feature",
  "destinationBranch": "main",
  "reviewers": ["reviewer1", "reviewer2"],
  "autoGenerateDescription": true
}
```

> **Note:** `workspace` and `repository` are optional if set in environment variables.

### update_pull_request

**General comment using PR URL:**
```json
{
  "prUrl": "https://bitbucket.org/myworkspace/myrepo/pull-requests/123",
  "comment": "Great work!"
}
```

**General comment using direct parameters:**
```json
{
  "pullRequestId": 123,
  "comment": "Great work!"
}
```

**Inline comment on specific line:**
```json
{
  "prUrl": "https://bitbucket.org/myworkspace/myrepo/pull-requests/123",
  "comment": "Consider adding error handling here",
  "commentFilePath": "src/models/trex/BiFastDetail.ts",
  "commentLineNumber": 42
}
```

**Update PR and merge:**
```json
{
  "prUrl": "https://bitbucket.org/myworkspace/myrepo/pull-requests/123",
  "title": "Updated title",
  "state": "MERGED",
  "mergeStrategy": "squash"
}
```

> **Note:** `prUrl` automatically extracts workspace, repository, and pullRequestId. Alternatively, provide them directly or use environment variables.

### create_branch

**From Jira ticket:**
```json
{
  "fromJiraTicket": "PROJ-123",
  "description": "implement new feature",
  "sourceBranch": "main"
}
```

**With explicit name:**
```json
{
  "name": "feature/my-branch",
  "sourceBranch": "main"
}
```

> **Note:** `workspace` and `repository` are optional if set in environment variables.

### delete_branch

```json
{
  "branchName": "feature/old-feature",
  "onlyIfMerged": true
}
```

> **Note:** `workspace` and `repository` are optional if set in environment variables.

### write_file

```json
{
  "filePath": "src/components/NewComponent.tsx",
  "content": "export const NewComponent = () => { return <div>Hello</div>; };",
  "branch": "feature/new-component",
  "message": "Add new component"
}
```

> **Note:** `workspace` and `repository` are optional if set in environment variables. The `author` parameter is also optional and defaults to the authenticated user.

### commit_files

```json
{
  "branch": "feature/multi-file-update",
  "message": "Update multiple configuration files",
  "files": [
    {
      "path": "package.json",
      "content": "{\"name\": \"my-app\", \"version\": \"1.0.0\"}"
    },
    {
      "path": "tsconfig.json",
      "content": "{\"compilerOptions\": {\"strict\": true}}"
    }
  ]
}
```

> **Note:** `workspace` and `repository` are optional if set in environment variables. The `author` parameter is also optional and defaults to the authenticated user.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled MCP server |
| `npm run dev` | Run directly with ts-node (development) |

## Notes

- **API Endpoint:** The server uses Bitbucket Cloud API at `https://api.bitbucket.org/2.0` (hardcoded, no configuration needed)
- **Authentication:** Uses `ATLASSIAN_EMAIL` + `ATLASSIAN_API_TOKEN` with Basic auth (same pattern as Confluence/Jira MCP servers)
- **Default Workspace/Repository:** Set `BITBUCKET_WORKSPACE` and `BITBUCKET_REPOSITORY` in environment to make them optional in tool calls
- **Inline Comments:** Use `commentFilePath` and `commentLineNumber` together with `comment` to create line-specific PR comments
- Server uses stdio transport only; no HTTP port is opened
- Branch names are automatically validated according to Bitbucket rules
- Jira ticket references (e.g., `PROJ-123`) are automatically extracted from commit messages and PR descriptions
- Protected branches (main, master, develop, dev) cannot be deleted

