/** Matches the shape /todo settles into: filter bar, headline, then rows. */
export default function TodoLoading() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="h-[49px] border-b border-border-default flex items-center gap-2.5 px-6">
        <div className="h-8 w-[280px] bg-border-light rounded-[9px]" />
        <div className="ml-auto h-8 w-[180px] bg-border-light rounded-[9px]" />
      </div>
      <div className="px-8 pt-[26px] flex flex-col gap-5 max-w-[920px] mx-auto">
        <div className="h-8 w-64 bg-border-default rounded" />
        <div className="h-[46px] bg-border-light rounded-card" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[52px] bg-border-light rounded-card" />
        ))}
      </div>
    </div>
  );
}
