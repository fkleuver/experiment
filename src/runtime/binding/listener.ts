import { IEventManager, DelegationStrategy } from './event-manager';
import { IExpression } from './ast';
import { IBinding } from './binding';
import { IServiceLocator } from '../di';
import { IDisposable } from '../interfaces';
import { IScope } from './binding-context';
import { INode } from '../dom';
import { BindingFlags, nextBindingId, BindingOrigin, BindingOperation, BindingDirection } from './binding-flags';

export class Listener implements IBinding {
  private _id = nextBindingId();
  private _callSourceFlags: BindingFlags;
  private _bindFlags: BindingFlags;
  private _handleEventFlags: BindingFlags;

  private source: IScope;
  private $isBound = false;
  private handler: IDisposable;

  constructor(
    public targetEvent: string,
    private delegationStrategy: DelegationStrategy,
    private sourceExpression: IExpression,
    private target: INode,
    private preventDefault: boolean,
    private eventManager: IEventManager,
    public locator: IServiceLocator
  ) {
    const baseFlags = BindingOrigin.binding | this._id;
    this._callSourceFlags = baseFlags | BindingOperation.call | BindingDirection.fromView;
    this._bindFlags = baseFlags | BindingOperation.bind;
    this._handleEventFlags = baseFlags | BindingOperation.event;
  }

  callSource(event: Event, flags?: BindingFlags) {
    let overrideContext = this.source.overrideContext as any;
    overrideContext['$event'] = event;

    let result = this.sourceExpression.evaluate(this.source, this.locator, (flags || this._callSourceFlags) | BindingFlags.mustEvaluate);

    delete overrideContext['$event'];

    if (result !== true && this.preventDefault) {
      event.preventDefault();
    }

    return result;
  }

  handleEvent(event: Event) {
    this.callSource(event, this._handleEventFlags);
  }

  $bind(source: IScope, flags?: BindingFlags) {
    if (this.$isBound) {
      if (this.source === source) {
        return;
      }

      this.$unbind();
    }

    this.$isBound = true;
    this.source = source;

    if (this.sourceExpression.bind) {
      this.sourceExpression.bind(this, source, flags || this._bindFlags);
    }

    this.handler = this.eventManager.addEventListener(
      this.target,
      this.targetEvent,
      this,
      this.delegationStrategy
    );
  }

  $unbind() {
    if (!this.$isBound) {
      return;
    }

    this.$isBound = false;

    if (this.sourceExpression.unbind) {
      this.sourceExpression.unbind(this, this.source);
    }

    this.source = null;
    this.handler.dispose();
    this.handler = null;
  }

  observeProperty() { }
}
