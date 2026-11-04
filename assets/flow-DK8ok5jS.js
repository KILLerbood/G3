const b={quote:["عرض السعر","Quote"],contract:["العقد","Contract"],invoice:["الفاتورة","Invoice"],payment:["الدفع","Payment"]};function h(t,n,d){const o=d.filter(i=>i.status!=="ملغية"&&(!t||i.quoteId===t.id)),s=t?.status==="اتوافق عليه",e=t&&["اترفض","انتهى"].includes(t.status),a=n?.status==="signed",c=o.some(i=>!["مجدولة","مسودة"].includes(i.status)),r=o.length>0&&o.every(i=>i.status==="مدفوعة");let l="quote";s&&(l=a?c?r?"done":"payment":"invoice":"contract");const m=["quote","contract","invoice","payment"],f=l==="done"?4:m.indexOf(l);return{at:l,steps:m.map((i,u)=>({key:i,state:e?u===0?"blocked":"todo":u<f?"done":u===f?"current":"todo"}))}}const p=(t,n)=>{const d=Date.parse(t);return isNaN(d)?0:Math.max(0,Math.floor((n-d)/864e5))},w={current:["لسه مستحقتش","Not due"],d1_30:["1–30 يوم","1–30 days"],d31_60:["31–60 يوم","31–60 days"],d61_90:["61–90 يوم","61–90 days"],d90:["أكتر من 90","90+ days"]};function g(t,n){const o=["current","d1_30","d31_60","d61_90","d90"].map(e=>({key:e,total:0,count:0,items:[]}));t.filter(e=>["اتبعت","مدفوعة جزئيًا"].includes(e.status)&&(e.balance??e.amount)>0).forEach(e=>{const a=p(e.dueDate,n),c=a===0?0:a<=30?1:a<=60?2:a<=90?3:4,r=o[c];r.total+=e.balance??e.amount,r.count++,r.items.push({...e,days:a})}),o.forEach(e=>e.items.sort((a,c)=>c.days-a.days));const s=o.reduce((e,a)=>e+a.total,0);return{buckets:o,total:s,overdue:s-o[0].total}}const y=[{id:"wa-before",channel:"wa",tone:"before",name:["قبل الميعاد (واتساب)","Before due (WhatsApp)"],body:`أهلًا {{الاسم}} 👋
بفكّرك إن فاتورة {{الفاتورة}} بمبلغ {{المبلغ}} ميعادها {{الاستحقاق}}.
تقدر تشوفها وتحمّلها من هنا: {{الرابط}}
لو محتاج أي حاجة أنا موجود. {{المرسل}}`},{id:"wa-friendly",channel:"wa",tone:"friendly",name:["تذكير ودّي (واتساب)","Friendly reminder (WhatsApp)"],body:`أهلًا {{الاسم}}، إزيك؟
حبيت أفكّرك بفاتورة {{الفاتورة}} ({{المبلغ}}) اللي كان ميعادها {{الاستحقاق}}، فاتت بـ {{الأيام}} يوم.
لو الدفعة اتحولت ابعتلي صورة التحويل وأنا أسجلها فورًا 🙏
{{الرابط}}`},{id:"wa-firm",channel:"wa",tone:"firm",name:["متابعة جادة (واتساب)","Firm follow-up (WhatsApp)"],body:`أهلًا {{الاسم}}،
فاتورة {{الفاتورة}} بمبلغ {{المبلغ}} متأخرة {{الأيام}} يوم. محتاجين نقفلها الأسبوع ده عشان الشغل يكمل من غير توقف.
ممكن تقولي ميعاد التحويل المتوقع؟
{{الرابط}}`},{id:"wa-final",channel:"wa",tone:"final",name:["آخر تذكير (واتساب)","Final notice (WhatsApp)"],body:`أهلًا {{الاسم}}،
ده آخر تذكير بفاتورة {{الفاتورة}} ({{المبلغ}}) المتأخرة {{الأيام}} يوم.
لو مفيش تحويل خلال 3 أيام، هنضطر نوقف الخدمة مؤقتًا لحد السداد. يهمنا نكمل مع {{النشاط}}، فكلمني لو فيه أي ظرف ونتفق سوا.
{{المرسل}}`},{id:"em-friendly",channel:"email",tone:"friendly",name:["تذكير ودّي (إيميل)","Friendly reminder (email)"],subject:"تذكير بفاتورة {{الفاتورة}} · {{النشاط}}",body:`أهلًا {{الاسم}}،

تذكير بسيط بفاتورة {{الفاتورة}} بمبلغ {{المبلغ}}، وكان ميعاد استحقاقها {{الاستحقاق}}.
تقدر تراجع الفاتورة وتحمّل نسخة PDF من الرابط:
{{الرابط}}

لو الدفعة اتحولت خلاص، رد على الإيميل ده برقم التحويل ونسجلها.

تحياتي،
{{المرسل}}`},{id:"em-firm",channel:"email",tone:"firm",name:["متابعة جادة (إيميل)","Firm follow-up (email)"],subject:"فاتورة {{الفاتورة}} متأخرة {{الأيام}} يوم",body:`أهلًا {{الاسم}}،

فاتورة {{الفاتورة}} بمبلغ {{المبلغ}} متأخرة {{الأيام}} يوم عن ميعادها ({{الاستحقاق}}).
ياريت تأكدلنا ميعاد التحويل خلال يومين عشان نخطط الشغل الجاي لـ {{النشاط}}.

{{الرابط}}

تحياتي،
{{المرسل}}`}];function F(t,n){const d=t<=0?"before":t<=14?"friendly":t<=45?"firm":"final";return(y.find(s=>s.channel===n&&s.tone===d)||y.find(s=>s.channel===n&&s.tone===(d==="final"?"firm":"friendly"))).id}function _(t,n){const d={الاسم:n.name.split(" ")[0]||n.name,النشاط:n.business,الفاتورة:n.invoice,المبلغ:n.amount,الاستحقاق:n.due,الأيام:String(n.days),الرابط:n.link,المرسل:n.sender},o=s=>s.replace(/\{\{([^}]+)\}\}/g,(e,a)=>a.trim()in d?d[a.trim()]:e);return{subject:o(t.subject||""),body:o(t.body)}}export{w as B,b as F,y as R,g as a,h as b,p as d,_ as f,F as s};
