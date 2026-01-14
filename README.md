# Bitbucket MCP Server

A TypeScript MCP server that enables Cursor to interact with Bitbucket Cloud repositories, pull requests, and branches.

## Features

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
| `update_pull_request` | Update PR title, description, or status, add/remove reviewers, add comments, merge PR (with merge strategy option) |

### Branch Operations

| Tool | Description |
|------|-------------|
| `create_branch` | Create branch from source branch, auto-name from Jira ticket: `feature/PROJ-123-description`, validate branch name format |
| `delete_branch` | Delete branch (with safety checks), clean up merged feature branches |

## Prerequisites

- Node.js 18+ (uses built-in `fetch`)
- Bitbucket Cloud account (uses `https://api.bitbucket.org/2.0` - no URL configuration needed)
- Authentication (choose one):
  - **OAuth 2.0 Access Token or App Password as Bearer Token** (recommended) - only the token is needed, no username/email/URL required
  - **App Password with Basic Auth** (legacy) - requires username + app password

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root with **one** of the following options:

### Option 1: Access Token as Bearer Token (Recommended)

```env
BITBUCKET_ACCESS_TOKEN=your-access-token
```

**Important:** You only need the token itself - no username, email, or URL configuration needed. The server uses `https://api.bitbucket.org/2.0` automatically.

To get an access token, you can use either:

**A) OAuth 2.0 Access Token:**
1. Go to https://bitbucket.org/account/settings/applications/
2. Create an OAuth consumer
3. Generate an access token with scopes: `repository:read`, `repository:write`, `pullrequest:read`, `pullrequest:write`
4. Copy the generated access token (you won't see it again)

**B) App Password (can be used as Bearer token):**
1. Go to https://bitbucket.org/account/settings/app-passwords/
2. Click "Create app password"
3. Give it a label (e.g., "MCP Server")
4. Select scopes: `repository:read`, `repository:write`, `pullrequest:read`, `pullrequest:write`
5. Copy the generated password - you can use it directly as `BITBUCKET_ACCESS_TOKEN` (no username needed)

### Option 2: App Password (Legacy)

```env
BITBUCKET_USERNAME=your-username
BITBUCKET_APP_PASSWORD=your-app-password
```

To create an App Password:
1. Go to https://bitbucket.org/account/settings/app-passwords/
2. Click "Create app password"
3. Give it a label (e.g., "MCP Server")
4. Select scopes: `repository:read`, `repository:write`, `pullrequest:read`, `pullrequest:write`
5. Copy the generated password (you won't see it again)

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
        "BITBUCKET_ACCESS_TOKEN": "your-oauth-access-token"
      }
    }
  }
}
```

Or with App Password:

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-mcp-server/dist/index.js"],
      "env": {
        "BITBUCKET_USERNAME": "your-username",
        "BITBUCKET_APP_PASSWORD": "your-app-password"
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

Make sure your `.env` file exists in the project root with either:

**OAuth Token (recommended):**
```env
BITBUCKET_ACCESS_TOKEN=your-oauth-access-token
```

**Or App Password (legacy):**
```env
BITBUCKET_USERNAME=your-username
BITBUCKET_APP_PASSWORD=your-app-password
```

> **Note:** Replace `/path/to/bitbucket-mcp-server` with the actual path to this project. Environment variables in `mcp.json` take precedence over `.env` if both are provided.

## Tool Usage Examples

### read_repository

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo"
}
```

### read_branch

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "branch": "feature/new-feature",
  "compareWithMain": true
}
```

### read_commit

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "commitHash": "abc123def456",
  "includeDiff": true
}
```

### read_file

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "filePath": "src/index.ts",
  "ref": "main"
}
```

### search_code

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "query": "function myFunction",
  "filePath": "*.ts",
  "branch": "main"
}
```

### list_pull_requests

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "state": "OPEN",
  "author": "username"
}
```

### read_pull_request

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "pullRequestId": 123,
  "includeDiff": true,
  "includeComments": true
}
```

### create_pull_request

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "title": "Add new feature",
  "description": "Implements PROJ-123",
  "sourceBranch": "feature/new-feature",
  "destinationBranch": "main",
  "reviewers": ["reviewer1", "reviewer2"],
  "autoGenerateDescription": true
}
```

### update_pull_request

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "pullRequestId": 123,
  "title": "Updated title",
  "state": "MERGED",
  "mergeStrategy": "squash",
  "comment": "Great work!"
}
```

### create_branch

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "fromJiraTicket": "PROJ-123",
  "description": "implement new feature",
  "sourceBranch": "main"
}
```

Or with explicit name:

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "name": "feature/my-branch",
  "sourceBranch": "main"
}
```

### delete_branch

```json
{
  "workspace": "myworkspace",
  "repository": "myrepo",
  "branchName": "feature/old-feature",
  "onlyIfMerged": true
}
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled MCP server |
| `npm run dev` | Run directly with ts-node (development) |

## Notes

- **API Endpoint:** The server uses Bitbucket Cloud API at `https://api.bitbucket.org/2.0` (hardcoded, no configuration needed)
- **Authentication:** Either `BITBUCKET_ACCESS_TOKEN` (Bearer token - recommended) or both `BITBUCKET_USERNAME` and `BITBUCKET_APP_PASSWORD` (Basic auth) must be provided
- **Token Only:** When using `BITBUCKET_ACCESS_TOKEN`, you only need the token itself - no username, email, or URL required
- Server uses stdio transport only; no HTTP port is opened
- Branch names are automatically validated according to Bitbucket rules
- Jira ticket references (e.g., `PROJ-123`) are automatically extracted from commit messages and PR descriptions
- Protected branches (main, master, develop, dev) cannot be deleted

