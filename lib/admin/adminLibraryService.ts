import "server-only";
import type { AdminLibraryResponse } from "@/lib/core/contracts";
import { listAdminLibrary } from "@/lib/admin/adminLibraryRepository";

export const getAdminLibrary = (): Promise<AdminLibraryResponse> => listAdminLibrary();
