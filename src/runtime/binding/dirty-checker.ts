import { SubscriberCollection } from './subscriber-collection';
import { DI } from '../di';
import { ICallable } from '../interfaces';
import { IAccessor, ISubscribable } from './observation';
import { nextBindingId, BindingFlags, BindingOrigin, BindingOperation, BindingDirection } from './binding-flags';

export interface IDirtyChecker {
  createProperty(obj: any, propertyName: string): IAccessor & ISubscribable & ICallable;
}

export const IDirtyChecker = DI.createInterface<IDirtyChecker>()
  .withDefault(x => x.singleton(DirtyChecker));

class DirtyChecker {
  private tracked = [];
  private checkDelay = 120;

  createProperty(obj: any, propertyName: string) {
    return new DirtyCheckProperty(this, obj, propertyName);
  }

  addProperty(property: DirtyCheckProperty) {
    let tracked = this.tracked;

    tracked.push(property);

    if (tracked.length === 1) {
      this.scheduleDirtyCheck();
    }
  }

  removeProperty(property: DirtyCheckProperty) {
    let tracked = this.tracked;
    tracked.splice(tracked.indexOf(property), 1);
  }

  scheduleDirtyCheck() {
    setTimeout(() => this.check(), this.checkDelay);
  }

  check() {
    let tracked = this.tracked;
    let i = tracked.length;

    while (i--) {
      let current = tracked[i];

      if (current.isDirty()) {
        current.call();
      }
    }

    if (tracked.length) {
      this.scheduleDirtyCheck();
    }
  }
}

class DirtyCheckProperty extends SubscriberCollection implements IAccessor, ISubscribable, ICallable {
  private _callFlags: BindingFlags;
  
  oldValue;
  
  constructor(private dirtyChecker: DirtyChecker, private obj: any, private propertyName: string) {
    super();

    this._callFlags = BindingOrigin.observer | BindingOperation.change | BindingDirection.fromView | this._id;
  }

  isDirty(): boolean {
    return this.oldValue !== this.obj[this.propertyName];
  }

  getValue() {
    return this.obj[this.propertyName];
  }

  setValue(newValue) {
    this.obj[this.propertyName] = newValue;
  }

  call(flags?: BindingFlags) {
    let oldValue = this.oldValue;
    let newValue = this.getValue();

    this.callSubscribers(newValue, oldValue, flags || this._callFlags);

    this.oldValue = newValue;
  }

  subscribe(context: string, callable: ICallable) {
    if (!this.hasSubscribers()) {
      this.oldValue = this.getValue();
      this.dirtyChecker.addProperty(this);
    }

    this.addSubscriber(context, callable);
  }

  unsubscribe(context: string, callable: ICallable) {
    if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
      this.dirtyChecker.removeProperty(this);
    }
  }
}
