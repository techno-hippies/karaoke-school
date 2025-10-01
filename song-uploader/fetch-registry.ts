import { loadRegistry } from './src/registry.js';

const registryUri = 'lens://24cdef29730ca5e8fe18c1a39f5ce65225c8558d414810e88ad344ced296a87b';
const registry = await loadRegistry(registryUri);
console.log(JSON.stringify(registry.songs, null, 2));
