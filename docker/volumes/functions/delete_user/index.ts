import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.25.0';

serve(async (req: Request) => {
  const reqJson = await req.json();
  
  try {
   const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    
    
    const jwt = req.headers.get('Authorization')!.split(' ')[1]
    const { data } = await supabaseClient.auth.getUser(jwt);

    await supabaseClient.from('users').delete().eq("id", data.user.id);
    
    await supabaseClient.auth.admin.deleteUser(
      data.user.id
    );

    return new Response(JSON.stringify({ success: true  }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});