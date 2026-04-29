import { NextResponse } from "next/server";
import { signInSchema } from "@/lib/zod";
import { prisma } from "@/lib/prisma";
import { SignJWT } from "jose";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 1. Validate incoming data
    const { email, password } = await signInSchema.parseAsync(body);

    // 2. Fetch the user from the database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    // 3. Match password
    const isPasswordValid = password === user.password_hash;

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    // 4. Create the payload for the mobile app
    const tokenPayload = {
      id: user.user_id.toString(),
      email: user.email,
      role: user.role,
    };

    // 5. Sign the JSON Web Token using 'jose' (Edge-compatible)
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    const token = await new SignJWT(tokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret);

    // 6. Return the raw token and user info to Expo
    return NextResponse.json({
      message: "Login successful",
      token: token,
      user: tokenPayload
    }, { status: 200 });

  } catch (error) {
    console.error("Mobile Login Error:", error);
    return NextResponse.json({ error: "Invalid request or credentials." }, { status: 400 });
  }
}
