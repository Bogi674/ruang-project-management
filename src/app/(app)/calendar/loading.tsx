export default function CalendarLoading() {
  return (
    <div className="flex h-[var(--app-content-h)] animate-pulse">
      <div className="flex-1 flex flex-col p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="w-8 h-8 bg-border-light rounded-lg" />
          <div className="h-6 w-36 bg-border-default rounded" />
          <div className="w-8 h-8 bg-border-light rounded-lg" />
        </div>
        <div className="grid grid-cols-7 gap-px bg-border-default flex-1 rounded-[12px] overflow-hidden">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="bg-bg-base" />
          ))}
        </div>
      </div>
      <div className="hidden md:block w-[220px] border-l border-border-default bg-bg-surface" />
    </div>
  );
}
