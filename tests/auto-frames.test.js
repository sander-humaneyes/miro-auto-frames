const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const CONTAINMENT_ERROR =
  'Cannot resize the frame (3458764667553893327) to the specified size, because one or more children would exist outside the parent frame.';

function loadAutoFrames() {
  const warnings = [];
  const errors = [];
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'auto-frames.js'), 'utf8');
  const context = {
    console: {
      error: (...args) => errors.push(args),
      warn: (...args) => warnings.push(args),
    },
    window: {},
  };

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'auto-frames.js' });

  return {
    AutoFrames: context.window.AutoFrames,
    errors,
    warnings,
  };
}

function createChild(overrides = {}) {
  return {
    height: overrides.height ?? 80,
    id: overrides.id ?? 'child-1',
    rotation: overrides.rotation ?? 0,
    title: overrides.title ?? '',
    type: overrides.type ?? 'sticky_note',
    width: overrides.width ?? 80,
    x: overrides.x ?? 120,
    y: overrides.y ?? 120,
    async sync() {},
  };
}

function createFrame(children, minimumAcceptedSize) {
  return {
    height: 240,
    id: 'frame-1',
    title: 'Frame 1',
    type: 'frame',
    width: 240,
    x: 120,
    y: 120,
    async getChildren() {
      return children;
    },
    async sync() {
      if (this.width < minimumAcceptedSize || this.height < minimumAcceptedSize) {
        throw new Error(CONTAINMENT_ERROR);
      }
    },
  };
}

test('fitFrame retries containment errors without dumping the raw error on each retry', async () => {
  const { AutoFrames, errors, warnings } = loadAutoFrames();
  const frame = createFrame([createChild()], 150);

  const result = await AutoFrames.fitFrame(frame, { padding: 32 });

  assert.equal(result.status, 'success');
  assert.equal(result.message, '1 item, minimum 32 dp padding.');
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0].length, 1);
  assert.match(warnings[0][0], /Next attempt: 34 dp total padding/);
  assert.match(warnings[1][0], /Next attempt: 38 dp total padding/);
  assert.equal(errors.length, 0);
});

test('fitFrame returns a diagnostic message after exhausting containment retries', async () => {
  const { AutoFrames, errors, warnings } = loadAutoFrames();
  const frame = createFrame([createChild()], 170);

  const result = await AutoFrames.fitFrame(frame, { padding: 32 });

  assert.equal(result.status, 'error');
  assert.match(result.message, /trying 32 dp, 34 dp, 38 dp, and 44 dp total padding/i);
  assert.match(result.message, /Measured bounds say the items should fit/i);
  assert.match(result.notificationMessage, /up to 44 dp padding/i);
  assert.equal(warnings.length, 3);
  assert.equal(errors.length, 1);
  assert.equal(errors[0][0], 'Shrink frame to content failed to fit Frame 1');
  assert.equal(errors[0][1].childTypes, '1 sticky note');
  assert.equal(errors[0][1].sdkMessage, CONTAINMENT_ERROR);
});
