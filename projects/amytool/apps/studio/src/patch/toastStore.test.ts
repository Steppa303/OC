import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast, useToastStore } from './toastStore';

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  vi.useRealTimers();
});

describe('toastStore', () => {
  it('pushes info and error toasts with an incrementing id', () => {
    useToastStore.getState().push('hello');
    toast('boom', 'error');
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(2);
    expect(toasts[0]).toMatchObject({ message: 'hello', tone: 'info' });
    expect(toasts[1]).toMatchObject({ message: 'boom', tone: 'error' });
    expect(toasts[1]!.id).toBeGreaterThan(toasts[0]!.id);
  });

  it('dismiss removes a toast by id', () => {
    useToastStore.getState().push('a');
    const id = useToastStore.getState().toasts[0]!.id;
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('auto-dismisses after the timeout', () => {
    vi.useFakeTimers();
    useToastStore.getState().push('temp', 'info');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(2800);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('errors linger longer than info toasts', () => {
    vi.useFakeTimers();
    useToastStore.getState().push('err', 'error');
    vi.advanceTimersByTime(2800);
    expect(useToastStore.getState().toasts).toHaveLength(1); // still up
    vi.advanceTimersByTime(2200);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
