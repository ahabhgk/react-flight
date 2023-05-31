import type { PluginObj } from "@babel/core";
import * as babel from "@babel/core";

function hasDirective(t: typeof babel.types, program: babel.types.Program, value: string): boolean {
	return program.directives.some(
		(d) => t.isDirective(d) && t.isDirectiveLiteral(d.value, { value })
	);
}

type directive = "client" | "server" | "none";

function getDirective(t: typeof babel.types, program: babel.types.Program): directive {
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
				const exportNames: string[] = this.get(EXPORT_NAMES_KEY);
				exportNames.push("default");
			},
			ExportDefaultSpecifier(path, pass) {
				const exportNames: string[] = this.get(EXPORT_NAMES_KEY);
				exportNames.push("default");
			},
			ExportNamedDeclaration(path, pass) {
				const exportNames: string[] = this.get(EXPORT_NAMES_KEY);
				const declaration = path.node.declaration;
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
				}
			},
			ExportSpecifier(path, pass) {
				const exportNames: string[] = this.get(EXPORT_NAMES_KEY);
				const exported = path.node.exported;
				if (t.isIdentifier(exported)) {
					exportNames.push(exported.name);
				} else {
					exportNames.push(exported.value);
				}
			},
		},
		post(file) {
			const directive: string = this.get(DIRECTIVE_KEY);
			const exportNames: string[] = this.get(EXPORT_NAMES_KEY);
			const comment = `@react-flight/internal:${directive}|${exportNames.join(",")}`;
			t.addComment(file.ast, "leading", comment);
		},
	};
}
