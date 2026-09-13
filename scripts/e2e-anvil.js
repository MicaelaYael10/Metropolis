#!/usr/bin/env node
// Prueba end-to-end LOCAL: levanta Anvil, despliega los tres contratos y recorre
// el ciclo completo del agente (politica -> evaluar -> bloquear -> registrar).
// No necesita red ni AVAX: usa Anvil y la cuenta de prueba por defecto.
//
//   pnpm run test:e2e
//   node scripts/e2e-anvil.js --port 8547 --keep

'use strict';

const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

// Cuenta 0 de Anvil (clave publica conocida, solo para pruebas locales).
const PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const USER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const port = Number(arg('port', 8547));
const keep = Boolean(arg('keep', false));
const RPC = `http://127.0.0.1:${port}`;

let passed = 0;
let failed = 0;
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  OK   ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', shell: false, ...opts });
  return { status: res.status, stdout: (res.stdout || '').trim(), stderr: (res.stderr || '').trim() };
}

function cast(args) {
  return run('cast', args);
}

function castSend(args) {
  return cast(['send', ...args, '--private-key', PK, '--rpc-url', RPC]);
}

function castCall(sig, args) {
  const r = cast(['call', ...args, '--rpc-url', RPC]);
  return { ok: r.status === 0, out: r.stdout, err: r.stderr };
}

async function waitForRpc(timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      });
      if (res.ok) return true;
    } catch {
      /* todavia no arranca */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  console.log(`\n== RiskGuard - prueba end-to-end (Anvil :${port}) ==`);

  const anvil = spawn('anvil', ['--port', String(port), '--silent'], { stdio: 'ignore' });

  const cleanup = () => {
    if (keep) return;
    try {
      spawnSync('taskkill', ['/pid', String(anvil.pid), '/f', '/t'], { stdio: 'ignore' });
    } catch {
      /* nada */
    }
  };

  try {
    const ready = await waitForRpc();
    if (!ready) throw new Error(`Anvil no respondio en ${RPC}`);
    console.log('  anvil listo');

    // 1) Despliegue
    const deploy = run('forge', ['script', 'script/Deploy.s.sol', '--rpc-url', RPC, '--broadcast', '--json'], {
      env: { ...process.env, PRIVATE_KEY: PK },
    });
    if (deploy.status !== 0) throw new Error(`forge script fallo:\n${deploy.stderr || deploy.stdout}`);

    let parsed;
    try {
      // `forge script --json` emite varios objetos JSON (resultado, gas, cadena...);
      // el primer objeto trae los `returns`.
      const firstLine = deploy.stdout.split(/\r?\n/).find((l) => l.trim().startsWith('{'));
      parsed = JSON.parse(firstLine);
    } catch (e) {
      throw new Error(`no se pudo parsear la salida de forge: ${e.message}`);
    }
    const reg = parsed.returns.registryAddr.value;
    const log = parsed.returns.agentLogAddr.value;
    const guard = parsed.returns.guardAddr.value;
    check('despliegue de los 3 contratos', Boolean(reg && log && guard), `${reg} ${log} ${guard}`);
    console.log(`    registry=${reg}\n    log=${log}\n    guard=${guard}`);

    // 2) Dos protocolos: uno sano y uno riesgoso
    const SAFE = '0x1000000000000000000000000000000000000001';
    const RISKY = '0x2000000000000000000000000000000000000002';

    const setup = [
      ['registerProtocol(address,string,uint8)', SAFE, 'Sano Lending', '1'],
      ['registerProtocol(address,string,uint8)', RISKY, 'Riesgoso Lending', '1'],
      ['setRiskScore(address,uint8,uint8,bytes32)', SAFE, '20', '90', '0x' + '11'.repeat(32)],
      ['setRiskScore(address,uint8,uint8,bytes32)', RISKY, '90', '80', '0x' + '22'.repeat(32)],
      ['setActive(address,bool)', SAFE, 'true'],
      ['setActive(address,bool)', RISKY, 'true'],
    ];
    let allSetup = true;
    for (const [sig, ...rest] of setup) {
      const r = castSend([reg, sig, ...rest]);
      if (r.status !== 0) {
        allSetup = false;
        console.error(`    setup fallo: ${sig} -> ${r.stderr}`);
      }
    }
    check('registrar protocolos y puntuar (requiere el riesgo leido on-chain)', allSetup);

    // 3) Politica del usuario
    const policy = castSend([guard, 'setPolicy(uint8,uint8,uint256,uint256)', '55', '5', '1000000', '500000']);
    check('el usuario fija su politica', policy.status === 0, policy.stderr);

    // 4) Control previo (vista)
    const safeCheck = castCall('checkOperation', [guard, 'checkOperation(address,address,uint256)(bool,uint8,uint8)', USER, SAFE, '100000']);
    const riskyCheck = castCall('checkOperation', [guard, 'checkOperation(address,address,uint256)(bool,uint8,uint8)', USER, RISKY, '100000']);
    check('checkOperation permite el protocolo sano', /^true\b/.test(safeCheck.out), safeCheck.out);
    check('checkOperation bloquea el protocolo riesgoso (motivo 4)', /^false\s+4\s+90/.test(riskyCheck.out.replace(/\n/g, ' ')), riskyCheck.out.replace(/\n/g, ' '));

    // 5) Ejecucion: sano pasa, riesgoso revierte
    const commitSafe = castSend([guard, 'commitOperation(address,address,uint256,bytes32)', USER, SAFE, '100000', '0x' + 'ab'.repeat(32)]);
    check('commitOperation del protocolo sano se ejecuta', commitSafe.status === 0, commitSafe.stderr);

    const commitRisky = castSend([guard, 'commitOperation(address,address,uint256,bytes32)', USER, RISKY, '100000', '0x' + 'cd'.repeat(32)]);
    check('commitOperation del riesgoso REVIERTE', commitRisky.status !== 0, 'no revirtio');

    // 6) El bloqueo se registra con el puntaje leido on-chain (el agente no puede mentir)
    const reject = castSend([guard, 'recordRejection(address,address,uint256,bytes32)', USER, RISKY, '100000', '0x' + 'ef'.repeat(32)]);
    check('recordRejection guarda la perdida evitada', reject.status === 0, reject.stderr);

    const last = castCall('lastEntryOf', [log, 'lastEntryOf(address)(address,address,uint256,uint8,uint8,bool,bytes32,uint64)', USER]);
    const flat = last.out.replace(/\n/g, ' ');
    check('el log guarda puntaje 90 y allowed=false', /\b90\b/.test(flat) && /false/.test(flat), flat);

    const count = castCall('count', [log, 'count()(uint256)']);
    check('el log tiene 2 entradas (1 ejecucion + 1 bloqueo)', count.out.trim() === '2', count.out.trim());
  } finally {
    cleanup();
  }

  console.log(`\n${passed} OK  -  ${failed} FAIL\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\nERROR: ${e.message}\n`);
  process.exit(1);
});
