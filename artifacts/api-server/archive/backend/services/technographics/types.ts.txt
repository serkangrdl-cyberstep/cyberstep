export interface TechStack {
  category: string;
  vendor: string;
  product: string;
  version?: string;
  confidence: number;
  detectedVia: string;
  evidence?: Record<string, unknown>;
  securityRisk?: "critical" | "high" | "medium" | "low" | "none";
  securityNote?: string;
  salesSignal?: string;
}

export interface MaturityResult {
  maturityScore: number;
  maturityLevel: "low" | "medium" | "high" | "enterprise";
  scoreEmail: number;
  scoreWeb: number;
  scoreInfra: number;
  scoreVisibility: number;
  companySegment: string;
  segmentSignals: string[];
  recommendedService: string;
  recommendationReason: string;
}
