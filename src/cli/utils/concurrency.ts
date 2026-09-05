/** Map work through a bounded pool while preserving input order. */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
  onComplete?: (completed: number, total: number) => void
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error('Concurrency must be a positive integer');
  const results = new Array<R>(items.length);
  let next = 0;
  let completed = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]!, index);
      completed++;
      onComplete?.(completed, items.length);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
