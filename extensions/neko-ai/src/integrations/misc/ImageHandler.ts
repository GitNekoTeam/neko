import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ProcessedImage {
    base64: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    originalPath?: string;
    width?: number;
    height?: number;
    sizeBytes: number;
}

export interface ImageProcessingOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
}

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB

export class ImageHandler {
    isImageFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return SUPPORTED_EXTENSIONS.includes(ext);
    }

    getMimeType(filePath: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        return mimeTypes[ext] || 'image/png';
    }

    async processImage(
        filePath: string,
        _options: ImageProcessingOptions = {}
    ): Promise<ProcessedImage> {
        const buffer = await fs.readFile(filePath);

        if (buffer.length > MAX_IMAGE_SIZE) {
            throw new Error(`Image file too large: ${buffer.length} bytes (max: ${MAX_IMAGE_SIZE})`);
        }

        const base64 = buffer.toString('base64');
        const mimeType = this.getMimeType(filePath);

        return {
            base64,
            mimeType,
            originalPath: filePath,
            sizeBytes: buffer.length
        };
    }

    async processImages(filePaths: string[]): Promise<ProcessedImage[]> {
        const results: ProcessedImage[] = [];

        for (const filePath of filePaths) {
            if (this.isImageFile(filePath)) {
                try {
                    const processed = await this.processImage(filePath);
                    results.push(processed);
                } catch (error) {
                    console.warn(`Failed to process image ${filePath}:`, error);
                }
            }
        }

        return results;
    }

    async processImageFromUri(uri: vscode.Uri): Promise<ProcessedImage> {
        return this.processImage(uri.fsPath);
    }

    async processImageFromBase64(
        base64: string,
        mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
    ): Promise<ProcessedImage> {
        const buffer = Buffer.from(base64, 'base64');

        return {
            base64,
            mimeType,
            sizeBytes: buffer.length
        };
    }

    async processImageFromClipboard(): Promise<ProcessedImage | null> {
        try {
            const clipboardContent = await vscode.env.clipboard.readText();

            if (clipboardContent.startsWith('data:image/')) {
                const matches = clipboardContent.match(/^data:(image\/\w+);base64,(.+)$/);
                if (matches) {
                    const mimeType = matches[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
                    const base64 = matches[2];
                    return this.processImageFromBase64(base64, mimeType);
                }
            }

            return null;
        } catch {
            return null;
        }
    }

    formatImageForApi(image: ProcessedImage): {
        type: 'image';
        source: {
            type: 'base64';
            media_type: string;
            data: string;
        };
    } {
        return {
            type: 'image',
            source: {
                type: 'base64',
                media_type: image.mimeType,
                data: image.base64
            }
        };
    }

    estimateTokens(image: ProcessedImage): number {
        const pixels = image.sizeBytes / 3;
        const side = Math.sqrt(pixels);
        const tiles = Math.ceil(side / 512) * Math.ceil(side / 512);
        return tiles * 170 + 85;
    }
}
