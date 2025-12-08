export interface TestCase {
    id: string;
    name: string;
    description: string;
    input: TestInput;
    expected: TestExpectation;
    tags?: string[];
    timeout?: number;
}

export interface TestInput {
    prefix: string;
    suffix: string;
    language: string;
    filePath?: string;
    context?: ContextItem[];
}

export interface ContextItem {
    type: 'file' | 'snippet' | 'definition';
    content: string;
    path?: string;
    language?: string;
}

export interface TestExpectation {
    contains?: string[];
    notContains?: string[];
    startsWith?: string;
    endsWith?: string;
    matches?: string;
    minLength?: number;
    maxLength?: number;
    isValidCode?: boolean;
}

export interface TestResult {
    testId: string;
    passed: boolean;
    completion: string;
    duration: number;
    error?: string;
    details?: TestResultDetails;
}

export interface TestResultDetails {
    containsChecks?: { pattern: string; found: boolean }[];
    notContainsChecks?: { pattern: string; found: boolean }[];
    startsWithCheck?: { expected: string; actual: string; passed: boolean };
    endsWithCheck?: { expected: string; actual: string; passed: boolean };
    matchesCheck?: { pattern: string; passed: boolean };
    lengthCheck?: { actual: number; min?: number; max?: number; passed: boolean };
}

export interface TestSuiteResult {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    results: TestResult[];
}

export interface LLMClientOptions {
    provider: string;
    model: string;
    apiKey?: string;
    apiEndpoint?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface CompletionRequest {
    prefix: string;
    suffix: string;
    language: string;
    maxTokens?: number;
    temperature?: number;
    stopSequences?: string[];
}

export interface CompletionResponse {
    completion: string;
    finishReason?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}
