import { describe, expect, it } from "vitest";
import { portalPhotoGridReducer } from "./PortalPhotoGrid";

const initialState = {
  items: [
    { id: "photo-1", baseName: "photo-1", selected: true },
    { id: "photo-2", baseName: "photo-2", selected: false },
  ],
  pendingId: null,
  error: null,
};

function selectedCount(state: { items: { selected: boolean }[] }) {
  return state.items.filter((item) => item.selected).length;
}

describe("PortalPhotoGrid optimistic state", () => {
  it("derives the optimistic count from the current grid items", () => {
    const optimistic = portalPhotoGridReducer(initialState, {
      type: "toggle",
      photoId: "photo-2",
      selected: true,
    });

    expect(selectedCount(initialState)).toBe(1);
    expect(selectedCount(optimistic)).toBe(2);
    expect(optimistic.pendingId).toBe("photo-2");
    expect(optimistic.error).toBeNull();
  });

  it("allows an optimistic deselection from a complete selection", () => {
    const complete = {
      ...initialState,
      items: initialState.items.map((item) => ({ ...item, selected: true })),
    };

    const optimistic = portalPhotoGridReducer(complete, {
      type: "toggle",
      photoId: "photo-1",
      selected: false,
    });

    expect(selectedCount(complete)).toBe(2);
    expect(selectedCount(optimistic)).toBe(1);
  });

  it("rolls the item and count back when the server rejects the change", () => {
    const optimistic = portalPhotoGridReducer(initialState, {
      type: "toggle",
      photoId: "photo-2",
      selected: true,
    });
    const rolledBack = portalPhotoGridReducer(optimistic, {
      type: "rollback",
      photoId: "photo-2",
      selected: false,
    });
    const settled = portalPhotoGridReducer(rolledBack, { type: "settled" });

    expect(selectedCount(rolledBack)).toBe(1);
    expect(rolledBack.error).toBe(
      "No se pudo actualizar la selección. Intenta nuevamente."
    );
    expect(settled.pendingId).toBeNull();
  });
});
