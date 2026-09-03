export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializePdfCanvasRuntime } = await import("./instrumentation-node");
    await initializePdfCanvasRuntime();
  }
}
