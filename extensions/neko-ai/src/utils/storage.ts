import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { constants as fsConstants } from 'fs';

const EXTENSION_NAME = 'neko-ai';

export async function getStorageBasePath(defaultPath: string): Promise<string> {
    let customStoragePath = '';

    try {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        customStoragePath = config.get<string>('customStoragePath', '');
    } catch (error) {
        console.warn('Could not access VSCode configuration - using default path');
        return defaultPath;
    }

    if (!customStoragePath) {
        return defaultPath;
    }

    try {
        await fs.mkdir(customStoragePath, { recursive: true });
        await fs.access(customStoragePath, fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK);
        return customStoragePath;
    } catch (error) {
        console.error(`Custom storage path is unusable: ${error instanceof Error ? error.message : String(error)}`);
        return defaultPath;
    }
}

export function getStorageBasePathSync(defaultPath: string): string {
    let customStoragePath = '';

    try {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        customStoragePath = config.get<string>('customStoragePath', '');
    } catch (error) {
        console.warn('Could not access VSCode configuration - using default path');
        return defaultPath;
    }

    if (!customStoragePath) {
        return defaultPath;
    }

    try {
        fsSync.mkdirSync(customStoragePath, { recursive: true });
        fsSync.accessSync(customStoragePath, fsConstants.R_OK | fsConstants.W_OK | fsConstants.X_OK);
        return customStoragePath;
    } catch (error) {
        return defaultPath;
    }
}

export async function getTaskDirectoryPath(globalStoragePath: string, taskId: string): Promise<string> {
    const basePath = await getStorageBasePath(globalStoragePath);
    const taskDir = path.join(basePath, 'tasks', taskId);
    await fs.mkdir(taskDir, { recursive: true });
    return taskDir;
}

export async function getSettingsDirectoryPath(globalStoragePath: string): Promise<string> {
    const basePath = await getStorageBasePath(globalStoragePath);
    const settingsDir = path.join(basePath, 'settings');
    await fs.mkdir(settingsDir, { recursive: true });
    return settingsDir;
}

export async function getCacheDirectoryPath(globalStoragePath: string): Promise<string> {
    const basePath = await getStorageBasePath(globalStoragePath);
    const cacheDir = path.join(basePath, 'cache');
    await fs.mkdir(cacheDir, { recursive: true });
    return cacheDir;
}

export function getVectorStoreDirectoryPath(globalStoragePath: string): string {
    const basePath = getStorageBasePathSync(globalStoragePath);
    const vectorDir = path.join(basePath, 'vector');
    fsSync.mkdirSync(vectorDir, { recursive: true });
    return vectorDir;
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as T;
    } catch {
        return null;
    }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function deleteFile(filePath: string): Promise<boolean> {
    try {
        await fs.unlink(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function deleteDirectory(dirPath: string): Promise<boolean> {
    try {
        await fs.rm(dirPath, { recursive: true, force: true });
        return true;
    } catch {
        return false;
    }
}
