const fileEl = document.getElementById('file');
for (let i=0;i<n;i++) out[i] = flat[i*ch + c];
return out;
});
} else { // ch x n
const ch = d0, n = d1;
channels = Array.from({length: ch}, (_,i)=>`ch${i+1}`);
data = Array.from({length: ch}, (_,c)=>{
const out = new Float64Array(n);
for (let i=0;i<n;i++) out[i] = flat[c*n + i];
return out;
});
}
} else {
throw new Error('Unsupported rank');
}
return { meta: { name, fs, channels, nSamples: data[0].length }, data };
}


async function parseMATv5WithWorker(buf, name){
return new Promise((resolve, reject)=>{
const uid = Math.random().toString(36).slice(2);
const fs = Number(fsEl.value) || 250;
const handler = (e)=>{
const { type, payload, reqId, error } = e.data||{};
if (reqId !== uid) return;
worker.removeEventListener('message', handler);
if (type === 'mat_parsed') resolve(payload);
else reject(new Error(error||'MAT v5 parse failed'));
};
worker.addEventListener('message', handler);
worker.postMessage({ type: 'parse_mat_v5', reqId: uid, name, buf, fs }, [buf]);
});
}


function renderPanels(){
if (!signal?.data?.length){ panelsEl.innerHTML = '<p style="padding:12px">ابتدا فایل سیگنال را بارگذاری کنید.</p>'; return; }
panelsEl.innerHTML = '';
const filters = [
{ key:'dc', title:'حذف DC', params:{} },
{ key:'detrend', title:'Detrend', params:{} },
{ key:'ma', title:'Moving Average', params:{ win_ms:200 } },
{ key:'median', title:'Median', params:{ win_ms:200 } },
{ key:'savgol', title:'Savitzky-Golay', params:{ win:11, poly:3 } },
{ key:'butter_lp', title:'Butter LP', params:{ fc:40, order:4 } },
{ key:'butter_hp', title:'Butter HP', params:{ fc:0.5, order:2 } },
{ key:'notch', title:'Notch 50/60Hz', params:{ f0:50, Q:35 } },
{ key:'wavelet', title:'Wavelet Denoise', params:{ wavelet:'db4', level:4 } }
];
for (const f of filters){
const node = document.getElementById('panel-tpl').content.cloneNode(true);
node.querySelector('h3').textContent = f.title;
node.querySelector('.params').textContent = JSON.stringify(f.params);
panelsEl.appendChild(node);
}
worker.postMessage({ type:'process_all', signal });
}


worker.onmessage = (e)=>{
const { results } = e.data||{};
if (!results) return;
const raw = signal.data[0];
const panels = panelsEl.querySelectorAll('.panel');
const keys = Object.keys(results);
keys.forEach((k, idx)=>{
const y = Array.from(results[k]);
const x = Array.from({length:y.length}, (_,i)=> i/signal.meta.fs);
const plotDiv = panels[idx].querySelector('.plot');
Plotly.newPlot(plotDiv,[{x, y: Array.from(raw), name:'Raw'},{x, y, name:k}],{margin:{l:20,r:10,t:10,b:20}});
});
};
