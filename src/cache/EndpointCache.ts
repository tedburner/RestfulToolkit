import { RestEndpoint, MatchScore, SearchQuery } from '../models/types';

interface SearchableField {
    lower: string;
    words: string[];
    acronym: string | null;
}

interface SearchableEndpoint {
    endpoint: RestEndpoint;
    path: SearchableField;
    className: SearchableField;
    methodName: SearchableField;
    httpMethod: SearchableField;
}

interface ScoredEndpoint {
    item: SearchableEndpoint;
    score: MatchScore;
    position: number;
}

interface ScoreAccumulator {
    total: number;
    pathScore: number;
    classScore: number;
    methodScore: number;
    httpScore: number;
}

export class EndpointCache {
    private endpoints: Map<string, SearchableEndpoint[]> = new Map();
    private fileIndex: Map<string, SearchableEndpoint[]> = new Map();
    private allEndpoints: SearchableEndpoint[] = [];
    private endpointCount = 0;

    private static readonly httpMethods = new Set(['get', 'post', 'put', 'delete', 'patch']);

    add(endpoint: RestEndpoint): void {
        const searchableEndpoint = this.createSearchableEndpoint(endpoint);
        const pathKey = searchableEndpoint.endpoint.path;
        if (!this.endpoints.has(pathKey)) {
            this.endpoints.set(pathKey, []);
        }
        this.endpoints.get(pathKey)!.push(searchableEndpoint);

        const fileKey = searchableEndpoint.endpoint.file;
        if (!this.fileIndex.has(fileKey)) {
            this.fileIndex.set(fileKey, []);
        }
        this.fileIndex.get(fileKey)!.push(searchableEndpoint);

        this.allEndpoints.push(searchableEndpoint);
        this.endpointCount++;
    }

    getByFile(file: string): RestEndpoint[] {
        return (this.fileIndex.get(file) || []).map(item => this.cloneEndpoint(item.endpoint));
    }

    getIndexedFiles(): string[] {
        return Array.from(this.fileIndex.keys());
    }

    removeByFile(file: string): void {
        const endpoints = this.fileIndex.get(file);
        if (!endpoints) {
            return;
        }

        for (const endpoint of endpoints) {
            const pathEndpoints = this.endpoints.get(endpoint.endpoint.path);
            if (pathEndpoints) {
                const filtered = pathEndpoints.filter(e => e.endpoint.file !== file);
                if (filtered.length === 0) {
                    this.endpoints.delete(endpoint.endpoint.path);
                } else {
                    this.endpoints.set(endpoint.endpoint.path, filtered);
                }
            }
        }

        this.endpointCount -= endpoints.length;
        this.fileIndex.delete(file);
        this.allEndpoints = this.allEndpoints.filter(e => e.endpoint.file !== file);
    }

    /**
     * 单文件整体替换端点：就地压缩全量数组并增量修补文件/路径索引，成本与
     * 该文件的端点数（外加一次全量数组指针压缩）成正比，供 watcher 保存等
     * 单文件热路径使用；不重建缓存数组。
     *
     * 顺序契约与批量更新一致：未涉及文件的端点保持原顺序，新端点追加到末尾。
     */
    updateFile(file: string, endpoints: RestEndpoint[]): void {
        const previousItems = this.fileIndex.get(file);
        const newItems = endpoints.map(endpoint => this.createSearchableEndpoint(endpoint));

        if (newItems.length > 0) {
            this.fileIndex.set(file, newItems);
        } else {
            this.fileIndex.delete(file);
        }

        if (previousItems) {
            let removedCount = 0;
            let writeIndex = 0;
            for (let index = 0; index < this.allEndpoints.length; index++) {
                const item = this.allEndpoints[index];
                if (item.endpoint.file === file) {
                    removedCount++;
                    continue;
                }
                this.allEndpoints[writeIndex++] = item;
            }
            this.allEndpoints.length = writeIndex;
            this.endpointCount -= removedCount;

            for (const item of previousItems) {
                const pathEndpoints = this.endpoints.get(item.endpoint.path);
                if (!pathEndpoints) {
                    continue;
                }
                const remaining = pathEndpoints.filter(e => e.endpoint.file !== file);
                if (remaining.length === 0) {
                    this.endpoints.delete(item.endpoint.path);
                } else {
                    this.endpoints.set(item.endpoint.path, remaining);
                }
            }
        }

        for (const item of newItems) {
            this.allEndpoints.push(item);
            this.indexEndpoint(this.endpoints, item.endpoint.path, item);
        }
        this.endpointCount += newItems.length;
    }

