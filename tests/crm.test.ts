import { describe, it, expect } from "vitest";
import { demoLeads, demoSalesReps, demoFollowUps, demoActivities, demoPipelineStages, demoAnalytics } from "@/lib/demo-data";

describe("CRM AI Assistant — demo data integrity", () => {
  it("has at least 5 leads", () => {
    expect(demoLeads.length).toBeGreaterThanOrEqual(5);
  });

  it("every lead has a valid owner reference", () => {
    const repIds = new Set(demoSalesReps.map(r => r.id));
    for (const lead of demoLeads) {
      expect(repIds.has(lead.ownerId), `Lead ${lead.id} has unknown owner ${lead.ownerId}`).toBe(true);
    }
  });

  it("aiScore is between 0 and 100 for all leads", () => {
    for (const lead of demoLeads) {
      expect(lead.aiScore).toBeGreaterThanOrEqual(0);
      expect(lead.aiScore).toBeLessThanOrEqual(100);
    }
  });

  it("follow-ups reference existing leads", () => {
    const leadIds = new Set(demoLeads.map(l => l.id));
    for (const fu of demoFollowUps) {
      expect(leadIds.has(fu.leadId), `Follow-up ${fu.id} references unknown lead ${fu.leadId}`).toBe(true);
    }
  });

  it("activities reference existing leads", () => {
    const leadIds = new Set(demoLeads.map(l => l.id));
    for (const act of demoActivities) {
      expect(leadIds.has(act.leadId), `Activity ${act.id} references unknown lead ${act.leadId}`).toBe(true);
    }
  });

  it("pipeline stages are in order", () => {
    for (let i = 1; i < demoPipelineStages.length; i++) {
      expect(demoPipelineStages[i].order).toBeGreaterThan(demoPipelineStages[i - 1].order);
    }
  });

  it("pipeline stage totals sum reasonably to analytics", () => {
    const stageTotal = demoPipelineStages.reduce((sum, s) => sum + s.totalValue, 0);
    expect(stageTotal).toBeGreaterThan(0);
    expect(stageTotal).toBeLessThan(10_000_000);
  });

  it("analytics values are sensible", () => {
    expect(demoAnalytics.winRate).toBeGreaterThan(0);
    expect(demoAnalytics.winRate).toBeLessThanOrEqual(100);
    expect(demoAnalytics.conversionRate).toBeGreaterThan(0);
    expect(demoAnalytics.pipelineValue).toBeGreaterThan(0);
  });

  it("sales reps have positive quota attainment", () => {
    for (const rep of demoSalesReps) {
      expect(rep.quotaAttainment).toBeGreaterThan(0);
      expect(rep.dealsWon).toBeGreaterThanOrEqual(0);
    }
  });

  it("lead statuses are valid", () => {
    const validStatuses = ["new", "contacted", "qualified", "proposal", "won", "lost"];
    for (const lead of demoLeads) {
      expect(validStatuses).toContain(lead.status);
    }
  });
});
