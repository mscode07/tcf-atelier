import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({
      ok: false,
      error: "missing_environment_variables",
      missing: [
        ...(!url ? ["SUPABASE_URL"] : []),
        ...(!key ? ["SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY"] : []),
      ],
    }, { status: 503 });
  }

  try {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        error: "supabase_rejected_connection",
        supabaseStatus: response.status,
      }, { status: 502 });
    }

    return NextResponse.json({ ok: true, database: "connected" });
  } catch {
    return NextResponse.json({
      ok: false,
      error: "supabase_unreachable",
    }, { status: 502 });
  }
}
