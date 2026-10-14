import { describe, it, expect, vi } from 'vitest';

describe('store WriteQueue', () => {
  it('creates a queue that is initially not busy', async () => {
    const { WriteQueue } = await import('../src/store');
    const onStatus = vi.fn();
    const queue = new WriteQueue(onStatus);
    expect(queue.busy).toBe(false);
  });

  it('tracks pending writes', async () => {
    const { WriteQueue } = await import('../src/store');
    const onStatus = vi.fn();
    const queue = new WriteQueue(onStatus);

    queue.write('test-file', { data: 'test' });

    expect(queue.busy).toBe(true);
  });
});
