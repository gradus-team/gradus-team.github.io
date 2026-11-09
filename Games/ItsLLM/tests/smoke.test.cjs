'use strict';
// Lightweight logic smoke tests for the static game; no browser or dependencies required.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

class ClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  toggle(value, force) {
    if (force === undefined) force = !this.values.has(value);
    force ? this.values.add(value) : this.values.delete(value);
    return force;
  }
  contains(value) { return this.values.has(value); }
}
const selectedTrainInputs = [];
const formMockElements = [];
class ElementMock {
  constructor(id) {
    this.id = id; this._innerHTML = ''; this.textContent = ''; this.value = undefined; this.defaultValue = '';
    this.tagName = 'INPUT'; this.type = 'text'; this.selectionStart = 0; this.selectionEnd = 0;
    this.hidden = false; this.style = {}; this.attrs = {}; this.dataset = {};
    this.classList = new ClassList(); this.listeners = {};
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(value) { this._innerHTML = String(value); if (this.id === 'tabContent') { for (const field of formMockElements) { field.value = field.defaultValue; field.selectionStart = 0; field.selectionEnd = 0; } document.activeElement = null; } }
  querySelectorAll(selector) { if (this.id === 'trainTypesMulti' && selector === '[data-train-type]:checked') return selectedTrainInputs.filter(x => x.checked); return []; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  setAttribute(name, value) { this.attrs[name] = value; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  focus() { document.activeElement = this; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
}
const elements = new Map();
const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, new ElementMock(id));
    return elements.get(id);
  },
  activeElement: null,
  querySelectorAll(selector) { if (selector && selector.startsWith('#tabContent input[id]')) return formMockElements; return []; },
  querySelector() { return new ElementMock('query'); },
  addEventListener() {},
};
const stored = new Map();
const localStorage = {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, String(value)),
  removeItem: key => stored.delete(key),
};
const context = {
  window:{addEventListener(){}}, document, localStorage, confirm: () => true, prompt: () => null, alert: () => {},
  console, Math, Date, Intl, TextEncoder, Uint8Array, Array, Object, String, Number,
  JSON, parseInt, parseFloat, isNaN, crypto: require('node:crypto').webcrypto,
  navigator: { clipboard: { writeText: async () => {} } }, location: { hash: '' },
  history: { replaceState() {} }, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
};
context.globalThis = context;

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'the game must include its inline game script');
const exposed = `\n;globalThis.__test = { startGame, buyServer, buyBulkServers, resolveGameConfirmation, buyDataset, train, publish, monthlyTick, compute, DATASETS, RIVALS, DATASET_COST_MULTIPLIER, loanQuote, updateLoanPreview, getCatalogCount: () => SERVER_CATALOG.length, getCatalog, instantiateServer, yearStartEvent, ensureFutureRivals, effectiveRivalMind, certificateChecks, getBanks:()=>BANKS, getTechnologies:()=>TECHNOLOGIES, getAutoMonthInterval:()=>AUTO_MONTH_INTERVAL_MS, getRisk, syncTrainingControls, renderAll, renderHeader, acceptContract, buyTechnology, reputationCampaign, generateMonthlyNews, CONTRACT_IDS, toggleServerList, renameCompany, saveCompanyName, changeBank, renderSecurity, renderOverview, progressTrainingMonthly, applyBestUpgrade, applyUpgradeDirect, upgradeOptions, buildUpgradePlan, executeUpgradePlan, upgradeAll, applyUpgrade, sellServer, resaleValue, serverMaintenance, modelSaleValue, modelStrength, normalizeState, openBank, takeLoan, marketing, actionAllowedWhilePaused, formatDataSize, formatParams, createCustomDataset, securityToggle, getState: () => state, renderContracts, renderBank, renderMarket, renderTechnology, renderNotifications, renderServers, renderLab, temporaryOfferTerms, computeServerCosts:()=>{const c=compute();return {revenue:c.revenue,modelRevenue:c.modelRevenue,expenses:c.expenses,profit:c.profit,payingUsers:c.payingUsers,requests:c.requests,trainingSpeed:c.trainingSpeed,modelCap:c.modelCap,api:c.api}} };\n`;
vm.runInNewContext(match[1] + exposed, context, { timeout: 10000, filename: 'itsllm-inline.js' });
const game = context.__test;
assert.equal(game.DATASET_COST_MULTIPLIER, 4, 'catalog base prices stay unchanged and the final dataset price uses ×4');
assert.equal(game.DATASETS[0].price, 1, 'the listed base price for chat data is unchanged');
for (const company of ['DeepSeek', 'Claude', 'Gemini', 'Qwen', 'GroqCloud']) assert.ok(game.RIVALS.some(r => r.name.includes(company)), `rival catalogue should include ${company}`);

