import 'aurelia-polyfills';
import 'performance-now';
import { initialize } from 'aurelia-pal-browser';
import { PLATFORM } from 'aurelia-pal';
initialize();

Error.stackTraceLimit = Infinity;

//const testContext: any = (require as any).context('./unit/ioc', true, /(code-generator|static-module-configuration)\.spec/);
//const testContext: any = (require as any).context('./unit/ioc', true, /syntax-transformer\.spec/);
//const testContext: any = (require as any).context('./unit/ioc', true, /(v2-slim|v1)-perf\.spec/);
const testContext: any = (require as any).context('./unit/ioc', true, /(v2-slim|v1)-perf\.spec/);
testContext.keys().forEach(testContext);
