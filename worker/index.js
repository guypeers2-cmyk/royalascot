import { DurableObject } from 'cloudflare:workers';
import { createTableHandler, handleWorkerFetch } from './table.js';

export class SharedTable extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.table = createTableHandler(ctx, env);
  }

  fetch(request) {
    return this.table.fetch(request);
  }

  alarm() {
    return this.table.alarm();
  }
}

export default {
  fetch(request, env) {
    return handleWorkerFetch(request, env);
  }
};
