import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }

  // Deletes expired rows in SQL and returns the image paths.
  const { data, error } = await db.rpc('purge_expired_certificate_data');
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const paths = (data ?? []) as string[];
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { error: rmErr } = await db.storage.from('certificate-logos').remove(chunk);
    if (rmErr) console.error('storage remove failed:', rmErr.message, chunk.length);
    else removed += chunk.length;
  }
  return Response.json({ images_scheduled: paths.length, images_removed: removed });
});
