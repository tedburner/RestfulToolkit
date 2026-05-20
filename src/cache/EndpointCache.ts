import { RestEndpoint, MatchScore, SearchQuery } from '../models/types';

export class EndpointCache {
    private endpoints: Map<string, RestEndpoint[]> = new Map();
    private fileIndex: Map<string, RestEndpoint[]> = new Map();
    private _size: number = 0;

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

        this.fileIndex.delete(file);
        this._size -= endpoints.length;
    }

    updateFile(file: string, endpoints: RestEndpoint[]): void {
        this.removeByFile(file);
        for (const endpoint of endpoints) {
            this.add(endpoint);
        }
    }

    search(query: SearchQuery, maxResults: number = 100): RestEndpoint[] {
        const allEndpoints = this.flattenAll();

        const scored = allEndpoints
            .map(endpoint => ({
                endpoint,
                score: this.calculateScore(endpoint, query)
            }))
            .filter(item => item.score.total > 0);

        scored.sort((a, b) => b.score.total - a.score.total);

        return scored.slice(0, maxResults).map(item => item.endpoint);
    }

    private calculateScore(endpoint: RestEndpoint, query: SearchQuery): MatchScore {
        const searchText = query.text.toLowerCase();
        const pathScore = this.matchScore(endpoint.path.toLowerCase(), searchText) * 0.4;
        const classScore = this.matchScore(endpoint.className.toLowerCase(), searchText) * 0.3;
        const methodScore = this.matchScore(endpoint.methodName.toLowerCase(), searchText) * 0.2;
        const httpScore = this.matchScore(endpoint.method.toLowerCase(), searchText) * 0.1;

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

        // 检查是否包含完整查询词（子串匹配）
        if (text.includes(query)) {
            return 0.9;
        }

        // 检查是否在单词边界处匹配（如 camelCase 或路径分隔符）
        if (this.matchAtWordBoundary(text, query)) {
            return 0.85;
        }

        const fuzzyScore = this.fuzzyMatch(text, query);
        return fuzzyScore;
    }

    private matchAtWordBoundary(text: string, query: string): boolean {
        // 在 camelCase 单词中检查 query 是否出现在大写边界处
        // 例如 query="parse" 在 "uploadParse" 中 → P 是大写，匹配
        const camelRegex = new RegExp(`[A-Z]${query}`, 'i');
        if (camelRegex.test(text)) {
            return true;
        }

        // 在路径中检查 query 是否紧跟在 / 之后
        if (text.includes(`/${query}`)) {
            return true;
        }

        return false;
    }

    private fuzzyMatch(text: string, query: string): number {
        let queryIndex = 0;
        let matches = 0;
        let consecutiveMatches = 0;
        let maxConsecutive = 0;

        for (let i = 0; i < text.length && queryIndex < query.length; i++) {
            if (text[i] === query[queryIndex]) {
                matches++;
                consecutiveMatches++;
                maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
                queryIndex++;
            } else {
                consecutiveMatches = 0;
            }
        }

        // 未完全匹配 query 的所有字符 → 0 分
        if (queryIndex !== query.length) {
            return 0;
        }

        // 连续匹配长度占比高说明接近子串匹配，给更高分
        const consecutiveRatio = maxConsecutive / query.length;
        const coverageRatio = matches / text.length;

        // 如果 query 的所有字符都有连续匹配（即完全子串），不应走到这里
        // 这里处理的是字符分散匹配的情况
        if (consecutiveRatio >= 0.7 && coverageRatio > 0.3) {
            return 0.5;
        }

        // 分散匹配：要求至少 60% 的文本字符参与匹配
        if (coverageRatio >= 0.6) {
            return 0.3;
        }

        return 0;
    }

    getAll(): RestEndpoint[] {
        return this.flattenAll();
    }

    private flattenAll(): RestEndpoint[] {
        const all: RestEndpoint[] = [];
        for (const endpoints of this.endpoints.values()) {
            all.push(...endpoints);
        }
        return all;
    }

    clear(): void {
        this.endpoints.clear();
        this.fileIndex.clear();
        this._size = 0;
    }

    size(): number {
        return this._size;
    }
}