type AnnotationExtras = Record<string, string | boolean>

function baseAnnotation(cat: string, intent: string, extras: AnnotationExtras = {}) {
  // Use full descriptive keys instead of shortened versions
  // cat -> category
  // intent -> intent
  // scope -> scope
  // cache -> cache
  // input -> input
  // dry -> dryRun
  // confirm -> confirmation
  // limit -> limit
  // weight -> weight
  // window -> window
  // Standard hints: readOnlyHint, destructiveHint, idempotentHint

  const formattedExtras: AnnotationExtras = {}
  for (const [key, value] of Object.entries(extras)) {
    if (key === "idempotent") formattedExtras.idempotentHint = value
    else if (key === "readOnly") formattedExtras.readOnlyHint = value
    else if (key === "destructive") formattedExtras.destructiveHint = value
    else if (key === "dry") formattedExtras.dryRun = value
    else if (key === "confirm") formattedExtras.confirmation = value
    else formattedExtras[key] = value
  }

  // Remove mode (m) as it is redundant with readOnlyHint/destructiveHint

  return {
    annotations: {
      category: cat,
      intent: intent,
      ...formattedExtras
    }
  }
}

export function readOnlyAnnotation(cat: string, intent: string, extras: AnnotationExtras = {}) {
  return baseAnnotation(cat, intent, { readOnly: true, ...extras })
}

export function destructiveAnnotation(cat: string, intent: string, extras: AnnotationExtras = {}) {
  return baseAnnotation(cat, intent, { destructive: true, confirm: "dryRun+confirm=yes", ...extras })
}
