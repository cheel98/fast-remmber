export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
const AUTH_TOKEN_KEY = 'fast-remmber-auth-token';

export interface RelationshipDetail {
  name: string;
  strength: number;
  similarityType?: string;
  difference?: string;
  sourceExample?: string;
  targetExample?: string;
  hasAIExplore?: boolean;
}

export interface UsageExample {
  title: string;
  usage: string;
  sentence: string;
  source: string;
  sourceUrl: string;
}

export interface IdiomResult {
  idiom: string;
  meaning: string;
  synonyms: RelationshipDetail[];
  antonyms: RelationshipDetail[];
  examples?: UsageExample[];
  emotions: string;
  hasAIExplore?: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  emotion?: string;
  hasMeaning?: boolean;
  val?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
  strength: number;
  similarityType?: string;
  difference?: string;
  sourceExample?: string;
  targetExample?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface AuthUser {
  id: string;
  username: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface DiscoveryRecord {
  id: string;
  query: string;
  createdAt: string;
  result: IdiomResult;
}

export const getStoredAuthToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setStoredAuthToken = (token: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearStoredAuthToken = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
};

const buildHeaders = (headers?: HeadersInit, requireAuth: boolean = false, includeJsonContentType: boolean = false): Headers => {
  const mergedHeaders = new Headers(headers);

  if (includeJsonContentType && !mergedHeaders.has('Content-Type')) {
    mergedHeaders.set('Content-Type', 'application/json');
  }

  const token = getStoredAuthToken();
  if (token) {
    mergedHeaders.set('Authorization', `Bearer ${token}`);
  } else if (requireAuth) {
    throw new Error('Please log in first');
  }

  return mergedHeaders;
};

const getErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = await response.json();
    if (payload?.error && typeof payload.error === 'string') {
      return payload.error;
    }
  } catch (error) {
    // Ignore JSON parsing failures and fall back to the default message.
  }

  return fallback;
};

const request = async (
  path: string,
  init: RequestInit,
  fallbackError: string,
  options: { requireAuth?: boolean; includeJsonContentType?: boolean } = {},
): Promise<Response> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init.headers, options.requireAuth ?? false, options.includeJsonContentType ?? false),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, fallbackError));
  }

  return response;
};

export const registerUser = async (username: string, password: string): Promise<AuthResponse> => {
  const response = await request(
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
    'Failed to register',
    { includeJsonContentType: true },
  );

  return response.json();
};

export const loginUser = async (username: string, password: string): Promise<AuthResponse> => {
  const response = await request(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
    'Failed to log in',
    { includeJsonContentType: true },
  );

  return response.json();
};

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const response = await request(
    '/auth/me',
    { method: 'GET' },
    'Failed to fetch current user',
    { requireAuth: true },
  );

  const payload = await response.json();
  return payload.user;
};

export const fetchDiscoveryHistory = async (limit: number = 20): Promise<DiscoveryRecord[]> => {
  const response = await request(
    `/discoveries?limit=${limit}`,
    { method: 'GET' },
    'Failed to fetch discovery history',
    { requireAuth: true },
  );

  const payload = await response.json();
  return payload.records ?? [];
};

export const analyzeIdiom = async (text: string): Promise<IdiomResult> => {
  const response = await request(
    '/analyze',
    {
      method: 'POST',
      body: JSON.stringify({ text }),
    },
    'Failed to analyze idiom',
    { requireAuth: true, includeJsonContentType: true },
  );

  return response.json();
};

export const saveIdiom = async (data: IdiomResult): Promise<void> => {
  await request(
    '/save',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    'Failed to save idiom to graph',
    { requireAuth: true, includeJsonContentType: true },
  );
};

export const fetchGraph = async (): Promise<GraphData> => {
  const response = await request(
    '/graph',
    { method: 'GET' },
    'Failed to fetch graph data',
    { requireAuth: true },
  );

  const data = await response.json();
  data.nodes = data.nodes.map((node: GraphNode) => ({ ...node, val: 1.5 }));
  return data;
};

export const associateIdioms = async (
  source: string,
  target: string,
  label: string = 'RELATED',
  strength: number = 1.0,
  details?: Omit<RelationshipDetail, 'name' | 'strength' | 'hasAIExplore'>,
): Promise<void> => {
  await request(
    '/associate',
    {
      method: 'POST',
      body: JSON.stringify({ source, target, label, strength, ...details }),
    },
    'Failed to create association',
    { requireAuth: true, includeJsonContentType: true },
  );
};

export const dissociateIdioms = async (source: string, target: string, label: string): Promise<void> => {
  await request(
    '/dissociate',
    {
      method: 'POST',
      body: JSON.stringify({ source, target, label }),
    },
    'Failed to remove association',
    { requireAuth: true, includeJsonContentType: true },
  );
};

export const fetchIdiomDetail = async (name: string): Promise<IdiomResult> => {
  const response = await request(
    `/idiom/${encodeURIComponent(name)}`,
    { method: 'GET' },
    'Failed to fetch idiom details',
    { requireAuth: true },
  );

  return response.json();
};

export const deleteIdiom = async (name: string): Promise<void> => {
  await request(
    `/idiom/${encodeURIComponent(name)}`,
    { method: 'DELETE' },
    'Failed to delete idiom',
    { requireAuth: true },
  );
};
