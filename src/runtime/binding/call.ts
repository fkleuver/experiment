import { IObserverLocator } from './observer-locator';
import { IExpression } from './ast';
import { IBinding } from './binding';
import { IServiceLocator } from '../di';
import { IBindingTargetAccessor } from './observation';
import { IScope } from './binding-context';
import { INode } from '../dom';
import { BindingFlags, nextBindingId, BindingOrigin, BindingOperation, BindingDirection } from './binding-flags';

export class Call implements IBinding {
  private _id = nextBindingId();
  private _callSourceFlags: BindingFlags;
  private _bindFlags: BindingFlags;
  private _unbindFlags: BindingFlags;

  targetObserver: IBindingTargetAccessor;
  private $scope: IScope;
  private $isBound = false;

  constructor(
    private sourceExpression: IExpression,
    private target: INode,
    private targetProperty: string,
    private observerLocator: IObserverLocator, 
    public locator: IServiceLocator) {
    this.targetObserver = <any>observerLocator.getObserver(target, targetProperty);

    const baseFlags = BindingOrigin.binding | this._id;
    this._callSourceFlags = baseFlags | BindingOperation.call | BindingDirection.fromView;
    this._bindFlags = baseFlags | BindingOperation.bind;
    this._unbindFlags = baseFlags | BindingOperation.unbind;
  }

  callSource($event, flags?: BindingFlags) {
    let overrideContext = <any>this.$scope.overrideContext;
    Object.assign(overrideContext, $event);
    overrideContext.$event = $event; // deprecate this?
    let result = this.sourceExpression.evaluate(this.$scope, this.locator, (flags || this._callSourceFlags) | BindingFlags.mustEvaluate);
    delete overrideContext.$event;

    for (let prop in $event) {
      delete overrideContext[prop];
    }

    return result;
  }

  $bind(scope: IScope, flags?: BindingFlags) {
    if (this.$isBound) {
      if (this.$scope === scope) {
        return;
      }

      this.$unbind();
    }

    this.$isBound = true;
    this.$scope = scope;
    flags = flags || this._bindFlags;

    if (this.sourceExpression.bind) {
      this.sourceExpression.bind(this, scope, flags);
    }

    this.targetObserver.setValue($event => this.callSource($event), this.target, this.targetProperty, flags);
  }

  $unbind() {
    if (!this.$isBound) {
      return;
    }

    this.$isBound = false;

    if (this.sourceExpression.unbind) {
      this.sourceExpression.unbind(this, this.$scope);
    }

    this.$scope = null;
    this.targetObserver.setValue(null, this.target, this.targetProperty, this._unbindFlags);
  }

  observeProperty() { }
}
