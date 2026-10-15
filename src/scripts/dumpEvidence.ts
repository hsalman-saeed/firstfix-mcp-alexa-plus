import { runFirstFixAgentWorkflow } from '../ai/firstFixAgent.js';

async function main() {
  const r1 = await runFirstFixAgentWorkflow({
    samplePlateId: 'sample_bosch_fd98_blurry',
    userUtterance: 'My Bosch dishwasher throws E24.',
    userConfirmedSerial: false,
  });
  console.log('=== BLURRY PAUSE JSON ===');
  console.log(JSON.stringify(r1, null, 2));

  const r2 = await runFirstFixAgentWorkflow({
    samplePlateId: 'sample_bosch_fd99',
    userUtterance: 'My Bosch dishwasher stopped draining with error code E24.',
    zipCode: '98101',
    autoReserveFirstSlot: true,
  });
  console.log('=== FD99 ORCHESTRATION TRACE JSON ===');
  console.log(JSON.stringify(r2, null, 2));
}

main().catch(console.error);
