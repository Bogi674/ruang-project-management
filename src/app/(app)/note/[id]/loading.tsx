export default function NoteLoading() {
  return (
    <div className="px-4 pt-5 md:px-20 md:pt-8 max-w-[820px] md:mx-auto w-full animate-pulse">
      <div className="h-9 w-2/3 bg-border-default rounded-lg mb-3" />
      <div className="h-3 w-40 bg-border-light rounded mb-6" />
      <div className="h-[46px] bg-bg-surface border border-border-light rounded-lg mb-6" />
      <div className="space-y-2.5">
        <div className="h-3.5 w-full bg-border-light rounded" />
        <div className="h-3.5 w-11/12 bg-border-light rounded" />
        <div className="h-3.5 w-4/5 bg-border-light rounded" />
      </div>
    </div>
  );
}
