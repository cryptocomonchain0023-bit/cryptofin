import { createClient } from '@/lib/supabase';

export async function getFreshAdminToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const nowSec = Math.floor(Date.now() / 1000);
  const needsRefresh =
    !session?.access_token ||
    (typeof session.expires_at === 'number' && session.expires_at - nowSec < 60);

  if (!needsRefresh && session?.access_token) {
    return session.access_token;
  }

  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session?.access_token ?? session?.access_token ?? null;
}

export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const buildHeaders = (accessToken: string | null): Headers => {
    const headers = new Headers(init.headers);
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    return headers;
  };

  const token = await getFreshAdminToken();
  let response = await fetch(input, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: buildHeaders(token),
  });

  if (response.status === 401) {
    const { data: refreshed } = await createClient().auth.refreshSession();
    const refreshedToken = refreshed.session?.access_token ?? null;
    if (refreshedToken) {
      response = await fetch(input, {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        headers: buildHeaders(refreshedToken),
      });
    }
  }

  return response;
}
