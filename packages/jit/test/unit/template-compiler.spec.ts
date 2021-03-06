import { DI, IContainer, IRegistry, PLATFORM, Constructable } from '../../../kernel/src';
import {
  IExpressionParser,
  IResourceDescriptions,
  BindingType,
  AccessScope,
  CustomAttributeResource,
  RuntimeCompilationResources,
  BindingMode,
  customElement,
  TargetedInstructionType as TT,
  bindable,
  customAttribute,
  ViewCompileFlags,
  ITemplateDefinition,
  IHydrateTemplateController,
  IHydrateElementInstruction,
  TargetedInstructionType,
  IBindableDescription,
  DelegationStrategy,
  CustomElementResource,
  ForOfStatement,
  BindingIdentifier,
  IExpression,
  PrimitiveLiteral
} from '../../../runtime/src';
import {
  TemplateCompiler,
  HydrateTemplateController,
  BasicConfiguration,
  parseCore,
  AttributeParser,
  ElementParser
} from '../../src';
import { expect } from 'chai';
import { createElement, eachCartesianJoinFactory, verifyBindingInstructionsEqual } from './util';

const attrParser = new AttributeParser();
const elParser = new ElementParser(attrParser);

export function createAttribute(name: string, value: string): Attr {
  const attr = document.createAttribute(name);
  attr.value = value;
  return attr;
}

