import { Registration } from "./registration";

export interface IActivator {
  registration: Registration;
  activate(): any;
}

export class SingletonActivator implements IActivator {
  public registration: Registration;
  private delegate: IActivator;
  private instance: any;

  constructor(registration: Registration, delegate: IActivator) {
    this.registration = registration;
    this.delegate = delegate;
  }

  public activate(): any {
    if (this.instance === undefined) {
      this.instance = this.delegate.activate();
    }
    return this.instance;
  }

  public newSingleton(): SingletonActivator {
    return new SingletonActivator(this.registration, this.delegate);
  }
}

export class InstanceActivator implements IActivator {
  public registration: Registration;
  private instance: any;

  constructor(registration: Registration, instance: any) {
    this.registration = registration;
    this.instance = instance;
  }

  public activate(): any {
    return this.instance;
  }
}

export class ClassActivator implements IActivator {
  public registration: Registration;
  private deps: IActivator[];

  constructor(registration: Registration, dependencyActivators: IActivator[]) {
    this.registration = registration;
    this.deps = dependencyActivators;
  }

  public activate(): any {
    const ctor = this.registration.ctor;
    switch (this.deps.length) {
      case 0: {
        return new ctor();
      }
      case 1: {
        return new ctor(
          this.deps[0].activate()
        );
      }
      case 2: {
        return new ctor(
          this.deps[0].activate(),
          this.deps[1].activate()
        );
      }
      case 3: {
        return new ctor(
          this.deps[0].activate(),
          this.deps[1].activate(),
          this.deps[2].activate()
        );
      }
      case 4: {
        return new ctor(
          this.deps[0].activate(),
          this.deps[1].activate(),
          this.deps[2].activate(),
          this.deps[3].activate()
        );
      }
      case 5: {
        return new ctor(
          this.deps[0].activate(),
          this.deps[1].activate(),
          this.deps[2].activate(),
          this.deps[3].activate(),
          this.deps[4].activate()
        );
      }
      case 6: {
        return new ctor(
          this.deps[0].activate(),
          this.deps[1].activate(),
          this.deps[2].activate(),
          this.deps[3].activate(),
          this.deps[4].activate(),
          this.deps[5].activate()
        );
      }
      case 7: {
        return new ctor(
          this.deps[0].activate(),
          this.deps[1].activate(),
          this.deps[2].activate(),
          this.deps[3].activate(),
          this.deps[4].activate(),
          this.deps[5].activate(),
          this.deps[6].activate()
        );
      }
      case 8: {
        return new ctor(
          this.deps[0].activate(),
          this.deps[1].activate(),
          this.deps[2].activate(),
          this.deps[3].activate(),
          this.deps[4].activate(),
          this.deps[5].activate(),
          this.deps[6].activate(),
          this.deps[7].activate()
        );
      }
      case 9: {
        return new ctor(
          this.deps[0].activate(),
          this.deps[1].activate(),
          this.deps[2].activate(),
          this.deps[3].activate(),
          this.deps[4].activate(),
          this.deps[5].activate(),
          this.deps[6].activate(),
          this.deps[7].activate(),
          this.deps[8].activate()
        );
      }
      case 10: {
        return new ctor(
          this.deps[0].activate(),
          this.deps[1].activate(),
          this.deps[2].activate(),
          this.deps[3].activate(),
          this.deps[4].activate(),
          this.deps[5].activate(),
          this.deps[6].activate(),
          this.deps[7].activate(),
          this.deps[8].activate(),
          this.deps[9].activate()
        );
      }
      default: {
        return new ctor(...this.deps.map(d => d.activate()));
      }
    }
  }
}
