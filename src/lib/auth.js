import jwt from 'jsonwebtoken';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('CRITICAL SECURITY CONFIGURATION: JWT_SECRET environment variable is required.');
  }
  return secret;
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
