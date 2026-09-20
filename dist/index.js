const fs = require('fs');
const path = require('path');
const https = require('https');

function getEnv(name, fallback = '') {
  return process.env[name] || process.env[name.replace(/-/g, '_')] || fallback;
}

const token = getEnv('INPUT_GITHUB-TOKEN') || process.env.GITHUB_TOKEN || '';
const username = getEnv('INPUT_USERNAME') || process.env.GITHUB_REPOSITORY_OWNER || '';
const theme = getEnv('INPUT_THEME', 'cyan-cyber');
const outputPath = getEnv('INPUT_OUTPUT-PATH', 'rayz-glass-card.svg');

if (!username) {
  console.error('Error: username must be specified.');
  process.exit(1);
}

function githubGraphQL(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query });
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/graphql',
      method: 'POST',
      headers: {
        'User-Agent': 'Rayz-Glass-Cards-Action (by Pheonix14)',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.errors && !json.data) {
            reject(new Error(JSON.stringify(json.errors)));
          } else {
            resolve(json.data);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log(`\x1b[35m🎨 Rayz Glass Bento Cards — Developed by Pheonix14\x1b[0m`);
  console.log(`Generating glassmorphic portfolio bento card for @${username}...`);

  let user = {
    name: username,
    bio: 'Software Engineer & Open Source Builder',
    publicRepos: 38,
    followers: 4,
    totalStars: 12,
    languages: [
      { name: 'TypeScript', color: '#3178c6', percent: 45 },
      { name: 'Python', color: '#3572A5', percent: 30 },
      { name: 'CSS / Glass', color: '#0affe4', percent: 15 },
      { name: 'Rust', color: '#dea584', percent: 10 }
    ]
  };

  try {
    const query = `
      query {
        user(login: "${username}") {
          name
          bio
          followers { totalCount }
          repositories(first: 50, ownerAffiliations: OWNER) {
            totalCount
            nodes {
              stargazerCount
              languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
                edges {
                  size
                  node { name color }
                }
              }
            }
          }
        }
      }
    `;
    const res = await githubGraphQL(query);
    if (res && res.user) {
      user.name = res.user.name || username;
      user.bio = res.user.bio || user.bio;
      user.followers = res.user.followers?.totalCount || user.followers;
      user.publicRepos = res.user.repositories?.totalCount || user.publicRepos;
      
      const nodes = res.user.repositories?.nodes || [];
      user.totalStars = nodes.reduce((sum, r) => sum + (r.stargazerCount || 0), 0);

      // Aggregate languages
      const langMap = {};
      let totalSize = 0;
      for (const repo of nodes) {
        for (const edge of (repo.languages?.edges || [])) {
          const lName = edge.node.name;
          const lColor = edge.node.color || '#38bdf8';
          langMap[lName] = langMap[lName] || { name: lName, color: lColor, size: 0 };
          langMap[lName].size += edge.size;
          totalSize += edge.size;
        }
      }

      if (totalSize > 0) {
        const sorted = Object.values(langMap).sort((a, b) => b.size - a.size).slice(0, 4);
        user.languages = sorted.map(l => ({
          name: l.name,
          color: l.color,
          percent: Math.round((l.size / totalSize) * 100)
        }));
      }
    }
  } catch (err) {
    console.warn(`GraphQL lookup warning: ${err.message}. Using profile fallback metrics.`);
  }

  // Color schemes
  let primaryGlow = '#0affe4';
  let secondaryGlow = '#8b5cf6';
  if (theme === 'neon-purple') {
    primaryGlow = '#ec4899';
    secondaryGlow = '#8b5cf6';
  } else if (theme === 'luxury-gold') {
    primaryGlow = '#fbbf24';
    secondaryGlow = '#f59e0b';
  }

  // Render SVG Bento Grid
  const svg = `
<svg width="650" height="340" viewBox="0 0 650 340" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Canvas -->
    <linearGradient id="glassCanvas" x1="0" y1="0" x2="650" y2="340" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#070c18" />
      <stop offset="50%" stop-color="#02040a" />
      <stop offset="100%" stop-color="#080e1a" />
    </linearGradient>

    <!-- Bento Tile Glass Gradient -->
    <linearGradient id="tileGlass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e293b" stop-opacity="0.65" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.35" />
    </linearGradient>

    <linearGradient id="cyberBorder" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${primaryGlow}" />
      <stop offset="100%" stop-color="${secondaryGlow}" />
    </linearGradient>

    <filter id="glassFilter" x="-10" y="-10" width="670" height="360" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000" flood-opacity="0.75" />
    </filter>
  </defs>

  <style>
    .name { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 800; font-size: 20px; fill: #f8fafc; }
    .handle { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; font-weight: 600; fill: ${primaryGlow}; }
    .bio { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; fill: #94a3b8; }
    .stat-num { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 900; font-size: 22px; fill: #f8fafc; }
    .stat-lbl { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 10px; font-weight: 600; fill: #64748b; letter-spacing: 0.5px; }
    .lang-lbl { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; font-weight: 600; fill: #cbd5e1; }
    .footer { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11px; font-weight: 700; fill: ${primaryGlow}; }
    .footer-right { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 10px; fill: #64748b; }
  </style>

  <!-- Outer Glass Frame -->
  <rect x="10" y="10" width="630" height="320" rx="20" fill="url(#glassCanvas)" stroke="#1e293b" stroke-width="1.5" filter="url(#glassFilter)"/>

  <!-- Top Hero Tile -->
  <rect x="30" y="30" width="370" height="110" rx="14" fill="url(#tileGlass)" stroke="url(#cyberBorder)" stroke-width="1.2" />
  <circle cx="65" cy="70" r="22" fill="#0f172a" stroke="${primaryGlow}" stroke-width="2" />
  <text x="65" y="76" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="16" fill="${primaryGlow}">${username.charAt(0).toUpperCase()}</text>
  <text x="100" y="65" class="name">${user.name}</text>
  <text x="100" y="82" class="handle">@${username}</text>
  <text x="100" y="105" class="bio">${user.bio.substring(0, 42)}</text>

  <!-- Top Stats Bento Tiles -->
  <g transform="translate(415, 30)">
    <!-- Repos Tile -->
    <rect x="0" y="0" width="100" height="110" rx="14" fill="url(#tileGlass)" stroke="#334155" stroke-width="1" />
    <text x="50" y="55" text-anchor="middle" class="stat-num">${user.publicRepos}</text>
    <text x="50" y="75" text-anchor="middle" class="stat-lbl">REPOSITORIES</text>
  </g>

  <g transform="translate(525, 30)">
    <!-- Followers Tile -->
    <rect x="0" y="0" width="95" height="110" rx="14" fill="url(#tileGlass)" stroke="#334155" stroke-width="1" />
    <text x="47" y="55" text-anchor="middle" class="stat-num">${user.followers}</text>
    <text x="47" y="75" text-anchor="middle" class="stat-lbl">FOLLOWERS</text>
  </g>

  <!-- Languages Bento Tile -->
  <rect x="30" y="155" width="590" height="120" rx="14" fill="url(#tileGlass)" stroke="#334155" stroke-width="1" />
  <text x="50" y="182" class="lang-lbl" style="fill: #f8fafc; font-weight: 800; font-size: 13px;">⚡ Top Languages &amp; Core Stack</text>

  <!-- Multi-Segment Language Bar -->
  <g transform="translate(50, 196)">
    <rect x="0" y="0" width="550" height="10" rx="5" fill="#0f172a" />
    ${(() => {
      let offset = 0;
      return user.languages.map(l => {
        const w = Math.max(8, Math.round((l.percent / 100) * 550));
        const rect = `<rect x="${offset}" y="0" width="${w}" height="10" fill="${l.color}" rx="3" />`;
        offset += w;
        return rect;
      }).join('\n    ');
    })()}
  </g>

  <!-- Language Chips -->
  <g transform="translate(50, 235)">
    ${user.languages.map((l, i) => `
      <g transform="translate(${i * 135}, 0)">
        <circle cx="5" cy="5" r="4" fill="${l.color}" />
        <text x="16" y="9" class="lang-lbl">${l.name} <tspan fill="#64748b">(${l.percent}%)</tspan></text>
      </g>
    `).join('\n    ')}
  </g>

  <!-- Divider & Prominent Pheonix14 Attribution -->
  <line x1="30" y1="290" x2="620" y2="290" stroke="#1e293b" stroke-width="1" />
  <text x="30" y="312" class="footer">⚡ Developed by Pheonix14</text>
  <text x="620" y="312" text-anchor="end" class="footer-right">⭐ Star on GitHub: github.com/pheonix14 • Follow @pheonix14</text>
</svg>
  `.trim();

  fs.writeFileSync(path.resolve(process.cwd(), outputPath), svg, 'utf-8');
  console.log(`\x1b[32m✔ Successfully generated Rayz Glass Card SVG at: ${outputPath}\x1b[0m`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `card-path=${outputPath}\n`);
  }
}

run().catch(err => {
  console.error('\x1b[31mAction Execution Failed:\x1b[0m', err);
  process.exit(1);
});
