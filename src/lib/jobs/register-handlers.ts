/**
 * Composition root for extraction job handlers: each sub-phase that adds a
 * processing engine registers it here via a side-effect import. Any service
 * that can enqueue a job imports this module first, guaranteeing the
 * relevant handler is registered before the job is ever dispatched.
 * Re-importing is safe/idempotent — registerHandler just replaces the
 * function reference for that engine type.
 */
import "@/lib/files/classification-handler";
import "@/lib/files/table-extraction-handler";
