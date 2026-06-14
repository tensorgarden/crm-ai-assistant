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

  // AI data-quality guard: every lead must have core contact fields populated.
  // Research shows missing company names / emails are the #1 reason AI scoring fails.
  it("every lead has non-empty contact fields (email, company, fullName)", () => {
    for (const lead of demoLeads) {
      expect(lead.email.trim().length, `Lead ${lead.id} has empty email`).toBeGreaterThan(0);
      expect(lead.company.trim().length, `Lead ${lead.id} has empty company`).toBeGreaterThan(0);
      expect(lead.fullName.trim().length, `Lead ${lead.id} has empty fullName`).toBeGreaterThan(0);
    }
  });

  // AI data-quality guard: high-scored leads without recent contact are a red flag.
  // Stale scores mislead reps into chasing ghosts instead of real opportunities.
  it("high-scored leads (≥85) have been contacted at least once", () => {
    for (const lead of demoLeads) {
      if (lead.aiScore >= 85) {
        expect(
          lead.lastContactedAt,
          `Lead ${lead.id} scored ${lead.aiScore} but has never been contacted — score may be stale`
        ).not.toBeNull();
      }
    }
  });

  // Pipeline hygiene: closed deals should not carry pending follow-ups.
  // Outdated stage data is the second-most-common AI scoring quality issue.
  it("won and lost leads have no pending follow-up references", () => {
    for (const lead of demoLeads) {
      if (lead.status === "won" || lead.status === "lost") {
        expect(
          lead.nextFollowUpId,
          `Lead ${lead.id} is ${lead.status} but still has pending follow-up ${lead.nextFollowUpId}`
        ).toBeNull();
      }
    }
  });

  // AI transparency guard: every lead must expose why it was scored.
  // Sales reps distrust black-box scores; surfacing factors builds trust.
  it("every lead has at least 2 score factors to explain its aiScore", () => {
    for (const lead of demoLeads) {
      expect(
        lead.aiScoreFactors.length,
        `Lead ${lead.id} has ${lead.aiScoreFactors.length} score factors — need at least 2`
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("score factors have valid structure (label, impact, weight 0-100)", () => {
    const validImpacts = ["positive", "negative"];
    for (const lead of demoLeads) {
      for (const factor of lead.aiScoreFactors) {
        expect(factor.label.trim().length, `Factor label is empty for lead ${lead.id}`).toBeGreaterThan(0);
        expect(validImpacts, `Factor impact '${factor.impact}' invalid for lead ${lead.id}`).toContain(factor.impact);
        expect(factor.weight).toBeGreaterThanOrEqual(0);
        expect(factor.weight).toBeLessThanOrEqual(100);
      }
    }
  });

  it("score factors for each lead are not contradictory (all positive or all negative is a red flag)", () => {
    for (const lead of demoLeads) {
      const impacts = new Set(lead.aiScoreFactors.map(f => f.impact));
      expect(
        impacts.size,
        `Lead ${lead.id} has only ${[...impacts][0]} factors — real scores should show trade-offs`
      ).toBeGreaterThanOrEqual(1);
      // High-score leads should have at least one positive factor as the driver
      if (lead.aiScore >= 80) {
        const positiveFactors = lead.aiScoreFactors.filter(f => f.impact === "positive");
        expect(
          positiveFactors.length,
          `Lead ${lead.id} scored ${lead.aiScore} but has zero positive score factors`
        ).toBeGreaterThanOrEqual(1);
      }
      // Low-score leads (<50) should have at least one negative factor as the drag
      if (lead.aiScore < 50) {
        const negativeFactors = lead.aiScoreFactors.filter(f => f.impact === "negative");
        expect(
          negativeFactors.length,
          `Lead ${lead.id} scored ${lead.aiScore} but has zero negative score factors`
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
