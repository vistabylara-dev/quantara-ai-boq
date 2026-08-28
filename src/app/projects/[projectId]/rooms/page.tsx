"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { ApiClientError, apiClient } from "@/lib/api/client";

type RoomView = {
  id: string;
  drawingPageId: string | null;
  roomName: string;
  roomNumber: string | null;
  area: number | null;
  perimeter: number | null;
  ceilingHeight: number | null;
  floorLevel: string | null;
  status: string;
};

type SourceFile = { id: string; originalName: string };
type DrawingPage = { id: string; pageNumber: number; sheetName: string | null };
type PageResponse = { pages: DrawingPage[] };

const panel = "rounded-[28px] border border-slate-800 bg-slate-950 p-6";
const input = "mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400";

function optionalPositiveNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Measurements must be positive numbers.");
  return parsed;
}

function safeError(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message || fallback;
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function ProjectRoomsPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(props.params);
  const encodedProjectId = encodeURIComponent(projectId);
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [pages, setPages] = useState<Array<DrawingPage & { fileName: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ drawingPageId: "", roomName: "", roomNumber: "", area: "", perimeter: "", ceilingHeight: "", floorLevel: "" });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [roomData, files] = await Promise.all([
        apiClient.get<RoomView[]>(`/api/projects/${encodedProjectId}/rooms`),
        apiClient.get<SourceFile[]>(`/api/projects/${encodedProjectId}/files`),
      ]);
      const pageGroups = await Promise.all(files.map(async (file) => {
        const response = await apiClient.get<PageResponse>(`/api/files/${encodeURIComponent(file.id)}/pages`);
        return response.pages.map((page) => ({ ...page, fileName: file.originalName }));
      }));
      setRooms(roomData);
      setPages(pageGroups.flat());
    } catch (loadError) {
      setError(safeError(loadError, "Room evidence could not be loaded."));
    } finally {
      setIsLoading(false);
    }
  }, [encodedProjectId]);

  useEffect(() => { void load(); }, [load]);

  const pageLabels = useMemo(() => new Map(pages.map((page) => [page.id, `${page.fileName} · page ${page.pageNumber}`])), [pages]);

  async function submitRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiClient.post<RoomView>(`/api/projects/${encodedProjectId}/rooms`, {
        drawingPageId: form.drawingPageId || undefined,
        roomName: form.roomName,
        roomNumber: form.roomNumber || undefined,
        area: optionalPositiveNumber(form.area),
        perimeter: optionalPositiveNumber(form.perimeter),
        ceilingHeight: optionalPositiveNumber(form.ceilingHeight),
        floorLevel: form.floorLevel || undefined,
      });
      setRooms((current) => [...current, created]);
      setForm({ drawingPageId: "", roomName: "", roomNumber: "", area: "", perimeter: "", ceilingHeight: "", floorLevel: "" });
      setMessage("Room evidence saved for professional review. No BOQ value was changed.");
    } catch (saveError) {
      setError(safeError(saveError, "Room evidence could not be saved."));
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmRoom(roomId: string) {
    setPendingRoomId(roomId);
    setError(null);
    setMessage(null);
    try {
      const confirmed = await apiClient.post<RoomView>(`/api/rooms/${encodeURIComponent(roomId)}/confirm`);
      setRooms((current) => current.map((room) => room.id === roomId ? confirmed : room));
      setMessage("Room evidence confirmed. It is now available only as guided-measurement evidence; it was not imported into the BOQ.");
    } catch (confirmError) {
      setError(safeError(confirmError, "Room evidence could not be confirmed."));
    } finally {
      setPendingRoomId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className={panel}>
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Drawing evidence</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Room measurement evidence</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Record a professionally identified room and its verified dimensions. Quantara does not claim automatic room-boundary detection here, does not invent missing measurements, and never imports these values into the BOQ without the guided review workflow.
        </p>
      </section>

      {(error || message) && (
        <div className={`rounded-2xl border p-4 text-sm ${error ? "border-rose-800 bg-rose-950/30 text-rose-200" : "border-emerald-800 bg-emerald-950/30 text-emerald-200"}`}>
          {error ?? message}
        </div>
      )}

      <section className={panel}>
        <h3 className="text-lg font-semibold text-white">Add professional room evidence</h3>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submitRoom}>
          <label className="text-sm text-slate-300 md:col-span-2">Source drawing page
            <select className={input} value={form.drawingPageId} onChange={(event) => setForm((current) => ({ ...current, drawingPageId: event.target.value }))}>
              <option value="">No page selected — professional manual entry</option>
              {pages.map((page) => <option key={page.id} value={page.id}>{pageLabels.get(page.id)}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-300">Room name *<input required className={input} value={form.roomName} onChange={(event) => setForm((current) => ({ ...current, roomName: event.target.value }))} /></label>
          <label className="text-sm text-slate-300">Room number<input className={input} value={form.roomNumber} onChange={(event) => setForm((current) => ({ ...current, roomNumber: event.target.value }))} /></label>
          <label className="text-sm text-slate-300">Area (m²)<input inputMode="decimal" className={input} value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} /></label>
          <label className="text-sm text-slate-300">Perimeter (m)<input inputMode="decimal" className={input} value={form.perimeter} onChange={(event) => setForm((current) => ({ ...current, perimeter: event.target.value }))} /></label>
          <label className="text-sm text-slate-300">Ceiling height (m)<input inputMode="decimal" className={input} value={form.ceilingHeight} onChange={(event) => setForm((current) => ({ ...current, ceilingHeight: event.target.value }))} /></label>
          <label className="text-sm text-slate-300">Floor level<input className={input} value={form.floorLevel} onChange={(event) => setForm((current) => ({ ...current, floorLevel: event.target.value }))} /></label>
          <button disabled={isSaving} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50 md:col-span-2">{isSaving ? "Saving…" : "Save for review"}</button>
        </form>
      </section>

      <section className={panel}>
        <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold text-white">Recorded rooms</h3><span className="text-sm text-slate-400">{rooms.length} total</span></div>
        {isLoading ? <p className="mt-4 text-sm text-slate-400">Loading room evidence…</p> : rooms.length === 0 ? <p className="mt-4 text-sm text-slate-400">No room evidence has been recorded.</p> : (
          <div className="mt-4 grid gap-3">
            {rooms.map((room) => (
              <article key={room.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold text-white">{room.roomNumber ? `${room.roomNumber} · ` : ""}{room.roomName}</p><p className="mt-1 text-xs text-slate-400">{room.drawingPageId ? pageLabels.get(room.drawingPageId) ?? "Linked drawing page" : "Professional manual entry"}</p></div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{room.status.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">Area {room.area ?? "—"} m² · Perimeter {room.perimeter ?? "—"} m · Height {room.ceilingHeight ?? "—"} m · Level {room.floorLevel ?? "—"}</p>
                {(room.status === "EXTRACTED" || room.status === "NEEDS_REVIEW") && <button type="button" disabled={pendingRoomId === room.id} onClick={() => void confirmRoom(room.id)} className="mt-4 rounded-xl border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50">{pendingRoomId === room.id ? "Confirming…" : "Confirm evidence"}</button>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
