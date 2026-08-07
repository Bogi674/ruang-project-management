export default function StoreroomLoading() {
  return (
    <div className="px-11 py-9 max-w-[920px] animate-pulse">
      <div className="h-8 w-40 bg-border-default rounded-lg mb-6" />
      <div className="border border-border-default rounded-card overflow-hidden">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-12 border-b border-border-light last:border-b-0 bg-bg-base" />
        ))}
      </div>
    </div>
  );
}
