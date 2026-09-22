import {
  RegistrationError,
  requestRegistration,
} from "@/lib/auth/registration";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input))
      return Response.json(
        { error: "Invalid registration details." },
        { status: 400 },
      );
    await requestRegistration(input);
    return Response.json({
      message: "Account created. You can now sign in.",
    });
  } catch (error) {
    if (error instanceof RegistrationError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError)
      return Response.json(
        { error: "Invalid registration details." },
        { status: 400 },
      );
    return Response.json(
      { error: "We couldn't process your request. Please try again later." },
      { status: 503 },
    );
  }
}
