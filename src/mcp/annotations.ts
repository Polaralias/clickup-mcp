type AnnotationExtras = Record<string, string | boolean>

function baseAnnotation(mode: "ro" | "mut", cat: string, intent: string, extras: AnnotationExtras = {}) {
  // Short keys for token efficiency:
  // m: mode
  // c: cat
  // i: intent
  // ro: readOnly
  // mut: destructive
  // s: scope
  // ch: cache
  // in: input
  // d: dry
  // cf: confirm
  // idm: idempotent
  // l: limit (was limit)
  // w: weight
  // win: window

  // Map long keys in extras to short keys if they exist
  const shortExtras: AnnotationExtras = {}
  for (const [key, value] of Object.entries(extras)) {
    if (key === "scope") shortExtras.s = value
    else if (key === "cache") shortExtras.ch = value
    else if (key === "input") shortExtras.in = value
    else if (key === "dry") shortExtras.d = value
    else if (key === "confirm") shortExtras.cf = value
    else if (key === "idempotent") shortExtras.idm = value
    else if (key === "readOnly") shortExtras.ro = value
    else if (key === "destructive") shortExtras.mut = value
    else if (key === "limit") shortExtras.l = value
    else if (key === "weight") shortExtras.w = value
    else if (key === "window") shortExtras.win = value
    else shortExtras[key] = value
  }

  return {
    annotations: {
      m: mode,
      c: cat,
      i: intent,
      ...shortExtras
    }
  }
}

export function readOnlyAnnotation(cat: string, intent: string, extras: AnnotationExtras = {}) {
  return baseAnnotation("ro", cat, intent, { readOnly: true, ...extras })
}

export function destructiveAnnotation(cat: string, intent: string, extras: AnnotationExtras = {}) {
  return baseAnnotation("mut", cat, intent, { destructive: true, confirm: "dryRun+confirm=yes", ...extras })
}
