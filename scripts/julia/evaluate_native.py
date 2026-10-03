"""Run the compiled native CLI against publisher parity and CrownKeep fixtures.
No downloads. Usage: python scripts/julia/evaluate_native.py ASSETS EXECUTABLE OUTPUT
"""
import sys,json,pathlib,subprocess,time,statistics,numpy as np
assets,executable,output=sys.argv[1:];root=pathlib.Path(__file__).resolve().parents[2]
parity=json.load(open(pathlib.Path(assets)/'parity-cases.json'));cases=json.load(open(root/'evals/julia/crownkeep.json'))
requests=[]
for row in parity:
 r=row['request'];requests.append({**r,'job':'parity','options':[{'id':str(i),'description':v} for i,v in enumerate(r['options'])]})
requests.extend(x['request'] for x in cases)
began=time.perf_counter();result=subprocess.run([executable,assets],input='\n'.join(json.dumps(x) for x in requests)+'\n',text=True,capture_output=True,check=True);elapsed=(time.perf_counter()-began)*1000
predictions=[json.loads(x) for x in result.stdout.splitlines()]
if len(predictions)!=len(requests):raise RuntimeError('incomplete native output')
parity_results=[]
for expected,actual in zip(parity,predictions):
 logits=np.array(expected['pytorch_logits']);prob=np.exp(logits-logits.max());prob/=prob.sum()
 parity_results.append({'match':actual.get('selected')==str(logits.argmax()),'maxProbabilityDelta':max(abs(actual['scores'][str(i)]-p) for i,p in enumerate(prob)) if 'scores' in actual else None})
case_results=[{**actual,'id':case['id'],'job':case['request']['job'],'expected':case['expected'],'correct':actual.get('selected')==case['expected']} for case,actual in zip(cases,predictions[len(parity):])]
report={'backend':'Rust ort 2.0.0-rc.10, ONNX Runtime CPU dynamic library','totalProcessMs':elapsed,'productionQualifiedJobs':[],'parity':{'matching':sum(x['match'] for x in parity_results),'total':len(parity_results),'maxProbabilityDelta':max(x['maxProbabilityDelta'] for x in parity_results),'medianMs':statistics.median(x['latencyMs'] for x in predictions[:len(parity)])},'accuracy':{'correct':sum(x['correct'] for x in case_results),'total':len(case_results)},'cases':case_results}
pathlib.Path(output).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='cases'},indent=2))
