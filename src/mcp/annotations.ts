type AnnotationExtras = Record<string, string | boolean>

function baseAnnotation(mode: "ro" | "mut", cat: string, intent: string, extras: AnnotationExtras = {}) {
  // Short keys for token efficiency:
  // m: mode
  // c: cat
  // i: intent
  // readOnlyHint: readOnly (standard)
  // destructiveHint: destructive (standard)
  // idempotentHint: idempotent (standard)
  // s: scope
  // ch: cache
  // in: input
  // d: dry
  // cf: confirm
  // l: limit (was limit)
  // w: weight
  // win: window

  // Map long keys in extras to short keys if they exist
  const formattedExtras: AnnotationExtras = {}
  for (const [key, value] of Object.entries(extras)) {
    if (key === "scope") formattedExtras.s = value
    else if (key === "cache") formattedExtras.ch = value
    else if (key === "input") formattedExtras.in = value
    else if (key === "dry") formattedExtras.d = value
    else if (key === "confirm") formattedExtras.cf = value
    else if (key === "idempotent") formattedExtras.idempotentHint = value
    else if (key === "readOnly") formattedExtras.readOnlyHint = value
    else if (key === "destructive") formattedExtras.destructiveHint = value
    else if (key === "limit") formattedExtras.l = value
    else if (key === "weight") formattedExtras.w = value
    else if (key === "window") formattedExtras.win = value
    else formattedExtras[key] = value
  }

  return {
    annotations: {
      m: mode,
      c: cat,
      i: intent,
      ...formattedExtras
    }
  }
}

export function readOnlyAnnotation(cat: string, intent: string, extras: AnnotationExtras = {}) {
  return baseAnnotation("ro", cat, intent, { readOnly: true, ...extras })
}

export function destructiveAnnotation(cat: string, intent: string, extras: AnnotationExtras = {}) {
  return baseAnnotation("mut", cat, intent, { destructive: true, confirm: "dryRun+confirm=yes", ...extras })
}
