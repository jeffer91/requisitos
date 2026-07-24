"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const root=path.resolve(__dirname,"..");
const artifacts=path.join(root,"artifacts");
fs.mkdirSync(artifacts,{recursive:true});

const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
const commands=String(pkg.scripts&&pkg.scripts.test||"")
  .split(/\s*&&\s*/)
  .map((value)=>value.trim())
  .filter(Boolean);

if(!commands.length){
  console.error("No existen comandos dentro de scripts.test.");
  fs.writeFileSync(path.join(artifacts,"npm-test-failed.txt"),"package-test-empty\n");
  fs.writeFileSync(path.join(artifacts,"npm-test-detail.txt"),"scripts.test está vacío\n");
  process.exit(1);
}

let failed="";
let detail="";
for(const command of commands){
  console.log(`\n===== CI TEST: ${command} =====\n`);
  const result=spawnSync(command,{
    cwd:root,
    shell:true,
    encoding:"utf8",
    env:process.env,
    maxBuffer:20*1024*1024
  });
  const stdout=String(result.stdout||"");
  const stderr=String(result.stderr||"");
  if(stdout){process.stdout.write(stdout);}
  if(stderr){process.stderr.write(stderr);}
  const code=Number.isInteger(result.status)?result.status:1;
  if(code!==0){
    failed=command;
    const lines=(stderr+"\n"+stdout)
      .split(/\r?\n/)
      .map((line)=>line.trim())
      .filter(Boolean);
    detail=lines.find((line)=>/^\d+\.\s/.test(line))
      || lines.find((line)=>/ERROR|FALLO|Error|fall/i.test(line))
      || lines[lines.length-1]
      || "Fallo sin detalle";
    console.error(`\nFAILED_SCRIPT=${command}`);
    console.error(`FAILED_DETAIL=${detail}\n`);
    break;
  }
}

fs.writeFileSync(path.join(artifacts,"npm-test-failed.txt"),failed?`${failed}\n`:"\n");
fs.writeFileSync(path.join(artifacts,"npm-test-detail.txt"),detail?`${detail}\n`:"\n");

if(failed){process.exit(1);}
console.log(`\nSUITE COMPLETA APROBADA: ${commands.length} comandos.\n`);
