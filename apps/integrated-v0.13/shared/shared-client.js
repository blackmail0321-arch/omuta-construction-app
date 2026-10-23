/* Supabase REST/Auth client. Only public publishable/anon keys belong in browser config. */
(function(root){'use strict';
 class SharedError extends Error{constructor(message,kind='network'){super(message);this.kind=kind;}}
 class SharedClient{
  constructor(config={}){this.url=String(config.url||'').replace(/\/$/,'');this.key=String(config.publishableKey||'');this.session=null;this.refreshing=null;this.storageKey='omuta-shared-session:'+this.url;
   try{this.session=JSON.parse(root.sessionStorage.getItem(this.storageKey)||'null');}catch{}
  }
  configured(){return !!(this.url&&this.key);}
  requireConfig(){
   if(!this.configured())throw new SharedError('共有先が未設定です。管理者に接続設定を依頼してください。','config');
   let endpoint;try{endpoint=new URL(this.url);}catch{throw new SharedError('共有先の設定を確認してください。','config');}
   const loopback=h=>['localhost','127.0.0.1','[::1]'].includes(h);
   if(root.location?.protocol!=='https:'&&!loopback(root.location?.hostname))throw new SharedError('共有機能はHTTPSの画面から利用してください。ファイルを直接開く場合は端末内保存のみ利用できます。','config');
   if(endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/'||
    (endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&loopback(endpoint.hostname)&&loopback(root.location?.hostname))))throw new SharedError('共有先はHTTPSのプロジェクトURLを指定してください。','config');
   let publicKey=this.key.startsWith('sb_publishable_');
   if(!publicKey&&this.key.split('.').length===3){try{const payload=JSON.parse(root.atob(this.key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));publicKey=payload.role==='anon';}catch{}}
   if(!publicKey)throw new SharedError('公開用のpublishableキーまたはanonキーを使用してください。管理用キーは使用できません。','config');
  }
  store(session){this.session=session;try{if(session)root.sessionStorage.setItem(this.storageKey,JSON.stringify(session));else root.sessionStorage.removeItem(this.storageKey);}catch{}}
  async raw(path,{body,token,method='POST'}={}){
   this.requireConfig();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
   try{
    const response=await root.fetch(this.url+path,{method,headers:{apikey:this.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
    const data=await response.json().catch(()=>null);
    if(!response.ok){
     if((data?.code==='40001'||data?.code==='PT409'))throw new SharedError('他の端末で更新されています。共有版を確認してから取り込んでください。','conflict');
     if(response.status===401)throw new SharedError('ログインの有効期限が切れました。再度ログインしてください。','auth');
     if(response.status===403||data?.code==='42501')throw new SharedError('この操作の権限がありません。共有設定を確認してください。','permission');
     if(data?.code==='22023')throw new SharedError('入力内容または登録済みの共有相手を確認してください。','validation');
     throw new SharedError(path.startsWith('/auth/')?'ログイン情報を確認してください。':'共有処理に失敗しました。接続設定とデータベース設定を確認してください。','server');
    }
    return data;
   }catch(error){if(error instanceof SharedError)throw error;if(controller.signal.aborted)throw new SharedError('共有先の応答が20秒以内に完了しませんでした。保存の成否は再接続後に確認してください。端末内のデータは保持しています。','timeout');throw new SharedError('共有先との通信が途中で失敗しました。端末内のデータは保持しています。','network');}finally{clearTimeout(timer);}
  }
  async signIn(email,password){const data=await this.raw('/auth/v1/token?grant_type=password',{body:{email,password}});if(!data?.access_token||!data?.user?.id)throw new SharedError('ログインに失敗しました。','auth');this.store({...data,expires_at:data.expires_at||Date.now()/1000+(data.expires_in||3600)});return data.user;}
  async refresh(){if(this.refreshing)return this.refreshing;if(!this.session?.refresh_token)throw new SharedError('ログインしてください。','auth');
   this.refreshing=(async()=>{try{const data=await this.raw('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:this.session.refresh_token}});if(!data?.access_token)throw new SharedError('再度ログインしてください。','auth');this.store({...this.session,...data,expires_at:data.expires_at||Date.now()/1000+(data.expires_in||3600)});}catch(error){if(error.kind==='auth'||error.kind==='server'){this.store(null);throw new SharedError('ログインの有効期限が切れました。再度ログインしてください。','auth');}throw error;}finally{this.refreshing=null;}})();return this.refreshing;
  }
  async rpc(name,args={}){
   if(!this.session)throw new SharedError('ログインしてください。','auth');
   if(this.session.expires_at<Date.now()/1000+30)await this.refresh();
   try{return await this.raw('/rest/v1/rpc/'+name,{token:this.session.access_token,body:args});}catch(error){if(error.kind!=='auth')throw error;await this.refresh();return this.raw('/rest/v1/rpc/'+name,{token:this.session.access_token,body:args});}
  }
  async signOut(){const token=this.session?.access_token;this.store(null);if(token)try{await this.raw('/auth/v1/logout',{token});}catch{}}
  access(){return this.rpc('shared_access');}
  list(){return this.rpc('shared_list_projects');}
  get(id){return this.rpc('shared_get_project',{p_id:id});}
  status(id,month){return this.rpc('shared_get_status',{p_id:id,p_month:month});}
  save(id,localId,project,revision){return this.rpc('shared_save_project',{p_id:id||null,p_local_id:localId,p_project:project,p_expected_revision:revision??null});}
  grant(id,email,access){return this.rpc('shared_grant_member',{p_id:id,p_email:email,p_access:access});}
  revoke(id,email){return this.rpc('shared_revoke_member',{p_id:id,p_email:email});}
 }
 root.OmutaShared={SharedClient,SharedError};
})(typeof window==='undefined'?globalThis:window);
