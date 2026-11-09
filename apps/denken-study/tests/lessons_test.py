"""Check worked explanations against independent resistor-network calculations."""
from pathlib import Path
import json,random,unittest
ROOT=Path(__file__).resolve().parents[1]
def solve(edges,fixed):
 nodes=sorted(set(n for a,b,r,e in edges for n in [a,b])-set(fixed));index={n:i for i,n in enumerate(nodes)};n=len(nodes);m=[[0.0]*(n+1) for _ in range(n)]
 for a,b,r,emf in edges:
  g=1/r
  for p,q,e in [(a,b,emf),(b,a,-emf)]:
   if p in fixed:continue
   row=m[index[p]];row[index[p]]+=g;row[-1]-=e*g
   if q in fixed:row[-1]+=g*fixed[q]
   else:row[index[q]]-=g
 for i in range(n):
  pivot=max(range(i,n),key=lambda k:abs(m[k][i]));m[i],m[pivot]=m[pivot],m[i];den=m[i][i];assert abs(den)>1e-14;m[i]=[x/den for x in m[i]]
  for j in range(n):
   if j==i:continue
   factor=m[j][i];m[j]=[x-factor*y for x,y in zip(m[j],m[i])]
 return {**fixed,**{node:m[i][-1] for node,i in index.items()}}
def circuit(r1,r2,r3,lam,left,source_edge=None):
 edges=[('a','b',lam*r1,0),('b','i',r1,0),('i','d',r3,0),('d','e',lam*r3,0),('b','c',r2,0),('c','d',r2,0)]
 for (a,b),r in zip([('a','h'),('h','g'),('g','f'),('f','e'),('h','i'),('i','f')],left):edges.append((a,b,r,12 if source_edge==(a,b) else 0))
 return edges
class Lessons(unittest.TestCase):
 def test_unknown_left_resistors_do_not_change_theory1_result(self):
  rng=random.Random(17)
  for _ in range(30):
   r1,r2,r3=[rng.uniform(.5,10) for _ in range(3)];left=[rng.uniform(.4,20) for _ in range(6)]
   v=solve(circuit(r1,r2,r3,1,left),{'a':12,'e':0});i=(v['b']-v['c'])/r2
   self.assertAlmostEqual(i,12/(r1+4*r2+r3),places=10)
 def test_theory1_last_item_zero_current_for_left_source(self):
  for lam in [.25,1,2,4]:
   v=solve(circuit(2,3,4,lam,[1,2,3,4,5,6],('h','g')),{'a':0,'e':0});self.assertAlmostEqual((v['b']-v['c'])/3,0,places=10)
 def test_theory1_numerical_check(self):
  v=solve(circuit(1,1,1,1,[2,5,3,8,4,6]),{'a':12,'e':0});self.assertAlmostEqual(v['b']-v['c'],2,places=10)
 def test_machine2_limits(self):
  a,b=20/5,30/3;self.assertAlmostEqual(min(20/(a/(a+b)),30/(b/(a+b))),42);self.assertAlmostEqual(40*a/(a+b),80/7);self.assertGreater(4/(4+30/6),4/(4+30/3))
 def test_semiconductor_equilibrium(self):
  e,n,mu,field,thermal=1.602e-19,1e15,.1,2,.026;diffusion=mu*thermal;gradient=-n*field/thermal
  self.assertAlmostEqual(e*diffusion*gradient+e*n*mu*field,0,places=12)
 def test_lessons_match_source_items(self):
  bank={q['id']:q for q in json.loads((ROOT/'data/bank.json').read_text(encoding='utf-8'))['questions']};lessons=json.loads((ROOT/'data/lessons.json').read_text(encoding='utf-8'))
  self.assertEqual(len(lessons),4)
  for qid,l in lessons.items():
   self.assertEqual(len(l['answers']),len(bank[qid]['items']));self.assertGreaterEqual(len(l['panels']),6)
   for p in l['panels']:
    self.assertTrue(p['tell']);self.assertIsInstance(p['ask'],str)
    if p.get('check'):self.assertIn(p['check']['correct'],range(len(p['check']['options'])))
if __name__=='__main__':unittest.main()
