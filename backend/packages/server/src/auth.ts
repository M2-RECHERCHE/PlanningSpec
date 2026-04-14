import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [salt, expectedHash] = storedHash.split(':');
    if (!salt || !expectedHash) {
        return false;
    }

    const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH) as Buffer;
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    if (expectedBuffer.length !== derivedKey.length) {
        return false;
    }

    return timingSafeEqual(expectedBuffer, derivedKey);
}

export function createSessionToken(tokenBytes: number): string {
    return randomBytes(tokenBytes).toString('hex');
}

export function hashSessionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}
