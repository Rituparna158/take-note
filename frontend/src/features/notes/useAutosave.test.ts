import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEditorStore } from "../../stores/editorStore.js";
import { useAutosave, type AutosaveValue } from "./useAutosave.js";

const BASE_VALUE: AutosaveValue = {
  title: "Untitled",
  content: { type: "doc", content: [] },
  tagIds: [],
};

function withTitle(title: string): AutosaveValue {
  return { ...BASE_VALUE, title };
}

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves after 2 seconds of inactivity following a change", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ value }: { value: AutosaveValue }) =>
        useAutosave({ enabled: true, value, initialSnapshot: BASE_VALUE, onSave }),
      { initialProps: { value: BASE_VALUE } },
    );

    rerender({ value: withTitle("Changed") });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(withTitle("Changed"));
    expect(useEditorStore.getState().status).toBe("saved");
  });

  it("does not save when nothing has changed since the last save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ value }: { value: AutosaveValue }) =>
        useAutosave({ enabled: true, value, initialSnapshot: BASE_VALUE, onSave }),
      { initialProps: { value: BASE_VALUE } },
    );

    rerender({ value: { ...BASE_VALUE } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("retries a failing save with 1s/2s/4s backoff before surfacing failure", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("network error"));
    const { rerender } = renderHook(
      ({ value }: { value: AutosaveValue }) =>
        useAutosave({ enabled: true, value, initialSnapshot: BASE_VALUE, onSave }),
      { initialProps: { value: BASE_VALUE } },
    );

    rerender({ value: withTitle("Changed") });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000); // debounce elapses -> attempt 1 (fails)
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(useEditorStore.getState().status).toBe("retrying");
    expect(useEditorStore.getState().retryCount).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // 1s backoff -> attempt 2 (fails)
    });
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(useEditorStore.getState().retryCount).toBe(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000); // 2s backoff -> attempt 3 (fails)
    });
    expect(onSave).toHaveBeenCalledTimes(3);
    expect(useEditorStore.getState().retryCount).toBe(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000); // 4s backoff -> attempt 4, final (fails)
    });
    expect(onSave).toHaveBeenCalledTimes(4);
    expect(useEditorStore.getState().status).toBe("error");
  });

  it("saves a value that already differs from initialSnapshot the moment it becomes enabled", async () => {
    // Simulates content that changed between a create/load request being sent and it resolving:
    // the value is already ahead of what was actually persisted (initialSnapshot) on first render.
    const onSave = vi.fn().mockResolvedValue(undefined);
    const driftedValue = withTitle("Drifted before enabled");
    renderHook(() =>
      useAutosave({ enabled: true, value: driftedValue, initialSnapshot: BASE_VALUE, onSave }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(driftedValue);
    expect(useEditorStore.getState().status).toBe("saved");
  });

  it("markSaved re-baselines the dirty check so a value saved outside onSave is not re-saved", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const restoredValue = withTitle("Restored externally");
    const { result, rerender } = renderHook(
      ({ value }: { value: AutosaveValue }) =>
        useAutosave({ enabled: true, value, initialSnapshot: BASE_VALUE, onSave }),
      { initialProps: { value: BASE_VALUE } },
    );

    act(() => {
      result.current.markSaved(restoredValue);
    });
    rerender({ value: restoredValue });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSave).not.toHaveBeenCalled();
  });
});
