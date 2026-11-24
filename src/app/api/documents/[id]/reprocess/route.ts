import fs from "node:fs";
import { NextResponse } from "next/server";
import { ensureUserSettings, getCurrentUser, logActivity } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { processUploadedDocument } from "@/lib/document-processor";
import { getDocumentById, getDocumentFileDetails } from "@/lib/documents";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const doc = getDocumentById(user.id, id);
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const fileInfo = getDocumentFileDetails(user.id, id);
  if (!fileInfo) {
    return NextResponse.json(
      { error: "This document has no attached file to reprocess." },
      { status: 400 }
    );
  }

  const settings = ensureUserSettings(user.id);
  const buffer = fs.readFileSync(fileInfo.absolutePath);
  const extracted = await processUploadedDocument({
    buffer,
    mimeType: fileInfo.mimeType,
    originalFilename: fileInfo.originalFilename,
    defaultCurrency: settings.currency,
    autoExtract: true,
  });

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE documents SET
      extracted_text = ?,
      ai_summary = ?,
      extraction_status = ?,
      updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    extracted.extractedText,
    extracted.aiSummary,
    extracted.extractionStatus,
    now,
    id,
    user.id
  );

  logActivity({
    userId: user.id,
    action: "document.processed",
    entityType: "document",
    entityId: id,
    entityName: doc.name,
    details: `Re-ran document text extraction (${extracted.extractionStatus})`,
  });

  return NextResponse.json({
    document: getDocumentById(user.id, id),
    extracted,
  });
}
