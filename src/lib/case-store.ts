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
import type { SpaceType } from "@/domain/types";

const STORAGE_KEY = "myintel.case.v1";

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
  reference: string;
  spaces: Space[];
  /** spaceId -> item code -> response */
  responses: Record<string, Record<string, Response>>;
  updatedAt: string | null;
}

export const EMPTY_CASE: CaseState = {
  reference: "",
  spaces: [],
  responses: {},
  updatedAt: null,
};

/**
 * Rejects references that look derived from someone's identity, e.g.
 * initials plus a birth year. Guard for the de-identified operating model.
 */
export function referenceLooksIdentifying(reference: string): boolean {
  const trimmed = reference.trim();
  if (!trimmed) return false;
  // Two or three letters next to a 4-digit year in the plausible-birth range.
  return /\b[A-Za-z]{2,3}[\s._-]?(18|19|20)\d{2}\b/.test(trimmed);
}

function newId(): string {
  return `sp_${Math.random().toString(36).slice(2, 10)}`;
}

function load(): CaseState {
  if (typeof window === "undefined") return EMPTY_CASE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CASE;
    const parsed = JSON.parse(raw) as CaseState;
    return {
      reference: parsed.reference ?? "",
      spaces: Array.isArray(parsed.spaces) ? parsed.spaces : [],
      responses: parsed.responses ?? {},
      updatedAt: parsed.updatedAt ?? null,
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

  // Restore on mount. Nothing renders from storage during SSR.
  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  // Persist on change. Debounced so typing does not thrash storage.
  useEffect(() => {
    if (!hydrated) return;
    setSaveState("saving");
    const t = setTimeout(() => {
      try {
        const next = { ...state, updatedAt: new Date().toISOString() };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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

  const addSpace = useCallback((type: SpaceType, label: string) => {
    const space: Space = { id: newId(), type, label };
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
      return { ...s, spaces: s.spaces.filter((sp) => sp.id !== id), responses };
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

  const reset = useCallback(() => {
    setState(EMPTY_CASE);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable; in-memory reset still applied */
    }
  }, []);

  return {
    state,
    hydrated,
    saveState,
    setReference,
    addSpace,
    renameSpace,
    removeSpace,
    setStatus,
    setReason,
    reset,
  };
}

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
