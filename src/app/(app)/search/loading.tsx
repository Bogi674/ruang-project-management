export default function SearchLoading() {
  return (
    <div className="px-4 py-6 md:px-11 md:py-9 max-w-[720px] animate-pulse">
      <div className="h-7 w-28 bg-border-default rounded-lg mb-5" />
      <div className="h-11 bg-bg-surface border border-border-light rounded-input mb-6" />
      <div className="border border-border-default rounded-card overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 border-b border-border-light last:border-b-0 bg-bg-base" />
        ))}
      </div>
    </div>
  );
}
