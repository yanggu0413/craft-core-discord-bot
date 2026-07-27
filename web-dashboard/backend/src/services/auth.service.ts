import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_99881122';

export interface UserPayload {
  mc_uuid: string;
  mc_username: string;
  discord_id?: string;
  roles?: string[];
  profile?: {
    roles?: string[];
    isAdmin?: boolean;
  };
}

/**
 * Sign JWT token for user profile
 */
export function signToken(payload: UserPayload, expiresIn: string = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): UserPayload | null {
  if (!token) return null;

  const trimmedToken = token.trim();

  try {
    const decoded = jwt.verify(trimmedToken, JWT_SECRET) as UserPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}
