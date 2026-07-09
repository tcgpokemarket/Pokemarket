export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo") ?? "/dashboard";
  return Response.redirect(new URL(redirectTo, url.origin));
}
