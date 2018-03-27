import * as ts from 'typescript';
import * as AST from './ast';
import { IObjectBuilder, IObjectContext } from '../composition/interfaces';
import { NoObject } from '../composition/core';
import { ChildNode, OptionalRequest } from './ts-syntax-transformer';

export class ModuleBuilder implements IObjectBuilder {
  public create(request: ts.Node, context: IObjectContext): Partial<AST.INode> | symbol {
    if (request.kind !== ts.SyntaxKind.SourceFile) return NoObject;

    const sourceFile = request as ts.SourceFile;
    const output = new AST.Node(AST.NodeKind.Module, null) as AST.IModule;
    output.path = sourceFile.fileName;

    for (const statement of sourceFile.statements) {
      const result = context.resolve(ChildNode.of(statement).withParentOutput(output));
      if (Array.isArray(result)) {
        output.items.push(...result);
      } else {
        output.items.push(result);
      }
    }

    return output;
  }
}

export class ClassBuilder implements IObjectBuilder {
  public create(request: ts.Node, context: IObjectContext): Partial<AST.INode> | symbol {
    if (request.kind !== ts.SyntaxKind.ClassDeclaration) return NoObject;

    const classDeclaration = request as ts.ClassDeclaration;
    const output = new AST.Node(AST.NodeKind.Class) as AST.IClass;
    output.name = context.resolve(classDeclaration.name);
    output.decorators = classDeclaration.decorators as any;

    for (const element of classDeclaration.members) {
      const member = context.resolve(ChildNode.of(element).withParentOutput(output));
      if (element.kind === ts.SyntaxKind.Constructor) {
        output.ctor = member;
      }
      output.members.push(member);
    }

    return output;
  }
}

export class FunctionBuilder implements IObjectBuilder {
  public create(request: ts.Node, context: IObjectContext): Partial<AST.INode> | symbol {
    if (request.kind !== ts.SyntaxKind.FunctionDeclaration) return NoObject;

    const functionDeclaration = request as ts.FunctionDeclaration;
    const output = new AST.Node(AST.NodeKind.Function) as AST.IFunction;
    output.name = context.resolve(functionDeclaration.name);
    output.decorators = functionDeclaration.decorators as any;

    for (const parameterDeclaration of functionDeclaration.parameters) {
      const parameter = context.resolve(ChildNode.of(parameterDeclaration).withParentOutput(output));
      output.parameters.push(parameter);
    }

    return output;
  }
}

export class VariableBuilder implements IObjectBuilder {
  public create(request: ts.Node, context: IObjectContext): Partial<AST.INode>[] | symbol {
    if (request.kind !== ts.SyntaxKind.VariableDeclaration) return NoObject;

    const outputs: Partial<AST.IVariable>[] = [];
    const variableStatement = request as ts.VariableStatement;
    for (const declaration of variableStatement.declarationList.declarations) {
      if (declaration.name.kind === ts.SyntaxKind.Identifier) {
        const output = new AST.Node(AST.NodeKind.Variable) as AST.IVariable;
        output.name = context.resolve(declaration.name);
        output.decorators = variableStatement.decorators as any;
        outputs.push(output);
      }
    }

    return outputs;
  }
}

export class ModuleImportBuilder implements IObjectBuilder {
  public create(request: ts.Node, context: IObjectContext): Partial<AST.INode>[] | symbol {
    if (request.kind !== ts.SyntaxKind.ImportDeclaration) return NoObject;

    const outputs: Partial<AST.IModuleImport>[] = [];
    const importDeclaration = request as ts.ImportDeclaration;
    const namedBindings = importDeclaration.importClause.namedBindings;
    if (namedBindings && namedBindings.kind === ts.SyntaxKind.NamedImports) {
      const path = context.resolve(OptionalRequest.for(importDeclaration.moduleSpecifier));
      for (const element of namedBindings.elements) {
        const output = new AST.Node(AST.NodeKind.ModuleImport) as AST.IModuleImport;
        output.path = path;
        output.name = context.resolve(element.name);
        outputs.push(output);
      }
    }

    return outputs;
  }
}