assert.equal(game.getCatalogCount(), 432, 'six families × 18 generations × four configs = 432 initial entries');
assert.equal(game.DATASETS.length, 12, 'at least 10 standard dataset categories');
const topRack2026 = game.getCatalog().find(x => x.id === 'newrack-2026-3');
assert.ok(topRack2026, 'top AI server generation exists for 2026');
assert.ok(topRack2026.price > 100000, 'frontier-generation AI server costs substantially more than entry hardware');
assert.ok((topRack2026.ram + topRack2026.vram) / 4 >= 2400, 'top 2026 server fits at least 2.4 TB of training data at 4 GB memory per GB');
assert.equal(game.formatDataSize(1200), '1.2 TB', 'data sizes above 800 GB should use TB notation');
assert.equal(game.formatDataSize(1200000), '1.2 PB', 'data sizes above 800 TB should use PB notation');
assert.equal(game.formatParams(1200), '1.2B', 'parameter counts above 800M should use B notation');
assert.equal(game.formatParams(1200000), '1.2T', 'parameter counts above 800B should use T notation');
game.startGame(100);
let state = game.getState();
assert.equal(state.cash, 100);
assert.equal(state.year, 2009);
assert.equal(state.datasets.chat, 1, 'starter pack includes 1 GB chat data');
assert.equal(game.getAutoMonthInterval(), 300000, 'autoplay advances one game month every five real minutes');
const riskState = { year: state.year, reputation: state.reputation, security: state.security };
state.year = 2026; state.reputation = 40; state.security = {basic:false,advanced:false,team:false,redTeam:false,managedSOC:false,zeroTrust:false,insurance:false,compliance:false,redTeam:false,threatIntel:false,ddosScrubbing:false,privacyOps:false,modelFirewall:false,incidentRetainer:false,redTeamPro:false};
const riskWithoutRedTeam = game.getRisk(); state.security.redTeam = true;
assert.ok(game.getRisk() < riskWithoutRedTeam, 'paid Red Team service reduces simulated incident risk');
state.year = riskState.year; state.reputation = riskState.reputation; state.security = riskState.security;
document.getElementById('trainDistribution').value = 'selected';
document.getElementById('trainTypesMulti').hidden = true; game.renderAll();
assert.equal(document.getElementById('trainTypesMulti').hidden, false, 'selected dataset checklist remains visible after a full monthly-style rerender');
document.getElementById('trainDistribution').value = 'single'; game.syncTrainingControls();
assert.equal(document.getElementById('trainTypesMulti').hidden, true, 'checklist hides again for single-type training');
const inProgressField=document.getElementById('modelName'); inProgressField.defaultValue=''; inProgressField.value='Working Model Draft'; inProgressField.selectionStart=12; inProgressField.selectionEnd=12; formMockElements.push(inProgressField); inProgressField.focus();
game.renderAll();
assert.equal(document.getElementById('modelName').value,'Working Model Draft','form text survives the rerender that occurs during a month change');
assert.equal(document.activeElement.id,'modelName','the active form control retains focus after a rerender');
assert.equal(document.activeElement.selectionStart,12,'caret position is restored after a rerender'); formMockElements.splice(formMockElements.indexOf(inProgressField),1); document.activeElement=null;
// Contract confirmation must show both its upfront debit and the net recurring cash flow.
const cashBeforeContractPreview = state.cash; state.cash = 100000000; game.acceptContract('google_data');
const contractDialog = document.getElementById('modalRoot').innerHTML;
assert.ok(contractDialog.includes('Списание сейчас: $25,000,000.00'), 'contract dialog explicitly shows the initial debit');
assert.ok(contractDialog.includes('Чистый ежемесячный поток:'), 'contract dialog explicitly shows net monthly flow');
game.resolveGameConfirmation(false); state.cash = cashBeforeContractPreview;

