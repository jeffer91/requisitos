/* Fecha institucional de emisión: último día laborable del mes situado dos meses
 * después del cierre académico. Calendario nacional de Ecuador; la sede debe
 * incorporar sus feriados locales extraordinarios antes de legalizar.
 */
(function(w){"use strict";
const OFFICIAL_2026=new Set([
 "2026-01-01","2026-01-02","2026-02-16","2026-02-17","2026-04-03",
 "2026-05-01","2026-05-25","2026-08-10","2026-10-09",
 "2026-11-02","2026-11-03","2026-12-25"
]);
const OFFICIAL_2027=new Set([
 "2027-01-01","2027-02-08","2027-02-09","2027-03-26",
 "2027-04-30","2027-05-24","2027-08-09","2027-10-08",
 "2027-11-01","2027-11-02","2027-12-25"
]);
function pad(n){return String(n).padStart(2,"0");}
function iso(y,m,d){return y+"-"+pad(m)+"-"+pad(d);}
function parse(period){
 const raw=String(period||"").trim().replace(/_+/g,"__");
 const m=raw.match(/^(\d{4})-(\d{2})__(\d{4})-(\d{2})$/);
 if(!m)throw Error("El período académico no tiene formato AAAA-MM__AAAA-MM.");
 const y1=Number(m[1]),m1=Number(m[2]),y2=Number(m[3]),m2=Number(m[4]);
 if(!Number.isInteger(y1)||!Number.isInteger(y2)||m1<1||m1>12||m2<1||m2>12||
  (y2*12+m2)<(y1*12+m1)||(y2*12+m2)-(y1*12+m1)>24)throw Error("Las fechas de inicio y fin del período son inválidas.");
 return {startYear:y1,startMonth:m1,endYear:y2,endMonth:m2};
}
function easter(year){
 // Algoritmo gregoriano de Meeus/Jones/Butcher.
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
 const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7*7)%7;
 const m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
 return new Date(Date.UTC(year,Math.floor(n/31)-1,n%31+1));
}
function moved(year,month,day){
 const dt=new Date(Date.UTC(year,month-1,day)),week=dt.getUTCDay();
 // Regla general: sábado al viernes, domingo al lunes; martes al lunes, miércoles/jueves al viernes.
 if(week===6)dt.setUTCDate(dt.getUTCDate()-1);
 else if(week===0)dt.setUTCDate(dt.getUTCDate()+1);
 else if(week===2)dt.setUTCDate(dt.getUTCDate()-1);
 else if(week===3)dt.setUTCDate(dt.getUTCDate()+2);
 else if(week===4)dt.setUTCDate(dt.getUTCDate()+1);
 return iso(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate());
}
function holidays(year){
 if(year===2026)return new Set(OFFICIAL_2026);
 if(year===2027)return new Set(OFFICIAL_2027);
 // Reglas nacionales habituales para otros años, sujetas a decretos y feriados locales.
 const dates=new Set([iso(year,1,1),iso(year,5,1),iso(year,12,25)]);
 for(const [month,day] of [[5,24],[8,10],[10,9],[11,2],[11,3]])dates.add(moved(year,month,day));
 const easterDate=easter(year);
 for(const daysBefore of [48,47,2]){
  const date=new Date(easterDate.getTime()-daysBefore*86400000);
  dates.add(iso(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate()));
 }
 return dates;
}
function forPeriod(periodId,extraHolidays){
 const p=parse(periodId);
 const last=new Date(Date.UTC(p.endYear,p.endMonth+2,0));
 const targetY=last.getUTCFullYear(),targetM=last.getUTCMonth()+1;
 const official=holidays(targetY);
 const extra=new Set((extraHolidays||[]).map(x=>String(x).slice(0,10)));
 while(last.getUTCMonth()+1===targetM){
  const date=iso(last.getUTCFullYear(),last.getUTCMonth()+1,last.getUTCDate());
  if(last.getUTCDay()!==0&&last.getUTCDay()!==6&&!official.has(date)&&!extra.has(date)){
   return {date,year:String(targetY),month:pad(targetM),monthKey:targetY+"-"+pad(targetM),
    calendar:"EC",holidaysVerified:targetY===2026||targetY===2027};
  }
  last.setUTCDate(last.getUTCDate()-1);
 }
 throw Error("No se encontró día laborable en el mes previsto.");
}
function inEcuadorToday(now){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Guayaquil",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now||new Date());
 const find=x=>parts.find(p=>p.type===x)?.value;
 return [find("year"),find("month"),find("day")].join("-");
}
function mayRegister(periodId,now){
 const scheduled=forPeriod(periodId);
 return scheduled.holidaysVerified&&inEcuadorToday(now)>=scheduled.date;
}
w.ActasIssueDate=Object.freeze({parse,forPeriod,holidays,inEcuadorToday,mayRegister});
})(window);
