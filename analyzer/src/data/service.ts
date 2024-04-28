import Profiler from "./profiler";
import Scope from "./objects/scope";
import ConditionalScope from "./objects/conditionalScope";
import Condition from "./objects/condition";
import FunctionScope from "./objects/functionScope";
import * as algorithms from "../algorithms";
import { SyntaxNode as Node } from "tree-sitter";
import Variable from "./objects/variable";
import { FunctionObject } from "../types";

const conditionalScopes = ["if", "else if", "while", "for"];

class Data {
  currentScope: Scope;
  scopes: Scope[];
  profiler: Profiler;
  functions: FunctionObject[];
  constructor() {
    this.currentScope = null;
    this.scopes = [];
    this.profiler = new Profiler();
    this.functions = [];
  }

  declareVariable(name: string, type: string) {
    const alreadyDeclared = this.scopes.some((scope) =>
      scope.containsVariable(name),
    );
    if (alreadyDeclared) this.profiler.registerRedeclaration();
    this.currentScope.declareVariable(name, type);
  }

  useVariable(name: string) {
    for (let scope of this.scopes) {
      scope.useVariable(name);
      if (scope.containsVariable(name)) break;
    }
  }

  registerInclude(name: string) {
    const libraryName = name.replace(/[<>"']/g, "");
    this.profiler.addInclude(libraryName);
  }

  createScope({
    type,
    returnType,
  }: { type?: string; returnType?: string } = {}) {
    let newScope: Scope;
    if (conditionalScopes.includes(type)) {
      newScope = new ConditionalScope({
        loops: type === "while" || type === "for",
      });
    } else if (type === "function") {
      newScope = new FunctionScope({ returnType });
    } else {
      newScope = new Scope();
    }
    this.currentScope = newScope;
    this.scopes.unshift(newScope);
  }

  leaveScope() {
    let leavingScope = this.scopes.shift();
    this.currentScope = this.scopes[0];
    let unUsedVariables = leavingScope.getUnUsedVariables();
    unUsedVariables.forEach((v) => this.profiler.addUnUsedVariable(v.name));
    if (
      leavingScope instanceof ConditionalScope &&
      !leavingScope.conditionUpdated()
    )
      this.profiler.registerConstantCondition();
    if (leavingScope instanceof FunctionScope) {
      const f = leavingScope.getFunction();
      this.functions.push(f);
      this.profiler.addFunction(f);
    }
  }

  storeCondition(nodes: Node[]) {
    const condition = new Condition(nodes);
    if (this.currentScope instanceof ConditionalScope)
      this.currentScope.condition = condition;
  }

  breakStatement() {
    if (this.currentScope instanceof ConditionalScope) {
      this.currentScope.registerBreak();
      this.profiler.registerBreak();
    }
  }

  continueStatement() {
    if (this.currentScope instanceof ConditionalScope) {
      this.profiler.registerContinue();
    }
  }

  setFunctionName(name: string) {
    if (this.currentScope instanceof FunctionScope) {
      this.currentScope.name = name;
      if (name !== "main") this.profiler.registerFunction();
    }
  }

  storeParameter(name: string, type: string) {
    if (this.currentScope instanceof FunctionScope) {
      this.currentScope.addParameter(name, type);
    }
    this.declareVariable(name, type);
  }

  registerCall(name: string) {
    const functionScope = this.scopes.find(scope => scope instanceof FunctionScope) as FunctionScope;
    functionScope.registerCall(name);
  }

  diagnose() {
    const dependencies = this.functions.reduce((acc, f) => {
      acc[f.name] = f.dependencies;
      return acc;
    }, {});
    const isRecursive = algorithms.isRecursive(dependencies);
    if (isRecursive) this.profiler.registerRecursion();
    return this.profiler.result();
  }
}

export default Data;
