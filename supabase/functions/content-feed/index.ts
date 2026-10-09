// Orbit content processor — Supabase Edge Function.
// Server-side only. Never expose an AI API key to the browser.
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json","Cache-Control":"public, max-age=300"};
const hn="https://hacker-news.firebaseio.com/v0";
const patterns=[
["Health & Science",/\b(cancer|clinical|medicine|patient|disease|health|exercise|study|research|biology|physics|science)\b/i],
["Gaming",/\b(gaming|game|unity|unreal|steam|indie game)\b/i],
["Music",/\b(music|album|song|audio|recording|spotify)\b/i],
["AI & Robotics",/\b(artificial intelligence|\bAI\b|LLM|robot|machine learning|neural|language model)\b/i],
["Business",/\b(funding|series [a-f]|acquisition|startup|company|merger|cloudflare|revenue)\b/i],
["Technology",/\b(programming|computer|software|javascript|typescript|browser|linux|chip|hardware|github|security)\b/i]
] as const;
const strip=(s:string)=>s.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const domain=(url:string)=>{try{return new URL(url).hostname}catch{return "news.ycombinator.com"}};
function classify(title:string,description:string){const text=title+" "+description;return patterns.find(([,regex])=>regex.test(text))?.[0]||"Other news"}
async function description(url:string){try{const r=await fetch("https://api.microlink.io?url="+encodeURIComponent(url),{signal:AbortSignal.timeout(6500)});if(!r.ok)return "";const j=await r.json();return strip(String(j?.data?.description||"")).slice(0,500)}catch{return ""}}
async function summarise(title:string,sourceText:string,apiKey:string){if(!apiKey||sourceText.length<80)return "";try{const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},body:JSON.stringify({model:Deno.env.get("ORBIT_SUMMARY_MODEL")||"gpt-4.1-mini",temperature:0.1,max_tokens:110,messages:[{role:"system",content:"Write one or two plain-language sentences (max 55 words) summarizing ONLY the provided publisher description. Do not add facts, dates, numbers, speculation or implications not in the description. No hype or marketing voice. If the description is insufficient, return exactly INSUFFICIENT."},{role:"user",content:"Headline: "+title+"\nPublisher description: "+sourceText}]})});if(!r.ok)return "";const j=await r.json();const answer=String(j?.choices?.[0]?.message?.content||"").trim();return answer==="INSUFFICIENT"?"":answer.slice(0,450)}catch{return ""}}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response(null,{headers:cors});if(req.method!=="GET")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers:cors});
try{const top=await fetch(hn+"/topstories.json");if(!top.ok)throw Error("HN unavailable");const ids=(await top.json() as number[]).slice(0,24);const raw=await Promise.all(ids.map(async id=>{try{const r=await fetch(hn+"/item/"+id+".json");return r.ok?await r.json():null}catch{return null}}));
const candidates=raw.filter(s=>s?.type==="story"&&s.title&&!s.deleted&&!s.dead).slice(0,12);
const aiKey=Deno.env.get("OPENAI_API_KEY")||"";
const posts=await Promise.all(candidates.map(async s=>{const url=typeof s.url==="string"&&/^https?:\/\//.test(s.url)?s.url:"https://news.ycombinator.com/item?id="+s.id;const meta=await description(url);const summary=await summarise(s.title,meta,aiKey);return {id:String(s.id),title:s.title,category:classify(s.title,meta),summary:summary||meta||null,summary_status:summary?"ai_source_based":meta?"publisher_description":"unavailable",source_name:domain(url),source_url:url,published_at:new Date(s.time*1000).toISOString(),image_url:null}}));
return new Response(JSON.stringify({posts,generated_at:new Date().toISOString()}),{headers:cors})}catch(e){return new Response(JSON.stringify({error:"Content service unavailable"}),{status:503,headers:cors})}});
