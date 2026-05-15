// ─────────────────────────────────────────────────────────────────────────────
// All SDK types in one place.  Import from the package root, not this file.
// ─────────────────────────────────────────────────────────────────────────────

// ── Chart types ───────────────────────────────────────────────────────────────
// Produced by the backend's global generate_chart_spec tool.
// Rendered in AgentPanel via Chart.js (lazy-loaded — zero cost until first chart appears).

export interface ChartDataset {
  label: string;
  data:  number[];
}

export interface ChartSpec {
  type:     'bar' | 'line' | 'pie' | 'doughnut';
  title:    string;
  labels:   string[];
  datasets: ChartDataset[];
  currency?: string;   // ISO code e.g. 'USD', 'INR' — formats y-axis values
  unit?:     string;   // suffix e.g. '%', 'kg' — appended to y-axis values
  stacked?:  boolean;  // stack datasets on bar/line charts
}

// ── Core response types ───────────────────────────────────────────────────────

export interface AgentInsight {
  type:    'warning' | 'positive' | 'neutral';
  title:   string;
  detail:  string;
  metric?: string;
}

export interface AgentFile {
  type:     'file';
  filename: string;
  mimeType: string;
  content:  string;   // raw file content (CSV string, etc.)
  rowCount?: number;
}

export interface AgentResponse {
  narrative:  string;
  insights:   AgentInsight[];
  apisCalled: string[];
  confidence: 'high' | 'medium' | 'low';
  files?:     AgentFile[];    // populated when agent called a file-export tool
  charts?:    ChartSpec[];   // populated when agent called generate_chart_spec
}

export interface AgentMessage {
  id:        string;
  role:      'user' | 'agent';
  content:   string;
  response?: AgentResponse;
  timestamp: Date;
  loading?:  boolean;
  error?:    string;
}

// ── Thread / persistence types ────────────────────────────────────────────────

export interface Thread {
  id:         string;
  title:      string;       // auto-generated from first user message (≤ 40 chars)
  screenType: string;
  messages:   AgentMessage[];
  createdAt:  string;       // ISO string — Date is not JSON-serialisable
  updatedAt:  string;
}

// ── Conversation history ──────────────────────────────────────────────────────

export interface ConversationTurn {
  role:    'user' | 'agent';
  content: string;
}

// ── Client config ─────────────────────────────────────────────────────────────

export interface AgentClientConfig {
  /** Full URL of the agent microservice e.g. https://agent-ms.your-domain.com */
  agentUrl: string;
  /** Username registered in the microservice */
  username: string;
  /** Password registered in the microservice */
  password: string;
}

// ── Registry types (optional — only needed if using the legacy apiRegistry pattern) ──

export interface ApiParameter {
  name:        string;
  type:        'string' | 'number' | 'boolean';
  required:    boolean;
  description: string;
}

export interface ApiDefinition {
  name:        string;
  description: string;
  endpoint:    string;
  method:      'GET' | 'POST' | 'PUT' | 'DELETE';
  parameters:  ApiParameter[];
}
