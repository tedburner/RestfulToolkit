import { RestEndpoint, MatchScore, SearchQuery } from '../models/types';

export class EndpointCache {
    private endpoints: Map<string, RestEndpoint[]> = new Map();
    private fileIndex: Map<string, RestEndpoint[]> = new Map();

    /** 扁平化端点缓存，避免每次 search() 重新分配 */
    private _allEndpoints: RestEndpoint[] = [];
    /** 增量计数器，避免 size() 每次 O(n) 遍历 */
    private _size = 0;

    /** httpMethod 集合，用于多词搜索的 token 分类（静态，避免每次 search 重建） */
    private static readonly httpMethods = new Set(['get', 'post', 'put', 'delete', 'patch']);

    add(endpoint: RestEndpoint): void {
        const pathKey = endpoint.path;
        if (!this.endpoints.has(pathKey)) {
            this.endpoints.set(pathKey, []);
        }
        this.endpoints.get(pathKey)!.push(endpoint);

        const fileKey = endpoint.file;
        if (!this.fileIndex.has(fileKey)) {
            this.fileIndex.set(fileKey, []);
        }
        this.fileIndex.get(fileKey)!.push(endpoint);

        this._allEndpoints.push(endpoint);
        this._size++;
    }

    getByFile(file: string): RestEndpoint[] {
        return this.fileIndex.get(file) || [];
    }

    removeByFile(file: string): void {
        const endpoints = this.fileIndex.get(file);
        if (!endpoints) {
            return;
        }

        for (const endpoint of endpoints) {
            const pathEndpoints = this.endpoints.get(endpoint.path);
            if (pathEndpoints) {
                const filtered = pathEndpoints.filter(e => e.file !== file);
                if (filtered.length === 0) {
                    this.endpoints.delete(endpoint.path);
                } else {
                    this.endpoints.set(endpoint.path, filtered);
                }
            }
        }

        this._size -= endpoints.length;
        this.fileIndex.delete(file);

        // 增量移除：直接过滤，无需全量重建
        this._allEndpoints = this._allEndpoints.filter(e => e.file !== file);
    }

    updateFile(file: string, endpoints: RestEndpoint[]): void {
        this.removeByFile(file);
        for (const endpoint of endpoints) {
            this.add(endpoint);
        }
    }

    search(query: SearchQuery, maxResults: number = 100): RestEndpoint[] {
        const limit = Math.min(1000, Math.max(1, Math.floor(maxResults)));
        const queryText = query.text.trim();

        if (!queryText) {
            return this._allEndpoints.slice(0, limit);
        }

        const tokens = queryText.split(/\s+/).map(t => t.toLowerCase()).filter(t => t.length > 0);

        /*
         * token 分类：在循环外执行一次，避免每个端点重复计算
         * httpTokens → 作为 HTTP 方法过滤器
         * searchTextTokens → 参与 path/class/method 打分
         */
        const httpTokens: string[] = [];
        const searchTextTokens: string[] = [];
        for (const token of tokens) {
            if (EndpointCache.httpMethods.has(token)) {
                httpTokens.push(token);
            } else {
                searchTextTokens.push(token);
            }
        }
        const hasHttpFilter = httpTokens.length > 0;

        const scored = this._allEndpoints
            .filter(endpoint => this.matchesFilters(endpoint, query))
            .map(endpoint => {
                const httpMethod = endpoint.method.toLowerCase();

                // 有 httpMethod token 但当前端点方法不匹配 → 过滤掉
                if (hasHttpFilter && !httpTokens.includes(httpMethod)) {
                    return { endpoint, score: this.zeroScore() };
                }

                // 没有搜索词
                if (searchTextTokens.length === 0) {
                    // 单词 httpMethod 查询（如 "post"）→ 该端点匹配，给 httpMethod 维度分数
                    if (tokens.length === 1 && hasHttpFilter) {
                        const httpScore = this.matchScore(httpMethod, tokens[0]) * 0.1;
                        return { endpoint, score: { pathScore:0, classScore:0, methodScore:0, httpScore, total: httpScore } };
                    }
                    // 多词全是 httpMethod（如 "post get"）→ 无搜索词，过滤
                    return { endpoint, score: this.zeroScore() };
                }

                // 预计算各维度 lowercase（每个端点只算一次，不在 calculateScore 内重复）
                const pathLower = endpoint.path.toLowerCase();
                const classLower = endpoint.className.toLowerCase();
                const methodLower = endpoint.methodName.toLowerCase();
                const httpLower = endpoint.method.toLowerCase();

                // 对每个搜索 token 计算 4 维分数
                const tokenScores: MatchScore[] = [];
                for (const token of searchTextTokens) {
                    tokenScores.push(this.calculateScore(pathLower, classLower, methodLower, httpLower, token));
                }

                // AND：每个搜索 token 都必须至少命中一个维度
                if (tokenScores.some(s => s.total === 0)) {
                    return { endpoint, score: this.zeroScore() };
                }

                // 多词取平均，单词直接用
                const total = searchTextTokens.length === 1
                    ? tokenScores[0].total
                    : tokenScores.reduce((acc, s) => acc + s.total, 0) / tokenScores.length;

                // 各维度取最大值（用于排序优先级）
                const maxPath = Math.max(...tokenScores.map(s => s.pathScore));
                const maxClass = Math.max(...tokenScores.map(s => s.classScore));
                const maxMethod = Math.max(...tokenScores.map(s => s.methodScore));
                const maxHttp = Math.max(...tokenScores.map(s => s.httpScore));

                return {
                    endpoint,
                    score: {
                        pathScore: maxPath,
                        classScore: maxClass,
                        methodScore: maxMethod,
                        httpScore: maxHttp,
                        total
                    }
                };
            })
            .filter(item => item.score.total > 0);

        /*
         * 排序：逐层比较实际分数值，而非二值 flag。
         * path 分数高的排最前；同分时比 className，再比 methodName，最后比总分。
         */
        scored.sort((a, b) => {
            // 1. path 分数
            if (a.score.pathScore !== b.score.pathScore) {
                return b.score.pathScore - a.score.pathScore;
            }
            // 2. className 分数
            if (a.score.classScore !== b.score.classScore) {
                return b.score.classScore - a.score.classScore;
            }
            // 3. methodName 分数
            if (a.score.methodScore !== b.score.methodScore) {
                return b.score.methodScore - a.score.methodScore;
            }
            // 4. 总分
            return b.score.total - a.score.total;
        });

        return scored.slice(0, limit).map(item => item.endpoint);
    }

