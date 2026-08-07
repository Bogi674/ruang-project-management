export default function RoomLoading() {
  return (
    <div className="px-4 py-6 md:px-11 md:py-9 max-w-[920px] animate-pulse">
      <div className="h-7 w-32 bg-border-default rounded-lg mb-6" />
      <div className="h-28 bg-bg-surface border border-border-light rounded-card mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[1, 2].map((i) => (
          <div key={i} className="h-56 bg-bg-surface border border-border-light rounded-card" />
        ))}
      </div>
    </div>
  );
}
