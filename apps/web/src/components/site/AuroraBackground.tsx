// Fixed animated backdrop. Pure CSS, no client JS, sits behind all content.
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {/* fine grid */}
      <div className="absolute inset-0 bg-grid-faint [background-size:64px_64px] [mask-image:radial-gradient(80%_60%_at_50%_0%,black,transparent)]" />
      {/* aurora blobs */}
      <div className="absolute -top-40 right-[-10%] h-[42rem] w-[42rem] rounded-full bg-primary/20 blur-[120px] animate-aurora" />
      <div className="absolute top-[20%] left-[-15%] h-[34rem] w-[34rem] rounded-full bg-sky/15 blur-[120px] animate-aurora [animation-delay:-7s]" />
      <div className="absolute bottom-[-20%] left-[30%] h-[38rem] w-[38rem] rounded-full bg-iris/15 blur-[130px] animate-aurora [animation-delay:-14s]" />
      {/* top sheen and bottom fade */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
    </div>
  );
}
