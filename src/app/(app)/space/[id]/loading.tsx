export default function SpaceLoading() {
  return (
    <div className="px-4 py-6 md:px-11 md:py-9 max-w-[860px] animate-pulse">
      <div className="h-3 w-24 bg-border-light rounded mb-3" />
      <div className="h-7 w-44 bg-border-default rounded-lg mb-6" />
      <div className="border border-border-default rounded-card overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 border-b border-border-light last:border-b-0 bg-bg-base" />
        ))}
      </div>
    </div>
  );
}