export class ModuleExportsBuilder implements IObjectBuilder {
  public create(request: ts.Node, context: IObjectContext): Partial<AST.INode>[] | symbol {
    if (request.kind !== ts.SyntaxKind.ExportDeclaration) return NoObject;

    const outputs: Partial<AST.IModuleExport>[] = [];
    const exportDeclaration = request as ts.ExportDeclaration;
    if (exportDeclaration.exportClause) {
      const path = context.resolve(OptionalRequest.for(exportDeclaration.moduleSpecifier));
      for (const element of exportDeclaration.exportClause.elements) {
        const output = new AST.Node(AST.NodeKind.ModuleExport) as AST.IModuleExport;
        output.path = path;
        output.name = context.resolve(element.name);
        outputs.push(output);
      }
    }

    return outputs;
  }
}

export class CallExpressionBuilder implements IObjectBuilder {
  public create(request: ts.Node, context: IObjectContext): Partial<AST.INode> | symbol {
    if (request.kind !== ts.SyntaxKind.CallExpression) return NoObject;

    return {}; //todo
  }
}

export class DecoratorBuilder implements IObjectBuilder {
  public create(request: ts.Decorator, context: IObjectContext): Partial<AST.INode> | symbol {
    if (request.kind !== ts.SyntaxKind.Decorator) return NoObject;

    const callExpression = request.expression as ts.CallExpression;
    const expressionText = context.resolve(callExpression.expression);
    const output = new AST.Node(AST.NodeKind.Decorator) as AST.IDecorator;
    output.name = expressionText;
    output.text = expressionText; //output.todo = raw string?

    return output;
  }
}

export class MethodBuilder implements IObjectBuilder {
  public create(request: ts.Node, context: IObjectContext): Partial<AST.INode> | symbol {
    if (request.kind !== ts.SyntaxKind.MethodDeclaration) return NoObject;

    const methodDeclaration = request as ts.MethodDeclaration;
    const output = new AST.Node(AST.NodeKind.Method) as AST.IMethod;
    output.name = context.resolve(methodDeclaration.name);
    for (const parameterDeclaration of methodDeclaration.parameters) {
      const parameter = context.resolve(ChildNode.of(parameterDeclaration).withParentOutput(output));
      output.parameters.push(parameter);
    }

    return output;
  }
}

export class ConstructorBuilder implements IObjectBuilder {
  public create(request: ts.Node, context: IObjectContext): Partial<AST.INode> | symbol {
    if (request.kind !== ts.SyntaxKind.Constructor) return NoObject;

    const constructorDeclaration = request as ts.ConstructorDeclaration;
    const output = new AST.Node(AST.NodeKind.Constructor) as AST.IConstructor;
    for (const parameterDeclaration of constructorDeclaration.parameters) {
      const parameter = context.resolve(ChildNode.of(parameterDeclaration).withParentOutput(output));
      output.parameters.push(parameter);
    }

    return output;
  }
}

export class PropertyBuilder implements IObjectBuilder {
  public create(request: ts.Node, context: IObjectContext): Partial<AST.INode> | symbol {
    if (request.kind !== ts.SyntaxKind.PropertyDeclaration) return NoObject;

    const propertyDeclaration = request as ts.PropertyDeclaration;
    const output = new AST.Node(AST.NodeKind.Property) as AST.IProperty;
    output.name = context.resolve(propertyDeclaration.name);

    return output;
  }
}

export class ParameterBuilder implements IObjectBuilder {
  public create(request: ts.Node, context: IObjectContext): Partial<AST.INode> | symbol {
    if (request.kind !== ts.SyntaxKind.Parameter) return NoObject;

    const parameterDeclaration = request as ts.ParameterDeclaration;
    const name = context.resolve(parameterDeclaration.name);
    const typeName = context.resolve(parameterDeclaration.type);
    const output = new AST.Node(AST.NodeKind.Parameter) as AST.IParameter;
    output.name = name;
    output.typeName = typeName;
    output.text = name;
    output.decorators = parameterDeclaration.decorators as any;

    return output;
  }
}
