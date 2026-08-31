export type Contact = {
  id: string;
  name: string;
  createdAt: string;
  meetingsCount: number;
};

export type FavoritePlace = {
  id: string;
  name: string;
  address: string;
  city: string;
  tags: string[];
  savedAt: string;
};

export type SavedRoute = {
  id: string;
  title: string;
  city: string;
  stopNames: string[];
  stopIds?: string[];
  savedAt: string;
};

export type SavedMeeting = {
  id: string;
  name: string;
  city: string;
  goal?: string;
  people?: number;
  savedAt: string;
};

export type MeetingTemplate = {
  id: string;
  name: string;
  city: "moscow" | "spb";
  goal: string;
  company: string;
  size: number;
  prefs: string[];
  signals: MeetingSignals;
  budgetLimit: number;
  budgetScope: "person" | "group";
  createdAt: string;
};

export type PlaceReaction = "love" | "like" | "neutral" | "dislike";

export type RouteFeedback = {
  id: string;
  meetingId: string;
  routeId: string;
  rating: number;
  positives: string[];
  issues: string[];
  placeReactions: Record<string, PlaceReaction>;
  createdAt: string;
};

export type SoberuMemory = {
  version: 2;
  profile: { id: string; name: string };
  contacts: Contact[];
  favoritePlaces: FavoritePlace[];
  savedRoutes: SavedRoute[];
  savedMeetings: SavedMeeting[];
  visitedPlaceIds: string[];
  preferenceWeights: Record<string, number>;
  feedback: RouteFeedback[];
  templates: MeetingTemplate[];
};

export const MEMORY_STORAGE_KEY = "soberu-memory-v1";

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultMemory(): SoberuMemory {
  return {
    version: 2,
    profile: { id: createId("profile"), name: "Вы" },
    contacts: [],
    favoritePlaces: [],
    savedRoutes: [],
    savedMeetings: [],
    visitedPlaceIds: [],
    preferenceWeights: {},
    feedback: [],
    templates: [],
  };
}

export function readMemory(raw: string | null): SoberuMemory {
  const fallback = createDefaultMemory();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed as Partial<SoberuMemory>;
    if (parsed.version !== 1 && parsed.version !== 2) return fallback;
    return {
      ...fallback,
      ...value,
      version: 2,
      profile: { ...fallback.profile, ...(value.profile ?? {}) },
      contacts: Array.isArray(value.contacts) ? value.contacts : [],
      favoritePlaces: Array.isArray(value.favoritePlaces) ? value.favoritePlaces : [],
      savedRoutes: Array.isArray(value.savedRoutes) ? value.savedRoutes : [],
      savedMeetings: Array.isArray(value.savedMeetings) ? value.savedMeetings : [],
      visitedPlaceIds: Array.isArray(value.visitedPlaceIds) ? value.visitedPlaceIds : [],
      preferenceWeights: value.preferenceWeights && typeof value.preferenceWeights === "object" ? value.preferenceWeights : {},
      feedback: Array.isArray(value.feedback) ? value.feedback : [],
      templates: Array.isArray(value.templates) ? value.templates : [],
    };
  } catch {
    return fallback;
  }
}

export function addContact(memory: SoberuMemory, name: string): { memory: SoberuMemory; contactId: string } {
  const normalized = name.trim();
  const existing = memory.contacts.find((contact) => contact.name.toLocaleLowerCase("ru-RU") === normalized.toLocaleLowerCase("ru-RU"));
  if (existing) return { memory, contactId: existing.id };
  const contact: Contact = { id: createId("contact"), name: normalized, createdAt: new Date().toISOString(), meetingsCount: 0 };
  return { memory: { ...memory, contacts: [...memory.contacts, contact] }, contactId: contact.id };
}

export function clampWeight(value: number) {
  return Math.max(-1, Math.min(1, Number(value.toFixed(2))));
}

export function updateWeights(weights: Record<string, number>, tags: string[], delta: number) {
  const next = { ...weights };
  tags.forEach((tag) => { next[tag] = clampWeight((next[tag] ?? 0) + delta); });
  return next;
}

export function preferenceBoost(weights: Record<string, number>, tags: string[]) {
  return tags.reduce((total, tag) => total + (weights[tag] ?? 0), 0);
}
import type { MeetingSignals } from "./recommendation";
