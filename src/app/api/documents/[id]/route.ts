import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteDocumentRecord,
  getDocumentById,
  listUserReminders,
  updateDocumentRecord,
} from "@/lib/documents";
import { isValidCategory } from "@/lib/constants";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const document = getDocumentById(user.id, id);
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const reminders = listUserReminders(user.id).filter((r) => r.document_id === id);
  return NextResponse.json({ document, reminders });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const body = await request.json();

    if (body?.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json(
        { error: "Document name cannot be empty." },
        { status: 400 }
      );
    }

    const parsedAmount =
      body?.amount === null || body?.amount === ""
        ? null
        : body?.amount !== undefined
          ? Number.parseFloat(String(body.amount))
          : undefined;

    const tags = Array.isArray(body?.tags)
      ? body.tags.map(String)
      : typeof body?.tags === "string"
        ? body.tags
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined;

    const updated = updateDocumentRecord(user.id, id, {
      name: body?.name !== undefined ? String(body.name) : undefined,
      category:
        body?.category && isValidCategory(String(body.category))
          ? body.category
          : undefined,
      issuer: body?.issuer !== undefined ? String(body.issuer) : undefined,
      purchase_date:
        body?.purchase_date !== undefined
          ? String(body.purchase_date || "").trim() || null
          : undefined,
      expiry_date:
        body?.expiry_date !== undefined
          ? String(body.expiry_date || "").trim() || null
          : undefined,
      warranty_duration:
        body?.warranty_duration !== undefined
          ? String(body.warranty_duration)
          : undefined,
      policy_number:
        body?.policy_number !== undefined ? String(body.policy_number) : undefined,
      amount:
        parsedAmount === undefined
          ? undefined
          : parsedAmount !== null && Number.isFinite(parsedAmount)
            ? parsedAmount
            : null,
      currency: body?.currency !== undefined ? String(body.currency) : undefined,
      notes: body?.notes !== undefined ? String(body.notes) : undefined,
      tags,
    });

    if (!updated) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    return NextResponse.json({ document: updated });
  } catch {
    return NextResponse.json(
      { error: "Failed to update document." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = deleteDocumentRecord(user.id, id);
  if (!deleted) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
