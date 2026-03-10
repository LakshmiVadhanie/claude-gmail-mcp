#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { authenticate } from './auth.js';
import { createDraft, listDrafts, sendDraft, readEmails } from './gmail.js';
import { getProfileString } from './config.js';

// Tool schemas
const CreateDraftSchema = z.object({
    to: z.string().email().describe('Recipient email address'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body (signature will be appended automatically)'),
    attachResume: z.boolean().default(false).describe('Whether to attach resume.pdf'),
});

const ListDraftsSchema = z.object({
    maxResults: z.number().int().positive().default(10).describe('Maximum number of drafts to return'),
});

const SendDraftSchema = z.object({
    draftId: z.string().describe('The draft ID to send'),
});

const ReadEmailsSchema = z.object({
    query: z.string().default('').describe('Gmail search query (e.g., "from:someone@example.com", "subject:meeting", "is:unread", or leave empty for recent emails)'),
    maxResults: z.number().int().positive().default(10).describe('Maximum number of emails to return'),
});

// Tool definitions
const tools: Tool[] = [
    {
        name: 'create_draft',
        description:
            'Create a Gmail draft with optional resume attachment. The signature will be automatically appended to the email body.',
        inputSchema: {
            type: 'object',
            properties: {
                to: {
                    type: 'string',
                    description: 'Recipient email address',
                },
                subject: {
                    type: 'string',
                    description: 'Email subject line',
                },
                body: {
                    type: 'string',
                    description: 'Email body (signature will be appended automatically)',
                },
                attachResume: {
                    type: 'boolean',
                    description: 'Whether to attach resume.pdf (default: false)',
                    default: false,
                },
            },
            required: ['to', 'subject', 'body'],
        },
    },
    {
        name: 'list_drafts',
        description: 'List all current Gmail drafts with their details',
        inputSchema: {
            type: 'object',
            properties: {
                maxResults: {
                    type: 'number',
                    description: 'Maximum number of drafts to return (default: 10)',
                    default: 10,
                },
            },
        },
    },
    {
        name: 'send_draft',
        description: 'Send an existing Gmail draft by its ID',
        inputSchema: {
            type: 'object',
            properties: {
                draftId: {
                    type: 'string',
                    description: 'The draft ID to send',
                },
            },
            required: ['draftId'],
        },
    },
    {
        name: 'get_profile',
        description:
            'Get profile context (education, experience, skills) to help draft personalized emails',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'read_emails',
        description:
            'Search and read Gmail messages. Supports Gmail search syntax (e.g., "from:email@example.com", "subject:keyword", "is:unread", "after:2024/01/01"). Returns email details including sender, subject, date, and full body content.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Gmail search query (e.g., "from:someone@example.com", "subject:meeting", "is:unread"). Leave empty for recent emails.',
                    default: '',
                },
                maxResults: {
                    type: 'number',
                    description: 'Maximum number of emails to return (default: 10)',
                    default: 10,
                },
            },
        },
    },
];

// Create MCP server
const server = new Server(
    {
        name: 'gmail-mcp-server',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Global auth client (initialized on first tool call)
let authClient: Awaited<ReturnType<typeof authenticate>> | null = null;

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        // Initialize auth client if needed (except for get_profile)
        if (name !== 'get_profile' && !authClient) {
            console.error('Initializing Gmail authentication...');
            authClient = await authenticate();
        }

        switch (name) {
            case 'create_draft': {
                const parsed = CreateDraftSchema.parse(args);
                const result = await createDraft(
                    authClient!,
                    parsed.to,
                    parsed.subject,
                    parsed.body,
                    parsed.attachResume
                );
                return {
                    content: [
                        {
                            type: 'text',
                            text: result.message,
                        },
                    ],
                };
            }

            case 'list_drafts': {
                const parsed = ListDraftsSchema.parse(args);
                const drafts = await listDrafts(authClient!, parsed.maxResults);

                if (drafts.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: 'No drafts found.',
                            },
                        ],
                    };
                }

                const draftList = drafts
                    .map(
                        (draft, i) =>
                            `${i + 1}. Draft ID: ${draft.id}\n   To: ${draft.to}\n   Subject: ${draft.subject}\n   Preview: ${draft.snippet.substring(0, 100)}...`
                    )
                    .join('\n\n');

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${drafts.length} draft(s):\n\n${draftList}`,
                        },
                    ],
                };
            }

            case 'send_draft': {
                const parsed = SendDraftSchema.parse(args);
                const result = await sendDraft(authClient!, parsed.draftId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: result.message,
                        },
                    ],
                };
            }

            case 'get_profile': {
                const profileString = getProfileString();
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Profile Context:\n\n${profileString}`,
                        },
                    ],
                };
            }

            case 'read_emails': {
                const parsed = ReadEmailsSchema.parse(args);
                const emails = await readEmails(authClient!, parsed.query, parsed.maxResults);

                if (emails.length === 0) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: parsed.query
                                    ? `No emails found matching query: "${parsed.query}"`
                                    : 'No emails found.',
                            },
                        ],
                    };
                }

                const emailList = emails
                    .map(
                        (email, i) =>
                            `${i + 1}. From: ${email.from}\n   To: ${email.to}\n   Subject: ${email.subject}\n   Date: ${email.date}\n   \n   ${email.body.substring(0, 500)}${email.body.length > 500 ? '...' : ''}\n   \n   ---`
                    )
                    .join('\n\n');

                return {
                    content: [
                        {
                            type: 'text',
                            text: `Found ${emails.length} email(s)${parsed.query ? ` matching "${parsed.query}"` : ''}:\n\n${emailList}`,
                        },
                    ],
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Provide helpful error messages
        if (errorMessage.includes('credentials.json')) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Error: ${errorMessage}\n\nPlease set up Google OAuth credentials first.`,
                    },
                ],
                isError: true,
            };
        }

        if (errorMessage.includes('token.json') || errorMessage.includes('authentication')) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Authentication Error: ${errorMessage}\n\nPlease run: npm run auth`,
                    },
                ],
                isError: true,
            };
        }

        if (errorMessage.includes('resume.pdf')) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Error: ${errorMessage}\n\nPlease place your resume.pdf in the project directory.`,
                    },
                ],
                isError: true,
            };
        }

        return {
            content: [
                {
                    type: 'text',
                    text: `❌ Error: ${errorMessage}`,
                },
            ],
            isError: true,
        };
    }
});

// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Gmail MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
