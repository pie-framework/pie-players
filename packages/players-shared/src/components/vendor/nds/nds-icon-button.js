/*
 * Vendored NDS icon button, v5.6.0 (a7ed2a9), built and patched by
 * scripts/sync-nds-icon-button.mjs. Do not edit by hand: rerun the script.
 * See README.md beside this file.
 */
//#region node_modules/.bun/@lit+reactive-element@2.1.2/node_modules/@lit/reactive-element/css-tag.js
/**
* @license
* Copyright 2019 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
var t$1 = globalThis;
var e$2 = t$1.ShadowRoot && (void 0 === t$1.ShadyCSS || t$1.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype;
var s$2 = Symbol();
var o$4 = /* @__PURE__ */ new WeakMap();
var n$3 = class {
	constructor(t, e, o) {
		if (this._$cssResult$ = !0, o !== s$2) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
		this.cssText = t, this.t = e;
	}
	get styleSheet() {
		let t = this.o;
		const s = this.t;
		if (e$2 && void 0 === t) {
			const e = void 0 !== s && 1 === s.length;
			e && (t = o$4.get(s)), void 0 === t && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), e && o$4.set(s, t));
		}
		return t;
	}
	toString() {
		return this.cssText;
	}
};
var r$3 = (t) => new n$3("string" == typeof t ? t : t + "", void 0, s$2);
var S$1 = (s, o) => {
	if (e$2) s.adoptedStyleSheets = o.map((t) => t instanceof CSSStyleSheet ? t : t.styleSheet);
	else for (const e of o) {
		const o = document.createElement("style"), n = t$1.litNonce;
		void 0 !== n && o.setAttribute("nonce", n), o.textContent = e.cssText, s.appendChild(o);
	}
};
var c$2 = e$2 ? (t) => t : (t) => t instanceof CSSStyleSheet ? ((t) => {
	let e = "";
	for (const s of t.cssRules) e += s.cssText;
	return r$3(e);
})(t) : t;
//#endregion
//#region node_modules/.bun/@lit+reactive-element@2.1.2/node_modules/@lit/reactive-element/reactive-element.js
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/ var { is: i$2, defineProperty: e$1, getOwnPropertyDescriptor: h$1, getOwnPropertyNames: r$2, getOwnPropertySymbols: o$3, getPrototypeOf: n$2 } = Object, a$1 = globalThis, c$1 = a$1.trustedTypes, l$1 = c$1 ? c$1.emptyScript : "", p$1 = a$1.reactiveElementPolyfillSupport, d$1 = (t, s) => t, u$1 = {
	toAttribute(t, s) {
		switch (s) {
			case Boolean:
				t = t ? l$1 : null;
				break;
			case Object:
			case Array: t = null == t ? t : JSON.stringify(t);
		}
		return t;
	},
	fromAttribute(t, s) {
		let i = t;
		switch (s) {
			case Boolean:
				i = null !== t;
				break;
			case Number:
				i = null === t ? null : Number(t);
				break;
			case Object:
			case Array: try {
				i = JSON.parse(t);
			} catch (t) {
				i = null;
			}
		}
		return i;
	}
}, f$1 = (t, s) => !i$2(t, s), b$1 = {
	attribute: !0,
	type: String,
	converter: u$1,
	reflect: !1,
	useDefault: !1,
	hasChanged: f$1
};
Symbol.metadata ??= Symbol("metadata"), a$1.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var y$1 = class extends HTMLElement {
	static addInitializer(t) {
		this._$Ei(), (this.l ??= []).push(t);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(t, s = b$1) {
		if (s.state && (s.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((s = Object.create(s)).wrapped = !0), this.elementProperties.set(t, s), !s.noAccessor) {
			const i = Symbol(), h = this.getPropertyDescriptor(t, i, s);
			void 0 !== h && e$1(this.prototype, t, h);
		}
	}
	static getPropertyDescriptor(t, s, i) {
		const { get: e, set: r } = h$1(this.prototype, t) ?? {
			get() {
				return this[s];
			},
			set(t) {
				this[s] = t;
			}
		};
		return {
			get: e,
			set(s) {
				const h = e?.call(this);
				r?.call(this, s), this.requestUpdate(t, h, i);
			},
			configurable: !0,
			enumerable: !0
		};
	}
	static getPropertyOptions(t) {
		return this.elementProperties.get(t) ?? b$1;
	}
	static _$Ei() {
		if (this.hasOwnProperty(d$1("elementProperties"))) return;
		const t = n$2(this);
		t.finalize(), void 0 !== t.l && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(d$1("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(d$1("properties"))) {
			const t = this.properties, s = [...r$2(t), ...o$3(t)];
			for (const i of s) this.createProperty(i, t[i]);
		}
		const t = this[Symbol.metadata];
		if (null !== t) {
			const s = litPropertyMetadata.get(t);
			if (void 0 !== s) for (const [t, i] of s) this.elementProperties.set(t, i);
		}
		this._$Eh = /* @__PURE__ */ new Map();
		for (const [t, s] of this.elementProperties) {
			const i = this._$Eu(t, s);
			void 0 !== i && this._$Eh.set(i, t);
		}
		this.elementStyles = this.finalizeStyles(this.styles);
	}
	static finalizeStyles(s) {
		const i = [];
		if (Array.isArray(s)) {
			const e = new Set(s.flat(1 / 0).reverse());
			for (const s of e) i.unshift(c$2(s));
		} else void 0 !== s && i.push(c$2(s));
		return i;
	}
	static _$Eu(t, s) {
		const i = s.attribute;
		return !1 === i ? void 0 : "string" == typeof i ? i : "string" == typeof t ? t.toLowerCase() : void 0;
	}
	constructor() {
		super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
	}
	_$Ev() {
		this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t) => t(this));
	}
	addController(t) {
		(this._$EO ??= /* @__PURE__ */ new Set()).add(t), void 0 !== this.renderRoot && this.isConnected && t.hostConnected?.();
	}
	removeController(t) {
		this._$EO?.delete(t);
	}
	_$E_() {
		const t = /* @__PURE__ */ new Map(), s = this.constructor.elementProperties;
		for (const i of s.keys()) this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
		t.size > 0 && (this._$Ep = t);
	}
	createRenderRoot() {
		const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
		return S$1(t, this.constructor.elementStyles), t;
	}
	connectedCallback() {
		this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
	}
	enableUpdating(t) {}
	disconnectedCallback() {
		this._$EO?.forEach((t) => t.hostDisconnected?.());
	}
	attributeChangedCallback(t, s, i) {
		this._$AK(t, i);
	}
	_$ET(t, s) {
		const i = this.constructor.elementProperties.get(t), e = this.constructor._$Eu(t, i);
		if (void 0 !== e && !0 === i.reflect) {
			const h = (void 0 !== i.converter?.toAttribute ? i.converter : u$1).toAttribute(s, i.type);
			this._$Em = t, null == h ? this.removeAttribute(e) : this.setAttribute(e, h), this._$Em = null;
		}
	}
	_$AK(t, s) {
		const i = this.constructor, e = i._$Eh.get(t);
		if (void 0 !== e && this._$Em !== e) {
			const t = i.getPropertyOptions(e), h = "function" == typeof t.converter ? { fromAttribute: t.converter } : void 0 !== t.converter?.fromAttribute ? t.converter : u$1;
			this._$Em = e;
			const r = h.fromAttribute(s, t.type);
			this[e] = r ?? this._$Ej?.get(e) ?? r, this._$Em = null;
		}
	}
	requestUpdate(t, s, i, e = !1, h) {
		if (void 0 !== t) {
			const r = this.constructor;
			if (!1 === e && (h = this[t]), i ??= r.getPropertyOptions(t), !((i.hasChanged ?? f$1)(h, s) || i.useDefault && i.reflect && h === this._$Ej?.get(t) && !this.hasAttribute(r._$Eu(t, i)))) return;
			this.C(t, s, i);
		}
		!1 === this.isUpdatePending && (this._$ES = this._$EP());
	}
	C(t, s, { useDefault: i, reflect: e, wrapped: h }, r) {
		i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, r ?? s ?? this[t]), !0 !== h || void 0 !== r) || (this._$AL.has(t) || (this.hasUpdated || i || (s = void 0), this._$AL.set(t, s)), !0 === e && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
	}
	async _$EP() {
		this.isUpdatePending = !0;
		try {
			await this._$ES;
		} catch (t) {
			Promise.reject(t);
		}
		const t = this.scheduleUpdate();
		return null != t && await t, !this.isUpdatePending;
	}
	scheduleUpdate() {
		return this.performUpdate();
	}
	performUpdate() {
		if (!this.isUpdatePending) return;
		if (!this.hasUpdated) {
			if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
				for (const [t, s] of this._$Ep) this[t] = s;
				this._$Ep = void 0;
			}
			const t = this.constructor.elementProperties;
			if (t.size > 0) for (const [s, i] of t) {
				const { wrapped: t } = i, e = this[s];
				!0 !== t || this._$AL.has(s) || void 0 === e || this.C(s, void 0, i, e);
			}
		}
		let t = !1;
		const s = this._$AL;
		try {
			t = this.shouldUpdate(s), t ? (this.willUpdate(s), this._$EO?.forEach((t) => t.hostUpdate?.()), this.update(s)) : this._$EM();
		} catch (s) {
			throw t = !1, this._$EM(), s;
		}
		t && this._$AE(s);
	}
	willUpdate(t) {}
	_$AE(t) {
		this._$EO?.forEach((t) => t.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
	}
	_$EM() {
		this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
	}
	get updateComplete() {
		return this.getUpdateComplete();
	}
	getUpdateComplete() {
		return this._$ES;
	}
	shouldUpdate(t) {
		return !0;
	}
	update(t) {
		this._$Eq &&= this._$Eq.forEach((t) => this._$ET(t, this[t])), this._$EM();
	}
	updated(t) {}
	firstUpdated(t) {}
};
y$1.elementStyles = [], y$1.shadowRootOptions = { mode: "open" }, y$1[d$1("elementProperties")] = /* @__PURE__ */ new Map(), y$1[d$1("finalized")] = /* @__PURE__ */ new Map(), p$1?.({ ReactiveElement: y$1 }), (a$1.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/.bun/lit-html@3.3.2/node_modules/lit-html/lit-html.js
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
var t = globalThis;
var i$1 = (t) => t;
var s$1 = t.trustedTypes;
var e = s$1 ? s$1.createPolicy("lit-html", { createHTML: (t) => t }) : void 0;
var h = "$lit$";
var o$2 = `lit$${Math.random().toFixed(9).slice(2)}$`;
var n$1 = "?" + o$2;
var r$1 = `<${n$1}>`;
var l = document;
var c = () => l.createComment("");
var a = (t) => null === t || "object" != typeof t && "function" != typeof t;
var u = Array.isArray;
var d = (t) => u(t) || "function" == typeof t?.[Symbol.iterator];
var f = "[ 	\n\f\r]";
var v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g;
var _ = /-->/g;
var m = />/g;
var p = RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g");
var g = /'/g;
var $ = /"/g;
var y = /^(?:script|style|textarea|title)$/i;
var x = (t) => (i, ...s) => ({
	_$litType$: t,
	strings: i,
	values: s
});
var b = x(1);
var E = Symbol.for("lit-noChange");
var A = Symbol.for("lit-nothing");
var C = /* @__PURE__ */ new WeakMap();
var P = l.createTreeWalker(l, 129);
function V(t, i) {
	if (!u(t) || !t.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return void 0 !== e ? e.createHTML(i) : i;
}
var N = (t, i) => {
	const s = t.length - 1, e = [];
	let n, l = 2 === i ? "<svg>" : 3 === i ? "<math>" : "", c = v;
	for (let i = 0; i < s; i++) {
		const s = t[i];
		let a, u, d = -1, f = 0;
		for (; f < s.length && (c.lastIndex = f, u = c.exec(s), null !== u);) f = c.lastIndex, c === v ? "!--" === u[1] ? c = _ : void 0 !== u[1] ? c = m : void 0 !== u[2] ? (y.test(u[2]) && (n = RegExp("</" + u[2], "g")), c = p) : void 0 !== u[3] && (c = p) : c === p ? ">" === u[0] ? (c = n ?? v, d = -1) : void 0 === u[1] ? d = -2 : (d = c.lastIndex - u[2].length, a = u[1], c = void 0 === u[3] ? p : "\"" === u[3] ? $ : g) : c === $ || c === g ? c = p : c === _ || c === m ? c = v : (c = p, n = void 0);
		const x = c === p && t[i + 1].startsWith("/>") ? " " : "";
		l += c === v ? s + r$1 : d >= 0 ? (e.push(a), s.slice(0, d) + h + s.slice(d) + o$2 + x) : s + o$2 + (-2 === d ? i : x);
	}
	return [V(t, l + (t[s] || "<?>") + (2 === i ? "</svg>" : 3 === i ? "</math>" : "")), e];
};
var S = class S {
	constructor({ strings: t, _$litType$: i }, e) {
		let r;
		this.parts = [];
		let l = 0, a = 0;
		const u = t.length - 1, d = this.parts, [f, v] = N(t, i);
		if (this.el = S.createElement(f, e), P.currentNode = this.el.content, 2 === i || 3 === i) {
			const t = this.el.content.firstChild;
			t.replaceWith(...t.childNodes);
		}
		for (; null !== (r = P.nextNode()) && d.length < u;) {
			if (1 === r.nodeType) {
				if (r.hasAttributes()) for (const t of r.getAttributeNames()) if (t.endsWith(h)) {
					const i = v[a++], s = r.getAttribute(t).split(o$2), e = /([.?@])?(.*)/.exec(i);
					d.push({
						type: 1,
						index: l,
						name: e[2],
						strings: s,
						ctor: "." === e[1] ? I : "?" === e[1] ? L : "@" === e[1] ? z : H
					}), r.removeAttribute(t);
				} else t.startsWith(o$2) && (d.push({
					type: 6,
					index: l
				}), r.removeAttribute(t));
				if (y.test(r.tagName)) {
					const t = r.textContent.split(o$2), i = t.length - 1;
					if (i > 0) {
						r.textContent = s$1 ? s$1.emptyScript : "";
						for (let s = 0; s < i; s++) r.append(t[s], c()), P.nextNode(), d.push({
							type: 2,
							index: ++l
						});
						r.append(t[i], c());
					}
				}
			} else if (8 === r.nodeType) if (r.data === n$1) d.push({
				type: 2,
				index: l
			});
			else {
				let t = -1;
				for (; -1 !== (t = r.data.indexOf(o$2, t + 1));) d.push({
					type: 7,
					index: l
				}), t += o$2.length - 1;
			}
			l++;
		}
	}
	static createElement(t, i) {
		const s = l.createElement("template");
		return s.innerHTML = t, s;
	}
};
function M(t, i, s = t, e) {
	if (i === E) return i;
	let h = void 0 !== e ? s._$Co?.[e] : s._$Cl;
	const o = a(i) ? void 0 : i._$litDirective$;
	return h?.constructor !== o && (h?._$AO?.(!1), void 0 === o ? h = void 0 : (h = new o(t), h._$AT(t, s, e)), void 0 !== e ? (s._$Co ??= [])[e] = h : s._$Cl = h), void 0 !== h && (i = M(t, h._$AS(t, i.values), h, e)), i;
}
var R = class {
	constructor(t, i) {
		this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = i;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(t) {
		const { el: { content: i }, parts: s } = this._$AD, e = (t?.creationScope ?? l).importNode(i, !0);
		P.currentNode = e;
		let h = P.nextNode(), o = 0, n = 0, r = s[0];
		for (; void 0 !== r;) {
			if (o === r.index) {
				let i;
				2 === r.type ? i = new k(h, h.nextSibling, this, t) : 1 === r.type ? i = new r.ctor(h, r.name, r.strings, this, t) : 6 === r.type && (i = new Z(h, this, t)), this._$AV.push(i), r = s[++n];
			}
			o !== r?.index && (h = P.nextNode(), o++);
		}
		return P.currentNode = l, e;
	}
	p(t) {
		let i = 0;
		for (const s of this._$AV) void 0 !== s && (void 0 !== s.strings ? (s._$AI(t, s, i), i += s.strings.length - 2) : s._$AI(t[i])), i++;
	}
};
var k = class k {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(t, i, s, e) {
		this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t, this._$AB = i, this._$AM = s, this.options = e, this._$Cv = e?.isConnected ?? !0;
	}
	get parentNode() {
		let t = this._$AA.parentNode;
		const i = this._$AM;
		return void 0 !== i && 11 === t?.nodeType && (t = i.parentNode), t;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(t, i = this) {
		t = M(this, t, i), a(t) ? t === A || null == t || "" === t ? (this._$AH !== A && this._$AR(), this._$AH = A) : t !== this._$AH && t !== E && this._(t) : void 0 !== t._$litType$ ? this.$(t) : void 0 !== t.nodeType ? this.T(t) : d(t) ? this.k(t) : this._(t);
	}
	O(t) {
		return this._$AA.parentNode.insertBefore(t, this._$AB);
	}
	T(t) {
		this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
	}
	_(t) {
		this._$AH !== A && a(this._$AH) ? this._$AA.nextSibling.data = t : this.T(l.createTextNode(t)), this._$AH = t;
	}
	$(t) {
		const { values: i, _$litType$: s } = t, e = "number" == typeof s ? this._$AC(t) : (void 0 === s.el && (s.el = S.createElement(V(s.h, s.h[0]), this.options)), s);
		if (this._$AH?._$AD === e) this._$AH.p(i);
		else {
			const t = new R(e, this), s = t.u(this.options);
			t.p(i), this.T(s), this._$AH = t;
		}
	}
	_$AC(t) {
		let i = C.get(t.strings);
		return void 0 === i && C.set(t.strings, i = new S(t)), i;
	}
	k(t) {
		u(this._$AH) || (this._$AH = [], this._$AR());
		const i = this._$AH;
		let s, e = 0;
		for (const h of t) e === i.length ? i.push(s = new k(this.O(c()), this.O(c()), this, this.options)) : s = i[e], s._$AI(h), e++;
		e < i.length && (this._$AR(s && s._$AB.nextSibling, e), i.length = e);
	}
	_$AR(t = this._$AA.nextSibling, s) {
		for (this._$AP?.(!1, !0, s); t !== this._$AB;) {
			const s = i$1(t).nextSibling;
			i$1(t).remove(), t = s;
		}
	}
	setConnected(t) {
		void 0 === this._$AM && (this._$Cv = t, this._$AP?.(t));
	}
};
var H = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(t, i, s, e, h) {
		this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t, this.name = i, this._$AM = e, this.options = h, s.length > 2 || "" !== s[0] || "" !== s[1] ? (this._$AH = Array(s.length - 1).fill(/* @__PURE__ */ new String()), this.strings = s) : this._$AH = A;
	}
	_$AI(t, i = this, s, e) {
		const h = this.strings;
		let o = !1;
		if (void 0 === h) t = M(this, t, i, 0), o = !a(t) || t !== this._$AH && t !== E, o && (this._$AH = t);
		else {
			const e = t;
			let n, r;
			for (t = h[0], n = 0; n < h.length - 1; n++) r = M(this, e[s + n], i, n), r === E && (r = this._$AH[n]), o ||= !a(r) || r !== this._$AH[n], r === A ? t = A : t !== A && (t += (r ?? "") + h[n + 1]), this._$AH[n] = r;
		}
		o && !e && this.j(t);
	}
	j(t) {
		t === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
	}
};
var I = class extends H {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(t) {
		this.element[this.name] = t === A ? void 0 : t;
	}
};
var L = class extends H {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(t) {
		this.element.toggleAttribute(this.name, !!t && t !== A);
	}
};
var z = class extends H {
	constructor(t, i, s, e, h) {
		super(t, i, s, e, h), this.type = 5;
	}
	_$AI(t, i = this) {
		if ((t = M(this, t, i, 0) ?? A) === E) return;
		const s = this._$AH, e = t === A && s !== A || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, h = t !== A && (s === A || e);
		e && this.element.removeEventListener(this.name, this, s), h && this.element.addEventListener(this.name, this, t), this._$AH = t;
	}
	handleEvent(t) {
		"function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
	}
};
var Z = class {
	constructor(t, i, s) {
		this.element = t, this.type = 6, this._$AN = void 0, this._$AM = i, this.options = s;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(t) {
		M(this, t);
	}
};
var B = t.litHtmlPolyfillSupport;
B?.(S, k), (t.litHtmlVersions ??= []).push("3.3.2");
var D = (t, i, s) => {
	const e = s?.renderBefore ?? i;
	let h = e._$litPart$;
	if (void 0 === h) {
		const t = s?.renderBefore ?? null;
		e._$litPart$ = h = new k(i.insertBefore(c(), t), t, void 0, s ?? {});
	}
	return h._$AI(t), h;
};
//#endregion
//#region node_modules/.bun/lit-element@4.2.2/node_modules/lit-element/lit-element.js
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/ var s = globalThis;
var i = class extends y$1 {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		const t = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= t.firstChild, t;
	}
	update(t) {
		const r = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = D(r, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return E;
	}
};
i._$litElement$ = !0, i["finalized"] = !0, s.litElementHydrateSupport?.({ LitElement: i });
var o$1 = s.litElementPolyfillSupport;
o$1?.({ LitElement: i });
(s.litElementVersions ??= []).push("4.2.2");
//#endregion
//#region node_modules/.bun/@lit+reactive-element@2.1.2/node_modules/@lit/reactive-element/decorators/property.js
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/ var o = {
	attribute: !0,
	type: String,
	converter: u$1,
	reflect: !1,
	hasChanged: f$1
};
var r = (t = o, e, r) => {
	const { kind: n, metadata: i } = r;
	let s = globalThis.litPropertyMetadata.get(i);
	if (void 0 === s && globalThis.litPropertyMetadata.set(i, s = /* @__PURE__ */ new Map()), "setter" === n && ((t = Object.create(t)).wrapped = !0), s.set(r.name, t), "accessor" === n) {
		const { name: o } = r;
		return {
			set(r) {
				const n = e.get.call(this);
				e.set.call(this, r), this.requestUpdate(o, n, t, !0, r);
			},
			init(e) {
				return void 0 !== e && this.C(o, void 0, t, e), e;
			}
		};
	}
	if ("setter" === n) {
		const { name: o } = r;
		return function(r) {
			const n = this[o];
			e.call(this, r), this.requestUpdate(o, n, t, !0, r);
		};
	}
	throw Error("Unsupported decorator location: " + n);
};
function n(t) {
	return (e, o) => "object" == typeof o ? r(t, e, o) : ((t, e, o) => {
		const r = e.hasOwnProperty(o);
		return e.constructor.createProperty(o, t), r ? Object.getOwnPropertyDescriptor(e, o) : void 0;
	})(t, e, o);
}
//#endregion
//#region node_modules/.bun/@lit+reactive-element@2.1.2/node_modules/@lit/reactive-element/decorators/state.js
/**
* @license
* Copyright 2017 Google LLC
* SPDX-License-Identifier: BSD-3-Clause
*/
//#endregion
//#region ../../../../private/var/folders/bn/0zg6dkf97j17x4y0cnjf3dhc0000gn/T/pie-nds-sync-soCK3d/web-components/src/utils/define-element.ts
/**
* Class decorator that registers a custom element, guarding against
* `customElements.define()` throwing when the tag name is already
* registered.
*
* Consumers that lazy-load routes/chunks can end up loading more than one
* copy of this library into the same document (each chunk bundling its own
* copy of next-design-system-web-components). Plain `@customElement()`
* calls `customElements.define()` unconditionally, so the second copy to
* load throws and can crash the host app. This warns instead of throwing —
* whichever copy registers first wins for that tag for the life of the
* document, which can mask a real version mismatch between chunks, so the
* warning is left in place (not gated behind a dev-only flag) as a
* breadcrumb for diagnosing that class of bug.
*/
function defineElement(tagName) {
	return function(constructor) {
		if (customElements.get(tagName)) {
			console.warn(`[NDS] <${tagName}> is already registered — skipping duplicate customElements.define() call. This usually means multiple copies of next-design-system-web-components were loaded into the same document (e.g. separately bundled lazy-loaded routes). If the copies are different versions, the one that registered first is the one actually running.`);
			return constructor;
		}
		customElements.define(tagName, constructor);
		return constructor;
	};
}
//#endregion
//#region \0@oxc-project+runtime@0.151.0/helpers/esm/decorate.js
function __decorate(decorators, target, key, desc) {
	var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
	if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
	else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
	return c > 3 && r && Object.defineProperty(target, key, r), r;
}
//#endregion
//#region ../../../../private/var/folders/bn/0zg6dkf97j17x4y0cnjf3dhc0000gn/T/pie-nds-sync-soCK3d/web-components/src/components/icon-button/nds-icon-button.ts
var NdsIconButton = class NdsIconButton extends i {
	constructor(..._args) {
		super(..._args);
		this.variant = "primary";
		this.size = "default";
		this.type = "circle";
		this.state = "default";
		this.iconName = "home";
		this.disabled = false;
		this.buttonAriaLabel = "Icon button";
		this.buttonAriaPressed = "";
		this.hasPopup = "";
		this.expanded = "";
		this.controls = "";
	}
	createRenderRoot() {
		return this;
	}
	connectedCallback() {
		super.connectedCallback();
		if (!document.querySelector("link[href*=\"Roboto\"]")) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = "https://ui.renaissance.com/fonts/Roboto/style.css";
			document.head.appendChild(link);
		}
	}
	/** Legacy alias — use `variant` instead. */
	set shape(value) {
		this.type = value;
	}
	get shape() {
		return this.type;
	}
	get buttonClasses() {
		return [
			"nds-icon-button",
			`nds-icon-button--${this.variant}`,
			`nds-icon-button--${this.size}`,
			`nds-icon-button--${this.type}`,
			this.state !== "default" ? `nds-icon-button--${this.state}` : "",
			this.disabled ? "nds-icon-button--disabled" : ""
		].filter(Boolean).join(" ");
	}
	handleClick(e) {
		if (this.disabled) {
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		this.dispatchEvent(new CustomEvent("icon-button-click", {
			bubbles: true,
			composed: true,
			detail: { originalEvent: e }
		}));
	}
	render() {
		return b`
      <style>
        pie-nds-icon-button {
          display: inline-block;
        }

        .nds-icon-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-family: var(--font-family-roboto, "Roboto", sans-serif);
          font-weight: var(--font-weight-regular, 400);
          line-height: 1;
          text-decoration: none;
          background: none;
          position: relative;
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          border: none;
          transition: background-color 0.2s ease-in-out,
                      color 0.2s ease-in-out,
                      box-shadow 0.2s ease-in-out;
        }

        /* ── Sizes ── */
        .nds-icon-button--x-small {
          width: var(--height-24, 24px);
          height: var(--height-24, 24px);
        }

        .nds-icon-button--small {
          width: var(--height-32, 32px);
          height: var(--height-32, 32px);
        }

        .nds-icon-button--medium {
          width: var(--height-36, 36px);
          height: var(--height-36, 36px);
        }

        .nds-icon-button--default {
          width: var(--height-40, 40px);
          height: var(--height-40, 40px);
        }

        .nds-icon-button--large {
          width: var(--height-48, 48px);
          height: var(--height-48, 48px);
        }

        /* ── Shapes ── */
        .nds-icon-button--circle {
          border-radius: var(--radius-circle, 50%);
        }

        .nds-icon-button--rounded {
          border-radius: var(--radius-8, 8px);
        }

        /* ── Primary ── */
        .nds-icon-button--primary {
          background-color: var(--color-interactive-blue, #146eb3);
          color: var(--color-primary-white, #ffffff);
        }

        .nds-icon-button--primary:hover:not(:disabled):not(.nds-icon-button--disabled) {
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-primary-black, #000000);
        }

        .nds-icon-button--primary:active:not(:disabled):not(.nds-icon-button--disabled) {
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-primary-black, #000000);
        }

        /* ── Secondary ── */
        .nds-icon-button--secondary {
          background-color: var(--color-primary-white, #ffffff);
          color: var(--color-interactive-blue, #146eb3);
          box-shadow: inset 0 0 0 var(--stroke-1, 1px) var(--color-interactive-blue, #146eb3);
        }

        .nds-icon-button--secondary:hover:not(:disabled):not(.nds-icon-button--disabled) {
          background-color: var(--color-interactive-blue, #146eb3);
          color: var(--color-primary-white, #ffffff);
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-primary-black, #000000);
        }

        .nds-icon-button--secondary:active:not(:disabled):not(.nds-icon-button--disabled) {
          background-color: var(--color-interactive-blue, #146eb3);
          color: var(--color-primary-white, #ffffff);
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-primary-black, #000000);
        }

        /* ── Tertiary ── */
        .nds-icon-button--tertiary {
          background-color: var(--color-new-gray, #f3f5f7);
          color: var(--color-interactive-blue, #146eb3);
        }

        .nds-icon-button--tertiary:hover:not(:disabled):not(.nds-icon-button--disabled) {
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-interactive-blue, #146eb3);
        }

        .nds-icon-button--tertiary:active:not(:disabled):not(.nds-icon-button--disabled) {
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-primary-black, #000000);
        }

        /* ── Ghost ── */
        .nds-icon-button--ghost {
          background-color: transparent;
          color: var(--color-interactive-blue, #146eb3);
        }

        .nds-icon-button--ghost:hover:not(:disabled):not(.nds-icon-button--disabled) {
          background-color: var(--color-new-gray, #f3f5f7);
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-interactive-blue, #146eb3);
        }

        .nds-icon-button--ghost:active:not(:disabled):not(.nds-icon-button--disabled) {
          background-color: var(--color-new-gray, #f3f5f7);
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-primary-black, #000000);
        }

        /* ── Dark (for dark backgrounds) ── */
        .nds-icon-button--dark {
          background-color: transparent;
          color: var(--color-primary-white, #ffffff);
          box-shadow: inset 0 0 0 var(--stroke-1, 1px) var(--color-primary-white, #ffffff);
        }

        .nds-icon-button--dark:hover:not(:disabled):not(.nds-icon-button--disabled) {
          background-color: var(--color-interactive-blue, #146eb3);
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-primary-white, #ffffff);
        }

        .nds-icon-button--dark:active:not(:disabled):not(.nds-icon-button--disabled) {
          background-color: var(--color-interactive-blue, #146eb3);
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-primary-white, #ffffff);
        }

        /* ── Danger (destructive CTAs — e.g. delete) ──
           Uses --color-website-red (#cf3a4e) for ~5.1:1 contrast with white text/icons
           (WCAG 2.1 AA pass). --color-primary-red (#fd4353) would fail at ~4:1. */
        .nds-icon-button--danger {
          background-color: var(--color-website-red, #cf3a4e);
          color: var(--color-primary-white, #ffffff);
        }

        .nds-icon-button--danger:hover:not(:disabled):not(.nds-icon-button--disabled) {
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-primary-black, #000000);
        }

        .nds-icon-button--danger:active:not(:disabled):not(.nds-icon-button--disabled) {
          box-shadow: inset 0 0 0 var(--stroke-2, 2px) var(--color-primary-black, #000000);
        }

        /* ── Disabled ── */
        .nds-icon-button--disabled,
        .nds-icon-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* ── Icon sizing ── */
        .nds-icon-button__icon {
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: inherit;
        }

        .nds-icon-button--x-small .nds-icon-button__icon {
          font-size: var(--nds-icon-small, 12px);
        }

        .nds-icon-button--small .nds-icon-button__icon {
          font-size: var(--nds-icon-small, 12px);
        }

        .nds-icon-button--medium .nds-icon-button__icon {
          font-size: var(--nds-icon-medium, 14px);
        }

        .nds-icon-button--default .nds-icon-button__icon {
          font-size: var(--nds-icon-default, 16px);
        }

        .nds-icon-button--large .nds-icon-button__icon {
          font-size: var(--nds-icon-large, 20px);
        }

        /* ── Focus ── */
        .nds-icon-button:focus-visible {
          outline: 2px solid var(--color-focus-blue, #2b87ff);
          outline-offset: 2px;
        }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          .nds-icon-button {
            transition: none;
          }
        }
      </style>
      <button
        type="button"
        class="${this.buttonClasses}"
        ?disabled="${this.disabled}"
        aria-disabled="${this.disabled ? "true" : "false"}"
        aria-label="${this.buttonAriaLabel}"
        aria-haspopup="${this.hasPopup || A}"
        aria-expanded="${this.expanded || A}"
        aria-controls="${this.controls || A}"
        aria-pressed="${this.buttonAriaPressed || A}"
        @click="${this.handleClick}"
      >
        <i class="fa-light fa-${this.iconName} nds-icon-button__icon" aria-hidden="true"></i>
      </button>
    `;
	}
};
__decorate([n()], NdsIconButton.prototype, "variant", void 0);
__decorate([n()], NdsIconButton.prototype, "size", void 0);
__decorate([n()], NdsIconButton.prototype, "type", void 0);
__decorate([n()], NdsIconButton.prototype, "state", void 0);
__decorate([n({ attribute: "icon-name" })], NdsIconButton.prototype, "iconName", void 0);
__decorate([n({ type: Boolean })], NdsIconButton.prototype, "disabled", void 0);
__decorate([n({ attribute: "button-aria-label" })], NdsIconButton.prototype, "buttonAriaLabel", void 0);
__decorate([n({ attribute: "button-aria-pressed" })], NdsIconButton.prototype, "buttonAriaPressed", void 0);
__decorate([n({ attribute: "has-popup" })], NdsIconButton.prototype, "hasPopup", void 0);
__decorate([n()], NdsIconButton.prototype, "expanded", void 0);
__decorate([n()], NdsIconButton.prototype, "controls", void 0);
__decorate([n()], NdsIconButton.prototype, "shape", null);
NdsIconButton = __decorate([defineElement("pie-nds-icon-button")], NdsIconButton);
//#endregion
export { NdsIconButton };
