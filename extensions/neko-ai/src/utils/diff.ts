import * as diff from 'diff';

export interface DiffChange {
    type: 'add' | 'remove' | 'unchanged';
    value: string;
    lineNumber?: number;
}

export function computeDiff(oldText: string, newText: string): DiffChange[] {
    const changes = diff.diffLines(oldText, newText);
    const result: DiffChange[] = [];
    let lineNumber = 1;

    for (const change of changes) {
        if (change.added) {
            result.push({
                type: 'add',
                value: change.value,
                lineNumber
            });
            lineNumber += change.count || 0;
        } else if (change.removed) {
            result.push({
                type: 'remove',
                value: change.value,
                lineNumber
            });
        } else {
            result.push({
                type: 'unchanged',
                value: change.value,
                lineNumber
            });
            lineNumber += change.count || 0;
        }
    }

    return result;
}

export function applyDiff(original: string, patch: string): string {
    try {
        const patches = diff.parsePatch(patch);
        if (patches.length === 0) return original;
        
        const result = diff.applyPatch(original, patches[0]);
        return result || original;
    } catch {
        return original;
    }
}

export function createUnifiedDiff(
    oldFileName: string,
    newFileName: string,
    oldContent: string,
    newContent: string
): string {
    return diff.createTwoFilesPatch(
        oldFileName,
        newFileName,
        oldContent,
        newContent,
        '',
        '',
        { context: 3 }
    );
}

export function highlightDiff(oldText: string, newText: string): string {
    const changes = diff.diffWords(oldText, newText);
    let result = '';

    for (const change of changes) {
        if (change.added) {
            result += `[+${change.value}+]`;
        } else if (change.removed) {
            result += `[-${change.value}-]`;
        } else {
            result += change.value;
        }
    }

    return result;
}
