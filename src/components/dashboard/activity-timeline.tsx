import { formatStatusLabel } from "./status-badge";

export type ActivityEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorName: string;
  createdAt: string;
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  return (
    <ol className="mt-4 space-y-4">
      {events.map((event) => (
        <li key={event.id} className="relative border-l-2 border-[#0EA5E9]/30 dark:border-[#22D3EE]/30 pl-5">
          <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-[#0EA5E9] dark:bg-[#22D3EE]" aria-hidden="true" />
          <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{formatDateTime(event.createdAt)}</p>
          <p className="text-sm font-semibold text-[#0B1630] dark:text-white">{formatStatusLabel(event.action)}</p>
          <p className="text-xs text-[#536078] dark:text-[#B8C4D8]">
            {event.actorName} · {formatStatusLabel(event.entityType)}
          </p>
        </li>
      ))}
    </ol>
  );
}
