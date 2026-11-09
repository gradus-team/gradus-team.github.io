'use strict';
// Small DOM-stub test for the Antivirus ↔ Engine homepage switch.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class ClassList {
  constructor() { this.values = new Set(); }
  add(v) { this.values.add(v); }
  remove(v) { this.values.delete(v); }
  toggle(v, force) { if (force === undefined) force = !this.values.has(v); force ? this.values.add(v) : this.values.delete(v); return force; }
  contains(v) { return this.values.has(v); }
}
class Element {
  constructor(id) { this.id=id; this.hidden=false; this.value=''; this.innerText=''; this.textContent=''; this.style={}; this.attrs={}; this.classList=new ClassList(); this.listeners={}; this.dataset={}; }
  addEventListener(k,fn) { this.listeners[k]=fn; }
  setAttribute(k,v) { this.attrs[k]=v; }
  getAttribute(k) { return this.attrs[k] ?? null; }
}
const elements=new Map();
const document={
  body:{dataset:{}},
  getElementById(id) { if(!elements.has(id))elements.set(id,new Element(id)); return elements.get(id); },
  querySelectorAll(selector) { if(selector==='[data-mode-content]') return [this.getElementById('antivirusContent'),this.getElementById('engineContent')].map((el,i)=>{el.dataset.modeContent=i===0?'antivirus':'engine';return el;}); return []; },
  querySelector() { return new Element('query'); },
  addEventListener() {},
};
const windowMock={addEventListener(){},innerWidth:1280,scrollY:0};
const context={document,window:windowMock,location:{hash:''},history:{replaceState(){}},console,Math,Date,Intl,setTimeout:()=>1,clearTimeout(){}};
context.globalThis=context;
// Reflect the initial HTML attributes in the tiny DOM stub.
document.getElementById('engineContent').hidden=true;
document.getElementById('antivirusContent').hidden=false;
document.getElementById('engineFeature').hidden=true;
document.getElementById('antivirusFeature').hidden=false;
document.getElementById('modeAntivirus').classList.add('active');
document.getElementById('modeAntivirus').setAttribute('aria-pressed','true');
document.getElementById('modeEngine').setAttribute('aria-pressed','false');
const root=path.join(__dirname,'..','..','..','index.html');
const html=fs.readFileSync(root,'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script,'homepage inline script found');
vm.runInNewContext(script[1]+'\n;globalThis.__test={setSiteMode,refreshEnginePrice};',context,{timeout:10000,filename:'homepage-inline.js'});
context.__test.setSiteMode('engine');
assert.equal(document.getElementById('engineContent').hidden,false);
assert.equal(document.getElementById('antivirusContent').hidden,true);
assert.equal(document.body.dataset.siteMode,'engine');
assert.equal(document.getElementById('engineFeature').hidden,false);
assert.equal(document.getElementById('antivirusFeature').hidden,true);
assert.equal(document.getElementById('modeEngine').getAttribute('aria-pressed'),'true');
assert.equal(document.getElementById('modeAntivirus').getAttribute('aria-pressed'),'false');
context.__test.setSiteMode('antivirus');
assert.equal(document.getElementById('engineContent').hidden,true);
assert.equal(document.getElementById('antivirusContent').hidden,false);
assert.equal(document.body.dataset.siteMode,'antivirus');
assert.equal(document.getElementById('engineFeature').hidden,true);
assert.equal(document.getElementById('antivirusFeature').hidden,false);
assert.equal(document.getElementById('modeAntivirus').getAttribute('aria-pressed'),'true');
// Verify selected-product checkout behavior, not just the presence of its HTML nodes.
document.getElementById('engineBuyProduct').value='go';
document.getElementById('engineBuyDuration').value='3';
context.__test.refreshEnginePrice();
assert.equal(document.getElementById('engineSelectedTitle').textContent,'GradAI Go');
assert.ok(document.getElementById('engineSelectedDescription').textContent.includes('GradAI Go'));
assert.equal(document.getElementById('engineOrderTotal').textContent,'Итого к оплате: 249 ₽');
document.getElementById('engineBuyProduct').value='plus';
document.getElementById('engineBuyDuration').value='12';
context.__test.refreshEnginePrice();
assert.equal(document.getElementById('engineSelectedTitle').textContent,'GradAI Plus');
assert.equal(document.getElementById('engineOrderTotal').textContent.replace(/\u00a0/g,' '),'Итого к оплате: 1 299 ₽');
console.log('PASS: homepage Antivirus ↔ Engine switch and dynamic selected-product checkout behave correctly.');
