/**
 * 批量脚本共享前置检查：确保 dist 编译产物存在且不早于 src 生产源码。
 *
 * 批量脚本 require 的是 dist 下的编译产物；忘记执行 `npm run compile` 时脚本会
 * 验证过期代码并给出误导性结论，因此默认将"dist 落后于 src"视为错误。
 * src/test 下的测试源码不参与比对（脚本不加载测试代码）。
 *
 * 环境变量 SKIP_DIST_CHECK=1 可跳过本检查。
 */
const fs = require('fs');
const path = require('path');

function collectNewestMtime(dir, state) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entryPath === path.join(__dirname, '..', '..')) {
                // 跳过 src/test：脚本验证的是生产模块，测试源码变动不需要重新编译
                continue;
            }
            collectNewestMtime(entryPath, state);
        } else if (/\.(ts|js)$/.test(entry.name)) {
            const mtime = fs.statSync(entryPath).mtimeMs;
            if (mtime > state.newest) {
                state.newest = mtime;
            }
        }
    }
}

function ensureFreshDist() {
    if (process.env.SKIP_DIST_CHECK === '1') {
        return;
    }

    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const distEntry = path.join(projectRoot, 'dist', 'extension.js');
    if (!fs.existsSync(distEntry)) {
        console.error('❌ 未找到 dist/extension.js — 请先执行 `npm run compile` 再运行批量脚本');
        process.exit(1);
    }

    const srcState = { newest: 0 };
    collectNewestMtime(path.join(projectRoot, 'src'), srcState);
    const distMtime = fs.statSync(distEntry).mtimeMs;
    if (srcState.newest > distMtime) {
        console.error('❌ src 生产源码比 dist 编译产物新，批量脚本将验证过期代码');
        console.error('   请先执行 `npm run compile`，或设置 SKIP_DIST_CHECK=1 跳过本检查');
        process.exit(1);
    }
}

module.exports = { ensureFreshDist };
