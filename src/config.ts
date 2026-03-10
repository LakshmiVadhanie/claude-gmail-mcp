import { homedir } from 'os';
import { join } from 'path';

// Get the username for Mac paths
const username = homedir().split('/').pop() || 'dhruvgorasiya';
const baseDir = `/Users/${username}/Desktop/claude-gmail`;

export const CONFIG = {
    // File paths
    paths: {
        credentials: join(baseDir, 'credentials.json'),
        token: join(baseDir, 'token.json'),
        resume: join(baseDir, 'Dhruv_Gorasiya_Resume.pdf'),
    },

    // Gmail API scopes
    scopes: [
        'https://www.googleapis.com/auth/gmail.modify', // Full Gmail access (read, compose, send, modify)
    ],

    // Email signature
    signature: `Best,
Dhruv Gorasiya

Phone: (925) 297-7110
LinkedIn: https://linkedin.com/in/dhruvgorasiya
Portfolio: https://dhruvgorasiya.netlify.app
GitHub: https://github.com/DhruvGorasiya`,

    // Profile context for email drafting
    profile: {
        name: 'Dhruv Gorasiya',
        education: 'MS in Computer Science at Northeastern University (3.92 GPA, graduating May 2026)',
        currentRole: 'Teaching Assistant for MLOps course',
        experience: [
            'Software Developer Intern at Weaviate - built hybrid search systems and APIs handling 50K+ daily requests',
            'Founded Twinly - AI productivity startup integrating Gmail, Notion, and Slack APIs, led team of 4 engineers',
            'Research Assistant in ML at California State University Long Beach - locality sensitive hashing and entity resolution',
        ],
        skills: 'Python, TypeScript, FastAPI, React, PostgreSQL, Vector Databases, AI/ML Infrastructure',
        targetRoles: 'Software Engineering roles with AI/ML focus',
    },

    // OAuth2 settings
    oauth: {
        redirectUri: 'http://localhost:3000/callback',
        port: 3000,
    },
};

// Format profile as a readable string
export function getProfileString(): string {
    const p = CONFIG.profile;
    return `Name: ${p.name}

Education: ${p.education}

Current Role: ${p.currentRole}

Experience:
${p.experience.map((exp, i) => `${i + 1}. ${exp}`).join('\n')}

Skills: ${p.skills}

Target Roles: ${p.targetRoles}`;
}
