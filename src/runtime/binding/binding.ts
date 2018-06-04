import { ConnectableBinding } from './connectable-binding';
import { enqueueBindingConnect } from './connect-queue';
import { IObserverLocator } from './observer-locator';
import { IExpression } from './ast';
import { Observer } from './property-observation';
import { IBindScope, IBindingTargetObserver, IBindingTargetAccessor } from './observation';
import { IServiceLocator } from '../di';
import { IScope, sourceContext, targetContext } from './binding-context';
import { Reporter } from '../reporter';
import { BindingFlags, BindingMode, BindingOperation, BindingDirection, BindingOrigin } from './binding-flags';

export interface IBinding extends IBindScope {
  locator: IServiceLocator;
  observeProperty(context: any, name: string): void;
}

export type IBindingTarget = any; // Node | CSSStyleDeclaration | IObservable;

export class Binding extends ConnectableBinding implements IBinding {
  private _updateSourceFlags: BindingFlags;
  private _updateTargetFlags: BindingFlags;
  private _bindFlags: BindingFlags;
  private _connectFlags: BindingFlags;

  public targetObserver: IBindingTargetObserver | IBindingTargetAccessor;
  private $scope: IScope;
  private $isBound = false;

  constructor(
    public sourceExpression: IExpression,
    public target: IBindingTarget,
    public targetProperty: string,
    public mode: BindingMode,
    observerLocator: IObserverLocator,
    public locator: IServiceLocator) {
    super(observerLocator);

    const baseFlags = BindingOrigin.binding | this.mode | this._id;
    this._updateSourceFlags = baseFlags | BindingOperation.change | BindingDirection.fromView;
    this._updateTargetFlags = baseFlags | BindingOperation.change | BindingDirection.toView;
    this._bindFlags = baseFlags | BindingOperation.bind;
    this._connectFlags = baseFlags | BindingOperation.connect;
  }

  updateTarget(value: any, flags?: BindingFlags) {
    this.targetObserver.setValue(value, this.target, this.targetProperty, flags || this._updateTargetFlags);
  }

  updateSource(value: any, flags?: BindingFlags) {
    this.sourceExpression.assign(this.$scope, value, this.locator, flags || this._updateSourceFlags);
  }

  call(context: string, newValue?: any, oldValue?: any, flags?: BindingFlags) {
    if (!this.$isBound) {
      return;
    }

    if (context === sourceContext) {
      flags = flags || this._updateTargetFlags;
      oldValue = this.targetObserver.getValue(this.target, this.targetProperty);
      newValue = this.sourceExpression.evaluate(this.$scope, this.locator, flags);

      if (newValue !== oldValue) {
        this.updateTarget(newValue, flags);
      }

      if (this.mode !== BindingMode.oneTime) {
        this.version++;
        this.sourceExpression.connect(this, this.$scope, flags);
        this.unobserve(false);
      }

      return;
    }

    if (context === targetContext) {
      flags = flags || this._updateSourceFlags;
      if (newValue !== this.sourceExpression.evaluate(this.$scope, this.locator, flags)) {
        this.updateSource(newValue, flags);
      }

      return;
    }

    throw Reporter.error(15, context);
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

    let mode = this.mode;

    if (!this.targetObserver) {
      let method: 'getObserver' | 'getAccessor' = mode === BindingMode.twoWay || mode === BindingMode.fromView ? 'getObserver' : 'getAccessor';
      this.targetObserver = <any>this.observerLocator[method](this.target, this.targetProperty);
    }

    if ('bind' in this.targetObserver) {
      this.targetObserver.bind(flags);
    }

    if (this.mode !== BindingMode.fromView) {
      let value = this.sourceExpression.evaluate(scope, this.locator, flags);
      this.updateTarget(value, flags);
    }

    if (mode === BindingMode.oneTime) {
      return;
    } else if (mode === BindingMode.toView) {
      enqueueBindingConnect(this);
    } else if (mode === BindingMode.twoWay) {
      this.sourceExpression.connect(this, scope, flags);
      (this.targetObserver as IBindingTargetObserver).subscribe(targetContext, this);
    } else if (mode === BindingMode.fromView) {
      (this.targetObserver as IBindingTargetObserver).subscribe(targetContext, this);
    }
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

    if ('unbind' in this.targetObserver) {
      (this.targetObserver as IBindingTargetObserver).unbind();
    }

    if ('unsubscribe' in this.targetObserver) {
      this.targetObserver.unsubscribe(targetContext, this);
    }

    this.unobserve(true);
  }

  connect(evaluate?: boolean, flags?: BindingFlags) {
    if (!this.$isBound) {
      return;
    }

    flags = flags || this._connectFlags;
    if (evaluate) {
      let value = this.sourceExpression.evaluate(this.$scope, this.locator, flags);
      this.updateTarget(value, flags);
    }

    this.sourceExpression.connect(this, this.$scope, flags);
  }
}
