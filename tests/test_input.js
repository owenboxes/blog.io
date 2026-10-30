function checkInput() {
  const channel = new SharedArrayBuffer(65544);
  for (const value of ['', '영성🙂', '  hi  ']) {
    if (!submitInput(channel, value)) throw new Error('submission rejected');
    if (receiveInput(channel) !== value) throw new Error('input corrupted');
    if (submitInput(channel, 'duplicate')) throw new Error('double submission accepted');
    Atomics.store(new Int32Array(channel, 0, 2), 0, 0);
  }
  if (submitInput(channel, '가'.repeat(22000))) throw new Error('oversize accepted');
  if (Atomics.load(new Int32Array(channel, 0, 2), 0) !== 0) throw new Error('oversize released waiting worker');
  return 'input channel: blank, Unicode, whitespace, duplicate, size limit PASS';
}
