import "server-only";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export const verifyPassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash);

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_COST);
