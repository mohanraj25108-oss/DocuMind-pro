import fs from "node:fs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDocumentFileDetails } from "@/lib/documents";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const fileInfo = getDocumentFileDetails(user.id, id);
  if (!fileInfo) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const inline = searchParams.get("inline") === "1";
  const buffer = fs.readFileSync(fileInfo.absolutePath);
  const safeFilename = fileInfo.originalFilename.replace(/["\r\n]/g, "_");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": fileInfo.mimeType,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeFilename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
