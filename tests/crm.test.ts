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


  // Routing SLA guard: fresh research shows manual routing delays kill conversion,
  // with high-intent leads needing a first response inside about five minutes.
  it("routes active high-intent leads with a five-minute first-response SLA", () => {
    const activeHighIntentLeads = demoLeads.filter(
      lead => lead.aiScore >= 85 && lead.status !== "won" && lead.status !== "lost"
    );

    expect(activeHighIntentLeads.length, "No active high-intent leads found for routing SLA coverage").toBeGreaterThanOrEqual(1);

    for (const lead of activeHighIntentLeads) {
      const routingSla = lead.routingSla;
      expect(routingSla, `Lead ${lead.id} is high intent but has no routing SLA`).not.toBeNull();
      if (!routingSla) {
        continue;
      }

      const assignedAt = Date.parse(routingSla.assignedAt);
      const dueAt = Date.parse(routingSla.firstResponseDueAt);
      const fiveMinutesMs = 5 * 60 * 1000;

      expect(Number.isNaN(assignedAt), `Lead ${lead.id} has invalid routing assignedAt`).toBe(false);
      expect(Number.isNaN(dueAt), `Lead ${lead.id} has invalid first response due time`).toBe(false);
      expect(dueAt - assignedAt, `Lead ${lead.id} response SLA is not after assignment`).toBeGreaterThan(0);
      expect(dueAt - assignedAt, `Lead ${lead.id} response SLA exceeds five minutes`).toBeLessThanOrEqual(fiveMinutesMs);
      expect(["on_track", "at_risk", "breached"], `Lead ${lead.id} has invalid routing SLA status`).toContain(routingSla.status);
      expect(routingSla.note.trim().length, `Lead ${lead.id} routing SLA lacks context`).toBeGreaterThanOrEqual(20);
    }
  });

  it("does not mark met routing SLAs as late when first response landed before the due time", () => {
    const routedLeads = demoLeads.filter(lead => lead.routingSla?.firstResponseAt);
    expect(routedLeads.length, "No demo leads show a completed first-response SLA").toBeGreaterThanOrEqual(1);

    for (const lead of routedLeads) {
      const routingSla = lead.routingSla;
      expect(routingSla).not.toBeNull();
      if (!routingSla || !routingSla.firstResponseAt) {
        continue;
      }

      const firstResponseAt = Date.parse(routingSla.firstResponseAt);
      const dueAt = Date.parse(routingSla.firstResponseDueAt);

      expect(Number.isNaN(firstResponseAt), `Lead ${lead.id} has invalid first response timestamp`).toBe(false);
      expect(firstResponseAt, `Lead ${lead.id} first response missed the SLA due time`).toBeLessThanOrEqual(dueAt);
      expect(routingSla.status, `Lead ${lead.id} met SLA but is not marked on-track`).toBe("on_track");
    }
  });


  // Account-based buying committees are a stronger intent signal than one person
  // clicking around; hot leads should show multiple roles before reps trust the score.
  it("buying committee signals are timestamped and role-tagged", () => {
    const validRoles = ["decision_maker", "executive", "operations", "technical", "finance", "security", "legal"];
    const leadsWithCommitteeSignals = demoLeads.filter(lead => lead.buyingCommitteeSignals.length > 0);

    expect(
      leadsWithCommitteeSignals.length,
      "No demo leads show account-based buying committee activity"
    ).toBeGreaterThanOrEqual(1);

    for (const lead of leadsWithCommitteeSignals) {
      for (const signal of lead.buyingCommitteeSignals) {
        expect(validRoles, `Lead ${lead.id} has invalid committee role ${signal.role}`).toContain(signal.role);
        expect(signal.signal.trim().length, `Lead ${lead.id} has an empty buying committee signal`).toBeGreaterThanOrEqual(25);
        expect(Number.isNaN(Date.parse(signal.observedAt)), `Lead ${lead.id} has invalid committee observedAt`).toBe(false);
      }
    }
  });

  it("active high-intent leads show multi-role committee alignment before hot routing", () => {
    const activeHighIntentLeads = demoLeads.filter(
      lead => lead.aiScore >= 85 && lead.status !== "won" && lead.status !== "lost"
    );

    expect(activeHighIntentLeads.length, "No active high-intent leads found for committee coverage").toBeGreaterThanOrEqual(1);

    for (const lead of activeHighIntentLeads) {
      const committeeRoles = new Set(lead.buyingCommitteeSignals.map(signal => signal.role));
      expect(
        committeeRoles.size,
        `Lead ${lead.id} is hot but lacks multi-role buying committee evidence`
      ).toBeGreaterThanOrEqual(2);
      expect(
        lead.aiRiskFlags.includes("bot_engagement_noise"),
        `Lead ${lead.id} should not be routed hot from scanner or vanity engagement noise`
      ).toBe(false);
    }
  });

  it("requires verified decision-maker involvement before hot-lead routing", () => {
    const activeHighIntentLeads = demoLeads.filter(
      lead => lead.aiScore >= 85 && lead.status !== "won" && lead.status !== "lost"
    );

    expect(
      activeHighIntentLeads.length,
      "No active high-intent leads found for decision-maker coverage"
    ).toBeGreaterThanOrEqual(1);

    for (const lead of activeHighIntentLeads) {
      const decisionMakerSignals = lead.buyingCommitteeSignals.filter(
        signal => signal.role === "decision_maker"
      );

      expect(
        decisionMakerSignals.length,
        `Lead ${lead.id} is hot but has no verified decision-maker involvement`
      ).toBeGreaterThanOrEqual(1);
      expect(
        decisionMakerSignals.every(
          signal => Date.parse(signal.observedAt) <= Date.parse(lead.aiScoreLastUpdatedAt)
        ),
        `Lead ${lead.id} was scored hot before its decision-maker signal was observed`
      ).toBe(true);
    }
  });

  // Buying-group coverage is not enough on its own: current research shows
  // unresolved stakeholder conflict can undermine otherwise qualified deals.
  it("keeps buying-group consensus reviews evidence-backed and timestamped", () => {
    const reviewedLeads = demoLeads.filter(lead => lead.buyingCommitteeConsensus !== null);
    const validStatuses = ["aligned", "mixed", "conflict"];

    expect(reviewedLeads.length, "No demo leads show buying-group consensus review").toBeGreaterThanOrEqual(1);

    for (const lead of reviewedLeads) {
      const consensus = lead.buyingCommitteeConsensus;
      expect(consensus).not.toBeNull();
      if (!consensus) {
        continue;
      }

      expect(validStatuses, `Lead ${lead.id} has invalid consensus status`).toContain(consensus.status);
      expect(consensus.summary.trim().length, `Lead ${lead.id} lacks a meaningful consensus summary`).toBeGreaterThanOrEqual(40);
      expect(Number.isNaN(Date.parse(consensus.assessedAt)), `Lead ${lead.id} has invalid consensus assessedAt`).toBe(false);
      expect(
        Date.parse(consensus.assessedAt),
        `Lead ${lead.id} was scored before its buying-group consensus review`
      ).toBeLessThanOrEqual(Date.parse(lead.aiScoreLastUpdatedAt));

      if (consensus.status === "aligned") {
        expect(consensus.unresolvedConcerns, `Lead ${lead.id} is aligned but still lists blockers`).toHaveLength(0);
      } else {
        expect(consensus.unresolvedConcerns.length, `Lead ${lead.id} has unresolved consensus risk without named concerns`).toBeGreaterThanOrEqual(1);
        expect(
          consensus.unresolvedConcerns.every(concern => concern.trim().length >= 20),
          `Lead ${lead.id} has a weak buying-group concern`
        ).toBe(true);
      }
    }
  });

  it("requires aligned buying-group consensus before active hot routing", () => {
    const activeHotLeads = demoLeads.filter(
      lead => lead.aiScore >= 85 && lead.status !== "won" && lead.status !== "lost"
    );

    expect(activeHotLeads.length, "No active hot leads found for consensus coverage").toBeGreaterThanOrEqual(1);
    for (const lead of activeHotLeads) {
      expect(
        lead.buyingCommitteeConsensus?.status,
        `Lead ${lead.id} is routed hot without aligned buying-group consensus`
      ).toBe("aligned");
      expect(
        lead.buyingCommitteeConsensus?.unresolvedConcerns,
        `Lead ${lead.id} is routed hot with unresolved buying-group concerns`
      ).toHaveLength(0);
    }
  });

  it("keeps conflicted buying groups in review instead of sales routing", () => {
    const conflictedLeads = demoLeads.filter(
      lead => lead.buyingCommitteeConsensus?.status === "conflict"
    );

    expect(conflictedLeads.length, "No demo lead shows buying-group conflict").toBeGreaterThanOrEqual(1);
    for (const lead of conflictedLeads) {
      expect(lead.aiRiskFlags, `Lead ${lead.id} lacks a visible conflict risk`).toContain("buying_group_conflict");
      expect(lead.qualificationGate.status, `Lead ${lead.id} bypasses review despite buying-group conflict`).toBe("review_required");
      expect(lead.routingSla, `Lead ${lead.id} is routed despite unresolved buying-group conflict`).toBeNull();
    }
  });

  // Gong's 2026 executive-selling research warns that stakeholder count alone
  // does not prove a contact can mobilize the buying group or sell internally.
  it("keeps internal champion readiness evidence-backed and timestamped", () => {
    const validStatuses = ["validated", "needs_enablement", "absent"];
    const reviewedLeads = demoLeads.filter(lead => lead.championReadiness.evidence.length > 0);

    expect(reviewedLeads.length, "No demo leads show internal champion review").toBe(demoLeads.length);
    for (const lead of reviewedLeads) {
      const readiness = lead.championReadiness;
      expect(validStatuses, `Lead ${lead.id} has invalid champion readiness`).toContain(readiness.status);
      expect(
        readiness.evidence.every(item => item.trim().length >= 30),
        `Lead ${lead.id} has weak champion-readiness evidence`
      ).toBe(true);
      expect(Number.isNaN(Date.parse(readiness.assessedAt)), `Lead ${lead.id} has invalid champion assessment time`).toBe(false);

      if (readiness.status === "validated") {
        expect(readiness.contactRole, `Lead ${lead.id} has a validated champion without a role`).not.toBeNull();
        expect(readiness.evidence.length, `Lead ${lead.id} lacks corroborating champion evidence`).toBeGreaterThanOrEqual(2);
        expect(readiness.internalCaseSharedAt, `Lead ${lead.id} has no proof the champion shared the internal case`).not.toBeNull();
      }
    }
  });

  it("requires a validated internal champion before active hot routing", () => {
    const activeHotLeads = demoLeads.filter(
      lead => lead.aiScore >= 85 && lead.status !== "won" && lead.status !== "lost"
    );

    expect(activeHotLeads.length, "No active hot leads found for champion coverage").toBeGreaterThanOrEqual(1);
    for (const lead of activeHotLeads) {
      const readiness = lead.championReadiness;
      expect(readiness.status, `Lead ${lead.id} is hot without a validated champion`).toBe("validated");
      expect(readiness.internalCaseSharedAt, `Lead ${lead.id} is hot without internal-case sharing evidence`).not.toBeNull();
      expect(
        Date.parse(readiness.assessedAt),
        `Lead ${lead.id} was scored hot before champion validation`
      ).toBeLessThanOrEqual(Date.parse(lead.aiScoreLastUpdatedAt));
      expect(
        Date.parse(readiness.internalCaseSharedAt ?? ""),
        `Lead ${lead.id} was scored hot before the champion shared the internal case`
      ).toBeLessThanOrEqual(Date.parse(lead.aiScoreLastUpdatedAt));
    }
  });

  it("keeps absent or unenabled champions out of active routing", () => {
    const unreadyActiveLeads = demoLeads.filter(
      lead =>
        lead.status !== "won" &&
        lead.status !== "lost" &&
        lead.championReadiness.status !== "validated"
    );

    expect(unreadyActiveLeads.length, "No active demo lead shows champion readiness risk").toBeGreaterThanOrEqual(1);
    for (const lead of unreadyActiveLeads) {
      expect(
        lead.qualificationGate.status,
        `Lead ${lead.id} is eligible despite unresolved champion readiness`
      ).not.toBe("eligible");
      expect(lead.routingSla, `Lead ${lead.id} is routed without a ready internal champion`).toBeNull();
    }
  });

  // Salesforce highlights lengthy cycles, expansive buying committees, and competing
  // priorities as common deal risks; a shared action plan makes the next commitment explicit.
  it("gives every active proposal a mutual action plan", () => {
    const activeProposals = demoLeads.filter(lead => lead.status === "proposal");

    expect(activeProposals.length, "No active proposals demonstrate action-plan coverage").toBeGreaterThanOrEqual(1);
    for (const lead of activeProposals) {
      expect(lead.mutualActionPlan, `Proposal ${lead.id} has no mutual action plan`).not.toBeNull();
    }
  });

  it("keeps mutual action-plan milestones buyer-visible and timestamped", () => {
    const plannedLeads = demoLeads.filter(lead => lead.mutualActionPlan !== null);
    const validStatuses = ["on_track", "at_risk", "blocked"];
    const validOwners = ["buyer", "seller", "shared"];

    expect(plannedLeads.length, "No demo leads show a mutual action plan").toBeGreaterThanOrEqual(2);
    for (const lead of plannedLeads) {
      const plan = lead.mutualActionPlan;
      expect(plan).not.toBeNull();
      if (!plan) continue;

      expect(validStatuses).toContain(plan.status);
      expect(validOwners).toContain(plan.milestoneOwner);
      expect(plan.nextMilestone.trim().length, `Lead ${lead.id} has a weak next milestone`).toBeGreaterThanOrEqual(30);
      expect(Number.isNaN(Date.parse(plan.dueAt)), `Lead ${lead.id} has an invalid milestone due date`).toBe(false);
      expect(Number.isNaN(Date.parse(plan.updatedAt)), `Lead ${lead.id} has an invalid plan update time`).toBe(false);
      expect(Date.parse(plan.updatedAt), `Lead ${lead.id} score predates its action-plan update`).toBeLessThanOrEqual(
        Date.parse(lead.aiScoreLastUpdatedAt)
      );
    }
  });

  it("surfaces blockers on at-risk action plans instead of showing false momentum", () => {
    const atRiskPlans = demoLeads.filter(lead => lead.mutualActionPlan?.status === "at_risk");

    expect(atRiskPlans.length, "No demo lead shows an at-risk action plan").toBeGreaterThanOrEqual(1);
    for (const lead of atRiskPlans) {
      const plan = lead.mutualActionPlan;
      expect(plan).not.toBeNull();
      if (!plan) continue;

      expect(plan.blockers.length, `Lead ${lead.id} is at risk without a named blocker`).toBeGreaterThanOrEqual(1);
      expect(plan.blockers.every(blocker => blocker.trim().length >= 25)).toBe(true);
      expect(plan.milestoneOwner, `Lead ${lead.id} uses a seller-only step as mutual progress`).not.toBe("seller");
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

  // Vanity-metric guard: automated scanners and bot-like page views should not
  // get routed as hot leads just because engagement counters are high.
  it("filters scanner-like inbound engagement noise before routing leads", () => {
    const scannerNoiseLeads = demoLeads.filter(l => l.aiRiskFlags.includes("bot_engagement_noise"));

    expect(
      scannerNoiseLeads.length,
      "No demo leads show bot/scanner engagement filtering for vanity metrics"
    ).toBeGreaterThanOrEqual(1);

    for (const lead of scannerNoiseLeads) {
      const positiveEngagementWeight = lead.aiScoreFactors
        .filter(f => f.category === "engagement" && f.impact === "positive")
        .reduce((sum, f) => sum + f.weight, 0);
      const negativeEngagementWeight = lead.aiScoreFactors
        .filter(f => f.category === "engagement" && f.impact === "negative")
        .reduce((sum, f) => sum + f.weight, 0);

      expect(lead.aiScore, `Lead ${lead.id} has scanner noise but is still scored hot`).toBeLessThan(60);
      expect(lead.aiScoreConfidence, `Lead ${lead.id} should be low confidence until a buyer is verified`).toBe("low");
      expect(
        negativeEngagementWeight,
        `Lead ${lead.id} should down-rank bot/scanner engagement noise more than it rewards page views`
      ).toBeGreaterThan(positiveEngagementWeight);
      expect(
        lead.aiScoreFactors.some(f => f.category === "intent" && f.impact === "negative"),
        `Lead ${lead.id} should show missing buyer intent before rep routing`
      ).toBe(true);
    }
  });


  // ICP-fit guard: current CRM guidance treats fit as a gate rather than a
  // small bonus that engagement can overwhelm.
  it("keeps ICP assessments evidence-backed and timestamped", () => {
    const validStatuses = ["strong", "partial", "out_of_profile"];

    for (const lead of demoLeads) {
      expect(validStatuses, `Lead ${lead.id} has invalid ICP fit status`).toContain(lead.icpFitAssessment.status);
      expect(
        lead.icpFitAssessment.evidence.length,
        `Lead ${lead.id} has no evidence behind its ICP assessment`
      ).toBeGreaterThanOrEqual(2);
      expect(
        lead.icpFitAssessment.evidence.every(item => item.trim().length >= 15),
        `Lead ${lead.id} has weak ICP evidence`
      ).toBe(true);
      expect(
        Number.isNaN(Date.parse(lead.icpFitAssessment.assessedAt)),
        `Lead ${lead.id} has an invalid ICP assessment timestamp`
      ).toBe(false);
    }
  });

  it("requires strong ICP fit before active leads enter hot routing", () => {
    const activeHotLeads = demoLeads.filter(
      lead => lead.aiScore >= 85 && lead.status !== "won" && lead.status !== "lost"
    );

    expect(activeHotLeads.length).toBeGreaterThanOrEqual(1);
    for (const lead of activeHotLeads) {
      expect(
        lead.icpFitAssessment.status,
        `Lead ${lead.id} is routed hot without strong ICP fit`
      ).toBe("strong");
    }
  });

  it("caps out-of-profile leads below sales-ready scoring", () => {
    const outOfProfileLeads = demoLeads.filter(
      lead => lead.icpFitAssessment.status === "out_of_profile"
    );

    expect(outOfProfileLeads.length, "No demo lead demonstrates the ICP gate").toBeGreaterThanOrEqual(1);
    for (const lead of outOfProfileLeads) {
      expect(lead.aiScore, `Lead ${lead.id} bypasses the ICP gate`).toBeLessThan(60);
      expect(
        lead.aiScoreFactors.some(factor => factor.category === "firmographic" && factor.impact === "negative"),
        `Lead ${lead.id} lacks a negative firmographic explanation for its ICP gate`
      ).toBe(true);
    }
  });


  // Negative-score math should not stand in for an explicit qualification state.
  // Hard disqualifiers need a visible, reasoned gate so they never reach a rep queue.
  it("keeps qualification gates explicit, explained, and timestamped", () => {
    const validStatuses = ["eligible", "review_required", "disqualified"];

    for (const lead of demoLeads) {
      expect(
        validStatuses,
        `Lead ${lead.id} has invalid qualification status ${lead.qualificationGate.status}`
      ).toContain(lead.qualificationGate.status);
      expect(
        lead.qualificationGate.reason.trim().length,
        `Lead ${lead.id} has no meaningful qualification reason`
      ).toBeGreaterThanOrEqual(30);
      expect(
        Number.isNaN(Date.parse(lead.qualificationGate.evaluatedAt)),
        `Lead ${lead.id} has an invalid qualification timestamp`
      ).toBe(false);
    }
  });

  it("keeps hard-disqualified records out of sales routing", () => {
    const disqualifiedLeads = demoLeads.filter(
      lead => lead.qualificationGate.status === "disqualified"
    );

    expect(
      disqualifiedLeads.length,
      "No demo leads show an explicit hard-disqualification gate"
    ).toBeGreaterThanOrEqual(1);

    for (const lead of disqualifiedLeads) {
      expect(lead.aiScore, `Lead ${lead.id} is disqualified but still scores sales-ready`).toBeLessThan(70);
      expect(lead.routingSla, `Lead ${lead.id} is disqualified but still has a routing SLA`).toBeNull();
      expect(lead.nextFollowUpId, `Lead ${lead.id} is disqualified but still has a pending follow-up`).toBeNull();
    }
  });

  it("requires active hot leads to pass the qualification gate before routing", () => {
    const activeHotLeads = demoLeads.filter(
      lead => lead.aiScore >= 85 && lead.status !== "won" && lead.status !== "lost"
    );

    expect(activeHotLeads.length).toBeGreaterThanOrEqual(1);
    for (const lead of activeHotLeads) {
      expect(
        lead.qualificationGate.status,
        `Lead ${lead.id} is routed hot without passing qualification`
      ).toBe("eligible");
    }
  });

});