    private zeroScore(): MatchScore {
        return { pathScore: 0, classScore: 0, methodScore: 0, httpScore: 0, total: 0 };
    }

    private matchesFilters(endpoint: RestEndpoint, query: SearchQuery): boolean {
        if (!query.filters) { return true; }
        if (query.filters.method && endpoint.method !== query.filters.method) { return false; }
        if (query.filters.framework && endpoint.framework !== query.filters.framework) { return false; }
        return true;
    }

    /**
     * 对单个 query token 计算 4 维加权分数。
     * 接收预 lowercase 的字段，避免重复 toLowerCase()。
     * 权重：path 0.4 > className 0.3 > methodName 0.2 > httpMethod 0.1
     */
    private calculateScore(
        pathLower: string, classLower: string, methodLower: string, httpLower: string,
        queryText: string
    ): MatchScore {
        const pathScore = this.matchScore(pathLower, queryText) * 0.4;
        const classScore = this.matchScore(classLower, queryText) * 0.3;
        const methodScore = this.matchScore(methodLower, queryText) * 0.2;
        const httpScore = this.matchScore(httpLower, queryText) * 0.1;

        return {
            pathScore,
            classScore,
            methodScore,
            httpScore,
            total: pathScore + classScore + methodScore + httpScore
        };
    }

    private matchScore(text: string, query: string): number {
        if (query.length === 0) {
            return 1;
        }

        if (text === query) {
            return 1;
        }

        // 子串包含
        if (text.includes(query)) {
            return 0.9;
        }

        // 单词边界：路径分隔符或 camelCase 起始
        if (this.matchAtWordBoundary(text, query)) {
            return 0.85;
        }

        // 首字母缩写匹配
        if (this.matchAcronym(text, query)) {
            return 0.82;
        }

        // 模糊匹配：最小 2 字符
        if (query.length < 2) {
            return 0;
        }

        return this.fuzzyMatch(text, query);
    }

    private matchAtWordBoundary(text: string, query: string): boolean {
        if (text.startsWith(query)) {
            return true;
        }

        if (text.includes(`/${query}`) ||
            text.includes(`-${query}`) ||
            text.includes(`_${query}`) ||
            text.includes(`.${query}`)) {
            return true;
        }

        // camelCase boundary: uppercase letter directly before the query
        const camelPattern = new RegExp('[A-Z]' + this.escapeRegex(query));
        if (camelPattern.test(text)) {
            return true;
        }

        return false;
    }

    /**
     * 首字母缩写匹配：将 camelCase / 分隔符边界拆分为词，
     * 取每个词的首字母组成缩写，检查 query 是否匹配。
     */
    private matchAcronym(text: string, query: string): boolean {
        const words = this.tokenizeCamelCase(text);
        if (words.length < 2) { return false; }
        const acronym = words.map(w => w[0]).join('').toLowerCase();
        return acronym === query;
    }

    /**
     * 将 camelCase / 分隔符边界字符串拆分为词。
     */
    private tokenizeCamelCase(text: string): string[] {
        const segments = text.split(/[^a-zA-Z]+/).filter(s => s.length > 0);
        const words: string[] = [];
        for (const seg of segments) {
            const camelParts = seg.match(/[A-Z]+(?=[A-Z][a-z]|\d|$)|[A-Z]?[a-z]+|[A-Z]+/g);
            if (camelParts) {
                words.push(...camelParts);
            }
        }
        return words;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * 模糊匹配：query 的所有字符按顺序出现在 text 中即视为匹配。
     * 评分基于连续率和集中率。
     */
    private fuzzyMatch(text: string, query: string): number {
        let queryIndex = 0;
        let consecutiveMatches = 0;
        let maxConsecutive = 0;
        let firstMatchPos = -1;
        let lastMatchPos = -1;

        for (let i = 0; i < text.length && queryIndex < query.length; i++) {
            if (text[i] === query[queryIndex]) {
                consecutiveMatches++;
                maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
                if (firstMatchPos === -1) { firstMatchPos = i; }
                lastMatchPos = i;
                queryIndex++;
            } else {
                consecutiveMatches = 0;
            }
        }

        if (queryIndex !== query.length) {
            return 0;
        }

        const consecutiveRatio = maxConsecutive / query.length;
        const spanLength = lastMatchPos - firstMatchPos + 1;
        const concentrationRatio = query.length / spanLength;

        if (consecutiveRatio >= 0.7) {
            return 0.5;
        }
        if (concentrationRatio >= 0.4) {
            return 0.3;
        }
        if (concentrationRatio >= 0.2) {
            return 0.15;
        }

        return 0;
    }

    /**
     * #18: 返回副本，防止外部修改污染内部缓存
     */
    getAll(): RestEndpoint[] {
        return [...this._allEndpoints];
    }

    clear(): void {
        this.endpoints.clear();
        this.fileIndex.clear();
        this._allEndpoints = [];
        this._size = 0;
    }

    size(): number {
        return this._size;
    }
}
