const assert = require('assert');
const { updateReadme } = require('./update-marketplace-stats');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

test('updates downloads or installs badge to Marketplace installs', () => {
  const content = [
    '# RestfulToolkit',
    '[![Installs](https://img.shields.io/badge/downloads-170-blue.svg)](https://marketplace.visualstudio.com/items?itemName=kiturone.restful-toolkit)',
  ].join('\n');

  const result = updateReadme(content, { installs: 176 }, 'README.md');

  assert.ok(result.content.includes('installs-176-blue'));
  assert.strictEqual(result.changed, true);
});

test('fails when README has no stat badge to update', () => {
  assert.throws(
    () => updateReadme('# RestfulToolkit', { installs: 176 }, 'README.md'),
    /No Marketplace installs badge found in README\.md/,
  );
});
