# Gmail MCP Server - Development Prompt

## Overview

Build an MCP (Model Context Protocol) server that connects Claude with my personal Gmail account. The server should allow Claude to create email drafts with optional resume attachment, list drafts, and send drafts after I review them.

## Technical Requirements

- **Language:** TypeScript
- **Runtime:** Node.js (ES Modules)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Gmail API:** `googleapis` npm package
- **Auth:** OAuth2 with offline refresh token (one-time browser auth flow)

## Project Structure

```
~/Desktop/claude-gmail/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── config.ts         # Configuration (paths, signature, profile)
│   ├── auth.ts           # OAuth2 authentication logic
│   └── gmail.ts          # Gmail API operations
├── package.json
├── tsconfig.json
├── credentials.json      # (user provides) Google OAuth credentials
├── token.json            # (generated) Stored refresh token after auth
└── resume.pdf            # (user provides) Resume for attachments
```

## File Paths (Mac)

All paths should use the user's Mac username. The base directory is:
```
/Users/{USERNAME}/Desktop/claude-gmail/
```

Files:
- Credentials: `/Users/{USERNAME}/Desktop/claude-gmail/credentials.json`
- Token: `/Users/{USERNAME}/Desktop/claude-gmail/token.json`
- Resume: `/Users/{USERNAME}/Desktop/claude-gmail/resume.pdf`

## Configuration (src/config.ts)

Store the following configuration:

### Signature Block
```
Best,
Dhruv Gorasiya

Phone: (925) 297-7110
LinkedIn: https://linkedin.com/in/dhruvgorasiya
Portfolio: https://dhruvgorasiya.netlify.app
GitHub: https://github.com/DhruvGorasiya
```

### Profile Context (for email drafting)
```json
{
  "name": "Dhruv Gorasiya",
  "education": "MS in Computer Science at Northeastern University (3.92 GPA, graduating May 2026)",
  "currentRole": "Teaching Assistant for MLOps course",
  "experience": [
    "Software Developer Intern at Weaviate - built hybrid search systems and APIs handling 50K+ daily requests",
    "Founded Twinly - AI productivity startup integrating Gmail, Notion, and Slack APIs, led team of 4 engineers",
    "Research Assistant in ML at California State University Long Beach - locality sensitive hashing and entity resolution"
  ],
  "skills": "Python, TypeScript, FastAPI, React, PostgreSQL, Vector Databases, AI/ML Infrastructure",
  "targetRoles": "Software Engineering roles with AI/ML focus"
}
```

### Gmail API Scopes
```
https://www.googleapis.com/auth/gmail.compose
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
```

## MCP Tools to Implement

### 1. `create_draft`

Creates a Gmail draft with optional resume attachment.

**Input Schema:**
```typescript
{
  to: string;           // Recipient email address
  subject: string;      // Email subject line
  body: string;         // Email body (plain text, signature will be appended)
  attachResume: boolean; // Whether to attach resume.pdf (default: false)
}
```

**Behavior:**
- Append the signature block to the body automatically
- If `attachResume` is true, read resume.pdf and attach it as a MIME multipart message
- Create draft via Gmail API
- Return the draft ID and a confirmation message

**Implementation Notes:**
- Use base64url encoding for the MIME message
- For attachments, create a multipart/mixed MIME message with:
  - text/plain part for the body
  - application/pdf part for the resume (base64 encoded)

### 2. `list_drafts`

Lists all current drafts in Gmail.

**Input Schema:**
```typescript
{
  maxResults?: number;  // Optional, default 10
}
```

**Behavior:**
- Fetch drafts from Gmail API
- Return list with draft ID, subject, and recipient for each

### 3. `send_draft`

Sends an existing draft.

**Input Schema:**
```typescript
{
  draftId: string;      // The draft ID to send
}
```

**Behavior:**
- Send the draft via Gmail API
- Return confirmation with message ID

### 4. `get_profile`

Returns the stored profile context (so Claude can reference it when drafting emails).

**Input Schema:** None

**Behavior:**
- Return the profile configuration as a formatted string

## Authentication Flow (src/auth.ts)

Implement a one-time OAuth2 authentication:

1. Check if `token.json` exists
   - If yes, load credentials and check expiry
   - If expired, use refresh token to get new access token
   - If refresh fails, delete token.json and re-authenticate

2. If no token.json exists:
   - Generate OAuth URL with offline access and consent prompt
   - Start a temporary local HTTP server on port 3000
   - Open the auth URL in the default browser (use `open` command on Mac)
   - Handle the callback at `http://localhost:3000/callback`
   - Exchange the auth code for tokens
   - Save tokens to `token.json`
   - Shut down the temporary server

3. Return authenticated OAuth2Client

## MCP Server Setup (src/index.ts)

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
```

- Create server with name "gmail-mcp-server"
- Register all tools with proper schemas using Zod or inline JSON Schema
- Handle tool calls by routing to appropriate Gmail functions
- Use stdio transport for communication with Claude

## Gmail Operations (src/gmail.ts)

### Creating MIME Messages

For plain emails:
```typescript
function createMimeMessage(to: string, subject: string, body: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body
  ].join('\r\n');
  
  return Buffer.from(message).toString('base64url');
}
```

For emails with attachments:
```typescript
function createMimeMessageWithAttachment(
  to: string, 
  subject: string, 
  body: string, 
  attachmentPath: string,
  attachmentName: string
): string {
  const boundary = `boundary_${Date.now()}`;
  const attachment = fs.readFileSync(attachmentPath);
  const attachmentBase64 = attachment.toString('base64');
  
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${attachmentName}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    '',
    attachmentBase64,
    `--${boundary}--`
  ].join('\r\n');
  
  return Buffer.from(message).toString('base64url');
}
```

### Gmail API Calls

```typescript
// Create draft
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
const draft = await gmail.users.drafts.create({
  userId: 'me',
  requestBody: {
    message: {
      raw: encodedMessage
    }
  }
});

// List drafts
const drafts = await gmail.users.drafts.list({
  userId: 'me',
  maxResults: maxResults
});

// Send draft
const sent = await gmail.users.drafts.send({
  userId: 'me',
  requestBody: {
    id: draftId
  }
});
```

## package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "auth": "node dist/auth.js"
  }
}
```

The `auth` script should run a standalone authentication flow (import and call the auth function directly).

## Claude Desktop Configuration

After building, the user needs to add this to their Claude Desktop config at `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "node",
      "args": ["/Users/{USERNAME}/Desktop/claude-gmail/dist/index.js"]
    }
  }
}
```

## Error Handling

- If credentials.json is missing, throw clear error with instructions
- If token.json is missing/invalid, prompt user to run `npm run auth`
- If resume.pdf is missing when attachment requested, throw clear error
- Handle Gmail API errors gracefully with meaningful messages

## Testing Checklist

1. Run `npm install` and `npm run build`
2. Run `npm run auth` to complete one-time authentication
3. Restart Claude Desktop to load the MCP server
4. Test `get_profile` tool
5. Test `create_draft` without attachment
6. Test `create_draft` with attachment
7. Verify draft appears in Gmail
8. Test `list_drafts`
9. Test `send_draft`
10. Verify email is sent

## Important Notes

- This is for personal use only, not production
- The refresh token provides long-term access, but may need re-auth if revoked
- Keep credentials.json and token.json secure (add to .gitignore if version controlling)
- The server runs via stdio, so console.log goes to stderr for debugging
