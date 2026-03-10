# Gmail MCP Server

MCP (Model Context Protocol) server that connects Claude Desktop with Gmail, enabling email draft creation with resume attachments, draft management, and sending capabilities.

## Features

- **Create Drafts**: Create email drafts with automatic signature appending
- **Resume Attachments**: Optionally attach LakshmiVadhanie_Resume.pdf to drafts
- **List Drafts**: View all current Gmail drafts
- **Send Drafts**: Send drafts after review
- **Read Emails**: Search and read Gmail messages with full content
- **Profile Context**: Access profile information for personalized emails

## Prerequisites

- Node.js 18+ installed
- Google Cloud OAuth credentials (see setup below)
- Resume file (optional, for attachments)

## Setup

### 1. Install Dependencies

```bash
cd ~/Desktop/claude-gmail
npm install
```

### 2. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing one
3. Enable the Gmail API
4. Create OAuth 2.0 Client ID:
   - Application type: **Desktop app**
   - Name: `Gmail MCP Server` (or any name)
5. Download the credentials JSON file
6. Save it as `credentials.json` in the project root

### 3. Build the Project

```bash
npm run build
```

### 4. Authenticate with Gmail

```bash
npm run auth
```

This will:
- Open your browser for Google OAuth authorization
- Save the refresh token to `token.json`
- Allow long-term access to your Gmail

### 5. (Optional) Add Resume

Place your resume as `LakshmiVadhanie_Resume.pdf` in the project root to enable attachment functionality.

### 6. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/Desktop/claude-gmail/dist/index.js"]
    }
  }
}
```

Replace `YOUR_USERNAME` with your actual Mac username.

### 7. Restart Claude Desktop

Restart Claude Desktop to load the MCP server.

## Available Tools

### `create_draft`

Create a Gmail draft with optional resume attachment.

**Parameters:**
- `to` (string): Recipient email address
- `subject` (string): Email subject line
- `body` (string): Email body (signature appended automatically)
- `attachResume` (boolean, optional): Whether to attach LakshmiVadhanie_Resume.pdf

**Example:**
```
Create a draft to hiring@company.com with subject "Application for Software Engineer" 
and attach my resume
```

### `list_drafts`

List all current Gmail drafts.

**Parameters:**
- `maxResults` (number, optional): Maximum drafts to return (default: 10)

**Example:**
```
Show me my current email drafts
```

### `send_draft`

Send an existing draft by ID.

**Parameters:**
- `draftId` (string): The draft ID to send

**Example:**
```
Send the draft with ID 12345abc
```

### `get_profile`

Get profile context for drafting personalized emails.

**Example:**
```
Show me my profile information
```

### `read_emails`

Search and read Gmail messages with full content.

**Parameters:**
- `query` (string, optional): Gmail search query using Gmail search syntax
  - Examples: `"from:someone@example.com"`, `"subject:meeting"`, `"is:unread"`, `"after:2024/01/01"`
  - Leave empty for recent emails
- `maxResults` (number, optional): Maximum emails to return (default: 10)

**Examples:**
```
Read my last 5 emails
Show me unread emails from john@example.com
Find emails about "job application" from the last week
```

**Gmail Search Syntax:**
- `from:email@example.com` - Emails from specific sender
- `to:email@example.com` - Emails to specific recipient
- `subject:keyword` - Emails with keyword in subject
- `is:unread` - Unread emails only
- `is:starred` - Starred emails
- `after:2024/01/01` - Emails after date
- `before:2024/12/31` - Emails before date
- Combine with AND/OR: `from:john@example.com subject:meeting`

## File Structure

```
~/Desktop/claude-gmail/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── config.ts         # Configuration (paths, signature, profile)
│   ├── auth.ts           # OAuth2 authentication logic
│   ├── auth-cli.ts       # Standalone auth script
│   └── gmail.ts          # Gmail API operations
├── dist/                 # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── credentials.json      # Google OAuth credentials (you provide)
├── token.json            # Stored refresh token (generated)
└── LakshmiVadhanie_Resume.pdf            # Your resume (optional, you provide)
```

## Troubleshooting

### "credentials.json not found"
Create OAuth credentials from Google Cloud Console and save as `credentials.json`.

### "Authentication failed"
Run `npm run auth` to complete the OAuth flow.

### "Resume file not found"
Place your `LakshmiVadhanie_Resume.pdf` in the project root, or don't use `attachResume: true`.

### Token expired
The server automatically refreshes tokens. If refresh fails, delete `token.json` and run `npm run auth` again.

## Security Notes

- Keep `credentials.json` and `token.json` secure
- These files are in `.gitignore` to prevent accidental commits
- The refresh token provides long-term access until revoked
- This is for personal use only, not production

## License

MIT
