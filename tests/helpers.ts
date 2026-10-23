import fs from "node:fs";
import path from "node:path";
import type { DailyMetric } from "@arc/core";

export const sample = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "sample", file), "utf8")) as T;
export const metricsRows = () => sample<DailyMetric[]>("daily_metrics.json");
export const planted = () => sample<{ client_id: string; rule: string; entity_id: string }[]>("planted_problems.json");
export const CLIENT_IDS = ["glowfield-skincare", "harbor-law", "northstar-partners", "ridgeline-roofing"];
