export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ 
    message: "Endpoint deshabilitado temporalmente",
    status: "ok"
  });
}

export async function POST() {
  return Response.json({ 
    message: "Endpoint deshabilitado temporalmente",
    status: "ok"
  });
}