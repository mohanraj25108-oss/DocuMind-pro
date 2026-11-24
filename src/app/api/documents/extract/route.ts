import { NextResponse } from "next/server";
import { ensureUserSettings, getCurrentUser } from "@/lib/auth";
import { ACCEPTED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { processUploadedDocument } from "@/lib/document-processor";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    if (!ACCEPTED_UPLOAD_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload PDF, PNG, JPG, or WEBP." },
        { status: 400 }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 15 MB limit." },
        { status: 400 }
      );
    }

    const settings = ensureUserSettings(user.id);
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await processUploadedDocument({
      buffer,
      mimeType,
      originalFilename: file.name,
      defaultCurrency: settings.currency,
      autoExtract: settings.auto_extract_on_upload,
    });

    return NextResponse.json({ extracted });
  } catch {
    return NextResponse.json(
      { error: "Failed to extract document metadata." },
      { status: 500 }
    );
  }
}