describe('TemplateCompiler', () => {
  let container: IContainer;
  let sut: TemplateCompiler;
  let expressionParser: IExpressionParser;
  let resources: IResourceDescriptions;

  beforeEach(() => {
    container = DI.createContainer();
    container.register(BasicConfiguration);
    expressionParser = container.get(IExpressionParser);
    sut = new TemplateCompiler(expressionParser as any, elParser, attrParser);
    container.registerResolver(CustomAttributeResource.keyFrom('foo'), <any>{ getFactory: () => ({ type: { description: {} } }) });
    resources = new RuntimeCompilationResources(<any>container);
  });


  describe('compileElement()', () => {

    it('set hasSlots to true <slot/>', () => {
      const definition = compileWith('<template><slot></slot></template>', []);
      expect(definition.hasSlots).to.be.true;

      // test this with nested slot inside template controller
    });

    describe('with custom element', () => {

      describe('compiles surrogate', () => {

        it('compiles surrogate', () => {
          const { instructions, surrogates } = compileWith(
            `<template class="h-100"></template>`,
            [],
            ViewCompileFlags.surrogate
          );
          verifyInstructions(instructions as any, []);
          verifyInstructions(surrogates as any, [
            { toVerify: ['type', 'value', 'to'], type: TT.setAttribute, value: 'h-100', to: 'class' }
          ]);
        });

        it('compiles surrogate with binding expression', () => {
          const { instructions, surrogates } = compileWith(
            `<template class.bind="base"></template>`,
            [],
            ViewCompileFlags.surrogate
          );
          verifyInstructions(instructions as any, [], 'normal');
          verifyInstructions(surrogates as any, [
            { toVerify: ['type', 'to'], type: TT.propertyBinding, to: 'class' }
          ], 'surrogate');
        });

        it('compiles surrogate with interpolation expression', () => {
          const { instructions, surrogates } = compileWith(
            `<template class="h-100 \${base}"></template>`,
            [],
            ViewCompileFlags.surrogate
          );
          verifyInstructions(instructions as any, [], 'normal');
          verifyInstructions(surrogates as any, [
            { toVerify: ['type', 'to'], type: TT.interpolation, to: 'class' }
          ], 'surrogate');
        });

        it('throws on attributes that require to be unique', () => {
          const attrs = ['id', 'part', 'replace-part'];
          attrs.forEach(attr => {
            expect(() => compileWith(
              `<template ${attr}="${attr}"></template>`,
              [],
              ViewCompileFlags.surrogate
            )).to.throw(/Invalid surrogate attribute/);
          });
        });
      });

      it('understands attr precendence: custom attr > element prop', () => {
        @customElement('el')
        class El {
          @bindable() prop1: string;
          @bindable() prop2: string;
          @bindable() prop3: string;
        }

        @customAttribute('prop3')
        class Prop {}

        const actual = compileWith(
          `<template>
            <el prop1.bind="p" prop2.bind="p" prop3.bind="t" prop3="t"></el>
          </template>`,
          [El, Prop]
        );
        expect(actual.instructions.length).to.equal(1);
        expect(actual.instructions[0].length).to.equal(3);
        const siblingInstructions = actual.instructions[0].slice(1);
        const expectedSiblingInstructions = [
          { toVerify: ['type', 'res', 'to'], type: TT.hydrateAttribute, res: 'prop3' },
          { toVerify: ['type', 'res', 'to'], type: TT.hydrateAttribute, res: 'prop3' }
        ];
        verifyInstructions(siblingInstructions, expectedSiblingInstructions);
        const rootInstructions = actual.instructions[0][0]['instructions'] as any[];
        const expectedRootInstructions = [
          { toVerify: ['type', 'res', 'to'], type: TT.propertyBinding, to: 'prop1' },
          { toVerify: ['type', 'res', 'to'], type: TT.propertyBinding, to: 'prop2' }
        ];
        verifyInstructions(rootInstructions, expectedRootInstructions);
      });

      it('distinguishs element properties / normal attributes', () => {
        @customElement('el')
        class El {

          @bindable()
          name: string;
        }

        const actual = compileWith(
          `<template>
            <el name="name" name2="label"></el>
          </template>`,
          [El]
        );
        const rootInstructions = actual.instructions[0] as any[];
        const expectedRootInstructions = [
          { toVerify: ['type', 'res'], type: TT.hydrateElement, res: 'el' }
        ];
        verifyInstructions(rootInstructions, expectedRootInstructions);

        const expectedElInstructions = [
          { toVerify: ['type', 'to', 'value'], type: TT.setProperty, to: 'name', value: 'name' }
        ];
        verifyInstructions(rootInstructions[0].instructions, expectedElInstructions);
      });

      it('understands element property casing', () => {
        @customElement('el')
        class El {

          @bindable()
          backgroundColor: string;
        }

        const actual = compileWith(
          `<template>
            <el background-color="label"></el>
          </template>`,
          [El]
        );
        const rootInstructions = actual.instructions[0] as any[];

        const expectedElInstructions = [
          { toVerify: ['type', 'value', 'to'], type: TT.setProperty, value: 'label', to: 'backgroundColor' },
        ];
        verifyInstructions(rootInstructions[0].instructions, expectedElInstructions);
      });

      it('understands binding commands', () => {
        @customElement('el')
        class El {
          @bindable({ mode: BindingMode.twoWay }) propProp1: string;
          @bindable() prop2: string;
          @bindable() propProp3: string;
          @bindable() prop4: string;
          @bindable() propProp5: string;
        }
        const actual = compileWith(
          `<template>
            <el
              prop-prop1.bind="prop1"
              prop2.one-time="prop2"
              prop-prop3.to-view="prop3"
              prop4.from-view="prop4"
              prop-prop5.two-way="prop5"
              ></el>
          </template>`,
          [El]
        );
        const rootInstructions = actual.instructions[0] as any[];

        const expectedElInstructions = [
          { toVerify: ['type', 'mode', 'to'], mode: BindingMode.twoWay, to: 'propProp1' },
          { toVerify: ['type', 'mode', 'to'], mode: BindingMode.oneTime, to: 'prop2' },
          { toVerify: ['type', 'mode', 'to'], mode: BindingMode.toView, to: 'propProp3' },
          { toVerify: ['type', 'mode', 'to'], mode: BindingMode.fromView, to: 'prop4' },
          { toVerify: ['type', 'mode', 'to'], mode: BindingMode.twoWay, to: 'propProp5' },
        ].map((e: any) => {
          e.type = TT.propertyBinding;
          return e;
        });
        verifyInstructions(rootInstructions[0].instructions, expectedElInstructions);
      });

      describe('with template controller', () => {
        it('compiles', () => {
          @customAttribute({
            name: 'prop',
            isTemplateController: true
          })
          class Prop {
            value: any;
          }
          const { template, instructions } = compileWith(
            `<template><el prop.bind="p"></el></template>`,
            [Prop]
          );
          expect((template as HTMLTemplateElement).outerHTML).to.equal('<template><au-marker class="au"></au-marker></template>')
          const [hydratePropAttrInstruction] = instructions[0] as [HydrateTemplateController];
          expect((hydratePropAttrInstruction.def.template as HTMLTemplateElement).outerHTML).to.equal('<template><el></el></template>');
        });

        it('moves attrbiutes instructions before the template controller into it', () => {
          @customAttribute({
            name: 'prop',
            isTemplateController: true
          })
          class Prop {
            value: any;
          }
          const { template, instructions } = compileWith(
            `<template><el name.bind="name" title.bind="title" prop.bind="p"></el></template>`,
            [Prop]
          );
          expect((template as HTMLTemplateElement).outerHTML).to.equal('<template><au-marker class="au"></au-marker></template>')
          const [hydratePropAttrInstruction] = instructions[0] as [HydrateTemplateController];
          verifyInstructions(hydratePropAttrInstruction.instructions as any, [
            { toVerify: ['type', 'to', 'from'],
              type: TT.propertyBinding, to: 'value', from: new AccessScope('p') },
            { toVerify: ['type', 'to', 'from'],
              type: TT.propertyBinding, to: 'name', from: new AccessScope('name') },
            { toVerify: ['type', 'to', 'from'],
              type: TT.propertyBinding, to: 'title', from: new AccessScope('title') },
          ]);
        });

        describe('[as-element]', () => {
          it('understands [as-element]', () => {
            @customElement('not-div')
            class NotDiv {}
            const { instructions } = compileWith('<template><div as-element="not-div"></div></template>', [NotDiv]);
            verifyInstructions(instructions[0] as any, [
              { toVerify: ['type', 'res'],
                type: TT.hydrateElement, res: 'not-div' }
            ]);
          });

          it('does not throw when element is not found', () => {
            const { instructions } = compileWith('<template><div as-element="not-div"></div></template>');
            expect(instructions.length).to.equal(0);
          });

          describe('with template controller', () => {
            it('compiles', () => {
              @customElement('not-div')
              class NotDiv {}
              const { instructions } = compileWith(
                '<template><div if.bind="value" as-element="not-div"></div></template>',
                [NotDiv]
              );

              verifyInstructions(instructions[0] as any, [
                { toVerify: ['type', 'res', 'to'],
                  type: TargetedInstructionType.hydrateTemplateController, res: 'if' }
              ]);
              const templateControllerInst = instructions[0][0] as any as IHydrateTemplateController;
              verifyInstructions(templateControllerInst.instructions, [
                { toVerify: ['type', 'to', 'from'],
                  type: TargetedInstructionType.propertyBinding, to: 'value', from: new AccessScope('value') }
              ]);
              const [hydrateNotDivInstruction] = templateControllerInst.def.instructions[0] as [IHydrateElementInstruction];
              verifyInstructions([hydrateNotDivInstruction], [
                { toVerify: ['type', 'res'],
                  type: TargetedInstructionType.hydrateElement, res: 'not-div' }
              ]);
              verifyInstructions(hydrateNotDivInstruction.instructions, []);
            });
          });
        });
      });

      describe('<let/> element', () => {

        it('compiles', () => {
          const { instructions } = compileWith(`<template><let></let></template>`);
          expect(instructions.length).to.equal(1);
        });

        it('does not generate instructions when there is no bindings', () => {
          const { instructions } = compileWith(`<template><let></let></template>`);
          expect((instructions[0][0] as any).instructions.length).to.equal(0);
        });

        it('ignores custom element resource', () => {
          @customElement('let')
          class Let {}

          const { instructions } = compileWith(
            `<template><let></let></template>`,
            [Let]
          );
          verifyInstructions(instructions[0] as any, [
            { toVerify: ['type'], type: TT.letElement }
          ]);
        });

        it('compiles with attributes', () => {
          const { instructions } = compileWith(`<let a.bind="b" c="\${d}"></let>`);
          verifyInstructions((instructions[0][0] as any).instructions, [
            { toVerify: ['type', 'to', 'srcOrExp'],
              type: TT.letBinding, to: 'a', from: 'b' },
            { toVerify: ['type', 'to'],
              type: TT.letBinding, to: 'c' }
          ]);
        });

        describe('[to-view-model]', () => {
          it('understands [to-view-model]', () => {
            const { instructions } = compileWith(`<template><let to-view-model></let></template>`);
            expect((instructions[0][0] as any).toViewModel).to.be.true;
          });

          it('ignores [to-view-model] order', () => {
            let instructions = compileWith(`<template><let a.bind="a" to-view-model></let></template>`).instructions[0] as any;
            verifyInstructions(instructions, [
              { toVerify: ['type', 'toViewModel'], type: TT.letElement, toViewModel: true }
            ]);
            instructions = compileWith(`<template><let to-view-model a.bind="a"></let></template>`).instructions[0] as any;
            verifyInstructions(instructions, [
              { toVerify: ['type', 'toViewModel'], type: TT.letElement, toViewModel: true }
            ]);
          });
        });
      });
    });

    interface IExpectedInstruction {
      toVerify: string[];
      [prop: string]: any;
    }

    function compileWith(markup: string | Element, extraResources: any[] = [], viewCompileFlags?: ViewCompileFlags) {
      extraResources.forEach(e => e.register(container));
      return sut.compile(<any>{ template: markup, instructions: [], surrogates: [] }, resources, viewCompileFlags);
    }

    function verifyInstructions(actual: any[], expectation: IExpectedInstruction[], type?: string) {
      expect(actual.length).to.equal(expectation.length, `Expected to have ${expectation.length} ${type ? `${type} ` : ''} instructions. Received: ${actual.length}`);
      for (let i = 0, ii = actual.length; i < ii; ++i) {
        const actualInst = actual[i];
        const expectedInst = expectation[i];
        for (const prop of expectedInst.toVerify) {
          if (expectedInst[prop] instanceof Object) {
            expect(
              actualInst[prop]).to.deep.equal(expectedInst[prop],
              `Expected actual instruction ${type ? `of ${type}` : ''} to have "${prop}": ${expectedInst[prop]}. Received: ${actualInst[prop]} (on index: ${i})`
            );
          } else {
            expect(
              actualInst[prop]).to.equal(expectedInst[prop],
              `Expected actual instruction ${type ? `of ${type}` : ''} to have "${prop}": ${expectedInst[prop]}. Received: ${actualInst[prop]} (on index: ${i})`
            );
          }
        }
      }
    }
  });
});



