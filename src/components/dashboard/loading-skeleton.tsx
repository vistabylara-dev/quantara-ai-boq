export default function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-4 animate-pulse space-y-3 motion-reduce:animate-none" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-10 rounded-xl bg-[#EEF3F8] dark:bg-[#111D33]" />
      ))}
    </div>
  );
}
