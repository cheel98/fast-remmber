export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export interface RelationshipDetail {
  name: string;
  strength: number;
  hasAIExplore?: boolean;
}

export interface IdiomResult {
  idiom: string;
  meaning: string;
  synonyms: RelationshipDetail[];
  antonyms: RelationshipDetail[];
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
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export const analyzeIdiom = async (text: string): Promise<IdiomResult> => {
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error('Failed to analyze idiom');
  }
  return response.json();
};

export const saveIdiom = async (data: IdiomResult): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    let errorMsg = 'Failed to save idiom to graph';
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch(e) {}
    throw new Error(errorMsg);
  }
};

export const fetchGraph = async (): Promise<GraphData> => {
  const response = await fetch(`${API_BASE_URL}/graph`);
  if (!response.ok) {
    throw new Error('Failed to fetch graph data');
  }
  const data = await response.json();
  
  // Basic cleanup or defaults for the graph library
  data.nodes = data.nodes.map((n: GraphNode) => ({ ...n, val: 1.5 }));
  return data;
};

export const associateIdioms = async (source: string, target: string, label: string = 'RELATED', strength: number = 1.0): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/associate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, target, label, strength }),
  });
  if (!response.ok) {
    let errorMsg = 'Failed to create association';
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch(e) {}
    throw new Error(errorMsg);
  }
};

export const dissociateIdioms = async (source: string, target: string, label: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/dissociate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, target, label }),
  });
  if (!response.ok) {
    let errorMsg = 'Failed to remove association';
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch(e) {}
    throw new Error(errorMsg);
  }
};

export const fetchIdiomDetail = async (name: string): Promise<IdiomResult> => {
  const response = await fetch(`${API_BASE_URL}/idiom/${encodeURIComponent(name)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch idiom details');
  }
  return response.json();
};

export const deleteIdiom = async (name: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/idiom/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete idiom');
  }
};
