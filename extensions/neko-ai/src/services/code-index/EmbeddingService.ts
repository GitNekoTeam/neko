import * as vscode from 'vscode';
import { BaseProvider } from '../../api/providers/BaseProvider';

export interface EmbeddedChunk {
    id: string;
    filePath: string;
    content: string;
    embedding: number[];
    startLine: number;
    endLine: number;
}

export class EmbeddingService {
    private outputChannel: vscode.OutputChannel;
    private provider: BaseProvider;
    private cache: Map<string, number[]> = new Map();

    constructor(outputChannel: vscode.OutputChannel, provider: BaseProvider) {
        this.outputChannel = outputChannel;
        this.provider = provider;
    }

    async embedText(text: string): Promise<number[]> {
        const cacheKey = this.hashText(text);
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        try {
            const response = await this.provider.getEmbedding(text);
            this.cache.set(cacheKey, response.embedding);
            return response.embedding;
        } catch (error) {
            this.outputChannel.appendLine(`Embedding error: ${error}`);
            throw error;
        }
    }

    async embedFile(
        filePath: string, 
        content: string, 
        chunkSize: number = 500
    ): Promise<EmbeddedChunk[]> {
        const chunks = this.splitFileIntoChunks(content, chunkSize);
        const embeddedChunks: EmbeddedChunk[] = [];

        for (const chunk of chunks) {
            try {
                const embedding = await this.embedText(chunk.content);
                embeddedChunks.push({
                    id: `${filePath}:${chunk.startLine}-${chunk.endLine}`,
                    filePath,
                    content: chunk.content,
                    embedding,
                    startLine: chunk.startLine,
                    endLine: chunk.endLine
                });
            } catch (error) {
                this.outputChannel.appendLine(
                    `Failed to embed chunk ${chunk.startLine}-${chunk.endLine} of ${filePath}: ${error}`
                );
            }
        }

        return embeddedChunks;
    }

    async embedBatch(texts: string[], batchSize: number = 10): Promise<number[][]> {
        const results: number[][] = [];
        
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const embeddings = await Promise.all(
                batch.map(text => this.embedText(text))
            );
            results.push(...embeddings);
        }

        return results;
    }

    private splitFileIntoChunks(
        content: string, 
        maxTokens: number
    ): { content: string; startLine: number; endLine: number }[] {
        const lines = content.split('\n');
        const chunks: { content: string; startLine: number; endLine: number }[] = [];
        
        let currentChunk: string[] = [];
        let startLine = 0;
        let currentTokens = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineTokens = Math.ceil(line.length / 4);

            if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
                chunks.push({
                    content: currentChunk.join('\n'),
                    startLine,
                    endLine: i - 1
                });
                currentChunk = [];
                currentTokens = 0;
                startLine = i;
            }

            currentChunk.push(line);
            currentTokens += lineTokens;
        }

        if (currentChunk.length > 0) {
            chunks.push({
                content: currentChunk.join('\n'),
                startLine,
                endLine: lines.length - 1
            });
        }

        return chunks;
    }

    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }

    async findSimilar(
        query: string, 
        chunks: EmbeddedChunk[], 
        topK: number = 10
    ): Promise<{ chunk: EmbeddedChunk; score: number }[]> {
        const queryEmbedding = await this.embedText(query);

        const scored = chunks.map(chunk => ({
            chunk,
            score: this.cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    clearCache(): void {
        this.cache.clear();
    }

    private hashText(text: string): string {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
}
