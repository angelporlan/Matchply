'use client';
import { useEffect } from 'react';
import { observeProductErrors, rememberRequestId } from '@/lib/client-diagnostics';

export default function ErrorObserver({ requestId }: { requestId?: string }) {
  useEffect(() => { rememberRequestId(requestId); return observeProductErrors(); }, [requestId]);
  return null;
}
