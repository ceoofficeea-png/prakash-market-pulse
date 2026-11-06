// Deterministic demonstration fixtures for the Prakash AI Avatar analytics.
// Stage 1 only: these figures are curated demo data, not connected to a live avatar service.

export type AvatarKpis = {
  consultations: number;
  consultationsDelta: number; // vs previous period, as a fraction
  recommendationAccuracy: number; // fraction 0-1
  accuracyDelta: number;
  avgFeedback: number; // 1-5 stars
  feedbackDelta: number;
  csat: number; // fraction 0-1 (share of 4-5 star ratings)
  leadsHandedToSales: number;
  leadsDelta: number;
};

export const AVATAR_KPIS: AvatarKpis = {
  consultations: 1284,
  consultationsDelta: 0.18,
  recommendationAccuracy: 0.93,
  accuracyDelta: 0.02,
  avgFeedback: 4.3,
  feedbackDelta: 0.05,
  csat: 0.87,
  leadsHandedToSales: 312,
  leadsDelta: 0.24,
};

export type AvatarModelRow = {
  model: string;
  category: "Submersible" | "Monoblock" | "Solar" | "Industrial" | "Openwell" | "Sewage";
  segment: "Agricultural" | "Industrial" | "Residential" | "Commercial";
  recommendations: number;
  acceptanceRate: number; // fraction 0-1
};

export const AVATAR_TOP_MODELS: AvatarModelRow[] = [
  { model: "Submersible Pump 4SP-18", category: "Submersible", segment: "Agricultural", recommendations: 286, acceptanceRate: 0.71 },
  { model: "Solar Pump System PSS-5", category: "Solar", segment: "Agricultural", recommendations: 214, acceptanceRate: 0.68 },
  { model: "Monoblock Pump PMB-25", category: "Monoblock", segment: "Residential", recommendations: 187, acceptanceRate: 0.74 },
  { model: "Industrial Centrifugal PIC-40", category: "Industrial", segment: "Industrial", recommendations: 142, acceptanceRate: 0.63 },
  { model: "Submersible Pump 4SP-24", category: "Submersible", segment: "Agricultural", recommendations: 121, acceptanceRate: 0.69 },
  { model: "Openwell Pump POW-15", category: "Openwell", segment: "Agricultural", recommendations: 98, acceptanceRate: 0.72 },
  { model: "Monoblock Motor PMM-10", category: "Monoblock", segment: "Residential", recommendations: 84, acceptanceRate: 0.66 },
  { model: "Sewage Pump PSP-20", category: "Sewage", segment: "Commercial", recommendations: 47, acceptanceRate: 0.58 },
];

export const AVATAR_SEGMENT_SPLIT = [
  { name: "Agricultural", value: 719 },
  { name: "Residential", value: 271 },
  { name: "Industrial", value: 189 },
  { name: "Commercial", value: 105 },
];

export type AvatarTag = { label: string; count: number; tone: "issue" | "praise" };

export const AVATAR_FEEDBACK_TAGS: AvatarTag[] = [
  { label: "Accurate sizing", count: 214, tone: "praise" },
  { label: "Fast answers", count: 168, tone: "praise" },
  { label: "Clear WhatsApp handover", count: 121, tone: "praise" },
  { label: "Helpful sizing charts", count: 96, tone: "praise" },
  { label: "Unsure of borewell yield", count: 74, tone: "issue" },
  { label: "Voltage / phase confusion", count: 58, tone: "issue" },
  { label: "Head depth under-estimated", count: 41, tone: "issue" },
  { label: "Dealer stock unavailable", count: 33, tone: "issue" },
  { label: "Flange standard questions", count: 22, tone: "issue" },
];

export type AvatarFunnelStage = { label: string; value: number };

export const AVATAR_FUNNEL: AvatarFunnelStage[] = [
  { label: "Customer visit", value: 3420 },
  { label: "Avatar pump-sizing consultation", value: 1284 },
  { label: "Recommendation generated", value: 1179 },
  { label: "Lead submitted (WhatsApp / form)", value: 402 },
  { label: "Sales qualified lead (SQL)", value: 187 },
];

export const AVATAR_HANDOVER_CHANNELS = [
  { name: "WhatsApp handover", value: 268 },
  { name: "Web form", value: 134 },
];
