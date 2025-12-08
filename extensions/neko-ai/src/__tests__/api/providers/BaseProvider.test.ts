import { describe, it, expect } from 'vitest';
import { 
    ProviderOptions, 
    ImageContent, 
    TextContent,
    Message 
} from '../../../api/providers/BaseProvider';

describe('BaseProvider types', () => {
    describe('ProviderOptions', () => {
        it('should have correct structure', () => {
            const options: ProviderOptions = {
                apiKey: 'test-key',
                apiEndpoint: 'https://api.example.com',
                model: 'gpt-4',
                completionModel: 'gpt-3.5-turbo',
                embeddingModel: 'text-embedding-3-small',
                temperature: 0.7,
                supportsVision: true
            };

            expect(options.apiKey).toBe('test-key');
            expect(options.supportsVision).toBe(true);
        });
    });

    describe('ImageContent', () => {
        it('should create base64 image content', () => {
            const content: ImageContent = {
                type: 'image',
                source: {
                    type: 'base64',
                    mediaType: 'image/png',
                    data: 'base64data'
                }
            };

            expect(content.type).toBe('image');
            expect(content.source.type).toBe('base64');
        });

        it('should create url image content', () => {
            const content: ImageContent = {
                type: 'image',
                source: {
                    type: 'url',
                    url: 'https://example.com/image.png'
                }
            };

            expect(content.source.type).toBe('url');
            expect(content.source.url).toBe('https://example.com/image.png');
        });
    });

    describe('TextContent', () => {
        it('should create text content', () => {
            const content: TextContent = {
                type: 'text',
                text: 'Hello world'
            };

            expect(content.type).toBe('text');
            expect(content.text).toBe('Hello world');
        });
    });

    describe('Message', () => {
        it('should create message with string content', () => {
            const message: Message = {
                role: 'user',
                content: 'Hello'
            };

            expect(message.role).toBe('user');
            expect(message.content).toBe('Hello');
        });

        it('should create message with mixed content', () => {
            const message: Message = {
                role: 'user',
                content: [
                    { type: 'text', text: 'Describe this image' },
                    { type: 'image', source: { type: 'base64', data: 'abc' } }
                ]
            };

            expect(Array.isArray(message.content)).toBe(true);
            expect((message.content as (TextContent | ImageContent)[]).length).toBe(2);
        });
    });
});
