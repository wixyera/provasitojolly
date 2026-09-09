import { jsonError, staffUser, supabaseFetch } from "../_supabase";

export async function POST(request: Request) {
  try {
    const context = await staffUser(request);
    const body = await request.json() as { email?: string; name?: string; role?: string };
    const email = body.email?.trim().toLowerCase() || "";
    const name = body.name?.trim() || "";
    const role = body.role === "staff" ? "staff" : "customer";
    if (!/^\S+@\S+\.\S+$/.test(email) || name.length < 2 || name.length > 120) {
      return Response.json({ error: "Inserisci un nome e un indirizzo email validi." }, { status: 400 });
    }

    const secret = context.config.secretKey;
    const invited = await supabaseFetch<{ user?: { id?: string } }>(context.config, "/auth/v1/admin/invite", {
      method: "POST",
      body: JSON.stringify({ email, data: { full_name: name } }),
    }, secret);
    const id = invited.user?.id;
    if (!id) throw new Error("Supabase non ha restituito l’utente invitato.");

    const profilePath = `/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`;
    const updated = await supabaseFetch<Array<{ id: string }>>(context.config, profilePath, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ full_name: name, email, role, is_blocked: false }),
    }, secret);
    if (!updated.length) {
      await supabaseFetch(context.config, "/rest/v1/profiles", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id, full_name: name, email, role, is_blocked: false }),
      }, secret);
    }
    await supabaseFetch(context.config, "/rest/v1/staff_audit", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ actor_id: context.user.id, action: "user_invited", target_id: id }),
    }, secret);
    return Response.json({ ok: true, id });
  } catch (error) {
    return jsonError(error);
  }
}
