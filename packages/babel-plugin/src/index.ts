import type { PluginObj } from "@babel/core";
import * as babel from "@babel/core";

function hasDirective(t: typeof babel.types, program: babel.types.Program, value: string): boolean {
	return program.directives.some(
		(d) => t.isDirective(d) && t.isDirectiveLiteral(d.value, { value })
	);
}

type Directive = "client" | "server" | "none";

function getDirective(t: typeof babel.types, program: babel.types.Program): Directive {
	const hasClientDirective = hasDirective(t, program, "use client");
	const hasServerDirective = hasDirective(t, program, "use server");
	if (hasClientDirective && !hasServerDirective) {
		return "client";
	}
	if (hasServerDirective && !hasClientDirective) {
		return "server";
	}
	if (hasClientDirective && hasServerDirective) {
		throw new Error("Can't have 'use server' and 'use client' in same file");
	}
	return "none";
}

const EXPORT_NAMES_KEY = Symbol("exportNames");
const DIRECTIVE_KEY = Symbol("directive");

export default function rscTransform({ types: t }: typeof babel): PluginObj {
	const name = "@react-flight/babel-plugin/react-server-components";

	return {
		name,
		pre(file) {
			this.set(EXPORT_NAMES_KEY, []);
		},
		visitor: {
			Program(path, pass) {
				const directive = getDirective(t, path.node);
				this.set(DIRECTIVE_KEY, directive);
			},
			ExportDefaultDeclaration(path, pass) {
				const directive: Directive = this.get(DIRECTIVE_KEY);
				const exportNames: string[] = this.get(EXPORT_NAMES_KEY);
				if (directive === "client") {
					exportNames.push("default");
					return;
				}
				if (directive === "server") {
					const declaration = path.node.declaration;
					const actionDefaultName = (name: string) => `default:${name}`;
					if (t.isFunctionDeclaration(declaration)) {
						if (declaration.id) {
							exportNames.push(actionDefaultName(declaration.id.name));
						} else {
							const id = path.scope.generateUidIdentifierBasedOnNode(declaration, "default");
							declaration.id = id;
							exportNames.push(actionDefaultName(id.name));
						}
					} else if (t.isArrowFunctionExpression(declaration) && declaration.async) {
						const id = path.scope.generateUidIdentifierBasedOnNode(declaration, "default");
						const arrowFunctionPath = path.get(
							"declaration"
						) as babel.NodePath<babel.types.ArrowFunctionExpression>;
						arrowFunctionPath.replaceWith(t.assignmentExpression("=", id, arrowFunctionPath.node));
						path.insertBefore(t.variableDeclaration("var", [t.variableDeclarator(id)]));
						exportNames.push(actionDefaultName(id.name));
					} else if (t.isIdentifier(declaration)) {
						exportNames.push(actionDefaultName(declaration.name));
					} else if (t.isCallExpression(declaration)) {
						const id = path.scope.generateUidIdentifierBasedOnNode(declaration, "default");
						const callExpressionPath = path.get(
							"declaration"
						) as babel.NodePath<babel.types.CallExpression>;
						callExpressionPath.replaceWith(
							t.assignmentExpression("=", id, callExpressionPath.node)
						);
						path.insertBefore(t.variableDeclaration("var", [t.variableDeclarator(id)]));
						exportNames.push(actionDefaultName(id.name));
					}
					return;
				}
			},
			ExportNamedDeclaration(path, pass) {
				if (path.node.source) return;
				const exportNames: string[] = this.get(EXPORT_NAMES_KEY);
				const declaration = path.node.declaration;
				const specifiers = path.node.specifiers;
				if (t.isFunctionDeclaration(declaration) && declaration.id) {
					exportNames.push(declaration.id.name);
				} else if (t.isClassDeclaration(declaration)) {
					exportNames.push(declaration.id.name);
				} else if (t.isVariableDeclaration(declaration)) {
					for (const decl of declaration.declarations) {
						if (t.isIdentifier(decl.id)) {
							exportNames.push(decl.id.name);
						}
					}
				} else if (specifiers.length > 0) {
					for (const specifier of specifiers) {
						const exportNames: string[] = this.get(EXPORT_NAMES_KEY);
						const exported = specifier.exported;
						if (t.isIdentifier(exported)) {
							exportNames.push(exported.name);
						} else {
							exportNames.push(exported.value);
						}
					}
				}
			},
		},
		post(file) {
			const directive: Directive = this.get(DIRECTIVE_KEY);
			const exportNames: string[] = this.get(EXPORT_NAMES_KEY);
			const comment = `@react-flight/internal:${directive}|${exportNames.join(",")}`;
			t.addComment(file.ast, "leading", comment);
		},
	};
}
