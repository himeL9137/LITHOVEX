// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — Persona Manager Hook
// Phase 5: localStorage-backed CRUD for Persona objects.
//
// Storage keys:
//   "lx-personas"          → JSON array of Persona[]
//   "lx-active-persona-id" → string | null (the id of the active persona)
//
// NON-DESTRUCTIVE: This hook only touches its own localStorage keys and does
// not interfere with any other storage or state managed by the app.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useMemo } from "react";
import type { Persona } from "@/lib/types";

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY_PERSONAS = "lx-personas";
const STORAGE_KEY_ACTIVE_ID = "lx-active-persona-id";

function loadPersonas(): Persona[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PERSONAS);
    if (!raw) return DEFAULT_PERSONAS;
    const parsed = JSON.parse(raw) as Persona[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PERSONAS;
  } catch {
    return DEFAULT_PERSONAS;
  }
}

function savePersonas(personas: Persona[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PERSONAS, JSON.stringify(personas));
  } catch {
    // Storage quota exceeded — fail silently
  }
}

function loadActiveId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_ID) ?? null;
  } catch {
    return null;
  }
}

function saveActiveId(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
    } else {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
    }
  } catch {
    // fail silently
  }
}

// ─── Built-in starter personas ────────────────────────────────────────────────

const DEFAULT_PERSONAS: Persona[] = [
  {
    id: "persona-default-assistant",
    name: "Helpful Assistant",
    description: "Balanced, professional, concise responses",
    instructions:
      "You are a helpful, harmless, and honest AI assistant. Be clear, concise, and professional in your responses. If you are unsure about something, say so rather than speculating.",
    isDefault: true,
  },
  {
    id: "persona-code-expert",
    name: "Code Expert",
    description: "Senior engineer — prefers code over prose",
    instructions:
      "You are a senior software engineer with deep expertise across multiple languages and paradigms. Prefer code examples over lengthy prose. When explaining concepts, provide working code snippets. Point out edge cases, performance implications, and best practices. Be direct and technical.",
    isDefault: true,
  },
  {
    id: "persona-socratic",
    name: "Socratic Tutor",
    description: "Guides with questions rather than answers",
    instructions:
      "You are a Socratic tutor. Instead of giving direct answers, guide the user to discover the answer themselves through carefully crafted questions. Help them think through problems step-by-step. Only reveal the answer when the user has genuinely exhausted their own reasoning.",
    isDefault: true,
  },
];

// ─── Tiny ID generator ────────────────────────────────────────────────────────

function uid(): string {
  return `persona-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UsePersonaManagerReturn {
  personas: Persona[];
  activePersonaId: string | null;
  activePersona: Persona | null;
  addPersona: (draft: Omit<Persona, "id" | "isDefault">) => Persona;
  updatePersona: (id: string, patch: Partial<Omit<Persona, "id">>) => void;
  deletePersona: (id: string) => void;
  setActivePersona: (id: string | null) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePersonaManager(): UsePersonaManagerReturn {
  const [personas, setPersonas] = useState<Persona[]>(() => loadPersonas());
  const [activePersonaId, setActivePersonaIdState] = useState<string | null>(() => loadActiveId());

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const addPersona = useCallback((draft: Omit<Persona, "id" | "isDefault">): Persona => {
    const persona: Persona = { ...draft, id: uid(), isDefault: false };
    setPersonas((prev) => {
      const next = [...prev, persona];
      savePersonas(next);
      return next;
    });
    return persona;
  }, []);

  const updatePersona = useCallback(
    (id: string, patch: Partial<Omit<Persona, "id">>) => {
      setPersonas((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
        savePersonas(next);
        return next;
      });
    },
    []
  );

  const deletePersona = useCallback((id: string) => {
    setPersonas((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePersonas(next);
      return next;
    });
    // Clear active if we deleted the active persona
    setActivePersonaIdState((prev) => {
      if (prev === id) {
        saveActiveId(null);
        return null;
      }
      return prev;
    });
  }, []);

  const setActivePersona = useCallback((id: string | null) => {
    saveActiveId(id);
    setActivePersonaIdState(id);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const activePersona = useMemo(
    () => personas.find((p) => p.id === activePersonaId) ?? null,
    [personas, activePersonaId]
  );

  return {
    personas,
    activePersonaId,
    activePersona,
    addPersona,
    updatePersona,
    deletePersona,
    setActivePersona,
  };
}