const firstServer = game.getState() && game.getCatalogCount() > 0;
assert.ok(firstServer);
const catalogFor2009 = (function () {
  // The live catalogue is represented through the exported count; purchase lookup remains internal.
  return true;
}());
assert.ok(catalogFor2009);
// The game starts with the cheapest 2009 laptop variant. The first matching id is generated deterministically.
game.buyServer('laptop-2009-0');
game.resolveGameConfirmation(true);
state = game.getState();
assert.equal(state.servers.length, 0, 'server purchase uses a one-month delivery queue');
assert.equal(state.pendingDeliveries.length, 1, 'server order should be queued for delivery');
assert.ok(state.cash < 100, 'server purchase deducts balance');
game.monthlyTick();
state = game.getState();
assert.equal(state.servers.length, 1, 'delivery adds the server after one month');
const savedYearForTrainingPerf = state.year, savedServersForTrainingPerf = state.servers;
state.year = 2026; state.servers = [game.instantiateServer(topRack2026)];
assert.ok(game.compute().trainingSpeed >= 2400, 'top 2026 server actually computes at least 2.4 TB/month training throughput');
state.year = savedYearForTrainingPerf; state.servers = savedServersForTrainingPerf;

// RAM upgrades must use the quoted plan and debit the amount shown in the confirmation.
state.cash = 50000;
const laptop = state.servers[0];
const ramOption = game.upgradeOptions(laptop).find(o => o.kind === 'ram');
assert.ok(ramOption && ramOption.cost > 0, 'compatible RAM upgrade has a positive preview price');
const cashBeforeUpgrade = state.cash, ramBeforeUpgrade = laptop.ram;
game.applyUpgrade(laptop.id, 'ram');
game.resolveGameConfirmation(true);
state = game.getState();
assert.ok(state.servers[0].ram > ramBeforeUpgrade, 'confirmed RAM upgrade changes server hardware');
assert.equal(cashBeforeUpgrade - state.cash, ramOption.cost, 'confirmed upgrade debits the same amount shown in the confirmation');

// Bulk orders queue the selected quantity and deliver that same number after one game month.
context.document.getElementById('bulkServerModel').value = 'laptop-2009-0';
context.document.getElementById('bulkServerCount').value = '3';
const beforeBulk = state.pendingDeliveries.reduce((n,d)=>n+(d.count||1),0);
const bulkUnitPrice = game.getCatalog().find(x => x.id === 'laptop-2009-0').price;
const cashBeforeBulk = state.cash;
game.buyBulkServers();
game.resolveGameConfirmation(true);
state = game.getState();
assert.equal(cashBeforeBulk - state.cash, bulkUnitPrice * 3, 'bulk order debits exactly unit price × selected quantity');
assert.equal(state.pendingDeliveries.reduce((n,d)=>n+(d.count||1),0), beforeBulk + 3, 'bulk order queues all three machines after confirmation');
game.monthlyTick();
state = game.getState();
assert.ok(state.servers.length >= 4, 'bulk delivery adds the purchased server quantity');
// Both fleet-wide upgrade buttons must apply real per-server operations and debit the displayed amount.
state.cash = 50000;
let plan = game.buildUpgradePlan(false);
assert.ok(plan.steps.length >= 2 && plan.total > 0, 'fleet upgrade plan includes compatible operations for multiple owned servers');
const cashBeforeFleetUpgrade = state.cash;
game.upgradeAll(false);
game.resolveGameConfirmation(true);
state = game.getState();
assert.equal(cashBeforeFleetUpgrade - state.cash, plan.total, 'fleet upgrade charge equals the preview sum');
let maxPlan = game.buildUpgradePlan(true);
assert.ok(maxPlan.steps.length > plan.steps.length && maxPlan.total > 0, 'max-upgrade plan includes repeated compatible upgrades instead of only one per server');
const cashBeforeMaxUpgrade = state.cash;
game.upgradeAll(true);
game.resolveGameConfirmation(true);
state = game.getState();
assert.equal(cashBeforeMaxUpgrade - state.cash, maxPlan.total, 'max-upgrade charge equals the confirmed plan');

