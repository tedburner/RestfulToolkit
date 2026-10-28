/**
 * EndpointCopyInfo 共享夹具：与 Mocha 侧（CurlConverter.test.ts 等）的 makeCopyInfo
 * 保持相同的字段契约，避免批量脚本每个用例手写完整对象。
 */
function makeCopyInfo(overrides = {}) {
    return {
        httpMethod: 'GET',
        contentType: 'url-params',
        path: '/api/users',
        parameters: [],
        framework: 'Spring',
        dtoFields: new Map(),
        ...overrides
    };
}

module.exports = { makeCopyInfo };
