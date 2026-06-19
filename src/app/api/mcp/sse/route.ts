import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Extend globalThis to store sessions
declare global {
  var mcpSessions: Map<string, {
    controller: ReadableStreamDefaultController;
    userId: string;
    userEmail: string;
  }> | undefined;
}

if (!globalThis.mcpSessions) {
  globalThis.mcpSessions = new Map();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token query parameter' }, { status: 401 });
  }

  // Verify the token
  let user = null;
  if (token.startsWith('matchply_usr_')) {
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.apiKey, token))
      .limit(1);
    
    if (dbUser) {
      user = dbUser;
    }
  } else {
    // Global API Key fallback
    const expectedGlobalToken = (globalThis as any).process?.env?.MATCHPLY_EXTERNAL_API_KEY;
    if (expectedGlobalToken && token === expectedGlobalToken) {
      const email = searchParams.get('userEmail');
      if (email) {
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (dbUser) {
          user = dbUser;
        }
      }
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized or user not found' }, { status: 401 });
  }

  const sessionId = crypto.randomUUID();

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Store session
      globalThis.mcpSessions!.set(sessionId, {
        controller,
        userId: user.id,
        userEmail: user.email,
      });

      // Keep-alive heartbeat comments every 15s to prevent cloud proxies from dropping the connection
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(':\n\n'));
        } catch (e) {
          clearInterval(keepAliveInterval);
        }
      }, 15000);

      // Send initial connect message pointing to the message endpoint
      // We pass the sessionId in the query param so the message handler can route requests back to this SSE channel.
      const nextAuthUrl = (globalThis as any).process?.env?.NEXTAUTH_URL;
      const forwardedHost = req.headers.get('x-forwarded-host');
      const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
      
      let baseUrl = nextAuthUrl;
      if (!baseUrl) {
        if (forwardedHost) {
          baseUrl = `${forwardedProto}://${forwardedHost}`;
        } else {
          baseUrl = req.nextUrl.origin;
        }
      }
      const messageUrl = `${baseUrl}/api/mcp/message?sessionId=${sessionId}`;
      
      const connectPayload = `event: connect\ndata: ${messageUrl}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectPayload));

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        globalThis.mcpSessions!.delete(sessionId);
        console.log(`[MCP] Session ${sessionId} disconnected.`);
      });
    },
    cancel() {
      globalThis.mcpSessions!.delete(sessionId);
      console.log(`[MCP] Session ${sessionId} cancelled.`);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export const dynamic = 'force-dynamic';
