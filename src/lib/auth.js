import jwt from 'jsonwebtoken';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const FALLBACK_JWT_SECRET = '8d6c702492d5a86eba4715acb2f2f79df758717167b54b04d93628c5d4f08fff';

export function getJwtSecret() {
  try {
    const cf = getCloudflareContext();
    if (cf?.env?.JWT_SECRET) {
      return cf.env.JWT_SECRET;
    }
  } catch {
    // Outside Cloudflare request context
  }

  return process.env.JWT_SECRET || FALLBACK_JWT_SECRET;
}

export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (err) {
    return null;
  }
}