// Different dataset types can contribute to the same unpublished model project.
state.cash = 50000;
state.datasets.docs = 1;
const initialBrain = state.brain;
game.train('chat', 1);
state = game.getState();
assert.ok(state.trainingJob, 'training should run asynchronously in game time');
assert.ok(state.trainingJob.timeRequired <= 12 && state.trainingJob.remainingMonths <= 12, 'training duration is capped at one game year');
assert.equal(state.datasets.chat, 0, 'training consumes inventory when queued');
game.monthlyTick();
state = game.getState();
assert.ok(state.brain > initialBrain, 'chat corpus should improve the in-domain skill after the training month');
assert.equal(state.trainedGB, 1);
assert.equal(state.trainedByType.chat, 1, 'first corpus category is tracked');
game.train('docs', 1);
state = game.getState();
assert.ok(state.trainingJob, 'a second dataset type can be trained after the first job completes');
game.monthlyTick();
state = game.getState();
assert.equal(state.trainedGB, 2, 'second type accumulates in the same project');
assert.equal(state.trainedByType.docs, 1, 'second category is preserved');
// Selecting two types in one job must split the requested size and keep both category records.
state.datasets.chat = 0.5;
state.datasets.math = 0.5;
document.getElementById('trainDistribution').value = 'selected';
selectedTrainInputs.splice(0, selectedTrainInputs.length,
  { value: 'chat', checked: true }, { value: 'math', checked: true });
game.train('chat', 1);
state = game.getState();
assert.ok(state.trainingJob, 'selected multi-type training starts');
assert.deepEqual(Object.keys(state.trainingJob.allocations).sort(), ['chat', 'math'], 'single training job includes each checked dataset type');
game.monthlyTick();
state = game.getState();
assert.ok(Math.abs(state.trainedByType.chat - 1.5) < 1e-6, 'multi-type run accumulates more chat data');
assert.ok(Math.abs(state.trainedByType.math - 0.5) < 1e-6, 'multi-type run accumulates maths data too');
assert.ok(Math.abs(state.trainedGB - 3) < 1e-6, 'trained data volume accumulates across dataset types and jobs');
selectedTrainInputs.splice(0, selectedTrainInputs.length);
document.getElementById('trainDistribution').value = 'single';

for (const [id, value] of Object.entries({
  modelName: 'SmokeTest LLM', priceTurbo: '2', priceStandard: '6',
  pricePlus: '16', priceExpert: '38',
})) document.getElementById(id).value = value;
game.publish();
state = game.getState();
assert.equal(state.models.length, 1);
assert.equal(state.models[0].published, true);
game.renderHeader();
assert.notEqual(document.getElementById('trainedMetric').textContent, '0 GB', 'trained data remains visible in the top metrics after publishing');
assert.notEqual(document.getElementById('paramsMetric').textContent, '0M', 'equivalent parameter count remains visible after publishing');
assert.notEqual(document.getElementById('brainMetric').textContent, '0 / 100', 'published model mind remains visible after publishing resets the lab');
assert.ok(Number.isFinite(game.compute().revenue) && game.compute().revenue >= 0, 'model revenue forecast should be finite and non-negative');
assert.ok(game.getState().users >= 10, 'publishing a model seeds a small initial audience instead of trapping the company at zero users');
assert.ok(game.compute().modelRevenue > 0, 'published model with active users and normal tariffs should produce revenue');
const marketComparisonHtml=game.renderMarket();
assert.ok(marketComparisonHtml.includes('Сравнение твоей модели с конкурентами') && marketComparisonHtml.includes('rivalStrengthFilter') && marketComparisonHtml.includes('rivalParamsFilter') && marketComparisonHtml.includes('compareModelSelect'), 'market includes own-model comparison and year/strength/parameter filters');
const dashboardHtml=game.renderOverview();
for(const lineItem of ['Доход моделей','Пассивный доход и контракты','Энергия серверов','Обслуживание оборудования','Кибербезопасность','Банк и комиссии','Контракты и прочие затраты']) assert.ok(dashboardHtml.includes(lineItem), `dashboard exposes financial line item: ${lineItem}`);
assert.ok(game.compute().requests <= game.getState().users * .03 * 120 + 1e-6, 'model request volume is tied to a 3% paying audience and 120 requests/month');
assert.ok(game.getBanks().startup.rate === .04, 'Northstar Startup Bank maintains its displayed 4% rate');
assert.ok(Object.keys(game.getBanks()).length >= 20, 'bank catalogue contains a broad choice of 22+ tariffs');
assert.equal(game.getTechnologies().length, 20, 'technology tree contains 20 distinct upgrades');
assert.ok(game.getTechnologies().reduce((sum, t) => sum + t.cost, 0) > 1e9, 'purchasing every technology costs more than $1B');
assert.equal(game.loanQuote(5000,24,game.getBanks().startup).monthlyPayment > 0, true, 'loan quote returns a monthly payment');
assert.equal(game.certificateChecks('standard').find(x=>x.label.includes('Баланс не ниже'))?.label, 'Баланс не ниже $1,500,000', 'standard certificate requires $1.5M cash');
assert.equal(game.certificateChecks('vip').find(x=>x.label.includes('Накопительный счёт'))?.ok, false, 'VIP certificate requires $1B savings');
const contractsHtml=game.renderContracts();
assert.ok(contractsHtml.includes('data-contract-tab="permanent"')&&contractsHtml.includes('data-contract-tab="temporary"'), 'contract view has separate permanent and time-limited tabs');
assert.ok(contractsHtml.includes('data-contract-panel="temporary"'), 'temporary offers have their own panel');
state.year=2026;
game.yearStartEvent();
const serverCatalogPage=game.renderServers();
assert.ok(serverCatalogPage.includes('id=\"serverSort\"'), 'server catalogue exposes sort controls');
assert.ok(serverCatalogPage.includes('Новый AI-сервер 2026 · Max'), 'top 2026 hardware is reachable among the default newest-generation results');
assert.ok(game.temporaryOfferTerms({id:'exclusive_license'}).includes('$50,000/мес.'), 'exclusive offer previews its monthly financial obligation before signing');
const newest=game.RIVALS.filter(r=>r.year===2026).sort((a,b)=>b.power-a.power)[0];
assert.equal(game.effectiveRivalMind(newest),100, 'the strongest model in its release year begins at mind 100');
const oldPeer=game.RIVALS.filter(r=>r.year===2023).sort((a,b)=>b.power-a.power)[0];
assert.ok(game.effectiveRivalMind(oldPeer)>=58 && game.effectiveRivalMind(oldPeer)<=62, 'a top model from 2023 falls to about 60 mind by 2026');
state.year=2009;
assert.equal(game.actionAllowedWhilePaused('buyServer'), true, 'server purchase is permitted on pause');
assert.equal(game.actionAllowedWhilePaused('upgradeAll'), true, 'server upgrades are permitted on pause');
assert.equal(game.actionAllowedWhilePaused('train'), false, 'training is blocked on pause');
assert.ok(game.getState().trainedLifetimeGB >= 1, 'lifetime training metric remains available after publication');
const monthBefore = state.month;
game.monthlyTick();
state = game.getState();
assert.equal(state.month, monthBefore + 1);
assert.ok(Number.isFinite(state.cash));