function createTplCtrlAttributeInstruction(attr: string, value: string) {
  if (attr === 'repeat.for') {
    return [{
      type: TT.iteratorBinding,
      from: new ForOfStatement(
        new BindingIdentifier(value.split(' of ')[0]),
        new AccessScope(value.split(' of ')[1])),
      to: 'items'
    }, {
      type: TT.setProperty,
      value: 'item',
      to: 'local'
    }];
  } else {
    return [{
      type: TT.propertyBinding,
      from: value.length === 0 ? PrimitiveLiteral.$empty : new AccessScope(value),
      to: 'value',
      mode: BindingMode.toView,
      oneTime: false
    }];
  }
}

function createTemplateController(attr: string, target: string, value: string, tagName: string, finalize: boolean, childInstr?, childTpl?): CTCResult {
  // multiple template controllers per element
  if (tagName === null) {
    const node = <Element>createElement(childTpl);
    const attributes = [];
    while (node.attributes.length) {
      attributes.unshift(node.attributes[0]);
      node.removeAttribute(node.attributes[0].name);
    }
    node.setAttribute(attr, value);
    while (attributes.length) {
      const attr = attributes.pop();
      node.setAttribute(attr.name, attr.value);
    }
    node.setAttribute(attr, value);
    const rawMarkup = node.outerHTML;
    const instruction = {
      type: TT.hydrateTemplateController,
      res: target,
      def: {
        name: target,
        template: createElement(`<template><au-marker class="au"></au-marker></template>`),
        instructions: [[childInstr]]
      },
      instructions: createTplCtrlAttributeInstruction(attr, value),
      link: attr === 'else'
    };
    const input = {
      template: finalize ? `<div>${rawMarkup}</div>` : rawMarkup,
      instructions: []
    }
    const output = {
      template: createElement(`<div><au-marker class="au"></au-marker></div>`),
      instructions: [[instruction]]
    }
    return [input, <any>output];
  } else {
    let compiledMarkup;
    let instructions;
    if (childInstr === undefined) {
      compiledMarkup = `<${tagName}></${tagName}>`;
      instructions = []
    } else {
      compiledMarkup = `<${tagName}><au-marker class="au"></au-marker></${tagName}>`;
      instructions = [[childInstr]]
    }
    const instruction = {
      type: TT.hydrateTemplateController,
      res: target,
      def: {
        name: target,
        template: createElement(tagName === 'template' ? compiledMarkup : `<template>${compiledMarkup}</template>`),
        instructions
      },
      instructions: createTplCtrlAttributeInstruction(attr, value),
      link: attr === 'else'
    };
    const rawMarkup = `<${tagName} ${attr}="${value||''}">${childTpl||''}</${tagName}>`;
    const input = {
      template: finalize ? `<div>${rawMarkup}</div>` : rawMarkup,
      instructions: []
    }
    const output = {
      template: createElement(finalize ? `<div><au-marker class="au"></au-marker></div>` : `<au-marker class="au"></au-marker>`),
      instructions: [[instruction]]
    }
    return [input, <any>output];
  }
}

function createCustomElement(tagName: string, finalize: boolean, attributes: [string, string][], childInstructions: any[], siblingInstructions: any[], nestedElInstructions: any[], childOutput?, childInput?) {
  const instruction = {
    type: TT.hydrateElement,
    res: tagName,
    instructions: childInstructions
  };
  const attributeMarkup = attributes.map(a => `${a[0]}="${a[1]}"`).join(' ');
  const rawMarkup = `<${tagName} ${attributeMarkup}>${(childInput&&childInput.template)||''}</${tagName}>`;
  const input = {
    template: finalize ? `<div>${rawMarkup}</div>` : rawMarkup,
    instructions: []
  }
  const outputMarkup = <HTMLElement>createElement(`<${tagName} ${attributeMarkup}>${(childOutput&&childOutput.template.outerHTML)||''}</${tagName}>`);
  outputMarkup.classList.add('au');
  const output = {
    template: finalize ? createElement(`<div>${outputMarkup.outerHTML}</div>`) : outputMarkup,
    instructions: [[instruction, ...siblingInstructions], ...nestedElInstructions]
  }
  return [input, output];
}

