"use client";

/**
 * Case state with local persistence.
 *
 * Deliberately behind a narrow interface. Stage 1 replaces the storage
 * backend with Postgres and the sync outbox; the UI should not need to
 * change, because it only ever talks to the hook below.
 *
 * Nothing here holds an identifier. A case is addressed by a reference the
 * clinician assigns — see docs/operating-model.md.
 */

import { useCallback, useEffect, useState } from "react";
import type { AssessmentStatus } from "@/domain/status";
import type { AssessmentMode, SpaceType } from "@/domain/types";
import type { FamilyAnswer } from "@/domain/family";
import { EMPTY_CONTACT, type FamilyContact } from "@/domain/family-report";
import {
  EMPTY_INTAKE,
  EMPTY_SIGNOFF,
  emptyPlanItem,
  type FindingDetail,
  type Intake,
  type PlanItem,
  type Signoff,
} from "@/domain/case";

const STORAGE_KEY = "myintel.case.v3";

/**
 * Contact details live under their own key, deliberately.
 *
 * They are the one piece of identifying data the product touches, and the
 * case payload is what Stage 1 will sync to a server. Keeping them in a
 * separate record means a name and email are structurally absent from
 * anything a clinical case carries, rather than absent by convention.
 */
const CONTACT_KEY = "myintel.family.contact.v1";

/** Which experience the user is in. Chosen on entry, changeable at any time. */
export type Audience = "unchosen" | "clinician" | "family";

export interface Space {
  readonly id: string;
  readonly type: SpaceType;
  readonly label: string;
}

export interface Response {
  readonly status: AssessmentStatus;
  readonly reason?: string;
}

export interface CaseState {
  audience: Audience;
  /** Clinician-only: whether MyIntel product content may appear. */
  mode: AssessmentMode;
  reference: string;
  intake: Intake;
  spaces: Space[];
  /** spaceId -> item code -> response. Clinician judgement only. */
  responses: Record<string, Record<string, Response>>;
  /**
   * familyKey -> answer. Kept strictly separate from `responses`: a family
   * answer is reported evidence, never a clinical rating.
   */
  familyAnswers: Record<string, FamilyAnswer>;
  /**
   * The only place in the whole model that holds a name or an email, and it
   * is the family's own, entered by them, on their own device. It is never
   * sent anywhere by this app — sharing hands the text to their mail client.
   * It must never be copied into a clinical case.
   */
  familyContact: FamilyContact;
  /** findingKey -> clinical detail */
  findings: Record<string, FindingDetail>;
  plan: PlanItem[];
  signoff: Signoff;
  updatedAt: string | null;
}

export const EMPTY_CASE: CaseState = {
  audience: "unchosen",
  mode: "standard_ot",
  reference: "",
  intake: EMPTY_INTAKE,
  spaces: [],
  responses: {},
  familyAnswers: {},
  familyContact: EMPTY_CONTACT,
  findings: {},
  plan: [],
  signoff: EMPTY_SIGNOFF,
  updatedAt: null,
};

/**
 * Rejects references that look derived from someone's identity, e.g.
 * initials plus a birth year. Guard for the de-identified operating model.
 */
