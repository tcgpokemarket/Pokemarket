import { createHash, timingSafeEqual } from 'crypto'

export function hasInternalAuth(req: Request) {
  const expected = process.env.INTERNAL_API_TOKEN
  if (!expected) return false

  const supplied = req.headers.get('x-internal-token')
  if (!supplied) return false

  const expectedHash = createHash('sha256').update(expected).digest()
  const suppliedHash = createHash('sha256').update(supplied).digest()

  return expectedHash.length === suppliedHash.length && timingSafeEqual(expectedHash, suppliedHash)
}
