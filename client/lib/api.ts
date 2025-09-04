export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export async function apiCall<T = any>(
  nodeUrl: string,
  endpoint: string,
  apiKey: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const url = `${nodeUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      return { error: error.error || `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

export async function checkNodeHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok && (await response.text()) === 'OK';
  } catch {
    return false;
  }
}