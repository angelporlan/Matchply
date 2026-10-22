/** Schedule from completion rather than from a fixed interval, so slow reads never overlap. */
export function startSerialPoll(load: (signal: AbortSignal) => Promise<unknown>, delayMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const poll = async () => {
    try { await load(controller.signal); }
    catch { /* Transient failures are retried; disposal never starts another read. */ }
    if (!controller.signal.aborted) timer = setTimeout(poll, delayMs);
  };
  timer = setTimeout(poll, delayMs);
  return () => { controller.abort(); clearTimeout(timer); };
}
