import { NextResponse, type NextRequest } from "next/server";

const ADMIN_SESSION_COOKIE = "foundryjobs_admin_session";

export function middleware(request: NextRequest): NextResponse {
  if (request.cookies.get(ADMIN_SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/",
    "/sources/:path*",
    "/raw-posts/:path*",
    "/job-posts/:path*",
    "/generated-posts/:path*",
    "/approval-queue/:path*",
    "/publish-events/:path*",
    "/scheduler/:path*",
  ],
};
