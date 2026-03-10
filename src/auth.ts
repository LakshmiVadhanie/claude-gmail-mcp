import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { createServer } from 'http';
import { parse } from 'url';
import { exec } from 'child_process';
import { CONFIG } from './config.js';

interface TokenData {
    access_token: string;
    refresh_token?: string;
    scope: string;
    token_type: string;
    expiry_date: number;
}

/**
 * Load OAuth2 credentials from credentials.json
 */
function loadCredentials(): any {
    if (!existsSync(CONFIG.paths.credentials)) {
        throw new Error(
            `credentials.json not found at ${CONFIG.paths.credentials}\n\n` +
            'Please create OAuth credentials from Google Cloud Console:\n' +
            '1. Go to https://console.cloud.google.com/apis/credentials\n' +
            '2. Create OAuth 2.0 Client ID (Desktop app)\n' +
            '3. Download credentials and save as credentials.json'
        );
    }

    const content = readFileSync(CONFIG.paths.credentials, 'utf-8');
    const credentials = JSON.parse(content);

    // Handle both direct credentials and installed app format
    if (credentials.installed) {
        return credentials.installed;
    }
    return credentials;
}

/**
 * Create OAuth2 client
 */
function createOAuth2Client(): OAuth2Client {
    const credentials = loadCredentials();
    const { client_id, client_secret, redirect_uris } = credentials;

    // Use configured redirect URI or fall back to first from credentials
    const redirectUri = CONFIG.oauth.redirectUri || redirect_uris[0];

    return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}

/**
 * Load saved token from token.json
 */
function loadToken(): TokenData | null {
    if (!existsSync(CONFIG.paths.token)) {
        return null;
    }

    try {
        const content = readFileSync(CONFIG.paths.token, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Error loading token:', error);
        return null;
    }
}

/**
 * Save token to token.json
 */
function saveToken(token: TokenData): void {
    writeFileSync(CONFIG.paths.token, JSON.stringify(token, null, 2));
    console.error('Token saved to', CONFIG.paths.token);
}

/**
 * Open URL in default browser (Mac)
 */
function openBrowser(url: string): void {
    exec(`open "${url}"`, (error) => {
        if (error) {
            console.error('Failed to open browser automatically. Please open this URL manually:');
            console.error(url);
        }
    });
}

/**
 * Run OAuth2 flow with local server
 */
async function runAuthFlow(oauth2Client: OAuth2Client): Promise<TokenData> {
    return new Promise((resolve, reject) => {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: CONFIG.scopes,
            prompt: 'consent', // Force consent to get refresh token
        });

        console.error('\n🔐 Starting OAuth2 authentication...\n');
        console.error('Opening browser for authorization...');
        console.error('If browser does not open, visit this URL:\n');
        console.error(authUrl);
        console.error('');

        // Create temporary HTTP server to handle callback
        const server = createServer(async (req, res) => {
            try {
                const url = parse(req.url || '', true);

                if (url.pathname === '/callback') {
                    const code = url.query.code as string;

                    if (!code) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end('<h1>Error: No authorization code received</h1>');
                        reject(new Error('No authorization code received'));
                        return;
                    }

                    // Exchange code for tokens
                    const { tokens } = await oauth2Client.getToken(code);

                    // Success response
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: green;">✓ Authentication Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);

                    // Close server
                    server.close();

                    resolve(tokens as TokenData);
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>Error during authentication</h1>');
                reject(error);
            }
        });

        server.listen(CONFIG.oauth.port, () => {
            console.error(`Listening for OAuth callback on port ${CONFIG.oauth.port}...`);
            openBrowser(authUrl);
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            server.close();
            reject(new Error('Authentication timeout - no response received within 5 minutes'));
        }, 5 * 60 * 1000);
    });
}

/**
 * Get authenticated OAuth2 client
 */
export async function authenticate(): Promise<OAuth2Client> {
    const oauth2Client = createOAuth2Client();

    // Try to load existing token
    let token = loadToken();

    if (token) {
        oauth2Client.setCredentials(token);

        // Check if token is expired
        const now = Date.now();
        if (token.expiry_date && token.expiry_date > now) {
            // Token is still valid
            console.error('✓ Using existing valid token');
            return oauth2Client;
        }

        // Try to refresh token
        if (token.refresh_token) {
            try {
                console.error('Refreshing expired token...');
                const { credentials } = await oauth2Client.refreshAccessToken();
                const newToken = credentials as TokenData;
                saveToken(newToken);
                oauth2Client.setCredentials(newToken);
                console.error('✓ Token refreshed successfully');
                return oauth2Client;
            } catch (error) {
                console.error('Failed to refresh token:', error);
                console.error('Deleting invalid token and re-authenticating...');
                unlinkSync(CONFIG.paths.token);
            }
        }
    }

    // No valid token, run auth flow
    console.error('No valid token found. Starting authentication flow...');
    token = await runAuthFlow(oauth2Client);
    saveToken(token);
    oauth2Client.setCredentials(token);

    console.error('\n✓ Authentication complete!\n');
    return oauth2Client;
}