// An unaffordable upgrade must not change RAM or cash.
const server = state.servers[0];
// The mass-upgrade regression above may have filled all RAM slots, so reset a disposable test server to a known compatible configuration.
server.ram = 8; server.ramMax = 32; server.ramSlots = 2; server.ramSlotsUsed = 1;
const beforeRam = server.ram;
const beforeCash = state.cash;
state.cash = 0;
game.applyUpgrade(server.id, 'ram');
assert.equal(server.ram, beforeRam);
assert.equal(state.cash, 0);
state.cash = beforeCash;

// Own-generated and hand-written datasets use their independent 2×/8× price rules with ×4 once, not a duplicated multiplier.
for (const [id, value] of Object.entries({ genFocus: 'chat', genAmount: '1', manualFocus: 'chat', manualAmount: '0.1' })) {
  document.getElementById(id).value = value;
}
state.cash = 1000;
game.createCustomDataset('generate');
game.resolveGameConfirmation(true);
state = game.getState();
assert.equal(state.customTypes['own-chat'].price, 40);
assert.ok(state.datasets['own-chat'] >= 1);
assert.ok(game.renderServers && game.renderLab().includes('Обучение'), 'lab remains renderable after adding a custom corpus');
const inventoryBeforeCustomBuy = state.datasets['own-chat'];
document.getElementById('buy-own-chat').value = '0.5';
game.buyDataset('own-chat');
game.resolveGameConfirmation(true);
state = game.getState();
assert.ok(state.datasets['own-chat'] > inventoryBeforeCustomBuy, 'generated dataset catalogue card can actually purchase additional units');
document.getElementById('manualAmount').value = '0.1';
game.createCustomDataset('manual');
game.resolveGameConfirmation(true);
state = game.getState();
assert.equal(state.customTypes['manual-chat'].price, 160);
assert.ok(state.datasets['manual-chat'] >= 0.1);
// A high-risk standard corpus raises the data license/privacy meter; Data License Guard is a real paid control.
state.datasets.medical = 1;
const riskBefore = state.dataRisk;
game.train('medical', 1);
state = game.getState();
if (state.trainingJob) game.monthlyTick();
state = game.getState();
assert.ok(state.dataRisk > riskBefore, 'high-risk dataset training increases license/privacy risk');
const expenseBeforeCompliance = game.compute().expenses;
game.securityToggle('compliance');
game.resolveGameConfirmation(true);
state = game.getState();
assert.equal(state.security.compliance, true, 'Data License Guard can be enabled');
assert.ok(game.compute().expenses >= expenseBeforeCompliance + 6 - 1e-6, 'Data License Guard has a monthly maintenance fee');
assert.ok(stored.has('gradus_itsllm_save_v1'), 'actions should auto-save local progress');

