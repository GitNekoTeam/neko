import * as vscode from 'vscode';
import axios from 'axios';

export interface MarketplaceItem {
    id: string;
    name: string;
    displayName: string;
    description: string;
    version: string;
    author: string;
    category: MarketplaceCategory;
    downloads: number;
    rating: number;
    tags: string[];
    icon?: string;
    repository?: string;
    license?: string;
    createdAt: string;
    updatedAt: string;
}

export type MarketplaceCategory =
    | 'mcp-server'
    | 'prompt-template'
    | 'mode'
    | 'tool'
    | 'theme'
    | 'extension';

export interface MarketplaceSearchOptions {
    query?: string;
    category?: MarketplaceCategory;
    sortBy?: 'downloads' | 'rating' | 'updated' | 'name';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
}

export interface MarketplaceSearchResult {
    items: MarketplaceItem[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface InstalledItem {
    id: string;
    version: string;
    installedAt: string;
    enabled: boolean;
}

export interface MarketplaceServiceOptions {
    apiEndpoint?: string;
    storagePath: string;
}

export class MarketplaceService {
    private apiEndpoint: string;
    private storagePath: string;
    private installedItems: Map<string, InstalledItem> = new Map();
    private cache: Map<string, { data: MarketplaceItem; timestamp: number }> = new Map();
    private cacheTimeout: number = 5 * 60 * 1000;

    constructor(options: MarketplaceServiceOptions) {
        this.apiEndpoint = options.apiEndpoint || 'https://marketplace.gitneko.com/api';
        this.storagePath = options.storagePath;
    }

    async initialize(): Promise<void> {
        await this.loadInstalledItems();
    }

    async search(options: MarketplaceSearchOptions = {}): Promise<MarketplaceSearchResult> {
        const {
            query = '',
            category,
            sortBy = 'downloads',
            sortOrder = 'desc',
            page = 1,
            pageSize = 20
        } = options;

        try {
            const params = new URLSearchParams();
            if (query) params.append('q', query);
            if (category) params.append('category', category);
            params.append('sortBy', sortBy);
            params.append('sortOrder', sortOrder);
            params.append('page', String(page));
            params.append('pageSize', String(pageSize));

            const response = await axios.get<MarketplaceSearchResult>(
                `${this.apiEndpoint}/search?${params.toString()}`
            );

            return response.data;
        } catch (error) {
            console.error('Marketplace search failed:', error);
            return {
                items: [],
                total: 0,
                page,
                pageSize,
                hasMore: false
            };
        }
    }

    async getItem(id: string): Promise<MarketplaceItem | null> {
        const cached = this.cache.get(id);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            const response = await axios.get<MarketplaceItem>(
                `${this.apiEndpoint}/items/${id}`
            );

            this.cache.set(id, {
                data: response.data,
                timestamp: Date.now()
            });

            return response.data;
        } catch (error) {
            console.error(`Failed to get item ${id}:`, error);
            return null;
        }
    }

    async getCategories(): Promise<{ category: MarketplaceCategory; count: number }[]> {
        try {
            const response = await axios.get<{ category: MarketplaceCategory; count: number }[]>(
                `${this.apiEndpoint}/categories`
            );
            return response.data;
        } catch (error) {
            console.error('Failed to get categories:', error);
            return [];
        }
    }

    async install(id: string): Promise<boolean> {
        const item = await this.getItem(id);
        if (!item) {
            vscode.window.showErrorMessage(`Item ${id} not found`);
            return false;
        }

        try {
            const installedItem: InstalledItem = {
                id: item.id,
                version: item.version,
                installedAt: new Date().toISOString(),
                enabled: true
            };

            this.installedItems.set(id, installedItem);
            await this.saveInstalledItems();

            vscode.window.showInformationMessage(`Installed ${item.displayName}`);
            return true;
        } catch (error) {
            console.error(`Failed to install ${id}:`, error);
            vscode.window.showErrorMessage(`Failed to install ${item.displayName}`);
            return false;
        }
    }

    async uninstall(id: string): Promise<boolean> {
        const installed = this.installedItems.get(id);
        if (!installed) {
            return false;
        }

        try {
            this.installedItems.delete(id);
            await this.saveInstalledItems();

            vscode.window.showInformationMessage(`Uninstalled ${id}`);
            return true;
        } catch (error) {
            console.error(`Failed to uninstall ${id}:`, error);
            return false;
        }
    }

    async update(id: string): Promise<boolean> {
        const installed = this.installedItems.get(id);
        if (!installed) {
            return false;
        }

        const item = await this.getItem(id);
        if (!item) {
            return false;
        }

        if (item.version === installed.version) {
            vscode.window.showInformationMessage(`${item.displayName} is already up to date`);
            return true;
        }

        try {
            installed.version = item.version;
            installed.installedAt = new Date().toISOString();
            await this.saveInstalledItems();

            vscode.window.showInformationMessage(`Updated ${item.displayName} to v${item.version}`);
            return true;
        } catch (error) {
            console.error(`Failed to update ${id}:`, error);
            return false;
        }
    }

    async checkUpdates(): Promise<{ id: string; currentVersion: string; newVersion: string }[]> {
        const updates: { id: string; currentVersion: string; newVersion: string }[] = [];

        for (const [id, installed] of this.installedItems) {
            const item = await this.getItem(id);
            if (item && item.version !== installed.version) {
                updates.push({
                    id,
                    currentVersion: installed.version,
                    newVersion: item.version
                });
            }
        }

        return updates;
    }

    isInstalled(id: string): boolean {
        return this.installedItems.has(id);
    }

    getInstalledVersion(id: string): string | null {
        return this.installedItems.get(id)?.version || null;
    }

    getInstalledItems(): InstalledItem[] {
        return Array.from(this.installedItems.values());
    }

    async setEnabled(id: string, enabled: boolean): Promise<void> {
        const installed = this.installedItems.get(id);
        if (installed) {
            installed.enabled = enabled;
            await this.saveInstalledItems();
        }
    }

    isEnabled(id: string): boolean {
        return this.installedItems.get(id)?.enabled ?? false;
    }

    private async loadInstalledItems(): Promise<void> {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const filePath = path.join(this.storagePath, 'installed.json');

            const content = await fs.readFile(filePath, 'utf-8');
            const items = JSON.parse(content) as InstalledItem[];

            this.installedItems.clear();
            for (const item of items) {
                this.installedItems.set(item.id, item);
            }
        } catch {
            this.installedItems.clear();
        }
    }

    private async saveInstalledItems(): Promise<void> {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const filePath = path.join(this.storagePath, 'installed.json');

            await fs.mkdir(this.storagePath, { recursive: true });
            await fs.writeFile(
                filePath,
                JSON.stringify(Array.from(this.installedItems.values()), null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('Failed to save installed items:', error);
        }
    }

    clearCache(): void {
        this.cache.clear();
    }
}
