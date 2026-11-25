import test from 'node:test';
import assert from 'node:assert/strict';
import { frequencyExpression, legendEntries, transitRows } from '../src/transit.js';

test('network legend follows visible layers and frequency toggle', () => {
  assert.deepEqual(legendEntries({},true),[]);
  assert.equal(legendEntries({stops:true},true).length,4);
  assert.equal(legendEntries({stops:true},false).length,1);
  assert.equal(legendEntries({coverage400:true,routes:true},true).length,3);
  assert.equal(frequencyExpression(false),'#344D61');
  assert.ok(frequencyExpression(true).includes('No service'));
});
test('stop popup preserves zero and missing distinction with actual date', () => {
  const rows=Object.fromEntries(transitRows({stop_id:'001',feed_id:'bus',scheduled_departures:0,departures_per_hour:0,frequency_class:'No service',service_date:'2026-11-24',window_start:'07:00',window_end:'19:00'},true));
  assert.equal(rows['Scheduled boardable departures'],0);
  assert.equal(rows['Service date'],'2026-11-24');
  assert.equal(rows.Municipality,'Not assigned');
  assert.equal(rows['Routes in time window'],'None');
});

