/**
 * Update VS Code Marketplace stats in README.md and README_CN.md
 *
 * Queries the undocumented VS Code Marketplace API for extension stats
 * and replaces the values in both English and Chinese README files.
 */

const https = require('https');

const EXTENSION_ID = 'kiturone.restful-toolkit';

function queryMarketplace() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      filters: [
        {
          criteria: [{ filterType: 7, value: EXTENSION_ID }],
          pageNumber: 1,
          pageSize: 1,
        },
      ],
      flags: 16863,
    });

    const req = https.request(
      'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json;api-version=7.2-preview.1',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const ext = json.results?.[0]?.extensions?.[0];
            if (!ext) {
              reject(new Error('Extension not found in marketplace response'));
              return;
            }
            const stats = {};
            for (const s of ext.statistics || []) {
              stats[s.statisticName] = s.value;
            }
            resolve({
              downloads: Math.round(stats.downloadCount || 0),
              installs: Math.round(stats.install || 0),
              rating: (stats.weightedRating || 0).toFixed(2),
              publishedDate: ext.publishedDate,
            });
          } catch (e) {
            reject(e);
          }
        });
      },
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function updateReadme(content, stats) {
  // Download badge at the top (same pattern in both EN and CN READMEs)
  return content.replace(
    /downloads-\d+-blue/,
    `downloads-${stats.installs}-blue`,
  );
}

async function main() {
  console.log('Querying VS Code Marketplace API...');
  const stats = await queryMarketplace();
  console.log('Stats:', stats);

  const fs = require('fs');
  const path = require('path');

  for (const file of ['README.md', 'README_CN.md']) {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠ ${file} not found, skipping`);
      continue;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    const updated = updateReadme(content, stats);
    if (updated !== content) {
      fs.writeFileSync(filePath, updated);
      console.log(`✅ Updated ${file}`);
    } else {
      console.log(`—  ${file} unchanged`);
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
