type TestCallback = (...args: any[]) => any;

declare const describe: (name: string, fn: TestCallback) => void;
declare const it: (name: string, fn: TestCallback) => void;
declare const beforeEach: (fn: TestCallback) => void;
declare const expect: (value: any) => any;
declare const jest: any;

