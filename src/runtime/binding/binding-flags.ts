export enum BindingMode {
  oneTime    = 0,
  toView     = 0b01 << 21,
  oneWay     = 0b01 << 21,
  fromView   = 0b10 << 21,
  twoWay     = 0b11 << 21
};

// Note: the BindingOrigin, BindingDirection and BindingOperation flags are
// combined to save space (unlike BindingMode, where twoWay is a legitimate OR).
// So these flags must be checked like so:
// (flags & BindingFlags.operation) === BindingOperation.bind/unbind/etc

/*@internal*/
export const enum BindingOrigin {
  unknown    = 0,
  component  = 0b01 << 23,
  binding    = 0b10 << 23,
  observer   = 0b11 << 23
}

/*@internal*/
export const enum BindingDirection {
  unknown   = 0,
  toView    = 0b01 << 25,
  fromView  = 0b10 << 25
}

/*@internal*/
export const enum BindingOperation {
  unknown   = 0,
  bind      = 0b001 << 27,
  unbind    = 0b010 << 27,
  connect   = 0b011 << 27,
  change    = 0b100 << 27,
  call      = 0b101 << 27,
  event     = 0b110 << 27
}

export enum BindingFlags {
  none              = 0,
  id                = (1 << 21) - 1, // 2097151 - can this realistically run out?
  mode              = 0b011 << 21,
  origin            = 0b011 << 23,
  direction         = 0b011 << 25,
  operation         = 0b111 << 27,
  // TODO: use the other binding flags to determine this, and then remove this flag
  mustEvaluate      = 1 << 30
}

// TODO: create a recycling mechanism or some other method that can't run out of numbers to use
let nextId = 1;
export function nextBindingId() {
  return nextId++;
}
