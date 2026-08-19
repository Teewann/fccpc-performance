import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path  = req.nextUrl.pathname;
    const role  = token?.role as string;

    // Executive only
    if (path.startsWith("/executive")) {
      if (!["EXECUTIVE", "ADMIN"].includes(role)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Admin only - settings removed so all roles can access it
    if (path.startsWith("/users")) {
      if (role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // EVC Suite - Executive only, silent redirect
    if (path.startsWith("/vc9k2")) {
      if (role !== "EXECUTIVE") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // EVC API routes - Executive only
    if (
      path.startsWith("/api/vc9k2") ||
      path.startsWith("/api/evc-vault") ||
      path.startsWith("/api/evc-tasks")
    ) {
      if (role !== "EXECUTIVE") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    // Supervisor and above
    if (path.startsWith("/supervisor")) {
      const allowed = ["SUPERVISOR", "DIRECTOR", "HR", "ADMIN", "EXECUTIVE"];
      if (!allowed.includes(role)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/check-in/:path*",
    "/supervisor/:path*",
    "/departments/:path*",
    "/tasks/:path*",
    "/kpi/:path*",
    "/appraisals/:path*",
    "/ai-insights/:path*",
    "/reports/:path*",
    "/notifications/:path*",
    "/users/:path*",
    "/settings/:path*",
    "/staff-logs/:path*",
    "/leave/:path*",
    "/announcements/:path*",
    "/exams/:path*",
    "/intern/:path*",
    "/audit-trail/:path*",
    "/directory/:path*",
    "/vc9k2/:path*",
    "/api/vc9k2/:path*",
    "/api/evc-vault/:path*",
    "/api/evc-tasks/:path*",
  ],
};