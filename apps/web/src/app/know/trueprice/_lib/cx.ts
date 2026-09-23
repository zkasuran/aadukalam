// Tiny className joiner, local to TruePrice so the module keeps to its own
// import surface. Falsy parts are dropped, the rest joined with a space.

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
