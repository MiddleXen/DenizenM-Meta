export default function DocsLoading() {
  return (
    <div className="w-full pb-16 animate-pulse" aria-busy="true" aria-label="Loading documentation">
      <div className="max-w-3xl mx-auto px-4 pt-9 pb-5 text-center space-y-3">
        <div className="h-10 sm:h-12 w-64 sm:w-80 mx-auto rounded-xl bg-[var(--table-border)]/60" />
        <div className="h-4 w-80 sm:w-[440px] max-w-full mx-auto rounded-md bg-[var(--table-border)]/40" />
        <div className="pt-3 max-w-xl mx-auto">
          <div className="h-11 w-full rounded-xl bg-[var(--table-border)]/60" />
        </div>
        <div className="pt-2 flex justify-center">
          <div className="h-7 w-44 rounded-md bg-[var(--table-border)]/40" />
        </div>
      </div>

      <div className="max-w-[1440px] w-[96%] mx-auto space-y-4 mt-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-44 rounded-2xl border border-[var(--table-border)] bg-[var(--card-bg)]/70"
          />
        ))}
      </div>
    </div>
  );
}
