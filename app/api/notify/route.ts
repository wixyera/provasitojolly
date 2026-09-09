import { currentUser, jsonError } from "../_supabase";
// Le email vengono accodate dalle transazioni SQL.
export async function POST(request: Request) {
 try { await currentUser(request); return Response.json({ok:true,queued:true}); }
 catch(error){return jsonError(error);}
}
