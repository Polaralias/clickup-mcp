type AnnotationExtras = Record<string, string | boolean>

function baseAnnotation(mode: "ro" | "mut", cat: string, intent: string, extras: AnnotationExtras = {}) {
  return {
    annotations: {
      mode,
      cat,
      intent,
      ...extras
    }
  }
}

export function readOnlyAnnotation(cat: string, intent: string, extras: AnnotationExtras = {}) {
  return baseAnnotation("ro", cat, intent, extras)
}

export function destructiveAnnotation(cat: string, intent: string, extras: AnnotationExtras = {}) {
  return baseAnnotation("mut", cat, intent, { confirm: "dryRun+confirm=yes", ...extras })
}