export function referenceLooksIdentifying(reference: string): boolean {
  const trimmed = reference.trim();
  if (!trimmed) return false;
  return /\b[A-Za-z]{2,3}[\s._-]?(18|19|20)\d{2}\b/.test(trimmed);
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadContact(): FamilyContact {
  if (typeof window === "undefined") return EMPTY_CONTACT;
  try {
    const raw = window.localStorage.getItem(CONTACT_KEY);
    if (!raw) return EMPTY_CONTACT;
    return { ...EMPTY_CONTACT, ...(JSON.parse(raw) as Partial<FamilyContact>) };
  } catch {
    return EMPTY_CONTACT;
  }
}

function load(): CaseState {
  if (typeof window === "undefined") return EMPTY_CASE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CASE;
    const p = JSON.parse(raw) as Partial<CaseState>;
    return {
      audience: p.audience ?? "unchosen",
      mode: p.mode ?? "standard_ot",
      reference: p.reference ?? "",
      intake: { ...EMPTY_INTAKE, ...(p.intake ?? {}) },
      spaces: Array.isArray(p.spaces) ? p.spaces : [],
      responses: p.responses ?? {},
      familyAnswers: p.familyAnswers ?? {},
      familyContact: loadContact(),
      findings: p.findings ?? {},
      plan: Array.isArray(p.plan) ? p.plan : [],
      signoff: { ...EMPTY_SIGNOFF, ...(p.signoff ?? {}) },
      updatedAt: p.updatedAt ?? null,
    };
  } catch {
    return EMPTY_CASE;
  }
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useCase() {
  const [state, setState] = useState<CaseState>(EMPTY_CASE);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveState("saving");
    const t = setTimeout(() => {
      try {
        // familyContact is split out here, not merely omitted from a type.
        // The case record is what syncs; it must not carry a name or email.
        const { familyContact, ...caseOnly } = state;
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...caseOnly, updatedAt: new Date().toISOString() }),
        );
        window.localStorage.setItem(CONTACT_KEY, JSON.stringify(familyContact));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state, hydrated]);

  const setReference = useCallback((reference: string) => {
    setState((s) => ({ ...s, reference }));
  }, []);

  /**
   * Entering the clinician workspace discards any contact details the family
   * entered. A shared tablet is a realistic scenario, and a clinician's case
   * must never end up holding a household's name and email.
   */
  const setAudience = useCallback((audience: Audience) => {
    setState((s) => {
      if (audience !== "clinician") return { ...s, audience };
      try {
        window.localStorage.removeItem(CONTACT_KEY);
      } catch {
        /* storage unavailable; in-memory clear still applied */
      }
      return { ...s, audience, familyContact: EMPTY_CONTACT };
    });
  }, []);

  const setMode = useCallback((mode: AssessmentMode) => {
    setState((s) => ({ ...s, mode }));
  }, []);

  /** Family answers are stored apart from clinician responses, by design. */
  const setFamilyAnswer = useCallback((key: string, answer: FamilyAnswer) => {
    setState((s) => ({ ...s, familyAnswers: { ...s.familyAnswers, [key]: answer } }));
  }, []);

  const patchFamilyContact = useCallback((patch: Partial<FamilyContact>) => {
    setState((s) => ({ ...s, familyContact: { ...s.familyContact, ...patch } }));
  }, []);

  const patchIntake = useCallback((patch: Partial<Intake>) => {
    setState((s) => ({ ...s, intake: { ...s.intake, ...patch } }));
  }, []);

  const addSpace = useCallback((type: SpaceType, label: string) => {
    const space: Space = { id: newId("sp"), type, label };
    setState((s) => ({ ...s, spaces: [...s.spaces, space] }));
    return space.id;
  }, []);

  const renameSpace = useCallback((id: string, label: string) => {
    setState((s) => ({
      ...s,
      spaces: s.spaces.map((sp) => (sp.id === id ? { ...sp, label } : sp)),
    }));
  }, []);

  const removeSpace = useCallback((id: string) => {
    setState((s) => {
      const responses = { ...s.responses };
      delete responses[id];
      const findings = Object.fromEntries(
        Object.entries(s.findings).filter(([k]) => !k.startsWith(`${id}::`)),
      );
      return { ...s, spaces: s.spaces.filter((sp) => sp.id !== id), responses, findings };
    });
  }, []);

  /** Setting the same status again clears it back to unknown. */
  const setStatus = useCallback((spaceId: string, code: string, status: AssessmentStatus) => {
    setState((s) => {
      const forSpace = { ...(s.responses[spaceId] ?? {}) };
      if (forSpace[code]?.status === status) delete forSpace[code];
      else forSpace[code] = { status, reason: forSpace[code]?.reason };
      return { ...s, responses: { ...s.responses, [spaceId]: forSpace } };
    });
  }, []);

  const setReason = useCallback((spaceId: string, code: string, reason: string) => {
    setState((s) => {
      const forSpace = { ...(s.responses[spaceId] ?? {}) };
      const existing = forSpace[code];
      if (!existing) return s;
      forSpace[code] = { ...existing, reason };
      return { ...s, responses: { ...s.responses, [spaceId]: forSpace } };
    });
  }, []);

  const patchFinding = useCallback((key: string, patch: Partial<FindingDetail>) => {
    setState((s) => ({
      ...s,
      findings: { ...s.findings, [key]: { ...(s.findings[key] ?? {}), ...patch } },
    }));
  }, []);

  const addPlanItem = useCallback((title = "") => {
    const item = emptyPlanItem(newId("rec"), title);
    setState((s) => ({ ...s, plan: [...s.plan, item] }));
    return item.id;
  }, []);

  const patchPlanItem = useCallback((id: string, patch: Partial<PlanItem>) => {
    setState((s) => ({
      ...s,
      plan: s.plan.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const removePlanItem = useCallback((id: string) => {
    setState((s) => ({ ...s, plan: s.plan.filter((p) => p.id !== id) }));
  }, []);

  const patchSignoff = useCallback((patch: Partial<Signoff>) => {
    setState((s) => ({ ...s, signoff: { ...s.signoff, ...patch } }));
  }, []);

  const sign = useCallback(() => {
    setState((s) => ({ ...s, signoff: { ...s.signoff, signedAt: new Date().toISOString() } }));
  }, []);

  const unsign = useCallback(() => {
    setState((s) => ({ ...s, signoff: { ...s.signoff, signedAt: null } }));
  }, []);

  const reset = useCallback(() => {
    setState(EMPTY_CASE);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(CONTACT_KEY);
    } catch {
      /* storage unavailable; in-memory reset still applied */
    }
  }, []);

  return {
    state,
    hydrated,
    saveState,
    setReference,
    setAudience,
    setMode,
    setFamilyAnswer,
    patchFamilyContact,
    patchIntake,
    addSpace,
    renameSpace,
    removeSpace,
    setStatus,
    setReason,
    patchFinding,
    addPlanItem,
    patchPlanItem,
    removePlanItem,
    patchSignoff,
    sign,
    unsign,
    reset,
  };
}

export type CaseApi = ReturnType<typeof useCase>;

/** Responses for one space as the Map the domain functions expect. */
export function responseMap(
  state: CaseState,
  spaceId: string,
): Map<string, { code: string; status: AssessmentStatus; reason?: string }> {
  const forSpace = state.responses[spaceId] ?? {};
  return new Map(
    Object.entries(forSpace).map(([code, r]) => [code, { code, status: r.status, reason: r.reason }]),
  );
}
