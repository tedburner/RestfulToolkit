export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type Framework = 'Spring' | 'JAX-RS';

export interface RestEndpoint {
    method: HttpMethod;
    path: string;
    className: string;
    methodName: string;
    file: string;
    line: number;
    framework: Framework;
}

export interface MatchScore {
    pathScore: number;
    classScore: number;
    methodScore: number;
    httpScore: number;
    total: number;
}

export interface SearchQuery {
    text: string;
    filters?: {
        method?: HttpMethod;
        framework?: Framework;
    };
}