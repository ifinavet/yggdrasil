import type { Id } from "@workspace/backend/convex/dataModel";
import { create } from "zustand";

interface SelectedEventsStore {
  events: Id<"events">[];
  addEvent: (eventId: Id<"events">) => void;
  removeEvent: (eventId: Id<"events">) => void;
  clearEvents: () => void;
}

export const useSelectedEventsStore = create<SelectedEventsStore>()((set) => ({
  events: [],
  addEvent: (eventId: Id<"events">) =>
    set((state) => ({
      events: [...state.events, eventId],
    })),
  removeEvent: (eventId: Id<"events">) =>
    set((state) => ({
      events: state.events.filter((id) => id !== eventId),
    })),
  clearEvents: () => set({ events: [] }),
}));
