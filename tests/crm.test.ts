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

  // A seller-authored checklist is not mutual progress. Current MAP guidance
  // recommends co-creating the plan and recording the buyer's commitment.
  it("pairs buyer confirmation identity and time on mutual action plans", () => {
    const plannedLeads = demoLeads.filter(lead => lead.mutualActionPlan !== null);
    const buyerConfirmedPlans = plannedLeads.filter(lead => lead.mutualActionPlan?.buyerConfirmedAt !== null);
    const pendingConfirmationPlans = plannedLeads.filter(lead => lead.mutualActionPlan?.buyerConfirmedAt === null);

    expect(buyerConfirmedPlans.length, "No action plan records buyer confirmation").toBeGreaterThanOrEqual(1);
    expect(pendingConfirmationPlans.length, "No action plan demonstrates pending buyer confirmation").toBeGreaterThanOrEqual(1);

    for (const lead of plannedLeads) {
      const plan = lead.mutualActionPlan;
      expect(plan).not.toBeNull();
      if (!plan) continue;

      expect(Boolean(plan.buyerConfirmedBy), `Lead ${lead.id} has mismatched buyer confirmation fields`).toBe(
        Boolean(plan.buyerConfirmedAt)
      );
      if (plan.buyerConfirmedAt) {
        expect(Number.isNaN(Date.parse(plan.buyerConfirmedAt)), `Lead ${lead.id} has an invalid buyer confirmation time`).toBe(false);
        expect(plan.buyerConfirmedBy?.trim().length ?? 0, `Lead ${lead.id} lacks a named buyer confirmer`).toBeGreaterThanOrEqual(10);
        expect(Date.parse(plan.buyerConfirmedAt), `Lead ${lead.id} was confirmed after its plan update`).toBeLessThanOrEqual(
          Date.parse(plan.updatedAt)
        );
      }
    }
  });

  it("requires buyer confirmation before an active proposal is shown on track", () => {
    const onTrackProposals = demoLeads.filter(
      lead => lead.status === "proposal" && lead.mutualActionPlan?.status === "on_track"
    );

    expect(onTrackProposals.length, "No on-track proposal demonstrates buyer confirmation").toBeGreaterThanOrEqual(1);
    for (const lead of onTrackProposals) {
      expect(lead.mutualActionPlan?.buyerConfirmedAt, `Lead ${lead.id} is on track without buyer confirmation`).not.toBeNull();
      expect(lead.mutualActionPlan?.buyerConfirmedBy, `Lead ${lead.id} is on track without a named buyer`).not.toBeNull();
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

  // Pipeline-health guard: 2026 sales pipeline guidance ranks slippage
  // (deals pushing past their agreed milestone dates) as a leading warning
  // sign, so action plans should record the original due date instead of
  // silently resetting it when a milestone moves.
  it("records milestone slippage instead of silently resetting due dates", () => {
    const plannedLeads = demoLeads.filter(lead => lead.mutualActionPlan !== null);

    expect(plannedLeads.length, "No demo leads show a mutual action plan").toBeGreaterThanOrEqual(2);

    for (const lead of plannedLeads) {
      const plan = lead.mutualActionPlan;
      expect(plan).not.toBeNull();
      if (!plan) continue;

      expect(Number.isInteger(plan.slippageCount), `Lead ${lead.id} has a non-integer slippage count`).toBe(true);
      expect(plan.slippageCount, `Lead ${lead.id} has a negative slippage count`).toBeGreaterThanOrEqual(0);

      if (plan.slippageCount === 0) {
        expect(plan.slippedFromAt, `Lead ${lead.id} has a stale slip origin with zero slips`).toBeNull();
      } else {
        expect(plan.slippedFromAt, `Lead ${lead.id} has slips without an original due date`).not.toBeNull();
        expect(Number.isNaN(Date.parse(plan.slippedFromAt ?? "")), `Lead ${lead.id} has an invalid original due date`).toBe(false);
        expect(
          Date.parse(plan.slippedFromAt ?? ""),
          `Lead ${lead.id} original due date is not before the current due date`
        ).toBeLessThan(Date.parse(plan.dueAt));
      }
    }
  });

  it("keeps slipped milestones from reading as clean momentum", () => {
    const slippedPlans = demoLeads.filter(lead => (lead.mutualActionPlan?.slippageCount ?? 0) > 0);

    expect(slippedPlans.length, "No demo lead shows a slipped milestone").toBeGreaterThanOrEqual(1);

    for (const lead of slippedPlans) {
      const plan = lead.mutualActionPlan;
      expect(plan).not.toBeNull();
      if (!plan) continue;

      expect(plan.blockers.length, `Lead ${lead.id} slipped without naming the cause`).toBeGreaterThanOrEqual(1);
      expect(plan.blockers.every(blocker => blocker.trim().length >= 25), `Lead ${lead.id} has a weak slip blocker`).toBe(true);

      if (plan.status === "on_track") {
        expect(plan.buyerConfirmedAt, `Lead ${lead.id} slipped back on track without buyer re-confirmation`).not.toBeNull();
        expect(
          Date.parse(plan.buyerConfirmedAt ?? ""),
          `Lead ${lead.id} was re-confirmed before the slip`
        ).toBeGreaterThan(Date.parse(plan.slippedFromAt ?? ""));
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

  // Operational activation guard: a stale score should remain attached to
  // an owned, unfinished revalidation action instead of becoming a snapshot.
  it('keeps stale active scores attached to an unfinished revalidation action', () => {
    const staleActiveLeads = demoLeads.filter(
      lead => lead.status !== 'won' && lead.status !== 'lost' && lead.scoreStalenessRisk !== 'fresh'
    );

    expect(staleActiveLeads.length, 'No active lead demonstrates stale-score activation coverage').toBeGreaterThanOrEqual(1);

    for (const lead of staleActiveLeads) {
      expect(lead.nextFollowUpId, `Lead ${lead.id} has stale scoring risk but no owned revalidation action`).not.toBeNull();
      const followUp = lead.nextFollowUpId
        ? demoFollowUps.find(candidate => candidate.id === lead.nextFollowUpId)
        : undefined;

      expect(followUp, `Lead ${lead.id} points to a missing revalidation action`).toBeDefined();
      if (!followUp) continue;

      expect(followUp.leadId, `Revalidation action ${followUp.id} targets the wrong lead`).toBe(lead.id);
      expect(followUp.completed, `Lead ${lead.id} has stale scoring risk but its revalidation action is complete`).toBe(false);
      expect(Number.isNaN(Date.parse(followUp.scheduledFor)), `Revalidation action ${followUp.id} has an invalid schedule`).toBe(false);
      expect(
        Date.parse(followUp.scheduledFor),
        `Lead ${lead.id} revalidation action predates the score refresh it is meant to revisit`
      ).toBeGreaterThanOrEqual(Date.parse(lead.aiScoreLastUpdatedAt));
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

// Forecast discipline: 2026 forecasting guidance warns that reps mark deals
// "commit" on intuition instead of buyer-verified evidence, so forecast
// categories need explicit entry criteria rather than a hot score alone.
describe("Forecast call discipline", () => {
  const validCategories = ["commit", "best_case", "pipeline"];

  it("keeps every forecast call typed, explained, and no newer than the score it relies on", () => {
    for (const lead of demoLeads) {
      const call = lead.forecastCall;
      if (!call) continue;
      expect(validCategories, `Lead ${lead.id} has an invalid forecast category`).toContain(call.category);
      expect(call.reason.trim().length, `Lead ${lead.id} has a weak forecast reason`).toBeGreaterThanOrEqual(30);
      expect(Number.isNaN(Date.parse(call.assessedAt)), `Lead ${lead.id} has an invalid forecast timestamp`).toBe(false);
      expect(Date.parse(call.assessedAt), `Lead ${lead.id} forecast postdates its score refresh`).toBeLessThanOrEqual(
        Date.parse(lead.aiScoreLastUpdatedAt)
      );
    }
  });

  it("covers commit, best-case, and pipeline calls so the suite is not a single happy path", () => {
    const categories = new Set(
      demoLeads.filter(lead => lead.forecastCall !== null).map(lead => lead.forecastCall?.category)
    );
    expect(categories.has("commit"), "No demo lead shows a commit forecast call").toBe(true);
    expect(categories.has("best_case"), "No demo lead shows a best-case forecast call").toBe(true);
    expect(categories.has("pipeline"), "No demo lead shows a pipeline forecast call").toBe(true);
  });

  it("requires buyer-verified on-track evidence before a commit call", () => {
    const commitLeads = demoLeads.filter(lead => lead.forecastCall?.category === "commit");
    expect(commitLeads.length, "No demo lead shows a commit forecast call").toBeGreaterThanOrEqual(1);
    for (const lead of commitLeads) {
      const plan = lead.mutualActionPlan;
      expect(plan, `Lead ${lead.id} is committed without a mutual action plan`).not.toBeNull();
      if (!plan) continue;
      expect(plan.status, `Lead ${lead.id} is committed on a plan that is not on track`).toBe("on_track");
      expect(plan.buyerConfirmedAt, `Lead ${lead.id} is committed without buyer confirmation`).not.toBeNull();
      expect(lead.qualificationGate.status, `Lead ${lead.id} is committed without passing qualification`).toBe("eligible");
    }
  });

  it("caps unconfirmed or at-risk plans below commit", () => {
    for (const lead of demoLeads) {
      const call = lead.forecastCall;
      if (!call || call.category === "commit") continue;
      const plan = lead.mutualActionPlan;
      const buyerVerifiedOnTrack = plan !== null && plan.status === "on_track" && plan.buyerConfirmedAt !== null;
      expect(buyerVerifiedOnTrack, `Lead ${lead.id} has buyer-verified on-track evidence but is not committed`).toBe(false);
    }
  });

  it("omits forecast calls on closed and disqualified records", () => {
    for (const lead of demoLeads) {
      const closedOrDisqualified =
        lead.status === "won" || lead.status === "lost" || lead.qualificationGate.status === "disqualified";
      if (closedOrDisqualified) {
        expect(lead.forecastCall, `Lead ${lead.id} is closed or disqualified but still carries a forecast call`).toBeNull();
      }
    }
  });

  // Behavioral engagement signals (website visits, email opens, content downloads) are
  // stronger intent indicators than single points of contact; high-intent leads should
  // show multiple engagement signals to strengthen the score confidence.
  it("active high-intent leads (≥85) have behavioral engagement signals", () => {
    const activeHighIntentLeads = demoLeads.filter(
      lead => lead.aiScore >= 85 && lead.status !== "won" && lead.status !== "lost"
    );

    expect(activeHighIntentLeads.length, "No active high-intent leads found for engagement coverage").toBeGreaterThanOrEqual(1);

    for (const lead of activeHighIntentLeads) {
      expect(
        lead.engagementSignals.length,
        `Lead ${lead.id} is high intent (score ${lead.aiScore}) but has no engagement signals — behavioral intent evidence is missing`
      ).toBeGreaterThan(0);
    }
  });

  it("all leads have engagement signals array defined", () => {
    for (const lead of demoLeads) {
      expect(
        Array.isArray(lead.engagementSignals),
        `Lead ${lead.id} engagementSignals is not an array`
      ).toBe(true);
    }
  });

  it("engagement signals have required fields", () => {
    const validSignalTypes = [
      "website_visit",
      "pricing_page_view",
      "demo_request",
      "doc_download",
      "email_open",
      "email_click",
      "content_engagement",
      "competitor_research",
    ];

    for (const lead of demoLeads) {
      for (const signal of lead.engagementSignals) {
        expect(validSignalTypes, `Lead ${lead.id} has invalid signal type "${signal.type}"`).toContain(signal.type);
        expect(signal.description.trim().length, `Lead ${lead.id} engagement signal lacks description`).toBeGreaterThan(0);
        expect(Number.isNaN(Date.parse(signal.timestamp)), `Lead ${lead.id} has invalid engagement signal timestamp`).toBe(
          false
        );
      }
    }
  });
});


// Engagement signal integrity: dirty CRM data is the top reason AI scoring goes wrong.
// Duplicate engagement traces across unrelated accounts and copy-paste signal blocks
// inflate scores and erode rep trust, so demo signals must stay account-specific.
describe("Engagement signal integrity", () => {
  it("no two leads carry identical engagement signal records", () => {
    const seen = new Set<string>();
    for (const lead of demoLeads) {
      for (const signal of lead.engagementSignals) {
        const key = `${signal.type}|${signal.description}|${signal.timestamp}`;
        expect(
          seen.has(key),
          `Duplicate engagement signal record "${key}" appears on more than one lead`
        ).toBe(false);
        seen.add(key);
      }
    }
  });

  it("no two leads share an identical engagement fingerprint", () => {
    const fingerprints = new Map<string, string>();
    for (const lead of demoLeads) {
      if (lead.engagementSignals.length === 0) {
        continue;
      }
      const fingerprint = lead.engagementSignals.map(s => `${s.type}@${s.timestamp}`).join(";");
      const existing = fingerprints.get(fingerprint);
      expect(
        existing,
        `Lead ${lead.id} shares an identical engagement fingerprint with ${existing}`
      ).toBeUndefined();
      fingerprints.set(fingerprint, lead.id);
    }
  });

  it("every engagement signal predates the score refresh that relies on it", () => {
    for (const lead of demoLeads) {
      const scoreUpdatedAt = Date.parse(lead.aiScoreLastUpdatedAt);
      for (const signal of lead.engagementSignals) {
        const signalAt = Date.parse(signal.timestamp);
        expect(Number.isNaN(signalAt), `Lead ${lead.id} has an unparseable signal timestamp`).toBe(false);
        expect(
          signalAt,
          `Lead ${lead.id} has a signal from after its score refresh — the score cannot cite future signals`
        ).toBeLessThanOrEqual(scoreUpdatedAt);
      }
    }
  });

  it("every engagement signal carries a typed provenance source", () => {
    const validSources = ["first_party", "third_party_intent"];
    for (const lead of demoLeads) {
      for (const signal of lead.engagementSignals) {
        expect(
          validSources,
          `Lead ${lead.id} has an invalid signal provenance "${signal.source}"`
        ).toContain(signal.source);
      }
    }
  });

  // Third-party intent enrichment (G2 category research, competitor review-page
  // traffic) is a real scoring input, but it is unverified until a first-party
  // touch confirms the buyer. Unflagged third-party intent inflates hot queues.
  it("third-party intent stays below hot routing until first-party verification", () => {
    const thirdPartyLeads = demoLeads.filter(lead =>
      lead.engagementSignals.some(signal => signal.source === "third_party_intent")
    );

    expect(
      thirdPartyLeads.length,
      "No demo leads show third-party intent provenance handling"
    ).toBeGreaterThanOrEqual(1);

    for (const lead of thirdPartyLeads) {
      expect(
        lead.aiRiskFlags,
        `Lead ${lead.id} carries third-party intent without the unverified risk flag`
      ).toContain("third_party_intent_unverified");

      const hasFirstPartySignal = lead.engagementSignals.some(signal => signal.source === "first_party");
      if (!hasFirstPartySignal) {
        expect(
          lead.aiScore,
          `Lead ${lead.id} scores ${lead.aiScore} from third-party intent with no first-party verification`
        ).toBeLessThan(85);
      }
    }
  });

  // Signal-level decay prevents an old low-value touch from keeping a lead hot
  // after the overall score has stopped reflecting current buyer intent.
  it('requires signal-level decay windows to match recency state', () => {
    const validRecency = ['fresh', 'aging', 'stale'];
    const dayMs = 24 * 60 * 60 * 1000;
    let staleSignalCount = 0;

    for (const lead of demoLeads) {
      const scoreUpdatedAt = Date.parse(lead.aiScoreLastUpdatedAt);
      for (const signal of lead.engagementSignals) {
        const signalAgeDays = (scoreUpdatedAt - Date.parse(signal.timestamp)) / dayMs;

        expect(validRecency, `Lead ${lead.id} has invalid signal recency`).toContain(signal.recency);
        expect(
          Number.isInteger(signal.decayWindowDays),
          `Lead ${lead.id} has a non-integer signal decay window`
        ).toBe(true);
        expect(signal.decayWindowDays, `Lead ${lead.id} has a non-positive signal decay window`).toBeGreaterThan(0);

        if (signal.recency === 'fresh') {
          expect(signalAgeDays, `Lead ${lead.id} marks an old signal as fresh`).toBeLessThanOrEqual(
            signal.decayWindowDays / 2
          );
        } else if (signal.recency === 'aging') {
          expect(signalAgeDays, `Lead ${lead.id} marks a fresh signal as aging`).toBeGreaterThan(
            signal.decayWindowDays / 2
          );
          expect(signalAgeDays, `Lead ${lead.id} marks an expired signal as aging`).toBeLessThanOrEqual(
            signal.decayWindowDays
          );
        } else {
          staleSignalCount += 1;
          expect(signalAgeDays, `Lead ${lead.id} marks a signal stale before its decay window`).toBeGreaterThan(
            signal.decayWindowDays
          );
        }
      }
    }

    expect(staleSignalCount, 'No demo signal shows hard-expiry coverage').toBeGreaterThanOrEqual(1);
  });

  // Signal-led plays lose value when enrichment arrives after the action window.
  // The working standard is roughly 15 minutes for high-intent signal delivery.
  it('tracks signal ingestion latency before the score refresh', () => {
    const fifteenMinutesMs = 15 * 60 * 1000;
    let delayedSignalCount = 0;

    for (const lead of demoLeads) {
      const scoreUpdatedAt = Date.parse(lead.aiScoreLastUpdatedAt);
      for (const signal of lead.engagementSignals) {
        expect(
          Number.isInteger(signal.ingestionLatencyMinutes),
          `Lead ${lead.id} has a non-integer signal ingestion latency`
        ).toBe(true);
        expect(
          signal.ingestionLatencyMinutes,
          `Lead ${lead.id} has a negative signal ingestion latency`
        ).toBeGreaterThanOrEqual(0);

        const ingestedAt = Date.parse(signal.timestamp) + signal.ingestionLatencyMinutes * 60 * 1000;
        expect(
          ingestedAt,
          `Lead ${lead.id} has a signal that arrived after the score refresh`
        ).toBeLessThanOrEqual(scoreUpdatedAt);
        if (signal.ingestionLatencyMinutes * 60 * 1000 > fifteenMinutesMs) {
          delayedSignalCount += 1;
        }
      }
    }

    expect(delayedSignalCount, 'No demo signal shows ingestion-delay coverage').toBeGreaterThanOrEqual(1);
  });

  it('holds leads with delayed signal ingestion for qualification review', () => {
    const delayedLeads = demoLeads.filter(lead =>
      lead.engagementSignals.some(signal => signal.ingestionLatencyMinutes > 15)
    );

    expect(delayedLeads.length, 'No lead demonstrates delayed signal review').toBeGreaterThanOrEqual(1);
    for (const lead of delayedLeads) {
      expect(lead.aiRiskFlags, `Lead ${lead.id} lacks a signal ingestion delay risk flag`).toContain(
        'signal_ingestion_delay'
      );
      expect(
        lead.qualificationGate.status,
        `Lead ${lead.id} is eligible despite delayed signal ingestion`
      ).toBe('review_required');
    }
  });
});
