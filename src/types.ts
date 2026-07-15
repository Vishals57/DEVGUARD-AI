export interface Issue {
  filePath: string;
  lineStart: number;
  category: "SECURITY" | "PERFORMANCE" | "QUALITY";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  explanation: string;
  remediation: string;
  beforeCode: string;
  afterCode: string;
}

export interface AuditReport {
  securityScore: number;
  performanceScore: number;
  qualityScore: number;
  threatLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  executiveSummary: string;
  issues: Issue[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
}

export interface SampleCode {
  id: string;
  name: string;
  description: string;
  fileName: string;
  isDiff: boolean;
  content: string;
}

export interface SavedAuditSession {
  id: string;
  timestamp: string;
  title: string;
  code: string;
  isDiff: boolean;
  report: AuditReport;
  chatMessages: ChatMessage[];
}