    /**
     * 批量整体替换多个文件的端点：一批变更只重建一次全量数组与索引，
     * 避免逐文件 removeByFile 造成的 O(变更文件数 × 总端点数) 累计成本。
     * 单文件批量走 updateFile 的增量修补，避免不必要的重建。
     *
     * 顺序契约与逐文件更新一致：未涉及文件的端点保持原顺序，新端点按更新
     * 顺序追加到末尾。
     */
    updateFiles(updates: Array<{ file: string; endpoints: RestEndpoint[] }>): void {
        if (updates.length === 0) {
            return;
        }
        if (updates.length === 1) {
            this.updateFile(updates[0].file, updates[0].endpoints);
            return;
        }
        const updatedFiles = new Set(updates.map(update => update.file));

        const survivingItems = this.allEndpoints.filter(item => !updatedFiles.has(item.endpoint.file));
        const addedItems: SearchableEndpoint[] = [];
        for (const update of updates) {
            for (const endpoint of update.endpoints) {
                addedItems.push(this.createSearchableEndpoint(endpoint));
            }
        }

        this.allEndpoints = survivingItems.concat(addedItems);

        this.fileIndex = new Map();
        this.endpoints = new Map();
        for (const item of this.allEndpoints) {
            this.indexEndpoint(this.fileIndex, item.endpoint.file, item);
            this.indexEndpoint(this.endpoints, item.endpoint.path, item);
        }

        this.endpointCount = this.allEndpoints.length;
    }

    private indexEndpoint(index: Map<string, SearchableEndpoint[]>, key: string, item: SearchableEndpoint): void {
        const bucket = index.get(key);
        if (bucket) {
            bucket.push(item);
        } else {
            index.set(key, [item]);
        }
    }

    search(query: SearchQuery, maxResults: number = 100): RestEndpoint[] {
        const limit = Math.min(1000, Math.max(1, Math.floor(maxResults)));
        const queryText = query.text.trim();

        if (!queryText) {
            return this.allEndpoints.slice(0, limit).map(item => this.cloneEndpoint(item.endpoint));
        }

        const rawTokens = queryText.split(/\s+/);
        const httpTokens = new Set<string>();
        const searchTextTokens: string[] = [];
        const seenSearchTextTokens = new Set<string>();
        let tokenCount = 0;

        for (const rawToken of rawTokens) {
            const token = rawToken.toLowerCase();
            if (token.length === 0) {
                continue;
            }
            tokenCount++;
            if (EndpointCache.httpMethods.has(token)) {
                httpTokens.add(token);
            } else if (!seenSearchTextTokens.has(token)) {
                seenSearchTextTokens.add(token);
                searchTextTokens.push(token);
            }
        }

        const hasHttpFilter = httpTokens.size > 0;
        const scored: ScoredEndpoint[] = [];

        for (let position = 0; position < this.allEndpoints.length; position++) {
            const item = this.allEndpoints[position];
            if (!this.matchesFilters(item.endpoint, query)) {
                continue;
            }

            if (hasHttpFilter && !httpTokens.has(item.httpMethod.lower)) {
                continue;
            }

            let score: MatchScore;
            if (searchTextTokens.length === 0) {
                if (tokenCount !== 1 || !hasHttpFilter) {
                    continue;
                }

                const httpScore = this.matchScore(item.httpMethod, rawTokens[0].toLowerCase()) * 0.1;
                score = { pathScore: 0, classScore: 0, methodScore: 0, httpScore, total: httpScore };
            } else {
                const accumulator: ScoreAccumulator = {
                    total: 0,
                    pathScore: 0,
                    classScore: 0,
                    methodScore: 0,
                    httpScore: 0
                };
                let matchesAllTokens = true;
                for (const token of searchTextTokens) {
                    if (!this.accumulateScore(item, token, accumulator)) {
                        matchesAllTokens = false;
                        break;
                    }
                }
                if (!matchesAllTokens) {
                    continue;
                }

                score = {
                    pathScore: accumulator.pathScore,
                    classScore: accumulator.classScore,
                    methodScore: accumulator.methodScore,
                    httpScore: accumulator.httpScore,
                    total: accumulator.total / searchTextTokens.length
                };
            }

            if (score.total > 0) {
                this.retainTopScore(scored, { item, score, position }, limit);
            }
        }

        scored.sort((a, b) => this.compareScoredStable(a, b));
        return scored.map(item => this.cloneEndpoint(item.item.endpoint));
    }

    private createSearchableEndpoint(endpoint: RestEndpoint): SearchableEndpoint {
        const cachedEndpoint = this.cloneEndpoint(endpoint);
        return {
            endpoint: cachedEndpoint,
            path: this.createSearchableField(cachedEndpoint.path),
            className: this.createSearchableField(cachedEndpoint.className),
            methodName: this.createSearchableField(cachedEndpoint.methodName),
            httpMethod: this.createSearchableField(cachedEndpoint.method)
        };
    }

    private cloneEndpoint(endpoint: RestEndpoint): RestEndpoint {
        return { ...endpoint };
    }

    private createSearchableField(text: string): SearchableField {
        const words = this.tokenizeCamelCase(text);
        return {
            lower: text.toLowerCase(),
            words,
            acronym: words.length >= 2 ? words.map(word => word[0]).join('').toLowerCase() : null
        };
    }