function createCustomAttribute(resName: string, finalize: boolean, attributes: [string, string][], childInstructions: any[], siblingInstructions: any[], nestedElInstructions: any[], childOutput?, childInput?) {
  const instruction = {
    type: TT.hydrateAttribute,
    res: resName,
    instructions: childInstructions
  };
  const attributeMarkup = attributes.map(a => `${a[0]}: ${a[1]};`).join('');
  const rawMarkup = `<div ${resName}="${attributeMarkup}">${(childInput&&childInput.template)||''}</div>`;
  const input = {
    template: finalize ? `<div>${rawMarkup}</div>` : rawMarkup,
    instructions: []
  }
  const outputMarkup = <HTMLElement>createElement(`<div ${resName}="${attributeMarkup}">${(childOutput&&childOutput.template.outerHTML)||''}</div>`);
  outputMarkup.classList.add('au');
  const output = {
    template: finalize ? createElement(`<div>${outputMarkup.outerHTML}</div>`) : outputMarkup,
    instructions: [[instruction, ...siblingInstructions], ...nestedElInstructions]
  }
  return [input, output];
}

const commandToMode = {
  'one-time': BindingMode.oneTime,
  'to-view': BindingMode.toView,
  'from-view': BindingMode.fromView,
  'two-way': BindingMode.twoWay
};

const validCommands = ['bind', 'one-time', 'to-view', 'from-view', 'two-way', 'trigger', 'delegate', 'capture', 'call'];

function createAttributeInstruction(bindable: IBindableDescription | null, attributeName: string, attributeValue: string, isMulti: boolean) {
  const parts = attributeName.split('.');
  const attr = parts[0];
  const cmd = parts.pop();
  const defaultMode = !!bindable ? (bindable.mode === BindingMode.default ? BindingMode.toView : bindable.mode) : BindingMode.toView;
  const mode = commandToMode[cmd] || defaultMode;
  const oneTime = mode === BindingMode.oneTime;

  if (!!bindable) {
    if (!!cmd && validCommands.indexOf(cmd) !== -1) {
      const type = TT.propertyBinding;
      const to = bindable.property;
      const from = parseCore(attributeValue);
      return { type, to, mode, from, oneTime };
    } else {
      const from = parseCore(attributeValue, <any>BindingType.Interpolation);
      if (!!from) {
        const type = TT.interpolation;
        const to = bindable.property;
        return { type, to, from };
      } else {
        const type = TT.setProperty;
        const to = bindable.property;
        const value = attributeValue;
        return { type, to, value };
      }
    }
  } else {
    const type = TT.propertyBinding;
    const to = attr;
    if (!!cmd && validCommands.indexOf(cmd) !== -1) {
      const from = parseCore(attributeValue);
      return { type, to, mode, from, oneTime };
    } else {
      let from = parseCore(attributeValue, <any>BindingType.Interpolation);
      if (!!from) {
        const type = TT.interpolation;
        return { type, to, from };
      } else if (isMulti) {
        const type = TT.setProperty;
        const to = attr;
        const value = attributeValue;
        return { type, to, value };
      } else {
        return null;
      }
    }
  }
}

type CTCResult = [ITemplateDefinition, ITemplateDefinition];

type Bindables = { [pdName: string]: IBindableDescription };

