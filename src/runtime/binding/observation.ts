import { ICallable, IDisposable, IIndexable } from '../interfaces';
import { IScope } from './binding-context';
import { BindingFlags } from './binding-flags';

export interface IBindScope {
  $bind(scope: IScope, flags?: BindingFlags): void;
  $unbind(): void;
}
export interface IAccessor<T = any> {
  getValue(): T;
  setValue(newValue: T, flags: BindingFlags): void;
}

export interface ISubscribable {
  subscribe(context: string, callable: ICallable): void;
  unsubscribe(context: string, callable: ICallable): void;
}

export interface IBindingTargetAccessor<TGetReturn = any, TSetValue = TGetReturn> {
  getValue(obj: IIndexable, propertyName: string): TGetReturn;
  setValue(value: TSetValue, obj: IIndexable, propertyName: string, flags: BindingFlags): void;
}

export interface IBindingTargetObserver<TGetReturn = any, TSetValue = TGetReturn>
  extends IBindingTargetAccessor<TGetReturn, TSetValue>, ISubscribable {

  bind?(flags: BindingFlags): void;
  unbind?(): void;
}

export interface IBindingCollectionObserver extends ISubscribable, ICallable {
  getValue?(target: IIndexable, targetProperty: string): any;
  setValue?(value: any, target: IIndexable, targetProperty: string, flags: BindingFlags): void;

  addChangeRecord(changeRecord: any): void;
  flushChangeRecords(): void;
  reset(oldCollection: any): any;
  getLengthObserver(): any;
}

export type AccessorOrObserver = IAccessor | IBindingTargetAccessor | IBindingTargetObserver | IBindingCollectionObserver;

export interface IObservable<T = any> {
  $observers: Record<string, AccessorOrObserver>;
}
