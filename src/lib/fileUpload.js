// Shared client-side upload guard. Storage and the signed-URL handlers enforce
// no per-file cap, so this is the single place the 40 MB-per-file limit lives.
// Called before minting a signed URL / reading bytes at every upload entry point.

export const MAX_UPLOAD_MB = 40

// Returns a human-readable error string if `file` is over the cap, else null.
export function fileSizeError(file, maxMb = MAX_UPLOAD_MB) {
  if (!file) return null
  if (file.size > maxMb * 1024 * 1024) {
    return `"${file.name}" (${(file.size / 1048576).toFixed(1)} MB) exceeds the ${maxMb} MB per-file upload limit.`
  }
  return null
}
