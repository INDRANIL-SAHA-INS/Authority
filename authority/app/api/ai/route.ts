import { NextRequest, NextResponse } from "next/server";

/**
 * Global AI Gateway Route
 * -----------------------
 * Forwards all incoming requests directly to the Python AI Mail Agent.
 */

export const maxDuration = 60; // Allow up to 60 seconds for AI processing

const AI_MAIL_SERVICE_URL = "http://localhost:8001/api/mail/ai-dispatch";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(AI_MAIL_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          error: data.detail || data.error || "AI Microservice returned an error." 
        }, 
        { status: response.status }
      );
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("❌ [AI_GATEWAY_ERROR]:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "AI Microservice is unreachable or timed out. Ensure the Python server is running." 
      }, 
      { status: 502 }
    );
  }
}
