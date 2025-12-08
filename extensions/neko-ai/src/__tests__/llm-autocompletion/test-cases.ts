import { TestCase } from './types';

export const BASIC_TEST_CASES: TestCase[] = [
    {
        id: 'ts-function-completion',
        name: 'TypeScript Function Completion',
        description: 'Complete a simple TypeScript function',
        input: {
            prefix: `function add(a: number, b: number): number {
    return `,
            suffix: `
}`,
            language: 'typescript'
        },
        expected: {
            contains: ['a', 'b'],
            matches: 'a\\s*\\+\\s*b'
        },
        tags: ['typescript', 'function', 'basic']
    },
    {
        id: 'ts-array-method',
        name: 'TypeScript Array Method',
        description: 'Complete array method chain',
        input: {
            prefix: `const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.`,
            suffix: ';',
            language: 'typescript'
        },
        expected: {
            contains: ['map'],
            notContains: ['undefined']
        },
        tags: ['typescript', 'array', 'basic']
    },
    {
        id: 'ts-interface-property',
        name: 'TypeScript Interface Property',
        description: 'Complete interface property',
        input: {
            prefix: `interface User {
    id: number;
    name: `,
            suffix: `
    email: string;
}`,
            language: 'typescript'
        },
        expected: {
            contains: ['string'],
            maxLength: 50
        },
        tags: ['typescript', 'interface', 'basic']
    },
    {
        id: 'js-async-await',
        name: 'JavaScript Async/Await',
        description: 'Complete async function',
        input: {
            prefix: `async function fetchData(url) {
    const response = await `,
            suffix: `
    return response.json();
}`,
            language: 'javascript'
        },
        expected: {
            contains: ['fetch'],
            notContains: ['undefined']
        },
        tags: ['javascript', 'async', 'basic']
    },
    {
        id: 'py-list-comprehension',
        name: 'Python List Comprehension',
        description: 'Complete list comprehension',
        input: {
            prefix: `numbers = [1, 2, 3, 4, 5]
squares = [`,
            suffix: ']',
            language: 'python'
        },
        expected: {
            contains: ['for'],
            matches: 'x\\s*\\*\\*?\\s*2?.*for.*in'
        },
        tags: ['python', 'list', 'basic']
    },
    {
        id: 'py-class-method',
        name: 'Python Class Method',
        description: 'Complete class method',
        input: {
            prefix: `class Calculator:
    def __init__(self):
        self.result = 0
    
    def add(self, value):
        self.result `,
            suffix: `
        return self`,
            language: 'python'
        },
        expected: {
            contains: ['+=', 'value'],
            maxLength: 100
        },
        tags: ['python', 'class', 'basic']
    }
];

export const ADVANCED_TEST_CASES: TestCase[] = [
    {
        id: 'ts-generic-function',
        name: 'TypeScript Generic Function',
        description: 'Complete generic function implementation',
        input: {
            prefix: `function identity<T>(arg: T): T {
    `,
            suffix: `
}`,
            language: 'typescript'
        },
        expected: {
            contains: ['return', 'arg'],
            maxLength: 50
        },
        tags: ['typescript', 'generics', 'advanced']
    },
    {
        id: 'ts-promise-chain',
        name: 'TypeScript Promise Chain',
        description: 'Complete promise chain',
        input: {
            prefix: `fetch('/api/users')
    .then(response => response.json())
    .then(users => `,
            suffix: `)
    .catch(error => console.error(error));`,
            language: 'typescript'
        },
        expected: {
            notContains: ['undefined', 'null'],
            minLength: 5
        },
        tags: ['typescript', 'promise', 'advanced']
    },
    {
        id: 'react-component',
        name: 'React Component',
        description: 'Complete React functional component',
        input: {
            prefix: `interface ButtonProps {
    label: string;
    onClick: () => void;
}

const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
    return (
        <button onClick={`,
            suffix: `}>
            {label}
        </button>
    );
};`,
            language: 'typescriptreact'
        },
        expected: {
            contains: ['onClick'],
            maxLength: 50
        },
        tags: ['react', 'component', 'advanced']
    }
];

export const ALL_TEST_CASES: TestCase[] = [...BASIC_TEST_CASES, ...ADVANCED_TEST_CASES];

export function getTestCasesByTag(tag: string): TestCase[] {
    return ALL_TEST_CASES.filter(tc => tc.tags?.includes(tag));
}

export function getTestCasesByLanguage(language: string): TestCase[] {
    return ALL_TEST_CASES.filter(tc => tc.input.language === language);
}

export function getTestCaseById(id: string): TestCase | undefined {
    return ALL_TEST_CASES.find(tc => tc.id === id);
}
