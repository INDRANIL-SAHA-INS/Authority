import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const data: Record<string, any> = {};
    
    // Create upload directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Process all fields in FormData
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        // Handle file upload
        const file = value as File;
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${Date.now()}_${file.name}`;
        const filePath = path.join(uploadDir, fileName);
        
        fs.writeFileSync(filePath, buffer);
        data[key] = {
          name: file.name,
          type: file.type,
          size: file.size,
          path: `/uploads/${fileName}`,
        };
      } else {
        data[key] = value;
      }
    }

    console.log("Received Job Application Data:", data);

    return NextResponse.json({
      success: true,
      message: "Application received and file saved",
      receivedData: data,
    });
  } catch (error) {
    console.error("Error processing application:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
