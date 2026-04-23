import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { action, userData, userId } = await req.json()

    // 1. LIST TEACHERS
    if (action === 'list') {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers()
      if (error) throw error
      
      // Filter for users with teacher role in metadata
      const teachers = data.users.filter(user => user.user_metadata?.role === 'teacher')
      return new Response(JSON.stringify({ teachers }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 2. CREATE TEACHER
    if (action === 'create') {
      const { email, password, fullName } = userData
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { 
          role: 'teacher', 
          full_name: fullName 
        }
      })
      if (error) throw error

      // Assign the 'teacher' role in the user_roles table
      if (data.user) {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .upsert({ user_id: data.user.id, role: 'teacher' }, { onConflict: 'user_id' })
        
        if (roleError) console.error('Error setting user role:', roleError)
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 3. DELETE TEACHER
    if (action === 'delete') {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    throw new Error('Invalid action')
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})