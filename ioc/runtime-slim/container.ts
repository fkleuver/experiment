import { Registration, RegistrationFlags } from './registration';
import { IActivator, ClassActivator, SingletonActivator } from './activation';
import { metadata } from 'aurelia-metadata';

const metadataKey = '__ioc__';
const rootScopeKey = '';
export class Container {
  public activators = new Map<number, IActivator>();
  public registrations = new Map<any, Registration>();

  public register(key: any, scopeBoundary?: any): Registration {
    const registration = Registration.create(key);
    if (scopeBoundary) {
      this.registrations.set(key, registration);
    } else {
      const scope = this.getScope(scopeBoundary);
      scope.registrations.set(key, registration);
    }
    return registration;
  }

  public registerAlias(from: any, to: any): void {
    registry.aliases.set(from, to);
  }

  public get<T>(key: any, scopeBoundary?: any): T {
    const scope = this.getScope(scopeBoundary);
    const registration = this.getRegistration(key, scope);
    if (typeof registration.ctor !== 'function') {
      return registration.ctor;
    }
    const activator = this.getActivator(registration, scope);

    const instance = activator.activate();
    if (registration.flags & RegistrationFlags.scopeBoundary) {
      this.registerScope(instance, scope);
    }

    return instance;
  }

  private getActivator(registration: Registration, scope: DependencyScope): IActivator {
    let activator = scope.activators.get(registration.id);
    if (activator === undefined) {
      const classMetadata = registry.getMetadata(registration);
      if (classMetadata.dependencies === undefined) {
        classMetadata.dependencies = getParamTypes(registration.ctor);
      }

      const dependencyActivators: IActivator[] = [];
      for (const dependency of classMetadata.dependencies) {
        const dependencyRegistration = this.getRegistration(dependency, scope);
        const dependencyActivator = this.getActivator(dependencyRegistration, scope);
        dependencyActivators.push(dependencyActivator);
      }

      const classActivator = new ClassActivator(registration, dependencyActivators);
      if (registration.flags & RegistrationFlags.singleton) {
        activator = new SingletonActivator(registration, classActivator);
      } else {
        activator = classActivator;
      }
    }
    return activator;
  }

  private getRegistration(keyOrAlias: any, scope: DependencyScope): Registration {
    while (registry.aliases.has(keyOrAlias)) {
      keyOrAlias = registry.aliases.get(keyOrAlias);
    }
    const key = keyOrAlias;
    let registration = scope.registrations.get(key);
    if (registration === undefined) {
      registration = Registration.create(key);
      scope.registrations.set(key, registration);
    }
    return registration;
  }

  private getScope(scopeBoundary?: any): DependencyScope {
    if (scopeBoundary) {
      let scope = registry.scopes.get(scopeBoundary);
      if (scope === undefined) {
        scope = this.registerScope(scopeBoundary, registry.scopes.get(rootScopeKey));
      }
      return scope;
    } else {
      return this as any;
    }
  }

  private registerScope(scopeBoundary: any, currentScope: DependencyScope): DependencyScope {
    const scope = new DependencyScope(scopeBoundary);
    for (const [key, activator] of currentScope.activators) {
      if (activator.registration.flags & RegistrationFlags.childScope && activator instanceof SingletonActivator) {
        scope.activators.set(key, activator.newSingleton());
      } else {
        scope.activators.set(key, activator);
      }
    }
    for (const [key, registration] of currentScope.registrations) {
      scope.registrations.set(key, registration);
    }
    registry.scopes.set(scopeBoundary, scope);
    return scope;
  }
}

export class DependencyScope {
  public scopeBoundary: any;
  public activators = new Map<number, IActivator>();
  public registrations = new Map<any, Registration>();

  constructor(scopeBoundary: any) {
    this.scopeBoundary = scopeBoundary;
  }
}

export class ClassMetadata {
  public registration?: Registration;
  public dependencies?: Function[];

  constructor(registration?: Registration) {
    this.registration = registration;
  }
}

export namespace registry {
  export const aliases = new Map<any, any>();
  export const dependencies = new Map<any, ParameterDecorator>();
  export const scopes = new Map<any, DependencyScope>();

  export function getMetadata(targetOrRegistration: Function | Registration): ClassMetadata {
    const isRegistration = typeof targetOrRegistration !== 'function';
    const ctor: Function = isRegistration ? (targetOrRegistration as any).ctor : targetOrRegistration;
    let $metadata: ClassMetadata = ctor[metadataKey];
    if ($metadata === undefined) {
      $metadata = ctor[metadataKey] = new ClassMetadata(isRegistration ? targetOrRegistration : undefined as any);
    } else if ($metadata.registration === undefined && isRegistration) {
      $metadata.registration = targetOrRegistration as any;
    }
    return $metadata;
  }
}

/*@internal*/
export function getParamTypes(ctor: any): any[] {
  let types: any[] = [];
  if (ctor.inject === undefined) {
    types = (metadata.getOwn('design:paramtypes', ctor) as Array<any>) || [];
  } else {
    let base = ctor;
    while (base !== Function.prototype && base !== Object.prototype) {
      types.push(...getInjectTypes(base));
      base = Object.getPrototypeOf(base);
    }
  }
  return types;
}

function getInjectTypes(ctor: any): any[] {
  if (!Object.prototype.hasOwnProperty.call(ctor, 'inject')) {
    return [];
  } else if (typeof ctor.inject === 'function') {
    return ctor.inject();
  } else {
    return ctor.inject;
  }
}
