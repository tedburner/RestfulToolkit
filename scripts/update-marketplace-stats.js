/**
 * Update VS Code Marketplace stats in README.md and README_CN.md.
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

function updateReadme(content, stats, fileName = 'README') {
  const badgePattern = /(?:downloads|installs)-\d+-blue/;
  const currentBadge = content.match(badgePattern)?.[0];

  if (!currentBadge) {
    throw new Error(`No Marketplace installs badge found in ${fileName}`);
  }

  const nextBadge = `installs-${stats.installs}-blue`;
  return {
    content: content.replace(badgePattern, nextBadge),
    changed: currentBadge !== nextBadge,
    currentBadge,
    nextBadge,
  };
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
      console.warn(`WARN: ${file} not found, skipping`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const updated = updateReadme(content, stats, file);
    console.log(`${file}: ${updated.currentBadge} -> ${updated.nextBadge}`);
    if (updated.changed) {
      fs.writeFileSync(filePath, updated.content);
      console.log(`OK: Updated ${file}`);
    } else {
      console.log(`OK: ${file} unchanged`);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  queryMarketplace,
  updateReadme,
};
