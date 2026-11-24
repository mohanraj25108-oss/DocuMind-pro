import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listUserDocuments, listUserReminders } from "@/lib/documents";

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";
  const documents = listUserDocuments(user.id);
  const reminders = listUserReminders(user.id);

  if (format === "ics") {
    const events = documents
      .filter((d) => Boolean(d.expiry_date))
      .map((d) => {
        const ymd = d.expiry_date!.slice(0, 10).replace(/-/g, "");
        return [
          "BEGIN:VEVENT",
          `UID:documind-${d.id}@documind.local`,
          `DTSTART;VALUE=DATE:${ymd}`,
          `SUMMARY:${escapeIcs(`DocuMind Expiry: ${d.name}`)}`,
          `DESCRIPTION:${escapeIcs(
            `${d.category}${d.issuer ? ` | Issuer: ${d.issuer}` : ""}${
              d.policy_number ? ` | Ref: ${d.policy_number}` : ""
            }`
          )}`,
          "END:VEVENT",
        ].join("\r\n");
      });

    const icsBody = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//DocuMind//Expiry Calendar//EN",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    return new NextResponse(icsBody, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="documind-expiries.ics"',
      },
    });
  }

  return new NextResponse(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        account: { name: user.name, email: user.email },
        documents,
        reminders,
      },
      null,
      2
    ),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="documind-backup.json"',
      },
    }
  );
}