    private retainTopScore(heap: ScoredEndpoint[], candidate: ScoredEndpoint, limit: number): void {
        if (heap.length < limit) {
            heap.push(candidate);
            this.bubbleUpWorst(heap, heap.length - 1);
            return;
        }

        if (this.compareScoredStable(candidate, heap[0]) >= 0) {
            return;
        }

        heap[0] = candidate;
        this.siftDownWorst(heap, 0);
    }

    private bubbleUpWorst(heap: ScoredEndpoint[], startIndex: number): void {
        let index = startIndex;
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.compareScoredStable(heap[index], heap[parent]) <= 0) {
                break;
            }
            [heap[index], heap[parent]] = [heap[parent], heap[index]];
            index = parent;
        }
    }

    private siftDownWorst(heap: ScoredEndpoint[], startIndex: number): void {
        let index = startIndex;
        while (index < heap.length) {
            const left = index * 2 + 1;
            const right = left + 1;
            let worst = index;
            if (left < heap.length && this.compareScoredStable(heap[left], heap[worst]) > 0) {
                worst = left;
            }
            if (right < heap.length && this.compareScoredStable(heap[right], heap[worst]) > 0) {
                worst = right;
            }
            if (worst === index) {
                return;
            }
            [heap[index], heap[worst]] = [heap[worst], heap[index]];
            index = worst;
        }
    }

    private compareScored(a: ScoredEndpoint, b: ScoredEndpoint): number {
        if (a.score.pathScore !== b.score.pathScore) {
            return b.score.pathScore - a.score.pathScore;
        }
        if (a.score.classScore !== b.score.classScore) {
            return b.score.classScore - a.score.classScore;
        }
        if (a.score.methodScore !== b.score.methodScore) {
            return b.score.methodScore - a.score.methodScore;
        }
        return b.score.total - a.score.total;
    }

    private compareScoredStable(a: ScoredEndpoint, b: ScoredEndpoint): number {
        return this.compareScored(a, b) || a.position - b.position;
    }

    private matchesFilters(endpoint: RestEndpoint, query: SearchQuery): boolean {
        if (!query.filters) { return true; }
        if (query.filters.method && endpoint.method !== query.filters.method) { return false; }
        if (query.filters.framework && endpoint.framework !== query.filters.framework) { return false; }
        return true;
    }

    private accumulateScore(item: SearchableEndpoint, queryText: string, accumulator: ScoreAccumulator): boolean {
        const pathScore = this.matchScore(item.path, queryText) * 0.4;
        const classScore = this.matchScore(item.className, queryText) * 0.3;
        const methodScore = this.matchScore(item.methodName, queryText) * 0.2;
        const httpScore = this.matchScore(item.httpMethod, queryText) * 0.1;
        const total = pathScore + classScore + methodScore + httpScore;

        if (total === 0) {
            return false;
        }

        accumulator.total += total;
        accumulator.pathScore = Math.max(accumulator.pathScore, pathScore);
        accumulator.classScore = Math.max(accumulator.classScore, classScore);
        accumulator.methodScore = Math.max(accumulator.methodScore, methodScore);
        accumulator.httpScore = Math.max(accumulator.httpScore, httpScore);
        return true;
    }

    private matchScore(field: SearchableField, query: string): number {
        if (query.length === 0) {
            return 1;
        }

        if (field.lower === query) {
            return 1;
        }
        if (field.lower.includes(query)) {
            return 0.9;
        }
        if (this.matchAtWordBoundary(field, query)) {
            return 0.85;
        }
        if (this.matchAcronym(field, query)) {
            return 0.82;
        }
        if (query.length < 2) {
            return 0;
        }

        return this.fuzzyMatch(field.lower, query);
    }

    private matchAtWordBoundary(field: SearchableField, query: string): boolean {
        if (field.lower.startsWith(query)) {
            return true;
        }
        if (field.lower.includes(`/${query}`) ||
            field.lower.includes(`-${query}`) ||
            field.lower.includes(`_${query}`) ||
            field.lower.includes(`.${query}`)) {
            return true;
        }

        return field.words.some(word => word.toLowerCase().startsWith(query));
    }

    private matchAcronym(field: SearchableField, query: string): boolean {
        return field.acronym === query;
    }

    private tokenizeCamelCase(text: string): string[] {
        const segments = text.split(/[^a-zA-Z]+/).filter(segment => segment.length > 0);
        const words: string[] = [];

        for (const segment of segments) {
            const camelParts = segment.match(/[A-Z]+(?=[A-Z][a-z]|\d|$)|[A-Z]?[a-z]+|[A-Z]+/g);
            if (camelParts) {
                words.push(...camelParts);
            }
        }

        return words;
    }

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

    getAll(): RestEndpoint[] {
        return this.allEndpoints.map(item => this.cloneEndpoint(item.endpoint));
    }

    clear(): void {
        this.endpoints.clear();
        this.fileIndex.clear();
        this.allEndpoints = [];
        this.endpointCount = 0;
    }

    size(): number {
        return this.endpointCount;
    }
}
