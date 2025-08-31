importScripts('https://cdn.jsdelivr.net/pyodide/v0.28.2/full/pyodide.js');
b,a = butter(4, 40/(fs/2), btype='low'); y['butter_lp'] = filtfilt(b,a,x)
b,a = butter(2, 0.5/(fs/2), btype='high'); y['butter_hp'] = filtfilt(b,a,x)
b,a = iirnotch(50/(fs/2), 35); y['notch'] = filtfilt(b,a,x)
coeffs = pywt.wavedec(x, 'db4', level=4)
sigma = np.median(np.abs(coeffs[-1]))/0.6745
T = sigma*np.sqrt(2*np.log(len(x)))
def soft(u,t): return np.sign(u)*np.maximum(np.abs(u)-t,0)
for i in range(1,len(coeffs)):
coeffs[i] = soft(coeffs[i], T)
y['wavelet'] = pywt.waverec(coeffs, 'db4')[:len(x)]
return y
`;
await self.pyodide.runPythonAsync(code);
const ch0 = Array.from(signal.data[0]);
const out = await self.pyodide.runPythonAsync(`process_all(${JSON.stringify(ch0)}, ${signal.meta.fs})`);
const result = {};
for (const k of out.keys()) result[k] = out.get(k).toJs({ create_proxies:false });
postMessage({ results: result });
} else if (type === 'parse_mat_v5'){
const { buf, name, reqId, fs } = e.data;
try {
self.pyodide.FS.writeFile('/tmp.mat', new Uint8Array(buf));
const code = `
import numpy as np
from scipy.io import loadmat


def pick_numeric(md):
cands = []
for k,v in md.items():
if k.startswith('__'): continue
if isinstance(v, np.ndarray) and np.issubdtype(v.dtype, np.number):
cands.append((k,v))
if not cands:
raise ValueError('no numeric array found')
cands.sort(key=lambda kv: kv[1].size, reverse=True)
key, arr = cands[0]
return key, arr


md = loadmat('/tmp.mat', squeeze_me=True, struct_as_record=False)
key, arr = pick_numeric(md)
shape = arr.shape
if arr.ndim == 1:
channels = ['ch1']
data = [arr.astype(float)]
elif arr.ndim == 2:
d0,d1 = shape
if d0 >= d1:
n, ch = d0, d1
data = [arr[:,i].astype(float) for i in range(ch)]
else:
ch, n = d0, d1
data = [arr[i,:].astype(float) for i in range(ch)]
channels = [f'ch{i+1}' for i in range(len(data))]
else:
raise ValueError('unsupported rank')
result = {
'meta': {'name': '${name}', 'fs': ${typeof fs==='number'? fs: 250}, 'channels': channels, 'nSamples': int(data[0].shape[0])},
'data': data
}
`;
const out = await self.pyodide.runPythonAsync(code);
const payload = { meta: out.get('meta').toJs(), data: [] };
const dataList = out.get('data');
for (let i=0;i<dataList.length;i++) payload.data.push(dataList.get(i).toJs({ create_proxies:false }));
postMessage({ type:'mat_parsed', payload, reqId });
} catch (err){
postMessage({ type:'mat_parsed_error', error: String(err), reqId });
}
}
};
