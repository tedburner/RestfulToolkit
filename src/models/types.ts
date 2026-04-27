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

export interface EndpointParameter {
    name: string;
    type: string;
    source: 'path' | 'query' | 'body' | 'form';
    originalCaseName: string;
    isRequired: boolean;
    defaultValue?: string;
}

export interface DtoField {
    name: string;
    type: string;
    originalName: string;
}

export interface EndpointCopyInfo {
    httpMethod: string;
    contentType: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'url-params';
    path: string;
    parameters: EndpointParameter[];
    framework: 'Spring' | 'JAX-RS';
    /** DTO 类型名 → 字段列表，由 DtoFieldExtractor 填充 */
    dtoFields: Map<string, DtoField[]>;
}