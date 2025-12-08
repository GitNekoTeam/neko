declare module 'axios' {
    export interface AxiosRequestConfig {
        url?: string;
        method?: string;
        baseURL?: string;
        headers?: Record<string, string>;
        params?: Record<string, unknown>;
        data?: unknown;
        timeout?: number;
        responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';
        signal?: AbortSignal;
    }

    export interface AxiosResponse<T = unknown> {
        data: T;
        status: number;
        statusText: string;
        headers: Record<string, string>;
        config: AxiosRequestConfig;
    }

    export interface AxiosError<T = unknown> extends Error {
        config: AxiosRequestConfig;
        code?: string;
        request?: unknown;
        response?: AxiosResponse<T>;
        isAxiosError: boolean;
    }

    export interface AxiosInstance {
        request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
        get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
        delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
        head<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
        post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
        put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
        patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
        defaults: AxiosRequestConfig;
    }

    export function create(config?: AxiosRequestConfig): AxiosInstance;
    export function request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    export function get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    export function post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    export function put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    export function patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    export function del<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;

    const axios: AxiosInstance & {
        create: typeof create;
        isAxiosError(payload: unknown): payload is AxiosError;
    };

    export default axios;
}
