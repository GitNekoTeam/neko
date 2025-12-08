import {
    TestCase,
    TestResult,
    TestSuiteResult,
    TestResultDetails,
    LLMClientOptions
} from './types';
import { LLMClient } from './LLMClient';

export interface TestRunnerOptions {
    llmOptions: LLMClientOptions;
    timeout?: number;
    retries?: number;
    parallel?: boolean;
    maxConcurrency?: number;
}

export class TestRunner {
    private client: LLMClient;
    private options: TestRunnerOptions;

    constructor(options: TestRunnerOptions) {
        this.options = {
            timeout: 30000,
            retries: 0,
            parallel: false,
            maxConcurrency: 5,
            ...options
        };
        this.client = new LLMClient(options.llmOptions);
    }

    async runTest(testCase: TestCase): Promise<TestResult> {
        const startTime = Date.now();
        const timeout = testCase.timeout || this.options.timeout || 30000;

        try {
            const completion = await this.executeWithTimeout(this.getCompletion(testCase), timeout);
            const duration = Date.now() - startTime;
            const { passed, details } = this.validateResult(completion, testCase.expected);

            return { testId: testCase.id, passed, completion, duration, details };
        } catch (error) {
            return {
                testId: testCase.id,
                passed: false,
                completion: '',
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    async runTests(testCases: TestCase[]): Promise<TestSuiteResult> {
        const startTime = Date.now();
        const results: TestResult[] = [];

        if (this.options.parallel) {
            const chunks = this.chunkArray(testCases, this.options.maxConcurrency || 5);
            for (const chunk of chunks) {
                const chunkResults = await Promise.all(chunk.map(tc => this.runTestWithRetry(tc)));
                results.push(...chunkResults);
            }
        } else {
            for (const testCase of testCases) {
                const result = await this.runTestWithRetry(testCase);
                results.push(result);
            }
        }

        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed && !r.error).length;
        const skipped = results.filter(r => r.error?.includes('skipped')).length;

        return {
            total: testCases.length,
            passed,
            failed,
            skipped,
            duration: Date.now() - startTime,
            results
        };
    }

    private async runTestWithRetry(testCase: TestCase): Promise<TestResult> {
        let lastResult: TestResult | null = null;
        const retries = this.options.retries || 0;

        for (let attempt = 0; attempt <= retries; attempt++) {
            lastResult = await this.runTest(testCase);
            if (lastResult.passed || !lastResult.error) {
                return lastResult;
            }
            if (attempt < retries) {
                await this.delay(1000 * (attempt + 1));
            }
        }

        return lastResult!;
    }

    private async getCompletion(testCase: TestCase): Promise<string> {
        const response = await this.client.complete({
            prefix: testCase.input.prefix,
            suffix: testCase.input.suffix,
            language: testCase.input.language
        });
        return response.completion;
    }

    private validateResult(
        completion: string,
        expected: TestCase['expected']
    ): { passed: boolean; details: TestResultDetails } {
        const details: TestResultDetails = {};
        let passed = true;

        if (expected.contains) {
            details.containsChecks = expected.contains.map(pattern => {
                const found = completion.includes(pattern);
                if (!found) passed = false;
                return { pattern, found };
            });
        }

        if (expected.notContains) {
            details.notContainsChecks = expected.notContains.map(pattern => {
                const found = completion.includes(pattern);
                if (found) passed = false;
                return { pattern, found };
            });
        }

        if (expected.startsWith !== undefined) {
            const startsWithPassed = completion.trimStart().startsWith(expected.startsWith);
            details.startsWithCheck = {
                expected: expected.startsWith,
                actual: completion.substring(0, expected.startsWith.length),
                passed: startsWithPassed
            };
            if (!startsWithPassed) passed = false;
        }

        if (expected.endsWith !== undefined) {
            const endsWithPassed = completion.trimEnd().endsWith(expected.endsWith);
            details.endsWithCheck = {
                expected: expected.endsWith,
                actual: completion.substring(completion.length - expected.endsWith.length),
                passed: endsWithPassed
            };
            if (!endsWithPassed) passed = false;
        }

        if (expected.matches) {
            const regex = new RegExp(expected.matches);
            const matchesPassed = regex.test(completion);
            details.matchesCheck = { pattern: expected.matches, passed: matchesPassed };
            if (!matchesPassed) passed = false;
        }

        if (expected.minLength !== undefined || expected.maxLength !== undefined) {
            const length = completion.length;
            const minOk = expected.minLength === undefined || length >= expected.minLength;
            const maxOk = expected.maxLength === undefined || length <= expected.maxLength;
            details.lengthCheck = {
                actual: length,
                min: expected.minLength,
                max: expected.maxLength,
                passed: minOk && maxOk
            };
            if (!minOk || !maxOk) passed = false;
        }

        return { passed, details };
    }

    private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
        ]);
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setLLMOptions(options: Partial<LLMClientOptions>): void {
        this.client.setOptions(options);
    }
}
