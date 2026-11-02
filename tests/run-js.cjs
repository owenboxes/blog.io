const fs = require('node:fs');
require('./test_catalog.cjs');
require('./test_edit_link.cjs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const globals = {SharedArrayBuffer, Int32Array, Uint8Array, Atomics, TextEncoder, TextDecoder};
console.log(vm.runInNewContext(read('site/input-channel.js')+'\n'+read('tests/test_input.js')+'\ncheckInput()', globals));
// Browser regression: the reported TextDecoder rejects shared BufferSource.
// Node accepts it, so enforce the observed browser boundary in this test.
const browserGlobals = {...globals, TextDecoder: class extends TextDecoder {
  decode(bytes, options) {
    if (bytes && bytes.buffer instanceof SharedArrayBuffer) {
      throw new TypeError('The provided ArrayBufferView value must not be shared.');
    }
    return super.decode(bytes, options);
  }
}};
console.log('Browser decoder: '+vm.runInNewContext(read('site/input-channel.js')+'\n'+read('tests/test_input.js')+'\ncheckInput()', browserGlobals));
console.log(vm.runInNewContext(read('site/dock.js')+'\n'+read('tests/test_dock.js')+'\ncheckDock()', {}));
const setup = vm.createContext({...globals});
vm.runInContext(read('tests/test_app.js'),setup);
const fixture = vm.runInContext('appFixture()',setup);
vm.createContext(fixture);
console.log(vm.runInContext(read('site/dock.js')+'\n'+read('site/input-channel.js')+'\n'+read('site/app.js')+'\n'+vm.runInContext('appChecks',setup),fixture));
for (const file of ['app.js','worker.js','dock.js','input-channel.js','catalog.js','edit-link.js']) new vm.Script(read('site/'+file));
console.log('All JS syntax checks PASS');

