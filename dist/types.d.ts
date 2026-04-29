export interface AgentInsight {
    type: 'warning' | 'positive' | 'neutral';
    title: string;
    detail: string;
    metric?: string;
}
export interface AgentResponse {
    narrative: string;
    insights: AgentInsight[];
    apisCalled: string[];
    confidence: 'high' | 'medium' | 'low';
}
export interface AgentMessage {
    id: string;
    role: 'user' | 'agent';
    content: string;
    response?: AgentResponse;
    timestamp: Date;
    loading?: boolean;
    error?: string;
}
export interface AgentClientConfig {
    /** Full URL of the agent microservice e.g. https://agent-ms.your-domain.com */
    agentUrl: string;
    /** Username registered in the microservice */
    username: string;
    /** Password registered in the microservice */
    password: string;
}
export interface ApiParameter {
    name: string;
    type: 'string' | 'number' | 'boolean';
    required: boolean;
    description: string;
}
export interface ApiDefinition {
    name: string;
    description: string;
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    parameters: ApiParameter[];
}
//# sourceMappingURL=types.d.ts.map