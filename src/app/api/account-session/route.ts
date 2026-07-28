import { NextResponse } from "next/server";
import {
  ACCOUNT_SESSION_CACHE_CONTROL,
  publicAccountSessionError,
} from "@/modules/account-sessions/account-session-http";
import {
  requireAccountSession,
} from "@/modules/account-sessions/account-session-guard";

function sessionResponse(
  body:
    | {
        ok: true;
        account: {
          accountId: string;
          clientId: string;
          email: string;
        };
      }
    | {
        ok: false;
        error: string;
      },
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": ACCOUNT_SESSION_CACHE_CONTROL,
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET() {
  try {
    const principal = await requireAccountSession();
    return sessionResponse(
      {
        ok: true,
        account: principal,
      },
      200
    );
  } catch (error) {
    const publicError = publicAccountSessionError(error);
    return sessionResponse(publicError.body, publicError.status);
  }
}
