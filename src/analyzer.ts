import Data from "./data/service";
import parser from "./parser";
import utils from "./utils";
import * as traversers from "./traversers";
import {SyntaxNode as Node} from "tree-sitter"

export default class Analyzer {
  store: Data;
  constructor() {
    this.store = new Data();
  }
  analyze(code: string) {
    const tree = parser.parse(code);
    const rootNode = tree.rootNode;
    this.store.createScope({ type: "global" });
    try {
      this.traverse(rootNode);
    } catch (e) {
      console.error(e);
    } finally {
      this.store.leaveScope()
      return this.store.diagnose();
    }
  }
  traverse(node: Node, depth: number = 0) {
    utils.log(node,depth);
    if (this.traversers[node.type]) {
      return this.traversers[node.type](node, depth);
    } else {
      node.children.forEach((c) => this.traverse(c, depth + 1));
    }
  }
  
  traversers = {
    declaration: traversers.declarationTraverser.bind(this),
    identifier: traversers.identifierTraverser.bind(this),
    while_statement: traversers.while_statementTraverser.bind(this),
    for_statement: traversers.for_statementTraverser.bind(this),
    if_statement: traversers.if_statementTraverser.bind(this),
    condition_clause: traversers.condition_clauseTraverser.bind(this),
    compound_statement: traversers.compound_statementTraverser.bind(this),
    preproc_include: traversers.preproc_includeTraverser.bind(this),
    break_statement: traversers.break_statementTraverser.bind(this),
    function_definition: traversers.function_definitionTraverser.bind(this),
    function_declarator: traversers.function_declaratorTraverser.bind(this),
    parameter_declaration: traversers.parameter_declarationTraverser.bind(this),
    call_expression: traversers.call_expressionTraverser.bind(this),
  };
}
