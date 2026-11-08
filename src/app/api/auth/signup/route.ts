import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, fullName, phone } = body;

    const computedFullName = (fullName || `${firstName || ''} ${lastName || ''}`).trim();

    // 1. Initialize Admin Client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 2. Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      // Check if user is actually confirmed in auth.users
      try {
        const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(existingUser.id);
        if (authUser && !authUser.email_confirmed_at) {
          // User attempted signup earlier but never confirmed email (e.g. OTP crash or timeout).
          // Safely remove the stale unconfirmed user so they can have a fresh start!
          await supabaseAdmin.from('profiles').delete().eq('id', existingUser.id);
          await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
        } else {
          return NextResponse.json({ error: "This email is already linked to an account." }, { status: 400 });
        }
      } catch (checkErr) {
        console.error("User status check error:", checkErr);
        return NextResponse.json({ error: "This email is already linked to an account." }, { status: 400 });
      }
    }

    // 3. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: computedFullName,
          first_name: firstName || '',
          last_name: lastName || '',
          phone: phone || ''
        },
      },
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        // Also check if there's an unconfirmed auth user without profile
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const stale = users.find(u => u.email?.toLowerCase() === email.toLowerCase() && !u.email_confirmed_at);
        if (stale) {
          await supabaseAdmin.auth.admin.deleteUser(stale.id);
          await supabaseAdmin.from('profiles').delete().eq('id', stale.id);
          
          // Retry signup once
          const { data: retryData, error: retryErr } = await supabaseAdmin.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: computedFullName,
                first_name: firstName || '',
                last_name: lastName || '',
                phone: phone || ''
              }
            }
          });
          if (retryErr) throw retryErr;
          if (retryData.user) {
            await supabaseAdmin.from('profiles').insert({
              id: retryData.user.id,
              email: email,
              full_name: computedFullName,
              first_name: firstName || null,
              last_name: lastName || null,
              phone: phone || null
            });
            return NextResponse.json({ success: true, userId: retryData.user.id });
          }
        }
        return NextResponse.json({ error: "User already exists. Please log in." }, { status: 400 });
      }
      throw authError;
    }

    if (!authData.user) throw new Error("User creation failed");
    const userId = authData.user.id;

    // 4. Create Profile
    await supabaseAdmin.from('profiles').insert({
      id: userId,
      email: email,
      full_name: computedFullName,
      first_name: firstName || null,
      last_name: lastName || null,
      phone: phone || null
    });

    return NextResponse.json({ success: true, userId });

  } catch (error: any) {
    console.error("Signup API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
