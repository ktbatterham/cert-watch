// Serialises read-modify-write operations on one AsyncStorage key so concurrent
// writers (for example a background check running while the user edits in the
// foreground) cannot clobber each other and lose an update. Each storage module
// owns its own lock instance, so writes to different keys still run in parallel.
export function createLock() {
  let chain: Promise<unknown> = Promise.resolve();
  return function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(fn, fn);
    chain = run.catch(() => {});
    return run;
  };
}