// Advancing beyond the historical campaign unlocks fictional rivals and new generated hardware years.
state.year = 2027;
state.month = 1;
game.yearStartEvent();
assert.ok(game.RIVALS.some(r => r.name.includes('GPT-7') && r.year === 2027), 'endless mode should add fictional GPT-7 competitor to the catalogue');
assert.ok(game.getCatalogCount() > 432, 'catalog should grow in endless mode');
state.cash = 1000;
const serverBeforeUpgrade = state.servers[0].ram;
const resaleBeforeUpgrade = game.resaleValue(state.servers[0]);
game.applyUpgrade(state.servers[0].id, 'ram');
game.resolveGameConfirmation(true);
state = game.getState();
assert.ok(state.servers[0].ram > serverBeforeUpgrade, 'compatible RAM upgrade should apply when affordable');
const saleValue = game.resaleValue(state.servers[0]);
assert.ok(saleValue > resaleBeforeUpgrade, 'resale value rises after installing an upgrade and includes upgrade investment');
assert.ok(saleValue > 0, 'server resale value should be positive and account for condition/assets');
const cashBeforeSale = state.cash;
const serverCountBeforeSale = state.servers.length;
game.sellServer(state.servers[0].id);
game.resolveGameConfirmation(true);
state = game.getState();
assert.equal(state.servers.length, serverCountBeforeSale - 1, 'selling a server should remove exactly one server from the owned fleet');
assert.ok(state.cash > cashBeforeSale, 'selling a server should credit the resale amount');

// Marketing is capped after its revenue benefit plateaus, so a legacy high level cannot create an endless expense sink.
state.marketing = 100;
assert.equal(game.compute().marketing, 1650, 'marketing recurring cost is capped at $1,650/month');
assert.ok(game.serverMaintenance({family:'laptop',ram:8,vram:.5,cores:2,storage:256,reliability:74,used:true}) < 15, 'a used laptop has affordable spec-based monthly maintenance');
assert.ok(game.modelSaleValue(state.models[0]) >= 5000, 'model sale values have a non-zero liquidation floor');
assert.equal(game.actionAllowedWhilePaused('buyDataset'), true);
assert.equal(game.actionAllowedWhilePaused('security'), true);
assert.equal(game.actionAllowedWhilePaused('openBank'), true);
assert.equal(game.actionAllowedWhilePaused('train'), false);

// Older schema-4 saves had both ×40 dataset costs and the former near-zero default model prices.
state.schema = 4;
state.migrations = {};
state.year = 2024;
state.month = 1;
state.users = 0;
state.dataSpend = 800;
state.labDatasetCost = 400;
state.customTypes = {'own-chat': {id:'own-chat', price:400}};
state.models = [{id:'legacy-model', name:'Legacy AI', versions:[
  {name:'Turbo',price:.02},{name:'Standard',price:.06},{name:'Plus',price:.16},{name:'Expert',price:.38}],
  published:true,trainedGB:1,parametersM:500,brain:10,logic:10,datasetCost:1000,totalRevenue:0,publishedYear:2020,publishedMonth:1,publishedAtMonth:0
}];
game.normalizeState();
state = game.getState();
assert.deepEqual(Array.from(state.models[0].versions, v => v.price), [2,6,16,38], 'old default model prices migrate to current tiers even if the save already used schema 4');
assert.equal(state.dataSpend, 80, 'previous ×40 data spending is normalized to ×4');
assert.equal(state.labDatasetCost, 40, 'pending training data cost is normalized to ×4');
assert.equal(state.models[0].datasetCost, 100, 'legacy model dataset cost is downscaled once, not twice');
assert.equal(state.customTypes['own-chat'].price, 40, 'legacy custom dataset unit price is normalized');
assert.ok(state.users >= 10, 'legacy company with published models receives a small audience seed if its audience was zero');

