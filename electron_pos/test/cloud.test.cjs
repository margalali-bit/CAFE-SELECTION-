const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const {PGlite}=require('@electric-sql/pglite');
test('Supabase schema, device deduplication, tenant separation and MFA owner policies',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid primary key);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.uid',true),'')::uuid $$;CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('aal',current_setting('test.aal',true)) $$;GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;`);
 await db.exec(readFileSync('../supabase/migrations/202611160001_cafe.sql','utf8'));
 const owner='00000000-0000-4000-8000-000000000001',deviceUser='00000000-0000-4000-8000-000000000002',stranger='00000000-0000-4000-8000-000000000003',cafe='00000000-0000-4000-8000-000000000010',device='00000000-0000-4000-8000-000000000020',event='00000000-0000-4000-8000-000000000030';
 await db.exec(`INSERT INTO auth.users VALUES('${owner}'),('${deviceUser}'),('${stranger}');INSERT INTO public.cafes VALUES('${cafe}','Cafe');INSERT INTO public.cafe_members VALUES('${cafe}','${owner}');INSERT INTO public.devices VALUES('${device}','${cafe}','${deviceUser}');`);
 const identity=async(id,aal='aal1')=>{await db.exec(`RESET ROLE;SELECT set_config('test.uid','${id}',false);SELECT set_config('test.aal','${aal}',false);SET ROLE authenticated;`);};
 const snapshot={orders:[],products:[],shifts:[],customers:[],debt_payments:[],expenses:[],settings:{},users:[]};
 const ingest=()=>db.query('SELECT public.ingest_snapshot($1,$2,$3,1,$4,$5::jsonb)',[cafe,device,event,'order.created',JSON.stringify(snapshot)]);
 await identity(stranger);await assert.rejects(ingest(),/Device access denied/);
 await identity(deviceUser);await ingest();await ingest();
 const batchEvent='00000000-0000-4000-8000-000000000031';const batch=()=>db.query('SELECT public.ingest_batch($1,$2,$3::jsonb,2,$4::jsonb)',[cafe,device,JSON.stringify([{event_id:batchEvent,seq:2,kind:'expense.created'}]),JSON.stringify(snapshot)]);await batch();await batch();
 assert.equal((await db.query('SELECT * FROM public.cafe_state')).rows.length,0);
 await assert.rejects(()=>db.exec("INSERT INTO public.commands(cafe_id,device_id,kind,payload) VALUES('"+cafe+"','"+device+"','settings','{}')"),/row-level security/);
 await identity(owner);assert.equal((await db.query('SELECT * FROM public.cafe_state')).rows.length,0);
 await identity(owner,'aal2');assert.equal((await db.query('SELECT * FROM public.cafe_state')).rows.length,1);
 await db.query("INSERT INTO public.commands(cafe_id,device_id,kind,payload) VALUES($1,$2,'settings','{}')",[cafe,device]);
 await assert.rejects(()=>db.exec("UPDATE public.cafe_state SET snapshot='{}'"),/permission denied/);
 await identity(stranger,'aal2');assert.equal((await db.query('SELECT * FROM public.cafe_state')).rows.length,0);assert.equal((await db.query('SELECT * FROM public.commands')).rows.length,0);
 await db.exec('RESET ROLE');assert.equal(Number((await db.query('SELECT count(*) n FROM public.sync_events')).rows[0].n),2);assert.equal(Number((await db.query('SELECT count(*) n FROM public.notification_jobs')).rows[0].n),1);
 }finally{await db.close();}
});
