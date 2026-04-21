const { EventEmitter } = require('events');
const emitter = globalThis.myEmitter || new EventEmitter();
globalThis.myEmitter = emitter;
emitter.setMaxListeners(20);
export default emitter;
