#!/usr/bin/env node

/**
 * Standalone authentication script
 * Run with: npm run auth
 */

import { authenticate } from './auth.js';

async function main() {
    console.log('='.repeat(60));
    console.log('Gmail MCP Server - Authentication Setup');
    console.log('='.repeat(60));
    console.log('');

    try {
        await authenticate();
        console.log('');
        console.log('='.repeat(60));
        console.log('✓ Authentication setup complete!');
        console.log('='.repeat(60));
        console.log('');
        console.log('Next steps:');
        console.log('1. Build the project: npm run build');
        console.log('2. Add to Claude Desktop config:');
        console.log('   ~/Library/Application Support/Claude/claude_desktop_config.json');
        console.log('');
        console.log('   {');
        console.log('     "mcpServers": {');
        console.log('       "gmail": {');
        console.log('         "command": "node",');
        console.log('         "args": ["/Users/lakshmivadhanie/Documents/claude-gmail-mcp/dist/index.js"]');
        console.log('       }');
        console.log('     }');
        console.log('   }');
        console.log('');
        console.log('3. Restart Claude Desktop');
        console.log('');
    } catch (error) {
        console.error('');
        console.error('='.repeat(60));
        console.error('❌ Authentication failed');
        console.error('='.repeat(60));
        console.error('');
        console.error('Error:', error instanceof Error ? error.message : String(error));
        console.error('');
        process.exit(1);
    }
}

main();
