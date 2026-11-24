import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listUserActivity } from "@/lib/documents";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all";
  const search = (searchParams.get("search") || "").trim().toLowerCase();

  let items = listUserActivity(user.id, 150);
  if (type !== "all") {
    items = items.filter((item) => item.entity_type === type);
  }
  if (search) {
    items = items.filter((item) =>
      `${item.action} ${item.entity_name || ""} ${item.details}`
        .toLowerCase()
        .includes(search)
    );
  }

  return NextResponse.json({ activities: items });
}
