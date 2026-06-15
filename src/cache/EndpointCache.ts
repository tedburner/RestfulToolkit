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
            return this.allEndpoints.slice(0, limit).map(item => this.cloneEndpoint(item.endpoint));
        }

        const tokens = queryText.split(/\s+/).map(t => t.toLowerCase()).filter(t => t.length > 0);
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
        const scored: ScoredEndpoint[] = [];

        for (const item of this.allEndpoints) {
            if (!this.matchesFilters(item.endpoint, query)) {
                continue;
            }

            if (hasHttpFilter && !httpTokens.includes(item.httpMethod.lower)) {
                continue;
            }

            let score: MatchScore;
            if (searchTextTokens.length === 0) {
                if (tokens.length !== 1 || !hasHttpFilter) {
                    continue;
                }

                const httpScore = this.matchScore(item.httpMethod, tokens[0]) * 0.1;
                score = { pathScore: 0, classScore: 0, methodScore: 0, httpScore, total: httpScore };
            } else {
                const tokenScores = searchTextTokens.map(token => this.calculateScore(item, token));

                if (tokenScores.some(tokenScore => tokenScore.total === 0)) {
                    continue;
                }

                const total = tokenScores.length === 1
                    ? tokenScores[0].total
                    : tokenScores.reduce((acc, tokenScore) => acc + tokenScore.total, 0) / tokenScores.length;

                score = {
                    pathScore: Math.max(...tokenScores.map(tokenScore => tokenScore.pathScore)),
                    classScore: Math.max(...tokenScores.map(tokenScore => tokenScore.classScore)),
                    methodScore: Math.max(...tokenScores.map(tokenScore => tokenScore.methodScore)),
                    httpScore: Math.max(...tokenScores.map(tokenScore => tokenScore.httpScore)),
                    total
                };
            }

            if (score.total > 0) {
                this.insertTopScore(scored, { item, score }, limit);
            }
        }

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

    private insertTopScore(scored: ScoredEndpoint[], candidate: ScoredEndpoint, limit: number): void {
        let index = 0;
        while (index < scored.length && this.compareScored(scored[index], candidate) <= 0) {
            index++;
        }

        if (index >= limit) {
            return;
        }

        scored.splice(index, 0, candidate);
        if (scored.length > limit) {
            scored.pop();
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

    private matchesFilters(endpoint: RestEndpoint, query: SearchQuery): boolean {
        if (!query.filters) { return true; }
        if (query.filters.method && endpoint.method !== query.filters.method) { return false; }
        if (query.filters.framework && endpoint.framework !== query.filters.framework) { return false; }
        return true;
    }

    private calculateScore(item: SearchableEndpoint, queryText: string): MatchScore {
        const pathScore = this.matchScore(item.path, queryText) * 0.4;
        const classScore = this.matchScore(item.className, queryText) * 0.3;
        const methodScore = this.matchScore(item.methodName, queryText) * 0.2;
        const httpScore = this.matchScore(item.httpMethod, queryText) * 0.1;

        return {
            pathScore,
            classScore,
            methodScore,
            httpScore,
            total: pathScore + classScore + methodScore + httpScore
        };
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
