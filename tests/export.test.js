import test from 'node:test';
import assert from 'node:assert/strict';
import { rowsToCSV } from '../src/export.js';
test('CSV preserves identifiers, quotes, line breaks, zeros and nulls',()=>{
 const csv=rowsToCSV([{id:'001',name:'A,"B"\nC',count:0,missing:null}]);
 assert.ok(csv.includes('"001","A,""B""\nC","0",""'));
 assert.ok(csv.endsWith('\r\n'));
});
test('CSV neutralizes spreadsheet formulas and retains numeric negatives',()=>{
 const csv=rowsToCSV([{label:'=1+1',other:' @SUM(A1)',negative:-2}]);
 assert.ok(csv.includes('"\'=1+1"')); assert.ok(csv.includes('"\' @SUM(A1)"')); assert.ok(csv.includes('"-2"'));
 assert.equal(rowsToCSV([]),'');
});
