const ALLOWED_ORIGINS = [
  'https://synapse-notes.vercel.app',
  'http://localhost:5173',
  'http://localhost:1420',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
]

export function getCorsHeaders(req?: Request) {
  const origin = req?.headers?.get('origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// Backwards compatible export for existing edge functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
