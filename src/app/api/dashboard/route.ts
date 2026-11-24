import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/documents";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = getDashboardData(user.id);
  return NextResponse.json(data);
}
