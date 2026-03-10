import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { readFileSync, existsSync } from 'fs';
import { CONFIG } from './config.js';

/**
 * Convert plain text to HTML with proper formatting
 */
function textToHtml(text: string): string {
    // Split by double line breaks for paragraphs, single line breaks become <br>
    return text
        .split('\n\n')
        .map(para => {
            // Within each paragraph, replace single line breaks with <br>
            return para.split('\n').join('<br>');
        })
        .filter(para => para.trim()) // Remove empty paragraphs
        .map(para => `<p style="margin: 0 0 10px 0;">${para}</p>`)
        .join('\n');
}

/**
 * Create MIME message for HTML email
 */
function createMimeMessage(to: string, subject: string, body: string): string {
    const htmlBody = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    ${textToHtml(body)}
</body>
</html>`;

    const message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlBody,
    ].join('\r\n');

    return Buffer.from(message).toString('base64url');
}

/**
 * Create MIME message with PDF attachment
 */
function createMimeMessageWithAttachment(
    to: string,
    subject: string,
    body: string,
    attachmentPath: string,
    attachmentName: string
): string {
    if (!existsSync(attachmentPath)) {
        throw new Error(`Resume file not found at ${attachmentPath}`);
    }

    const boundary = `boundary_${Date.now()}`;
    const attachment = readFileSync(attachmentPath);
    const attachmentBase64 = attachment.toString('base64');

    const htmlBody = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    ${textToHtml(body)}
</body>
</html>`;

    const message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlBody,
        '',
        `--${boundary}`,
        `Content-Type: application/pdf; name="${attachmentName}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${attachmentName}"`,
        '',
        attachmentBase64,
        `--${boundary}--`,
    ].join('\r\n');

    return Buffer.from(message).toString('base64url');
}

/**
 * Create a Gmail draft
 */
export async function createDraft(
    auth: OAuth2Client,
    to: string,
    subject: string,
    body: string,
    attachResume: boolean = false
): Promise<{ draftId: string; message: string }> {
    const gmail = google.gmail({ version: 'v1', auth });

    // Append signature to body
    const fullBody = `${body}\n\n${CONFIG.signature}`;

    // Create MIME message
    const encodedMessage = attachResume
        ? createMimeMessageWithAttachment(to, subject, fullBody, CONFIG.paths.resume, 'LakshmiVadhanie_Resume.pdf')
        : createMimeMessage(to, subject, fullBody);

    // Create draft
    const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
            message: {
                raw: encodedMessage,
            },
        },
    });

    const draftId = response.data.id!;
    const attachmentInfo = attachResume ? ' with resume attached' : '';

    return {
        draftId,
        message: `Draft created successfully${attachmentInfo}!\nDraft ID: ${draftId}\nTo: ${to}\nSubject: ${subject}`,
    };
}

/**
 * List Gmail drafts
 */
export async function listDrafts(
    auth: OAuth2Client,
    maxResults: number = 10
): Promise<Array<{ id: string; subject: string; to: string; snippet: string }>> {
    const gmail = google.gmail({ version: 'v1', auth });

    const response = await gmail.users.drafts.list({
        userId: 'me',
        maxResults,
    });

    const drafts = response.data.drafts || [];

    // Fetch full draft details to get subject and recipient
    const draftDetails = await Promise.all(
        drafts.map(async (draft) => {
            const details = await gmail.users.drafts.get({
                userId: 'me',
                id: draft.id!,
                format: 'metadata',
            });

            const headers = details.data.message?.payload?.headers || [];
            const to = headers.find((h: any) => h.name === 'To')?.value || 'Unknown';
            const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(No subject)';
            const snippet = details.data.message?.snippet || '';

            return {
                id: draft.id!,
                subject,
                to,
                snippet,
            };
        })
    );

    return draftDetails;
}

/**
 * Send a Gmail draft
 */
export async function sendDraft(
    auth: OAuth2Client,
    draftId: string
): Promise<{ messageId: string; message: string }> {
    const gmail = google.gmail({ version: 'v1', auth });

    const response = await gmail.users.drafts.send({
        userId: 'me',
        requestBody: {
            id: draftId,
        },
    });

    const messageId = response.data.id!;

    return {
        messageId,
        message: `Draft sent successfully!\nMessage ID: ${messageId}`,
    };
}

/**
 * Read/search Gmail messages
 */
export async function readEmails(
    auth: OAuth2Client,
    query: string = '',
    maxResults: number = 10
): Promise<Array<{
    id: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    date: string;
    snippet: string;
    body: string;
}>> {
    const gmail = google.gmail({ version: 'v1', auth });

    // Search for messages
    const searchResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
    });

    const messages = searchResponse.data.messages || [];

    if (messages.length === 0) {
        return [];
    }

    // Fetch full message details
    const messageDetails = await Promise.all(
        messages.map(async (message) => {
            const details = await gmail.users.messages.get({
                userId: 'me',
                id: message.id!,
                format: 'full',
            });

            const headers = details.data.payload?.headers || [];
            const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
            const to = headers.find((h: any) => h.name === 'To')?.value || 'Unknown';
            const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(No subject)';
            const date = headers.find((h: any) => h.name === 'Date')?.value || 'Unknown';
            const snippet = details.data.snippet || '';

            // Extract email body
            let body = '';
            const parts = details.data.payload?.parts;

            if (parts) {
                // Multipart message
                for (const part of parts) {
                    if (part.mimeType === 'text/plain' && part.body?.data) {
                        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                        break;
                    }
                }
                // Fallback to HTML if no plain text
                if (!body) {
                    for (const part of parts) {
                        if (part.mimeType === 'text/html' && part.body?.data) {
                            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                            break;
                        }
                    }
                }
            } else if (details.data.payload?.body?.data) {
                // Simple message
                body = Buffer.from(details.data.payload.body.data, 'base64').toString('utf-8');
            }

            return {
                id: message.id!,
                threadId: details.data.threadId || '',
                from,
                to,
                subject,
                date,
                snippet,
                body: body || snippet,
            };
        })
    );

    return messageDetails;
}