describe(`TemplateCompiler - combinations`, () => {
  function setup(...globals: IRegistry[]) {
    const container = DI.createContainer();
    container.register(BasicConfiguration, ...globals);
    const expressionParser = container.get(IExpressionParser);
    const sut = new TemplateCompiler(expressionParser as any, elParser, attrParser);
    const resources = new RuntimeCompilationResources(<any>container);
    return { container, expressionParser, sut, resources }
  }

  describe('plain attributes', () => {
    eachCartesianJoinFactory([
      <(() => [string])[]>[
        () => ['div']
      ],
      <(($1: [string]) => [string, string, string, IExpression])[]>[
        () => ['foo', 'foo', 'bar', new AccessScope('bar')],
        () => ['foo.bar', 'foo', 'bar', new AccessScope('bar')],
        () => ['foo.bind', 'foo', 'bar', new AccessScope('bar')],
        () => ['value', 'value', 'value', new AccessScope('value')]
      ],
      <(($1: [string], $2: [string, string, string, IExpression]) => [string, string, any])[]>[
        ($1, [,, value, from]) => [`ref`,               value, { type: TT.refBinding,      from }],
        ($1, [attr, to, value, from]) => [`${attr}.bind`,      value, { type: TT.propertyBinding, from, to, mode: BindingMode.toView,   oneTime: false }],
        ($1, [attr, to, value, from]) => [`${attr}.to-view`,   value, { type: TT.propertyBinding, from, to, mode: BindingMode.toView,   oneTime: false }],
        ($1, [attr, to, value, from]) => [`${attr}.one-time`,  value, { type: TT.propertyBinding, from, to, mode: BindingMode.oneTime,  oneTime: true  }],
        ($1, [attr, to, value, from]) => [`${attr}.from-view`, value, { type: TT.propertyBinding, from, to, mode: BindingMode.fromView, oneTime: false }],
        ($1, [attr, to, value, from]) => [`${attr}.two-way`,   value, { type: TT.propertyBinding, from, to, mode: BindingMode.twoWay,   oneTime: false }],
        ($1, [attr, to, value, from]) => [`${attr}.trigger`,   value, { type: TT.listenerBinding, from, to, strategy: DelegationStrategy.none,      preventDefault: true }],
        ($1, [attr, to, value, from]) => [`${attr}.delegate`,  value, { type: TT.listenerBinding, from, to, strategy: DelegationStrategy.bubbling,  preventDefault: false }],
        ($1, [attr, to, value, from]) => [`${attr}.capture`,   value, { type: TT.listenerBinding, from, to, strategy: DelegationStrategy.capturing, preventDefault: false }],
        ($1, [attr, to, value, from]) => [`${attr}.call`,      value, { type: TT.callBinding,     from, to }]
      ]
    ], ([el], $2, [n1, v1, i1]) => {
      const markup = `<${el} ${n1}="${v1}"></${el}>`;

      it(markup, () => {
        const input = { template: markup, instructions: [], surrogates: [] };
        const expected = { template: createElement(`<${el} ${n1}="${v1}" class="au"></${el}>`), instructions: [[i1]], surrogates: [] };

        const { sut, resources } = setup();

        const actual = sut.compile(<any>input, resources);

        verifyBindingInstructionsEqual(actual, expected);
      });
    });
  });

  describe('custom attributes', () => {
    eachCartesianJoinFactory([
      // IAttributeDefinition.bindables
      <(() => [Record<string, IBindableDescription> | undefined, BindingMode | undefined, string])[]>[
        () => [undefined, undefined, 'value'],
        () => [{}, undefined,  'value'],
        () => [{ asdf: { attribute: 'bazBaz', property: 'bazBaz', mode: BindingMode.oneTime } }, BindingMode.oneTime, 'bazBaz'],
        () => [{ asdf: { attribute: 'bazBaz', property: 'bazBaz', mode: BindingMode.fromView } }, BindingMode.fromView, 'bazBaz'],
        () => [{ asdf: { attribute: 'bazBaz', property: 'bazBaz', mode: BindingMode.twoWay } }, BindingMode.twoWay, 'bazBaz'],
        () => [{ asdf: { attribute: 'bazBaz', property: 'bazBaz', mode: BindingMode.default } }, BindingMode.default, 'bazBaz']
      ],
      <(() => [string, string, IExpression, Constructable])[]>[
        () => ['foo',     '', PrimitiveLiteral.$empty, class Foo{}],
        () => ['foo-foo', '', PrimitiveLiteral.$empty, class FooFoo{}],
        () => ['foo',     'bar', new AccessScope('bar'), class Foo{}]
      ],
      // IAttributeDefinition.defaultBindingMode
      <(() => BindingMode | undefined)[]>[
        () => undefined,
        () => BindingMode.oneTime,
        () => BindingMode.toView,
        () => BindingMode.fromView,
        () => BindingMode.twoWay
      ],
      <(($1: [Record<string, IBindableDescription>, BindingMode, string], $2: [string, string, IExpression, Constructable], $3: BindingMode) => [string, any])[]>[
        ([, mode, to], [attr,, from], defaultMode) => [`${attr}`,           { type: TT.propertyBinding, from, to, mode: (mode && mode !== BindingMode.default) ? mode : (defaultMode || BindingMode.toView) }],
        ([, mode, to], [attr,, from], defaultMode) => [`${attr}.bind`,      { type: TT.propertyBinding, from, to, mode: (mode && mode !== BindingMode.default) ? mode : (defaultMode || BindingMode.toView) }],
        ([,, to], [attr,, from]) => [`${attr}.to-view`,   { type: TT.propertyBinding, from, to, mode: BindingMode.toView }],
        ([,, to], [attr,, from]) => [`${attr}.one-time`,  { type: TT.propertyBinding, from, to, mode: BindingMode.oneTime }],
        ([,, to], [attr,, from]) => [`${attr}.from-view`, { type: TT.propertyBinding, from, to, mode: BindingMode.fromView }],
        ([,, to], [attr,, from]) => [`${attr}.two-way`,   { type: TT.propertyBinding, from, to, mode: BindingMode.twoWay }]
      ]
    ], ([bindables], [attr, value,, ctor], defaultBindingMode, [name, childInstruction]) => {
      childInstruction.oneTime = childInstruction.mode === BindingMode.oneTime;
      const def = { name: PLATFORM.camelCase(attr), defaultBindingMode, bindables };
      const markup = `<div ${name}="${value}"></div>`;

      it(`${markup}  CustomAttribute=${JSON.stringify(def)}`, () => {
        const input = { template: markup, instructions: [], surrogates: [] };
        const instruction = { type: TT.hydrateAttribute, res: def.name, instructions: [childInstruction] };
        const expected = { template: createElement(`<div ${name}="${value}" class="au"></div>`), instructions: [[instruction]], surrogates: [] };

        const $def = CustomAttributeResource.define(def, ctor);
        const { sut, resources } = setup($def);

        const actual = sut.compile(<any>input, resources);

        verifyBindingInstructionsEqual(actual, expected);
      });
    });
  });

  describe('custom attributes with multiple bindings', () => {

    eachCartesianJoinFactory([
      <(() => string)[]>[
        () => 'foo',
        () => 'bar42'
      ],
      <(($1: string) => string)[]>[
        (pdName) => pdName,
        (pdName) => `${pdName}Bar` // descriptor.property is different from the actual property name
      ],
      <(($1: string, $2: string) => Bindables)[]>[
        (pdName, pdProp) => ({ [pdName]: { property: pdProp, attribute: PLATFORM.kebabCase(pdProp), mode: BindingMode.default  } }),
        (pdName, pdProp) => ({ [pdName]: { property: pdProp, attribute: PLATFORM.kebabCase(pdProp), mode: BindingMode.oneTime  } }),
        (pdName, pdProp) => ({ [pdName]: { property: pdProp, attribute: PLATFORM.kebabCase(pdProp), mode: BindingMode.toView   } }),
        (pdName, pdProp) => ({ [pdName]: { property: pdProp, attribute: PLATFORM.kebabCase(pdProp), mode: BindingMode.fromView } }),
        (pdName, pdProp) => ({ [pdName]: { property: pdProp, attribute: PLATFORM.kebabCase(pdProp), mode: BindingMode.twoWay   } })
      ],
      <(() => [string, string])[]>[
        () => [``,           `''`],
        () => [``,           `\${a}`],
        () => [`.bind`,      `''`],
        () => [`.one-time`,  `''`],
        () => [`.to-view`,   `''`],
        () => [`.from-view`, `''`],
        () => [`.two-way`,   `''`]
      ],
      <(($1: string, $2: string, $3: Bindables, $4: [string, string]) => [IBindableDescription, string])[]>[
        (pdName, pdProp, bindables, [cmd]) => [bindables[pdName], `${pdProp}${cmd}`],
        (pdName, pdProp, bindables, [cmd]) => [bindables[pdName], `${pdProp}.qux${cmd}`],
        (pdName, pdProp, bindables, [cmd]) => [null,              `${pdProp}Qux${cmd}`]
        // TODO: test fallback to attribute name when no matching binding exists (or throw if we don't want to support this)
      ]
    ], (pdName, pdProp, bindables, [cmd, attrValue], [bindable, attrName]) => {
      it(`div - pdName=${pdName}  pdProp=${pdProp}  cmd=${cmd}  attrName=${attrName}  attrValue="${attrValue}"`, () => {

        const { sut, resources } = setup(
          <any>CustomAttributeResource.define({ name: 'asdf', bindables }, class FooBar{})
        );

        const instruction = createAttributeInstruction(bindable, attrName, attrValue, true);

        const [input, output] = createCustomAttribute('asdf', true, [[attrName, attrValue]], [instruction], [], []);

        const actual = sut.compile(<any>input, resources);
        try {
          verifyBindingInstructionsEqual(actual, output);
        } catch(err) {
          //console.log('EXPECTED: ', JSON.stringify(output.instructions[0][0], null, 2));
          //console.log('ACTUAL: ', JSON.stringify(actual.instructions[0][0], null, 2));
          throw err;
        }
      });
    });
  });

  describe('nested template controllers (one per element)', () => {

    eachCartesianJoinFactory([
      <(() => CTCResult)[]>[
        () => createTemplateController('foo',        'foo',    '',              'div',      false),
        () => createTemplateController('foo',        'foo',    'bar',           'div',      false),
        () => createTemplateController('if.bind',    'if',     'show',          'div',      false),
        () => createTemplateController('if.bind',    'if',     'show',          'template', false),
        () => createTemplateController('repeat.for', 'repeat', 'item of items', 'div',      false),
        () => createTemplateController('repeat.for', 'repeat', 'item of items', 'template', false)
      ],
      <(($1: CTCResult) => CTCResult)[]>[
        ([input, output]) => createTemplateController('foo',        'foo',    '',              'div',      false, output.instructions[0][0], input.template),
        ([input, output]) => createTemplateController('foo',        'foo',    'bar',           'div',      false, output.instructions[0][0], input.template),
        ([input, output]) => createTemplateController('if.bind',    'if',     'show',          'div',      false, output.instructions[0][0], input.template),
        ([input, output]) => createTemplateController('else',       'else',   '',              'div',      false, output.instructions[0][0], input.template),
        ([input, output]) => createTemplateController('else',       'else',   '',              'template', false, output.instructions[0][0], input.template),
        ([input, output]) => createTemplateController('repeat.for', 'repeat', 'item of items', 'div',      false, output.instructions[0][0], input.template),
        ([input, output]) => createTemplateController('with.bind',  'with',   'foo',           'div',      false, output.instructions[0][0], input.template),
        ([input, output]) => createTemplateController('with.bind',  'with',   'foo',           'template', false, output.instructions[0][0], input.template)
      ],
      <(($1: CTCResult, $2: CTCResult) => CTCResult)[]>[
        ($1, [input, output]) => createTemplateController('foo',        'foo',    '',              'div',      false, output.instructions[0][0], input.template),
        ($1, [input, output]) => createTemplateController('foo',        'foo',    'bar',           'div',      false, output.instructions[0][0], input.template),
        ($1, [input, output]) => createTemplateController('foo',        'foo',    'bar',           'template', false, output.instructions[0][0], input.template),
        ($1, [input, output]) => createTemplateController('repeat.for', 'repeat', 'item of items', 'div',      false, output.instructions[0][0], input.template),
        ($1, [input, output]) => createTemplateController('repeat.for', 'repeat', 'item of items', 'template', false, output.instructions[0][0], input.template)
      ],
      <(($1: CTCResult, $2: CTCResult, $3: CTCResult) => CTCResult)[]>[
        ($1, $2, [input, output]) => createTemplateController('bar',        'bar',    '',              'div',      true, output.instructions[0][0], input.template),
        ($1, $2, [input, output]) => createTemplateController('bar',        'bar',    'baz',           'div',      true, output.instructions[0][0], input.template),
        ($1, $2, [input, output]) => createTemplateController('bar',        'bar',    'baz',           'template', true, output.instructions[0][0], input.template),
        ($1, $2, [input, output]) => createTemplateController('repeat.for', 'repeat', 'item of items', 'div',      true, output.instructions[0][0], input.template),
        ($1, $2, [input, output]) => createTemplateController('repeat.for', 'repeat', 'item of items', 'template', true, output.instructions[0][0], input.template)
      ]
    ], ($1, $2, $3, [input, output]) => {

      it(`${input.template}`, () => {

        const { sut, resources } = setup(
          <any>CustomAttributeResource.define({ name: 'foo', isTemplateController: true }, class Foo{}),
          <any>CustomAttributeResource.define({ name: 'bar', isTemplateController: true }, class Bar{}),
          <any>CustomAttributeResource.define({ name: 'baz', isTemplateController: true }, class Baz{}),
          <any>CustomAttributeResource.define({ name: 'qux', isTemplateController: true }, class Qux{})
        );

        const actual = sut.compile(<any>input, resources);
        try {
          verifyBindingInstructionsEqual(actual, output);
        } catch(err) {
          //console.log('EXPECTED: ', JSON.stringify(output.instructions[0][0], null, 2));
          //console.log('ACTUAL: ', JSON.stringify(actual.instructions[0][0], null, 2));
          throw err;
        }
      });
    });
  });

  describe('nested template controllers (multiple per element)', () => {

    eachCartesianJoinFactory([
      <(() => CTCResult)[]>[
        () => createTemplateController('foo',        'foo',    '',              'div',      false),
        () => createTemplateController('foo',        'foo',    'bar',           'div',      false),
        () => createTemplateController('if.bind',    'if',     'show',          'div',      false),
        () => createTemplateController('if.bind',    'if',     'show',          'template', false),
        () => createTemplateController('repeat.for', 'repeat', 'item of items', 'div',      false),
        () => createTemplateController('repeat.for', 'repeat', 'item of items', 'template', false)
      ],
      <(($1: CTCResult) => CTCResult)[]>[
        ([input, output]) => createTemplateController('bar',        'bar',    '',              null,       false, output.instructions[0][0], input.template),
        ([input, output]) => createTemplateController('else',       'else',   '',              null,       false, output.instructions[0][0], input.template),
        ([input, output]) => createTemplateController('with.bind',  'with',   'foo',           null,       false, output.instructions[0][0], input.template)
      ],
      <(($1: CTCResult, $2: CTCResult) => CTCResult)[]>[
        ($1, [input, output]) => createTemplateController('foo',        'foo',    '',              'div',      false, output.instructions[0][0], input.template),
        ($1, [input, output]) => createTemplateController('foo',        'foo',    'bar',           'div',      false, output.instructions[0][0], input.template),
        ($1, [input, output]) => createTemplateController('foo',        'foo',    'bar',           'template', false, output.instructions[0][0], input.template),
        ($1, [input, output]) => createTemplateController('baz',        'baz',    '',              null,       false, output.instructions[0][0], input.template),
        ($1, [input, output]) => createTemplateController('repeat.for', 'repeat', 'item of items', 'div',      false, output.instructions[0][0], input.template),
        ($1, [input, output]) => createTemplateController('repeat.for', 'repeat', 'item of items', 'template', false, output.instructions[0][0], input.template)
      ],
      <(($1: CTCResult, $2: CTCResult, $3: CTCResult) => CTCResult)[]>[
        ($1, $2, [input, output]) => createTemplateController('qux',        'qux',    '',              null,       false, output.instructions[0][0], input.template),
        ($1, $2, [input, output]) => createTemplateController('if.bind',    'if',     '',              'template', false, output.instructions[0][0], input.template),
        ($1, $2, [input, output]) => createTemplateController('if.bind',    'if',     '',              'div',      false, output.instructions[0][0], input.template),
        ($1, $2, [input, output]) => createTemplateController('repeat.for', 'repeat', 'item of items', 'div',      false, output.instructions[0][0], input.template),
        ($1, $2, [input, output]) => createTemplateController('repeat.for', 'repeat', 'item of items', 'template', false, output.instructions[0][0], input.template)
      ],
      <(($1: CTCResult, $2: CTCResult, $3: CTCResult, $4: CTCResult) => CTCResult)[]>[
        ($1, $2, $3, [input, output]) => createTemplateController('quux',       'quux',   '',              null,       true, output.instructions[0][0], input.template)
      ]
    ], ($1, $2, $3, $4, [input, output]) => {

      it(`${input.template}`, () => {

        const { sut, resources } = setup(
          <any>CustomAttributeResource.define({ name: 'foo',  isTemplateController: true }, class Foo{}),
          <any>CustomAttributeResource.define({ name: 'bar',  isTemplateController: true }, class Bar{}),
          <any>CustomAttributeResource.define({ name: 'baz',  isTemplateController: true }, class Baz{}),
          <any>CustomAttributeResource.define({ name: 'qux',  isTemplateController: true }, class Qux{}),
          <any>CustomAttributeResource.define({ name: 'quux', isTemplateController: true }, class Quux{})
        );

        const actual = sut.compile(<any>input, resources);
        try {
          verifyBindingInstructionsEqual(actual, output);
        } catch(err) {
          //console.log('EXPECTED: ', JSON.stringify(output.instructions[0][0], null, 2));
          //console.log('ACTUAL: ', JSON.stringify(actual.instructions[0][0], null, 2));
          throw err;
        }
      });
    });
  });

  describe('sibling template controllers', () => {

    eachCartesianJoinFactory([
      <(() => CTCResult[])[]>[
        () => []
      ],
      <((results: CTCResult[]) => void)[]>[
        (results: CTCResult[]) => { results.push(createTemplateController('foo',        'foo',    '',              'div', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('foo',        'foo',    '',              'template', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('foo',        'foo',    'bar',           'div', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('if.bind',    'if',     'show',          'div', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('repeat.for', 'repeat', 'item of items', 'div', false)) }
      ],
      <((results: CTCResult[]) => void)[]>[
        (results: CTCResult[]) => { results.push(createTemplateController('foo',        'foo',    '',              'div', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('foo',        'foo',    'bar',           'div', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('if.bind',    'if',     'show',          'div', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('if.bind',    'if',     'show',          'template', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('else',       'else',   '',              'div', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('repeat.for', 'repeat', 'item of items', 'div', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('repeat.for', 'repeat', 'item of items', 'template', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('with.bind',  'with',   'bar',           'div', false)) }
      ],
      <((results: CTCResult[]) => void)[]>[
        (results: CTCResult[]) => { results.push(createTemplateController('foo',        'foo',    '',              'div', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('foo',        'foo',    'bar',           'div', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('repeat.for', 'repeat', 'item of items', 'div', false)) },
        (results: CTCResult[]) => { results.push(createTemplateController('repeat.for', 'repeat', 'item of items', 'template', false)) }
      ]
    ], ([[input1, output1], [input2, output2], [input3, output3]]) => {
      const input = {
        template: `<div>${input1.template}${input2.template}${input3.template}</div>`,
        instructions: []
      };

      it(`${input.template}`, () => {

        const { sut, resources } = setup(
          <any>CustomAttributeResource.define({ name: 'foo', isTemplateController: true }, class Foo{}),
          <any>CustomAttributeResource.define({ name: 'bar', isTemplateController: true }, class Bar{}),
          <any>CustomAttributeResource.define({ name: 'baz', isTemplateController: true }, class Baz{})
        );

        const output = {
          template: createElement(`<div>${output1.template['outerHTML']}${output2.template['outerHTML']}${output3.template['outerHTML']}</div>`),
          instructions: [output1.instructions[0], output2.instructions[0], output3.instructions[0]]
        };
        const actual = sut.compile(<any>input, resources);
        try {
          verifyBindingInstructionsEqual(actual, output);
        } catch(err) {
          //console.log('EXPECTED: ', JSON.stringify(output.instructions[0][0], null, 2));
          //console.log('ACTUAL: ', JSON.stringify(actual.instructions[0][0], null, 2));
          throw err;
        }
      });
    });
  });

  describe('attributes on custom elements', () => {
    eachCartesianJoinFactory([
      <(() => string)[]>[
        () => 'foo',
        () => 'bar42'
      ],
      <(($1: string) => string)[]>[
        (pdName) => pdName,
        (pdName) => `${pdName}Bar` // descriptor.property is different from the actual property name
      ],
      <(($1: string, $2: string) => string)[]>[
        (pdName, pdProp) => PLATFORM.kebabCase(pdProp),
        (pdName, pdProp) => `${PLATFORM.kebabCase(pdProp)}-baz` // descriptor.attribute is different from kebab-cased descriptor.property
      ],
      <(($1: string, $2: string, $3: string) => Bindables)[]>[
        (pdName, pdProp, pdAttr) => ({ [pdName]: { property: pdProp, attribute: pdAttr, mode: BindingMode.default  } }),
        (pdName, pdProp, pdAttr) => ({ [pdName]: { property: pdProp, attribute: pdAttr, mode: BindingMode.oneTime  } }),
        (pdName, pdProp, pdAttr) => ({ [pdName]: { property: pdProp, attribute: pdAttr, mode: BindingMode.toView   } }),
        (pdName, pdProp, pdAttr) => ({ [pdName]: { property: pdProp, attribute: pdAttr, mode: BindingMode.fromView } }),
        (pdName, pdProp, pdAttr) => ({ [pdName]: { property: pdProp, attribute: pdAttr, mode: BindingMode.twoWay   } })
      ],
      <(() => [string, string])[]>[
        () => [``,           `''`],
        () => [``,           `\${a}`],
        () => [`.bind`,      `''`],
        () => [`.one-time`,  `''`],
        () => [`.to-view`,   `''`],
        () => [`.from-view`, `''`],
        () => [`.two-way`,   `''`]
      ],
      <(($1: string, $2: string, $3: string, $4: Bindables, $5: [string, string]) => [IBindableDescription, string])[]>[
        (pdName, pdProp, pdAttr, bindables, [cmd]) => [bindables[pdName], `${pdAttr}${cmd}`],
        (pdName, pdProp, pdAttr, bindables, [cmd]) => [bindables[pdName], `${pdAttr}.qux${cmd}`],
        (pdName, pdProp, pdAttr, bindables, [cmd]) => [null,              `${pdAttr}-qux${cmd}`]
      ],
      <(() => string)[]>[
        () => `''`
      ]
    ], (pdName, pdProp, pdAttr, bindables, [cmd, attrValue], [bindable, attrName]) => {
      it(`customElement - pdName=${pdName}  pdProp=${pdProp}  pdAttr=${pdAttr}  cmd=${cmd}  attrName=${attrName}  attrValue="${attrValue}"`, () => {

        const { sut, resources } = setup(
          <any>CustomElementResource.define({ name: 'foobar', bindables }, class FooBar{})
        );

        const instruction = createAttributeInstruction(bindable, attrName, attrValue, false);
        const instructions = instruction === null ? [] : [instruction];
        const childInstructions = !!bindable ? instructions : [];
        const siblingInstructions = !bindable ? instructions : [];

        const [input, output] = createCustomElement('foobar', true, [[attrName, attrValue]], childInstructions, siblingInstructions, []);

        const actual = sut.compile(<any>input, resources);
        try {
          verifyBindingInstructionsEqual(actual, output);
        } catch(err) {
          //console.log('EXPECTED: ', JSON.stringify(output.instructions[0][0], null, 2));
          //console.log('ACTUAL: ', JSON.stringify(actual.instructions[0][0], null, 2));
          throw err;
        }
      });
    });
  });

  describe('custom elements', () => {
    eachCartesianJoinFactory([
      <(() => CTCResult)[]>[
        () => createCustomElement(`foo`, false, [], [], [], []),
        () => createCustomElement(`bar`, false, [], [], [], []),
        () => createCustomElement(`baz`, false, [], [], [], [])
      ],
      <(($1: CTCResult) => CTCResult)[]>[
        ([input, output]) => createCustomElement(`foo`, false, [], [], [], output.instructions, output, input),
        ([input, output]) => createCustomElement(`bar`, false, [], [], [], output.instructions, output, input),
        ([input, output]) => createCustomElement(`baz`, false, [], [], [], output.instructions, output, input)
      ],
      <(($1: CTCResult, $2: CTCResult) => CTCResult)[]>[
        ($1, [input, output]) => createCustomElement(`foo`, true, [], [], [], output.instructions, output, input),
        ($1, [input, output]) => createCustomElement(`bar`, true, [], [], [], output.instructions, output, input),
        ($1, [input, output]) => createCustomElement(`baz`, true, [], [], [], output.instructions, output, input)
      ]
    ], ($1, $2, [input, output]) => {
      it(`${input.template}`, () => {

        const { sut, resources } = setup(
          <any>CustomElementResource.define({ name: 'foo' }, class Foo{}),
          <any>CustomElementResource.define({ name: 'bar' }, class Bar{}),
          <any>CustomElementResource.define({ name: 'baz' }, class Baz{})
        );

        const actual = sut.compile(<any>input, resources);
        try {
          verifyBindingInstructionsEqual(actual, output);
        } catch(err) {
          //console.log('EXPECTED: ', JSON.stringify(output.instructions[0][0], null, 2));
          //console.log('ACTUAL: ', JSON.stringify(actual.instructions[0][0], null, 2));
          throw err;
        }
      });
    });
  });

  // it('test', () => {
  //   const { sut, resources } = setup(
  //     <any>CustomElementResource.define({ name: 'foo' }, class Foo{}),
  //     <any>CustomAttributeResource.define({ name: 'bar' }, class Bar{})
  //   );

  //   const [input, output] = createCustomElement(`foo`, false, [], [], [], []);
  //   const actual = sut.compile(<any>input, resources)

  //   verifyBindingInstructionsEqual(actual, output);
  // })
});
