import { describe, expect, it } from 'vitest';
import { checkPython, stripStringsAndComments } from './python';

const ALLOWED: { name: string; code: string }[] = [
  { name: 'plain amy.send loop', code: 'def loop():\n    amy.send(osc=0, note=60, vel=1)' },
  {
    name: 'whitelisted imports',
    code: 'import math, random\nimport time\nfrom amyboard import cv_in\n\ndef loop():\n    v = cv_in(0)\n    amy.send(osc=0, freq=440 * math.pow(2, v))',
  },
  {
    name: 'forbidden words only inside strings/comments',
    code: '# this could open a file or exec code, but only in a comment\ndef loop():\n    label = "do not eval or import os here"\n    amy.send(osc=0, vel=1)',
  },
  { name: 'random + time usage', code: 'def loop():\n    time.sleep(0)\n    amy.send(osc=0, note=random.randint(48, 72), vel=1)' },
];

const FORBIDDEN: { name: string; code: string; reason: RegExp }[] = [
  { name: 'import os', code: 'import os\ndef loop():\n    os.system("rm -rf /")', reason: /import 'os' is not allowed/ },
  { name: 'from subprocess', code: 'from subprocess import run\ndef loop():\n    run(["ls"])', reason: /import from 'subprocess'/ },
  { name: 'open a file', code: 'def loop():\n    f = open("/etc/passwd")', reason: /use of 'open'/ },
  { name: 'exec', code: 'def loop():\n    exec("print(1)")', reason: /use of 'exec'/ },
  { name: 'eval', code: 'def loop():\n    x = eval("2+2")', reason: /use of 'eval'/ },
  { name: '__import__ escape', code: 'def loop():\n    __import__("os").system("id")', reason: /use of '__import__'/ },
  {
    name: 'dunder introspection escape',
    code: 'def loop():\n    cls = ().__class__.__bases__[0].__subclasses__()',
    reason: /use of '__subclasses__'/,
  },
  { name: 'import network + call', code: 'import socket\ndef loop():\n    socket.socket()', reason: /import 'socket' is not allowed/ },
];

describe('checkPython', () => {
  for (const c of ALLOWED) {
    it(`allows: ${c.name}`, () => {
      const res = checkPython(c.code);
      expect(res.ok, res.errors.join('; ')).toBe(true);
    });
  }

  for (const c of FORBIDDEN) {
    it(`forbids: ${c.name}`, () => {
      const res = checkPython(c.code);
      expect(res.ok).toBe(false);
      expect(res.errors.join('; ')).toMatch(c.reason);
    });
  }

  it('does not flag identifiers that merely contain a forbidden word', () => {
    expect(checkPython('def loop():\n    reopen_time = 5\n    amy.send(osc=0, vel=1)').ok).toBe(true);
  });
});

describe('stripStringsAndComments', () => {
  it('removes comments and string bodies but keeps code', () => {
    const out = stripStringsAndComments('x = "os.system"  # exec\nimport os');
    expect(out).not.toContain('os.system');
    expect(out).not.toContain('exec');
    expect(out).toContain('import os');
  });
});
