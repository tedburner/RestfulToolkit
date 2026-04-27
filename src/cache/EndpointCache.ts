import * as vscode from 'vscode';
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

    search(query: SearchQuery): RestEndpoint[] {
        const allEndpoints = this.flattenAll();

        const scored = allEndpoints
            .map(endpoint => ({
                endpoint,
                score: this.calculateScore(endpoint, query)
            }))
            .filter(item => item.score.total > 0);

        scored.sort((a, b) => b.score.total - a.score.total);

        const maxResults = vscode.workspace
            .getConfiguration('restfulToolkit')
            .get<number>('maxResults', 100);

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

        if (text.includes(query)) {
            return 0.8;
        }

        const fuzzyScore = this.fuzzyMatch(text, query);
        return fuzzyScore;
    }

    private fuzzyMatch(text: string, query: string): number {
        let queryIndex = 0;
        let matches = 0;

        for (let i = 0; i < text.length && queryIndex < query.length; i++) {
            if (text[i] === query[queryIndex]) {
                matches++;
                queryIndex++;
            }
        }

        return queryIndex === query.length ? (matches / text.length) * 0.5 : 0;
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