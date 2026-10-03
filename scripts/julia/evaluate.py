"""Development-only CPU parity/precision/CrownKeep eval. No downloads.
Requires pip install onnxruntime tokenizers onnx onnxconverter-common.
Usage: python scripts/julia/evaluate.py ASSET_DIR --output REPORT [--precision fp32|fp16|int8]
Python is never a CrownKeep installation dependency.
"""
import argparse, json, time, statistics, pathlib, platform
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer
p=argparse.ArgumentParser();p.add_argument('assets');p.add_argument('--output',required=True);p.add_argument('--precision',choices=['fp32','fp16','int8'],default='fp32');a=p.parse_args()
root=pathlib.Path(a.assets); tokenizer=Tokenizer.from_file(str(root/'tokenizer.json'))
def encode(row):
 options=row['options']; state=row['state']; question=row['question']; kind=row.get('type','choice')
 if len(options)<2 or len(options)>20 or any('<mask>' in x for x in [state,question,*options]): raise ValueError('strict contract')
 tok=lambda x: tokenizer.encode(x,add_special_tokens=False).ids
 head=tok(f'{kind} question: {question}'); opts=[tok(' '+x) for x in options]
 if any(len(x)>48 for x in opts): raise ValueError('option overflow')
 budget=512-sum(len(x)+1 for x in opts)
 if len(head)>budget: raise ValueError('head overflow')
 ids=[2,*head,1];markers=[]
 for option in opts: markers.append(len(ids)); ids.extend([4,*option])
 ids.append(1); context=tok(state)
 if len(ids)+len(context)+1>1024: raise ValueError('state overflow')
 ids.extend([*context,1]); length=(len(ids)+7)//8*8; count=len(ids)
 return {'input_ids':np.array([ids+[0]*(length-count)],dtype=np.int64),'attention_mask':np.array([[1]*count+[0]*(length-count)],dtype=np.int64),'marker_pos':np.array([markers],dtype=np.int64),'marker_mask':np.ones((1,len(options)),dtype=bool),'qtype':np.array([{'choice':0,'score':1,'noul':2}[kind]],dtype=np.int64)}
model=root/'model.onnx'
report={'precision':a.precision,'platform':platform.platform(),'ort':ort.__version__,'threads':4,'productionQualifiedJobs':[]}
try:
 if a.precision=='int8':
  from onnxruntime.quantization import quantize_dynamic, QuantType
  model=root/'model.int8.onnx';quantize_dynamic(str(root/'model.onnx'),str(model),weight_type=QuantType.QInt8,op_types_to_quantize=['MatMul'],use_external_data_format=True)
 if a.precision=='fp16':
  import onnx
  from onnxconverter_common import float16
  model=root/'model.fp16.onnx'; converted=float16.convert_float_to_float16(onnx.load(str(root/'model.onnx')),keep_io_types=True);onnx.save_model(converted,str(model),save_as_external_data=True,all_tensors_to_one_file=True,location='model.fp16.onnx.data',size_threshold=1024)
 opts=ort.SessionOptions();opts.intra_op_num_threads=4
 began=time.perf_counter(); session=ort.InferenceSession(str(model),opts,providers=['CPUExecutionProvider']);report['loadMs']=(time.perf_counter()-began)*1000
 def run(row):
  began=time.perf_counter(); logits=session.run(['logits'],encode(row))[0].reshape(-1).astype(float); latency=(time.perf_counter()-began)*1000
  probs=np.exp(logits-logits.max());probs/=probs.sum();return logits,probs,latency
 run({'state':'','question':'Ready?','options':['Yes','No']})
 parity=[]
 for case in json.load(open(root/'parity-cases.json')):
  logits,probs,ms=run(case['request']);ref=np.array(case['pytorch_logits']);parity.append({'match':int(logits.argmax())==int(ref.argmax()),'maxLogitDelta':float(abs(logits-ref).max()),'latencyMs':ms})
 report['parity']={'matching':sum(x['match'] for x in parity),'total':len(parity),'maxLogitDelta':max(x['maxLogitDelta'] for x in parity),'medianMs':statistics.median(x['latencyMs'] for x in parity),'p95Ms':float(np.percentile([x['latencyMs'] for x in parity],95))}
 cases=json.load(open(pathlib.Path(__file__).resolve().parents[2]/'evals/julia/crownkeep.json'));results=[]
 for case in cases:
  req=case['request'];row={**req,'options':[x['description'] for x in req['options']]};logits,probs,ms=run(row);selected=req['options'][int(probs.argmax())]['id'];results.append({'id':case['id'],'job':req['job'],'expected':case['expected'],'selected':selected,'correct':selected==case['expected'],'confidence':float(probs.max()),'scores':{x['id']:float(v) for x,v in zip(req['options'],probs)},'latencyMs':ms})
 report['cases']=results;report['accuracy']={'correct':sum(x['correct'] for x in results),'total':len(results)}
 report['confusions']=[x['id'] for x in results if not x['correct']]
 report['modelBytes']=model.stat().st_size+sum(x.stat().st_size for x in root.glob(model.name+'.data*'))
except Exception as e: report['error']=str(e)
pathlib.Path(a.output).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['cases']},indent=2))
