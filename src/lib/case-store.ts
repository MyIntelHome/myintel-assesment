"use client";

/**
 * Case state with local persistence.
 *
 * Deliberately behind a narrow interface. Stage 1 replaces the storage
 * backend with Postgres and the sync outbox; the UI should not need to
 * change, because it only ever talks to the hook below.
 *
 * Case references and free text are entered by users. No automatic
 * de-identification is claimed; see docs/operating-model.md.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createReportVersion, type ReportVersion } from "@/domain/report-version";
import { buildCaseView } from "./selectors";
import { savedCaseSchema } from "./case-validation";
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

/** Legacy contact key, cleared when migrating to the optional sharing flow. */
const CONTACT_KEY = "myintel.family.contact.v1";
const ARCHIVE_KEY = "myintel.cases.v1";

export interface FamilyPosition { phase: "welcome" | "rooms" | "room" | "milestone" | "contact" | "report"; roomIndex: number }

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
  id: string;
  reportVersions: ReportVersion[];
  familyPosition?: FamilyPosition;
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
  id: "",
  reportVersions: [],
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

export function normalise(p: Partial<CaseState>): CaseState {
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Invalid saved case");
  if (!savedCaseSchema.safeParse(p).success) throw new Error("Invalid saved case fields");
  p = Object.fromEntries(Object.entries(p).filter(([,value]) => value !== undefined)) as Partial<CaseState>;
  return { ...EMPTY_CASE, ...p, id: p.id || newId("case"),
    reportVersions: Array.isArray(p.reportVersions) ? p.reportVersions : [],
    intake: {...EMPTY_INTAKE,...p.intake}, signoff:{...EMPTY_SIGNOFF,...p.signoff},
    // Legacy timestamps are not immutable reports. They must be reviewed again.
    ...(p.signoff?.signedAt && !p.reportVersions?.length ? {signoff:{...EMPTY_SIGNOFF,...p.signoff,signedAt:null}} : {}),
    familyContact: EMPTY_CONTACT,
  };
}

export function readArchive(raw: string | null): {activeId?: string; cases: CaseState[]} {
  if (raw === null) return {cases: []};
  const saved = JSON.parse(raw);
  if (!saved || typeof saved !== "object" || !Array.isArray(saved.cases)) throw new Error("Invalid case archive");
  const cases = saved.cases.map(normalise) as CaseState[];
  if (new Set(cases.map(c => c.id)).size !== cases.length) throw new Error("Duplicate case IDs");
  if (cases.length && !cases.some(c => c.id === saved.activeId)) throw new Error("Active case is missing");
  return {activeId: saved.activeId, cases};
}

function load(): CaseState {
  if (typeof window === "undefined") return EMPTY_CASE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalise({});
    const p = JSON.parse(raw) as Partial<CaseState>;
    return normalise(p);
  } catch { throw new Error("The saved case could not be read."); }
}

