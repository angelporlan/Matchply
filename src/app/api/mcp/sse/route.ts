import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated — This endpoint uses the legacy SSE transport.
 * ChatGPT and modern MCP clients should use the Streamable HTTP
 * endpoint at /api/mcp instead (POST for requests, GET for SSE stream).
 */

export async function GET(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  return NextResponse.json(
    {
      error: 'This endpoint has been deprecated.',
      message: 'Please use the Streamable HTTP endpoint instead.',
      endpoint: `${baseUrl}/api/mcp`,
      transport: 'streamable-http',
      auth: 'Use Authorization: Bearer <your_api_key> header',
    },
    { status: 410 }
  );
}

export async function POST(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  return NextResponse.json(
    {
      error: 'This endpoint has been deprecated.',
      message: 'Please use the Streamable HTTP endpoint instead.',
      endpoint: `${baseUrl}/api/mcp`,
      transport: 'streamable-http',
      auth: 'Use Authorization: Bearer <your_api_key> header',
    },
    { status: 410 }
  );
}

export const dynamic = 'force-dynamic';
