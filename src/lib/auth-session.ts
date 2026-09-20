import { auth } from '@/auth';
import { requestCache } from '@/lib/request-cache';

/** One JWT decode per request, shared by layout, page and nested helpers. */
export const getSession = requestCache(async () => auth());
