import { parseFile } from "./dataEngine";

self.onmessage = async (e: MessageEvent<File>) => {
  try {
    const dataset = await parseFile(e.data);
    (self as unknown as Worker).postMessage({ ok: true, dataset });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
