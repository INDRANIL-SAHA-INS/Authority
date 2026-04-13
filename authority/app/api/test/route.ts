import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ 
    status: "ready", 
    message: "API is ready for more requests" 
  }, { status: 200 });
}
export async function POST() {  

}