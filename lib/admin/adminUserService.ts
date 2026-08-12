import "server-only";
import type { AdminUserRow } from "@/lib/core/contracts";
import { listUsers } from "@/lib/admin/adminUserRepository";

export const getAdminUsers = async (): Promise<AdminUserRow[]> => listUsers();
