/* Separate from the trace channel: submitting input must not change step mode. */
function submitInput(buffer, value) {
  const state = new Int32Array(buffer, 0, 2);
  const bytes = new TextEncoder().encode(value);
  if (Atomics.load(state, 0) !== 0 || bytes.length > buffer.byteLength - 8) return false;
  new Uint8Array(buffer, 8).set(bytes);
  Atomics.store(state, 1, bytes.length);
  Atomics.store(state, 0, 1);
  Atomics.notify(state, 0);
  return true;
}
function receiveInput(buffer) {
  const state = new Int32Array(buffer, 0, 2);
  // Browser TextDecoder may reject shared views. Copy the submitted bytes into
  // an ordinary ArrayBuffer before decoding; the input channel stays shared.
  const bytes = new Uint8Array(buffer, 8, Atomics.load(state, 1)).slice();
  return new TextDecoder().decode(bytes);
}
