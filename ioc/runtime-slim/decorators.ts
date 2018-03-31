import { registry, getParamTypes } from "./container";
import { Registration } from "./registration";

export function inject(...keys: any[]): ClassDecorator {
  return (target: Function): void => {
    registry.getMetadata(target).dependencies = keys;
  };
}

export function autoinject<T extends Function>(key?: T): T extends Function ? ClassDecorator : void {
  const decorator: any = (target: Function): void => {
    inject(...getParamTypes(target))(target);
  };

  return key ? decorator(key) : decorator;
}

export function registration(
  configure?: ((registration: Registration) => Registration)
): ClassDecorator {
  return (target: Function): void => {
    const registration = Registration.create(target);

    registry.getMetadata(target).registration = typeof configure === 'function' ? configure(registration) : registration;
    const scope = registry.scopes.get(null);
    scope.registrations.set(registration.key, registration);
  };
}

export function transient(key?: any): ClassDecorator {
  if (key !== undefined) {
    registration(registration => registration.transient())(key);
  } else {
    return (target: Function): void => {
      registration(registration => registration.transient())(target);
    };
  }
}

export function singleton(key?: any): ClassDecorator {
  if (key !== undefined) {
    registration()(key);
  } else {
    return (target: Function): void => {
      registration()(target);
    };
  }
}
