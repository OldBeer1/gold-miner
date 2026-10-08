"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,".."),config=require("../js/config.js"),hash=p=>crypto.createHash("sha256").update(fs.readFileSync(path.join(root,p))).digest("hex");
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name).replaceAll("\\","/")]);}
const files=[...fs.readdirSync(root).filter(p=>p.endsWith(".md")),...walk("docs").filter(p=>p.endsWith(".md"))],checks=[],anchors=new Map();
function headingSlug(s){return s.toLowerCase().replace(/<[^>]+>/g,"").replace(/[^\p{L}\p{N}_\-\s]/gu,"").trim().replace(/ /g,"-");}
for(const p of files){const text=fs.readFileSync(path.join(root,p),"utf8"),ids=new Set(),used=new Map();let fenced=false;for(const line of text.split(/\r?\n/)){if(/^\s*```/.test(line)){fenced=!fenced;continue;}if(fenced)continue;for(const m of line.matchAll(/<a\s+id="([^"]+)"/g))ids.add(m[1]);const m=line.match(/^#{1,6}\s+(.+?)(?:\s+#+)?$/);if(m){const base=headingSlug(m[1]),n=used.get(base)||0;used.set(base,n+1);ids.add(base+(n?"-"+n:""));}}assert.equal(fenced,false,`Unclosed code fence ${p}`);anchors.set(p,ids);}
let links=0,fragments=0;const failures=[],localOnlyReferences=[];
for(const p of files){const text=fs.readFileSync(path.join(root,p),"utf8");for(const m of text.matchAll(/!?\[[^\]\n]*\]\(([^\)\n]+)\)/g)){let target=m[1];if(/^(https?:|mailto:|data:)/i.test(target))continue;if(target.startsWith("<")&&target.endsWith(">"))target=target.slice(1,-1);const [file,...pieces]=target.split("#"),absolute=path.resolve(root,path.dirname(p),decodeURIComponent(file||path.basename(p))),relative=path.relative(root,absolute).replaceAll("\\","/");links++;if(!fs.existsSync(absolute)){
  // Historical links can name ignored, machine-local backups absent from a clone.
  if(p.startsWith("docs/history/")&&relative.startsWith("output/backups/")){localOnlyReferences.push({document:p,target:relative,status:"absent local-only historical backup; not a tracked project resource"});continue;}
  failures.push(`${p}: missing ${target}`);continue;
}if(pieces.length&&relative.endsWith(".md")){fragments++;const id=decodeURIComponent(pieces.join("#"));if(!anchors.get(relative)?.has(id))failures.push(`${p}: missing anchor ${relative}#${id}`);}}}
assert.deepEqual(failures,[],"Document links and anchors");checks.push(`${files.length} Markdown, ${links-localOnlyReferences.length} available local links and ${fragments} anchors valid; ${localOnlyReferences.length} absent local-only historical backup links reported separately`);
const html=fs.readFileSync(path.join(root,"index.html"),"utf8"),resources=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(p=>!p.startsWith("data:"));for(const p of resources)assert.ok(fs.existsSync(path.join(root,p)),`HTML resource ${p}`);
const runtime=["index.html","styles.css",...resources.filter(p=>p.endsWith(".js"))];assert.equal(new Set(runtime).size,10);assert.equal(config.version,"1.5.3");assert.equal(config.rulesVersion,"1.5.3");assert.equal(config.levels,undefined);checks.push("10 runtime files, HTML references, release/rules version and removed inactive config valid");
const packageScript=fs.readFileSync(path.join(root,"scripts/package-release.ps1"),"utf8");for(const p of runtime)assert.ok(packageScript.includes("'"+p+"'"),`Package includes ${p}`);checks.push("Player archive whitelist includes all runtime files");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"output/playwright/survival-v150-cleanup-manifest.json"),"utf8"));
for(const p of manifest.deletedStepPaths)assert.equal(fs.existsSync(path.join(root,p)),false);
for(const item of manifest.archives){const [p,fragment]=item.destination.split("#");assert.ok(fs.existsSync(path.join(root,p)));if(fragment)assert.ok(anchors.get(p).has(fragment));if(item.archiveSha256)assert.equal(hash(p),item.archiveSha256);}
for(const item of manifest.protectedFiles)assert.equal(hash(item.path),item.sha256,`Protected historical file ${item.path}`);checks.push(`12 completed step files archived; ${manifest.protectedFiles.length} historical outputs/ZIPs retain exact SHA-256`);
const historical=JSON.parse(fs.readFileSync(path.join(root,"output/playwright/survival-v151-historical-manifest.json"),"utf8"));
for(const item of historical.files)assert.equal(hash(item.path),item.sha256,`Preserved v150 evidence ${item.path}`);checks.push(`${historical.files.length} v150 historical scripts/reports/images retain exact SHA-256`);
const previous=JSON.parse(fs.readFileSync(path.join(root,"output/playwright/survival-v152-historical-manifest.json"),"utf8"));
for(const item of previous.files)assert.equal(hash(item.path),item.sha256,`Preserved v151 evidence ${item.path}`);checks.push(`${previous.files.length} v151 historical scripts/reports/images retain exact SHA-256`);
const latest=JSON.parse(fs.readFileSync(path.join(root,"output/playwright/survival-v153-historical-manifest.json"),"utf8"));
for(const item of latest.files)assert.equal(hash(item.path),item.sha256,`Preserved v152 evidence ${item.path}`);checks.push(`${latest.files.length} v152 historical scripts/reports/images retain exact SHA-256`);
const report={version:config.version,result:"passed",method:"filesystem reference/anchor/HTML/package and protected-file hash checks; no gameplay claim",checks,markdownFiles:files.length,localLinks:links,localOnlyReferences,anchors:fragments,runtimeFiles:runtime,protectedFiles:manifest.protectedFiles.length};
fs.writeFileSync(path.resolve(root,process.argv[2]||"output/playwright/survival-v153-project-report.json"),JSON.stringify(report,null,2)+"\n");console.log(checks.join("\n"));
