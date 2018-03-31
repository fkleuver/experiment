import { IActivator } from "./activation";

let currentId = 0;

export class Registration {
  public id: number;
  public key: any;
  public ctor: any
  public flags: RegistrationFlags;
  public instance: any
  public activator: IActivator;

  constructor(key: any, ctor: any = key, flags: RegistrationFlags = RegistrationFlags.singleton | RegistrationFlags.globalScope) {
    this.id += currentId;
    this.key = key;
    this.ctor = ctor;
    this.flags = flags;
  }

  public static create(key: any): Registration {
    return new Registration(key);
  }

  public transient(): Registration {
    this.flags |= RegistrationFlags.transient;
    return this;
  }

  public childScope(): Registration {
    this.flags |= RegistrationFlags.childScope;
    return this;
  }

  public scopeBoundary(): Registration {
    this.flags |= RegistrationFlags.scopeBoundary;
    return this;
  }

  public toInstance(instance: any): void {
    this.instance = instance;
  }

  public toActivator(activator: IActivator): void {
    this.activator = activator;
  }
}

export const enum RegistrationFlags {
  singleton = 1 << 0,
  transient = 1 << 1,
  globalScope = 1 << 2,
  childScope = 1 << 3,
  scopeBoundary = 1 << 4
};
