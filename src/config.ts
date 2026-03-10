import { homedir } from 'os';
import { join } from 'path';

const baseDir = '/Users/lakshmivadhanie/Documents/claude-gmail-mcp';

export const CONFIG = {
    // File paths
    paths: {
        credentials: join(baseDir, 'credentials.json'),
        token: join(baseDir, 'token.json'),
        resume: join(baseDir, 'LakshmiVadhanie_Resume.pdf'),
    },

    // Gmail API scopes
    scopes: [
        'https://www.googleapis.com/auth/gmail.modify', // Full Gmail access (read, compose, send, modify)
    ],

    // Email signature
    signature: `Best,
Lakshmi Vadhanie Ganesh

Phone: (617) 992-5386
LinkedIn: https://linkedin.com/in/lakshmivadhanie/
Portfolio: https://lakshmivadhanie-portfolio.netlify.app/
GitHub: https://github.com/LakshmiVadhanie`,

    // Profile context for email drafting
    profile: {
        name: 'Lakshmi Vadhanie Ganesh',
        education: 'MS in Data Science at Northeastern University (3.83 GPA, graduating May 2026)',
        currentRole: 'Graduate Teaching Assistant for CS 7180: AI-Assisted Software Engineering',
        experience: [
            'ML Co-op at Wave Life Sciences - optimized prediction accuracy (R2 from 0.36 to 0.6) across 90K+ samples, accelerated ETL pipeline throughput by 85% on AWS',
            'Research Assistant at SRM Institute - built NLP and adversarial ML pipelines with CNN, BERT, and GNN architectures on 100K+ text records, published peer-reviewed research',
            'ML Engineer Intern at Zoho Corporation - developed scalable analytics pipelines reducing resolution time by 40% across 10K+ monthly queries, built NL-to-SQL interface on PostgreSQL and ElasticSearch',
        ],
        skills: 'Python, SQL, PySpark, AWS, Azure, LangChain, RAG, Databricks, Snowflake, scikit-learn, PyTorch, Docker, Tableau, Power BI',
        targetRoles: 'Data Science, ML Engineering, and AI/Software Engineering roles',
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
