export * from "./posthog";

export const TREND_METRICS = ["demand", "fill", "attendance"] as const;

export type TrendMetric = (typeof TREND_METRICS)[number];
