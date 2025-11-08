export async function ping(message?: string) {
  return { message: message ?? "pong" }
}
