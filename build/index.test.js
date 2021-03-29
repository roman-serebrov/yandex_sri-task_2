const assert = require('assert/strict');
const input = require('../input');
const output = require('../output');
const { prepareData } = require('./index');

const preparedSlides = prepareData(input, { sprintId: 977 });
assert.deepEqual(preparedSlides[0], output[0]);
assert.deepEqual(preparedSlides[1], output[1]);
assert.deepEqual(preparedSlides[2], output[2]);
assert.deepEqual(preparedSlides[3], output[3]);
assert.deepEqual(preparedSlides[4], output[4]);
