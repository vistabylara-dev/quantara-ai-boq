export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.VERCEL_ENV) return;
  const { initializePdfCanvasRuntime } = await import("./instrumentation-node");
  await initializePdfCanvasRuntime();
}