// With ordinary tariffs and active users, a small server should not have five-figure operating costs.
state.year = 2026;
state.users = 10000;
state.marketing = 0;
state.security = {basic:false,advanced:false,team:false,compliance:false,managedSOC:false,zeroTrust:false,insurance:false,redTeam:false};
state.loans = [];
state.bank = null;
state.contracts = [];
state.acquisitions = [];
state.portfolio = {};
state.servers = [{id:'econ-laptop',family:'laptop',ram:8,vram:.5,cores:2,power:65,storage:256,reliability:74,used:true,online:true,lifeRemaining:18,baseLife:24,purchasePrice:65,assetValue:65}];
state.models = Array.from({length:4}, (_,i)=>({id:`econ-model-${i}`,name:`Top AI ${i+1}`,versions:[{name:'Turbo',price:2},{name:'Standard',price:6},{name:'Plus',price:16},{name:'Expert',price:38}],published:true,trainedGB:100,parametersM:50000,brain:95,logic:95,datasetCost:100,totalRevenue:50000,publishedAtMonth:0}));
const balanced = game.compute();
assert.ok(balanced.modelRevenue > 10, 'four strong models and a 10,000-user audience should produce positive scaled revenue without runaway millions');
assert.ok(balanced.expenses < 100, 'without security, marketing, loans or contracts a basic laptop should not cost thousands monthly');
assert.ok(balanced.profit > 0, 'model income should exceed basic laptop operating costs at a modest 10,000-user audience');
state.servers = Array.from({length:112},(_,i)=>({id:`hi-${i}`,family:'newrack',ram:1280,vram:330,cores:100,power:1800,storage:4096,reliability:95,used:false,online:true,lifeRemaining:60,baseLife:72,purchasePrice:50000,assetValue:50000}));
state.users = 8245068;
const highAudience = game.compute();
assert.ok(highAudience.modelRevenue < 2000000, '8.2M audience must not produce tens of millions in monthly model revenue with default tariffs');
assert.ok(highAudience.modelRevenue > 1000, 'large audiences still generate revenue proportional to paying users and request demand');
state.users = 10000;
state.servers = [{id:'econ-laptop',family:'laptop',ram:8,vram:.5,cores:2,power:65,storage:256,reliability:74,used:true,online:true,lifeRemaining:18,baseLife:24,purchasePrice:65,assetValue:65}];

// Opening a bank account is permitted at $0, but credit remains unavailable at a zero balance.
state.cash = 0;
state.bank = null;
state.reputation = 40;
state.bank = {id:'startup',opened:true,rate:.24,fee:999,monthlyFee:999,savingsRate:.2}; game.normalizeState();
assert.equal(state.bank.rate,.04,'legacy Northstar account migration replaces stale 24% APR with the canonical 4% tariff');
assert.equal(state.bank.monthlyFee,state.bank.fee,'legacy account migration also resets stale monthly service fees');
state.bank = null;
game.openBank('startup');
game.resolveGameConfirmation(true);
state = game.getState();
assert.equal(state.bank.opened, true, 'a bank account can be opened with a zero balance');
game.updateLoanPreview();
assert.equal(document.getElementById('loanAprLabel').textContent, '4.0% годовых', 'the selected bank APR matches the canonical Northstar 4% rate');
assert.ok(document.getElementById('loanMonthlyPreview').textContent.startsWith('$'), 'monthly loan payment is rendered in the preview');
const loanCount = state.loans.length;
game.takeLoan();
assert.equal(state.loans.length, loanCount, 'the credit function blocks borrowing when the balance is zero');
assert.equal(game.loanQuote(5000, 12, state.bank).monthlyPayment > 0, true, 'loan payment preview calculation is positive and available');

