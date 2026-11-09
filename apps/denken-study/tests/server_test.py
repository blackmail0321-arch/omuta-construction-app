import importlib.util,json,os,threading,urllib.request,urllib.error,unittest
from unittest.mock import patch
from io import BytesIO
from pathlib import Path
spec=importlib.util.spec_from_file_location('appserver',Path(__file__).resolve().parents[1]/'server.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
class FakeResponse(BytesIO):
 status=200
 def __enter__(self):return self
 def __exit__(self,*args):self.close()
class TestGateway(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.http=s.ThreadingHTTPServer(('127.0.0.1',0),s.Handler);threading.Thread(target=cls.http.serve_forever,daemon=True).start();cls.base=f'http://127.0.0.1:{cls.http.server_port}'
 @classmethod
 def tearDownClass(cls):cls.http.shutdown();cls.http.server_close()
 def req(self,path,body=None,origin=None):
  h={'Content-Type':'application/json'}
  if origin is not None:h['Origin']=origin
  r=urllib.request.Request(self.base+path,data=json.dumps(body).encode() if body is not None else None,headers=h)
  try:
   with urllib.request.urlopen(r) as res:return res.status,json.load(res)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
 def test_01_unconfigured(self):
  with patch.dict(os.environ,{},clear=True):
   self.assertFalse(self.req('/api/status')[1]['aiConfigured']);self.assertEqual(self.req('/api/explain',{'qid':'2026-theory-1','question':'説明してください'},self.base)[0],503)
 def test_02_cross_origin(self):self.assertEqual(self.req('/api/explain',{},'https://example.com')[0],403)
 def test_03_payload(self):
  real=urllib.request.urlopen;captured=[]
  def remote(req,*a,**kw):
   if isinstance(req,urllib.request.Request) and req.full_url=='https://api.openai.com/v1/responses':
    d=json.loads(req.data);captured.append(d);return FakeResponse(json.dumps({'output':[{'content':[{'type':'output_text','text':'接続処理のテスト応答'}]}]}).encode())
   return real(req,*a,**kw)
  with patch.dict(os.environ,{'DENKEN_AI_KEY':'test-only-not-a-real-key'}),patch('urllib.request.urlopen',remote):
   code,d=self.req('/api/explain',{'qid':'2026-theory-1','question':'なぜこの式を使いますか'},self.base);self.assertEqual(code,200);self.assertEqual(d['text'],'接続処理のテスト応答');self.assertFalse(captured[0]['store']);self.assertTrue(any(c['type']=='input_image' for c in captured[0]['input'][0]['content']))
 def test_05_ai_connection_check(self):
  real=urllib.request.urlopen
  def remote(req,*a,**kw):
   if isinstance(req,urllib.request.Request) and req.full_url=='https://api.openai.com/v1/models':return FakeResponse(b'{"data":[]}')
   return real(req,*a,**kw)
  with patch.dict(os.environ,{'DENKEN_AI_KEY':'test-only-not-a-real-key'}),patch('urllib.request.urlopen',remote):
   code,d=self.req('/api/ai/check',{},self.base);self.assertEqual(code,200);self.assertTrue(d['ok'])
 def test_06_key_configuration_is_ephemeral(self):
  real=urllib.request.urlopen;key='sk-test-not-a-real-key-1234567890'
  def remote(req,*a,**kw):
   if isinstance(req,urllib.request.Request) and req.full_url.startswith('https://api.openai.com/v1/models/'):
    return FakeResponse(b'{"id":"gpt-5-mini"}')
   return real(req,*a,**kw)
  with patch.dict(os.environ,{},clear=True),patch('urllib.request.urlopen',remote):
   code,d=self.req('/api/ai/configure',{'apiKey':key,'model':'gpt-5-mini'},self.base);self.assertEqual(code,200);self.assertTrue(self.req('/api/status')[1]['aiConfigured']);self.assertNotIn(key,json.dumps(d))
   code,_=self.req('/api/ai/configure',{'apiKey':'bad','model':'x'},self.base);self.assertEqual(code,400);self.assertEqual(os.environ.get('DENKEN_AI_KEY'),key)
   code,_=self.req('/api/ai/disconnect',{},self.base);self.assertEqual(code,200);self.assertNotIn('DENKEN_AI_KEY',os.environ)
 def test_07_rejected_key_keeps_previous(self):
  real=urllib.request.urlopen
  def remote(req,*a,**kw):
   if isinstance(req,urllib.request.Request) and req.full_url.startswith('https://api.openai.com/'):
    raise urllib.error.HTTPError(req.full_url,401,'Unauthorized',{},None)
   return real(req,*a,**kw)
  with patch.dict(os.environ,{'DENKEN_AI_KEY':'previous-test-only'}),patch('urllib.request.urlopen',remote):
   code,d=self.req('/api/ai/configure',{'apiKey':'sk-test-not-a-real-key-1234567890','model':'gpt-5-mini'},self.base);self.assertEqual(code,502);self.assertEqual(os.environ['DENKEN_AI_KEY'],'previous-test-only')
 def test_08_key_configuration_rejects_other_origins(self):
  self.assertEqual(self.req('/api/ai/configure',{'apiKey':'sk-test-not-a-real-key-1234567890'},'https://example.com')[0],403)
 def test_04_private_files(self):
  for path in ['/server.py','/assets/../server.py','/data/bank.json']:
   try:urllib.request.urlopen(self.base+path);self.fail(path)
   except urllib.error.HTTPError as e:self.assertEqual(e.code,404)
if __name__=='__main__':unittest.main()
