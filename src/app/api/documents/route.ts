import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { ensureUserSettings, getCurrentUser } from "@/lib/auth";
import {
  ACCEPTED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  isValidCategory,
  type DocumentCategory,
} from "@/lib/constants";
import { UPLOADS_DIR } from "@/lib/db";
import { processUploadedDocument } from "@/lib/document-processor";
import { createDocumentRecord, listUserDocuments } from "@/lib/documents";

function safeExtFromMime(mimeType: string, filename: string): string {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return ".jpg";
  const ext = path.extname(filename).toLowerCase();
  return /^\.[a-z0-9]{1,6}$/.test(ext) ? ext : ".bin";
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "all";
  const expiryStatus = searchParams.get("expiryStatus") || "all";
  const tag = searchParams.get("tag") || "all";
  const sortBy = (searchParams.get("sortBy") || "uploaded") as
    | "uploaded"
    | "purchase"
    | "expiry"
    | "name"
    | "amount";
  const sortDir = searchParams.get("sortDir") as "asc" | "desc" | null;

  const documents = listUserDocuments(user.id, {
    search,
    category,
    expiryStatus,
    tag,
    sortBy,
    sortDir: sortDir || undefined,
  });

  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    const settings = ensureUserSettings(user.id);

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      let filePathRel: string | null = null;
      let originalFilename: string | null = null;
      let mimeType: string | null = null;
      let fileSize = 0;
      let extractedText = String(formData.get("extracted_text") || "");
      let aiSummary = String(formData.get("ai_summary") || "");
      let extractionStatus = String(formData.get("extraction_status") || "processed");

      let autoMeta: Awaited<ReturnType<typeof processUploadedDocument>> | null = null;

      if (file instanceof File && file.size > 0) {
        const mime = file.type || "application/octet-stream";
        if (!ACCEPTED_UPLOAD_MIME_TYPES.has(mime)) {
          return NextResponse.json(
            {
              error:
                "Unsupported file format. Accepted formats: PDF, PNG, JPG, and WEBP.",
            },
            { status: 400 }
          );
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          return NextResponse.json(
            { error: "File exceeds the 15 MB size limit." },
            { status: 400 }
          );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const userUploadDir = path.join(UPLOADS_DIR, user.id);
        if (!fs.existsSync(userUploadDir)) {
          fs.mkdirSync(userUploadDir, { recursive: true });
        }

        const safeName = `${crypto.randomUUID()}${safeExtFromMime(mime, file.name)}`;
        fs.writeFileSync(path.join(userUploadDir, safeName), buffer);

        filePathRel = safeName;
        originalFilename = file.name;
        mimeType = mime;
        fileSize = file.size;

        if (!extractedText) {
          autoMeta = await processUploadedDocument({
            buffer,
            mimeType: mime,
            originalFilename: file.name,
            defaultCurrency: settings.currency,
            autoExtract: settings.auto_extract_on_upload,
          });
          extractedText = autoMeta.extractedText;
          if (!aiSummary) aiSummary = autoMeta.aiSummary;
          extractionStatus = autoMeta.extractionStatus;
        }
      }

      const rawName = String(formData.get("name") || "").trim();
      const name = rawName || autoMeta?.suggestedName || originalFilename || "Untitled Document";
      const rawCat = String(formData.get("category") || autoMeta?.category || "");
      const category: DocumentCategory = isValidCategory(rawCat)
        ? rawCat
        : "Other personal documents";

      const rawAmount = formData.get("amount");
      const parsedAmount =
        rawAmount !== null && String(rawAmount).trim() !== ""
          ? Number.parseFloat(String(rawAmount))
          : autoMeta?.amount ?? null;

      let tags: string[] = autoMeta?.tags || [];
      const rawTags = formData.get("tags");
      if (rawTags !== null) {
        try {
          const parsed = JSON.parse(String(rawTags));
          if (Array.isArray(parsed)) tags = parsed.map(String);
        } catch {
          tags = String(rawTags)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }

      const document = createDocumentRecord(user.id, {
        name,
        category,
        issuer: String(formData.get("issuer") ?? autoMeta?.issuer ?? ""),
        purchase_date:
          String(formData.get("purchase_date") || "").trim() ||
          autoMeta?.purchaseDate ||
          null,
        expiry_date:
          String(formData.get("expiry_date") || "").trim() ||
          autoMeta?.expiryDate ||
          null,
        warranty_duration: String(
          formData.get("warranty_duration") ?? autoMeta?.warrantyDuration ?? ""
        ),
        policy_number: String(
          formData.get("policy_number") ?? autoMeta?.policyNumber ?? ""
        ),
        amount: Number.isFinite(parsedAmount as number) ? parsedAmount : null,
        currency: String(
          formData.get("currency") || autoMeta?.currency || settings.currency
        ),
        notes: String(formData.get("notes") || ""),
        tags,
        file_path: filePathRel,
        original_filename: originalFilename,
        mime_type: mimeType,
        file_size: fileSize,
        extracted_text: extractedText,
        ai_summary: aiSummary,
        extraction_status: filePathRel ? extractionStatus : "manual",
      });

      return NextResponse.json({ document }, { status: 201 });
    }

    // JSON manual creation
    const body = await request.json();
    const name = String(body?.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Document name is required." },
        { status: 400 }
      );
    }

    const rawCat = String(body?.category || "");
    const category: DocumentCategory = isValidCategory(rawCat)
      ? rawCat
      : "Other personal documents";

    const parsedAmount =
      body?.amount !== null && body?.amount !== undefined && String(body.amount).trim() !== ""
        ? Number.parseFloat(String(body.amount))
        : null;

    const tags = Array.isArray(body?.tags)
      ? body.tags.map(String)
      : typeof body?.tags === "string"
        ? body.tags
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];

    const document = createDocumentRecord(user.id, {
      name,
      category,
      issuer: String(body?.issuer || ""),
      purchase_date: body?.purchase_date ? String(body.purchase_date).trim() : null,
      expiry_date: body?.expiry_date ? String(body.expiry_date).trim() : null,
      warranty_duration: String(body?.warranty_duration || ""),
      policy_number: String(body?.policy_number || ""),
      amount: Number.isFinite(parsedAmount as number) ? parsedAmount : null,
      currency: String(body?.currency || settings.currency),
      notes: String(body?.notes || ""),
      tags,
      extraction_status: "manual",
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to save document." },
      { status: 500 }
    );
  }
}