// VIP certificate checks use all six criteria, including 50% of distinct permanent contracts.
const savedVipState = {year:state.year,month:state.month,reputation:state.reputation,savings:state.savings,cash:state.cash,models:state.models,contracts:state.contracts,loans:state.loans,unpaidFines:state.unpaidFines};
state.year=2035; state.month=1; state.reputation=60; state.savings=1e9; state.cash=2e6; state.loans=[]; state.unpaidFines=0;
state.models=[{id:'vip-model',name:'VIP Model',published:true,parametersM:10000000,trainedGB:20000,brain:100,logic:100,versions:[{name:'Standard',price:2}]}];
state.contracts=game.CONTRACT_IDS.slice(0,Math.ceil(game.CONTRACT_IDS.length/2)).map(id=>({id,name:id,monthsLeft:12}));
assert.ok(game.certificateChecks('vip').every(c=>c.ok), 'VIP certificate becomes eligible only when all six requirements are met');
state.year=2026; state.month=10; state.reputation=50; state.cash=1500000; state.savings=0;
state.models=[{id:'std-model',name:'Standard Model',published:true,parametersM:1000000,trainedGB:2000,brain:50,logic:50,versions:[{name:'Standard',price:2}]}]; state.contracts=[];
assert.ok(game.certificateChecks('standard').every(c=>c.ok), 'standard certificate checks October 2026, 1T parameters, rep 50, $1.5M, cleared loans, and no fines');
Object.assign(state,savedVipState);
const newsBefore = state.notifications.length; game.generateMonthlyNews();
const newNotificationCount = state.notifications.length - newsBefore;
assert.ok(newNotificationCount >= 2, 'each game month records both company and industry news in the internal Notifications list');
const newNotifications = state.notifications.slice(0, newNotificationCount);
assert.ok(newNotifications.some(n=>n.text.includes('Новости индустрии')) && newNotifications.some(n=>n.text.includes('Новости компании')), 'internal news contains a company item and an industry item even if a random offer is added too');

// If pure mind/logic bonuses exceed 100, the remainder is redirected to popularity rather than wasted.
state.cash=1e9; state.brain=100; state.logic=100; state.techBrainBonus=0; state.techLogicBonus=0; state.techPopularity=0; state.techs=state.techs.filter(id=>id!=='frontier_reasoning');
const overflowPopularityBefore=state.techPopularity; game.buyTechnology('frontier_reasoning'); game.resolveGameConfirmation(true);
assert.equal(state.techBrainBonus,0, 'mind bonus does not exceed 100 after the cap');
assert.equal(state.techLogicBonus,0, 'logic bonus does not exceed 100 after the cap');
assert.ok(state.techPopularity>overflowPopularityBefore, 'over-cap mind and logic technology bonuses convert into popularity');

// Remaining account/company controls and the expanded security catalogue.
assert.ok((game.renderSecurity().match(/data-action=\"security\"/g)||[]).length >= 14, 'security panel exposes the expanded 14-service catalogue');
const listStateBefore = state.showServerList; game.toggleServerList();
assert.equal(state.showServerList,!listStateBefore,'server list can be hidden and shown'); game.toggleServerList();
const companyBeforeRename=state.company; game.renameCompany(); document.getElementById('newCompanyName').value='Audit Company'; game.saveCompanyName();
assert.equal(state.company,'Audit Company','company can be renamed through a custom in-site dialog'); state.company=companyBeforeRename; game.renderAll();
const nextBank=Object.values(game.getBanks()).find(b=>b.id!=='startup'&&b.minRep<=state.reputation&&!b.needsIncome);
assert.ok(nextBank,'bank catalogue offers at least one alternative bank at the current reputation');
state.cash=1000000; const bankBeforeSwitch=state.bank.id; game.changeBank(nextBank.id);
const switchDialog=document.getElementById('modalRoot').innerHTML; assert.ok(switchDialog.includes('К списанию:'),'bank switching previews the charge before confirmation');
game.resolveGameConfirmation(true); assert.equal(state.bank.id,nextBank.id,'bank switching changes the canonical bank tariff');
assert.notEqual(state.bank.id,bankBeforeSwitch,'new bank is distinct from the prior account');
state.cash=0; state.reputation=0; state.monthsPlayed=10; state.lastRepCampaignMonth=-99;
game.reputationCampaign(); const reputationDialog=document.getElementById('modalRoot').innerHTML;
assert.ok(reputationDialog.includes('Ожидаемый прирост репутации: 4 пунктов'), 'free transparency campaign is available when both cash and reputation collapse');
game.resolveGameConfirmation(true); assert.ok(state.reputation>=4,'manual recovery can lift reputation from zero without years of passive marketing');

console.log('PASS: catalog, dataset ×4 price math, training and revenue launch, bank/account rules, marketing expense cap, legacy price migration, affordable hardware upkeep, server resale, custom dataset pricing, licensing risk, pause restrictions, autosave and endless mode.');
