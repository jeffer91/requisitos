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
  process.exit(1);
}

let failed="";
for(const command of commands){
  console.log(`\n===== CI TEST: ${command} =====\n`);
  const result=spawnSync(command,{
    cwd:root,
    shell:true,
    stdio:"inherit",
    env:process.env
  });
  const code=Number.isInteger(result.status)?result.status:1;
  if(code!==0){
    failed=command;
    console.error(`\nFAILED_SCRIPT=${command}\n`);
    break;
  }
}

fs.writeFileSync(
  path.join(artifacts,"npm-test-failed.txt"),
  failed?`${failed}\n`:"\n"
);

if(failed){process.exit(1);}
console.log(`\nSUITE COMPLETA APROBADA: ${commands.length} comandos.\n`);
