export type LeadStatus = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

export type LeadSource = "inbound" | "outbound" | "referral" | "event" | "partner";

export type Priority = "high" | "medium" | "low";

export type FollowUpType = "call" | "email" | "meeting" | "demo" | "proposal_send";

export type ScoreConfidence = "high" | "medium" | "low";

export type RepFeedbackAction = "override_up" | "override_down" | "confirm";

export type ScoreFactorCategory = "firmographic" | "technographic" | "intent" | "engagement";

export type ScoreStalenessRisk = "fresh" | "watch" | "decay_review";

export interface RepFeedback {
  repId: string;
  action: RepFeedbackAction;
  reason: string;
  previousScore: number;
  createdAt: string;
}

export interface ScoreFactor {
  label: string;
  impact: "positive" | "negative";
  category: ScoreFactorCategory;
  weight: number; // 0–100 relative contribution to the score
}

export interface Lead {
  id: string;
  fullName: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  aiScore: number;
  aiScoreConfidence: ScoreConfidence;
  aiScoreLastUpdatedAt: string;
  aiScoreFactors: ScoreFactor[];
  aiRiskFlags: string[];
  scoreStalenessRisk: ScoreStalenessRisk;
  scoreStalenessReason: string | null;
  repFeedback: RepFeedback | null;
  dealValue: number;
  ownerId: string;
  createdAt: string;
  lastContactedAt: string | null;
  nextFollowUpId: string | null;
  tags: string[];
}

export interface FollowUp {
  id: string;
  leadId: string;
  type: FollowUpType;
  scheduledFor: string;
  priority: Priority;
  title: string;
  notes: string;
  completed: boolean;
  completedAt: string | null;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  dealCount: number;
  totalValue: number;
}

export interface Activity {
  id: string;
  leadId: string;
  type: FollowUpType;
  timestamp: string;
  summary: string;
  outcome: "positive" | "neutral" | "negative";
}

export interface SalesRep {
  id: string;
  fullName: string;
  email: string;
  role: string;
  quotaAttainment: number;
  dealsWon: number;
  pipelineValue: number;
}

export interface TeamAnalytics {
  totalLeads: number;
  qualifiedLeads: number;
  pipelineValue: number;
  avgDealSize: number;
  conversionRate: number;
  tasksDueToday: number;
  overdueTasks: number;
  winRate: number;
}
