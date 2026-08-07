export default function HomeLoading() {
  return (
    <div className="px-11 py-9 max-w-[920px] animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-48 bg-border-default rounded-lg mb-2" />
        <div className="h-3 w-32 bg-border-light rounded" />
      </div>
      <div className="mb-8">
        <div className="h-3 w-16 bg-border-light rounded mb-3" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-bg-surface border border-border-light rounded-card" />
          ))}
        </div>
      </div>
      <div>
        <div className="h-3 w-14 bg-border-light rounded mb-3" />
        <div className="border border-border-default rounded-card overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 border-b border-border-light last:border-b-0 bg-bg-base" />
          ))}
        </div>
      </div>
    </div>
  );
}
