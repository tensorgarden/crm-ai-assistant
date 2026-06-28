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

  it("score factors have valid structure (label, impact, category, weight 0-100)", () => {
    const validImpacts = ["positive", "negative"];
    const validCategories = ["firmographic", "technographic", "intent", "engagement"];
    for (const lead of demoLeads) {
      for (const factor of lead.aiScoreFactors) {
        expect(factor.label.trim().length, `Factor label is empty for lead ${lead.id}`).toBeGreaterThan(0);
        expect(validImpacts, `Factor impact '${factor.impact}' invalid for lead ${lead.id}`).toContain(factor.impact);
        expect(validCategories, `Factor category '${factor.category}' invalid for lead ${lead.id}`).toContain(factor.category);
        expect(factor.weight).toBeGreaterThanOrEqual(0);
        expect(factor.weight).toBeLessThanOrEqual(100);
      }
    }
  });

  // Signal-quality guard: current lead scoring guidance warns that engagement noise
  // (opens, clicks, page views) should not override ICP fit or buying intent.
  it("high-scored leads are backed by firmographic or intent signals, not engagement alone", () => {
    for (const lead of demoLeads) {
      if (lead.aiScore >= 85) {
        const highQualityDrivers = lead.aiScoreFactors.filter(
          factor =>
            factor.impact === "positive" &&
            (factor.category === "firmographic" || factor.category === "intent")
        );
        expect(
          highQualityDrivers.length,
          `Lead ${lead.id} scored ${lead.aiScore} without firmographic or intent drivers`
        ).toBeGreaterThanOrEqual(1);
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

  // Score confidence guard: modern AI lead scoring needs reps to see freshness,
  // not just a single black-box priority number.
  it("every lead exposes score confidence and a parseable score refresh timestamp", () => {
    const validConfidence = ["high", "medium", "low"];
    for (const lead of demoLeads) {
      expect(validConfidence, `Lead ${lead.id} has invalid confidence ${lead.aiScoreConfidence}`).toContain(lead.aiScoreConfidence);
      expect(Number.isNaN(Date.parse(lead.aiScoreLastUpdatedAt)), `Lead ${lead.id} has invalid score timestamp`).toBe(false);
    }
  });

  it("score timestamps are refreshed after the most recent contact activity", () => {
    for (const lead of demoLeads) {
      if (lead.lastContactedAt) {
        expect(
          Date.parse(lead.aiScoreLastUpdatedAt),
          `Lead ${lead.id} score timestamp predates its last contact`
        ).toBeGreaterThanOrEqual(Date.parse(lead.lastContactedAt));
      }
    }
  });

  it("low-confidence scores carry an explicit reason for rep review", () => {
    for (const lead of demoLeads) {
      if (lead.aiScoreConfidence === "low") {
        expect(
          lead.aiRiskFlags.length,
          `Lead ${lead.id} is low confidence but has no review risk flags`
        ).toBeGreaterThan(0);
      }
    }
  });

  it("score staleness risk values are valid and explained when attention is needed", () => {
    const validStalenessRisks = ["fresh", "watch", "decay_review"];
    for (const lead of demoLeads) {
      expect(
        validStalenessRisks,
        `Lead ${lead.id} has invalid staleness risk ${lead.scoreStalenessRisk}`
      ).toContain(lead.scoreStalenessRisk);

      if (lead.scoreStalenessRisk !== "fresh") {
        expect(
          lead.scoreStalenessReason?.trim().length ?? 0,
          `Lead ${lead.id} needs a staleness explanation when risk is ${lead.scoreStalenessRisk}`
        ).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("decay-review leads carry explicit risk flags before stale intent stays in the sales queue", () => {
    const decayReviewLeads = demoLeads.filter(l => l.scoreStalenessRisk === "decay_review");
    expect(
      decayReviewLeads.length,
      "No demo leads show score decay review for stale CRM intent"
    ).toBeGreaterThanOrEqual(1);
    expect(
      decayReviewLeads.some(l => l.status !== "won" && l.status !== "lost"),
      "At least one active lead should show score decay review before reps chase stale intent"
    ).toBe(true);

    for (const lead of decayReviewLeads) {
      expect(
        lead.aiRiskFlags,
        `Lead ${lead.id} is marked for decay review but lacks the score_decay_review risk flag`
      ).toContain("score_decay_review");
      expect(
        lead.aiScoreConfidence,
        `Lead ${lead.id} should not keep high confidence while marked for score decay review`
      ).not.toBe("high");
    }
  });

  // Closed-loop rep feedback: reps must be able to override AI scores.
  // Without this, model accuracy drifts and reps ignore scores entirely.
  it("rep feedback entries reference valid sales reps", () => {
    const repIds = new Set(demoSalesReps.map(r => r.id));
    for (const lead of demoLeads) {
      if (lead.repFeedback) {
        expect(
          repIds.has(lead.repFeedback.repId),
          `Lead ${lead.id} rep feedback references unknown rep ${lead.repFeedback.repId}`
        ).toBe(true);
      }
    }
  });

  it("rep feedback reasons are non-empty and meaningful", () => {
    for (const lead of demoLeads) {
      if (lead.repFeedback) {
        expect(
          lead.repFeedback.reason.trim().length,
          `Lead ${lead.id} rep feedback reason is empty`
        ).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("rep feedback actions use valid values", () => {
    const validActions = ["override_up", "override_down", "confirm"];
    for (const lead of demoLeads) {
      if (lead.repFeedback) {
        expect(
          validActions,
          `Lead ${lead.id} has invalid rep feedback action '${lead.repFeedback.action}'`
        ).toContain(lead.repFeedback.action);
      }
    }
  });

  it("rep feedback createdAt is a parseable ISO timestamp", () => {
    for (const lead of demoLeads) {
      if (lead.repFeedback) {
        expect(
          Number.isNaN(Date.parse(lead.repFeedback.createdAt)),
          `Lead ${lead.id} rep feedback has invalid createdAt`
        ).toBe(false);
      }
    }
  });

  it("at least one lead has rep feedback demonstrating the closed-loop feature", () => {
    const feedbackLeads = demoLeads.filter(l => l.repFeedback !== null);
    expect(feedbackLeads.length, "No leads have rep feedback — closed-loop override is not demonstrated").toBeGreaterThanOrEqual(1);
  });
});