export function preserveCase(cases: readonly CaseState[], state: CaseState, updatedAt: string) {
  const {familyContact,...caseOnly} = state;
  void familyContact;
  return [...cases.filter(c=>c.id!==state.id),{...caseOnly,familyContact:EMPTY_CONTACT,updatedAt}];
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useCase() {
  const [state, setState] = useState<CaseState>(EMPTY_CASE);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [cases, setCases] = useState<CaseState[]>([]);
  const [storageConflict, setStorageConflict] = useState(false);
  const [storageProblem,setStorageProblem] = useState("");
  const archiveRef = useRef<CaseState[]>([]);
  const revisionRef = useRef<string | null>(null);

  const updateDraft = useCallback((change: (s: CaseState) => CaseState) => {
    setState(s => s.signoff.signedAt ? s : change(s));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ARCHIVE_KEY);
      revisionRef.current = raw;
      const saved = readArchive(raw);
      archiveRef.current = saved.cases;
      setCases(archiveRef.current);
      setState(archiveRef.current.find(c=>c.id===saved.activeId) ?? load());
      // Contact details are no longer required or retained by this flow.
      window.localStorage.removeItem(CONTACT_KEY);
    } catch {
      setSaveState("error");setStorageConflict(true);
      setStorageProblem("Saved cases could not be read, or storage is unavailable. Existing records have not been overwritten. Reopen the original browser profile or contact support before clearing browser data.");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if ((event.key === ARCHIVE_KEY || event.key === null) && event.newValue !== revisionRef.current) {
        setStorageConflict(true); setSaveState("error");
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);

  useEffect(() => {
    if (!hydrated || storageConflict) return;
    setSaveState("saving");
    let pending = true;
    const persist = () => {
      if (!pending) return;
      pending = false;
      try {
        // Remove legacy contact fields. No cloud synchronization is implemented.
        const { familyContact, ...caseOnly } = state;
        void familyContact;
        if (window.localStorage.getItem(ARCHIVE_KEY) !== revisionRef.current) {
          setStorageConflict(true); setSaveState("error"); return;
        }
        const list = preserveCase(archiveRef.current,state,new Date().toISOString());
        const archive = JSON.stringify({activeId:state.id,cases:list.map(({familyContact,...rest})=>{void familyContact;return rest;})});
        window.localStorage.setItem(ARCHIVE_KEY, archive);
        revisionRef.current = archive;
        archiveRef.current = list;
        setCases(list);
        void caseOnly;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    };
    const t = setTimeout(persist, 400);
    // Flush the latest committed edit when leaving instead of losing the debounce window.
    window.addEventListener("pagehide", persist);
    return () => { clearTimeout(t); window.removeEventListener("pagehide", persist); };
  }, [state, hydrated, storageConflict]);

  const setReference = useCallback((reference: string) => {
    updateDraft((s) => ({ ...s, reference }));
  }, [updateDraft]);

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
    updateDraft((s) => ({ ...s, mode }));
  }, [updateDraft]);

  /** Family answers are stored apart from clinician responses, by design. */
  const setFamilyAnswer = useCallback((key: string, answer: FamilyAnswer) => {
    setState((s) => ({ ...s, familyAnswers: { ...s.familyAnswers, [key]: answer } }));
  }, []);

  const patchFamilyContact = useCallback((patch: Partial<FamilyContact>) => {
    setState((s) => ({ ...s, familyContact: { ...s.familyContact, ...patch } }));
  }, []);

  const patchIntake = useCallback((patch: Partial<Intake>) => {
    updateDraft((s) => ({ ...s, intake: { ...s.intake, ...patch } }));
  }, [updateDraft]);

  const addSpace = useCallback((type: SpaceType, label: string) => {
    const space: Space = { id: newId("sp"), type, label };
    updateDraft((s) => ({ ...s, spaces: [...s.spaces, space] }));
    return space.id;
  }, [updateDraft]);

  const renameSpace = useCallback((id: string, label: string) => {
    updateDraft((s) => ({
      ...s,
      spaces: s.spaces.map((sp) => (sp.id === id ? { ...sp, label } : sp)),
    }));
  }, [updateDraft]);

  const removeSpace = useCallback((id: string) => {
    updateDraft((s) => {
      const responses = { ...s.responses };
      delete responses[id];
      const findings = Object.fromEntries(
        Object.entries(s.findings).filter(([k]) => !k.startsWith(`${id}::`)),
      );
      return { ...s, spaces: s.spaces.filter((sp) => sp.id !== id), responses, findings };
    });
  }, [updateDraft]);

  /** Setting the same status again clears it back to unknown. */
  const setStatus = useCallback((spaceId: string, code: string, status: AssessmentStatus) => {
    updateDraft((s) => {
      const forSpace = { ...(s.responses[spaceId] ?? {}) };
      if (forSpace[code]?.status === status) delete forSpace[code];
      else forSpace[code] = { status, reason: forSpace[code]?.reason };
      return { ...s, responses: { ...s.responses, [spaceId]: forSpace } };
    });
  }, [updateDraft]);

  const setReason = useCallback((spaceId: string, code: string, reason: string) => {
    updateDraft((s) => {
      const forSpace = { ...(s.responses[spaceId] ?? {}) };
      const existing = forSpace[code];
      if (!existing) return s;
      forSpace[code] = { ...existing, reason };
      return { ...s, responses: { ...s.responses, [spaceId]: forSpace } };
    });
  }, [updateDraft]);

  const patchFinding = useCallback((key: string, patch: Partial<FindingDetail>) => {
    updateDraft((s) => ({
      ...s,
      findings: { ...s.findings, [key]: { ...(s.findings[key] ?? {}), ...patch } },
    }));
  }, [updateDraft]);

  const addPlanItem = useCallback((title = "", details: Partial<PlanItem> = {}) => {
    const item = {...emptyPlanItem(newId("rec"), title),...details};
    updateDraft((s) => ({ ...s, plan: [...s.plan, item] }));
    return item.id;
  }, [updateDraft]);

  const patchPlanItem = useCallback((id: string, patch: Partial<PlanItem>) => {
    updateDraft((s) => ({
      ...s,
      plan: s.plan.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, [updateDraft]);

  const removePlanItem = useCallback((id: string) => {
    updateDraft((s) => ({ ...s, plan: s.plan.filter((p) => p.id !== id) }));
  }, [updateDraft]);

  const patchSignoff = useCallback((patch: Partial<Signoff>) => {
    updateDraft((s) => ({ ...s, signoff: { ...s.signoff, ...patch } }));
  }, [updateDraft]);

  const sign = useCallback(() => {
    setState((s) => {
      if (s.signoff.signedAt) return s;
      const version = createReportVersion(s, buildCaseView(s), new Date().toISOString(), newId("report"));
      return {...s, signoff:version.caseData.signoff,reportVersions:[...s.reportVersions,version]};
    });
  }, []);

  const unsign = useCallback(() => {
    setState((s) => ({ ...s, signoff: { ...s.signoff, signedAt: null } }));
  }, []);

  const reset = useCallback((audience: Audience = "unchosen") => {
    if (saveState !== "saved" || storageConflict) return;
    setState(normalise({audience}));
  }, [saveState,storageConflict]);

  const openCase = useCallback((id: string) => {
    if (saveState !== "saved" || storageConflict) return;
    const found = archiveRef.current.find(c=>c.id===id);
    if (found) setState(normalise(found));
  }, [saveState,storageConflict]);
  const setFamilyPosition = useCallback((familyPosition: FamilyPosition) => {
    setState(s=>({...s,familyPosition}));
  }, []);

  return {
    state,
    hydrated,
    saveState,
    cases,
    storageConflict,
    storageProblem,
    openCase,
    setFamilyPosition,
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
