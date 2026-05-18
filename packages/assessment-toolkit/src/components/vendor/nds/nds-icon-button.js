/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const H = globalThis, D = H.ShadowRoot && (H.ShadyCSS === void 0 || H.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, tt = Symbol(), W = /* @__PURE__ */ new WeakMap();
let nt = class {
  constructor(t, e, s) {
    if (this._$cssResult$ = !0, s !== tt) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (D && t === void 0) {
      const s = e !== void 0 && e.length === 1;
      s && (t = W.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), s && W.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const rt = (o) => new nt(typeof o == "string" ? o : o + "", void 0, tt), at = (o, t) => {
  if (D) o.adoptedStyleSheets = t.map(((e) => e instanceof CSSStyleSheet ? e : e.styleSheet));
  else for (const e of t) {
    const s = document.createElement("style"), i = H.litNonce;
    i !== void 0 && s.setAttribute("nonce", i), s.textContent = e.cssText, o.appendChild(s);
  }
}, V = D ? (o) => o : (o) => o instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const s of t.cssRules) e += s.cssText;
  return rt(e);
})(o) : o;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: ht, defineProperty: ct, getOwnPropertyDescriptor: lt, getOwnPropertyNames: dt, getOwnPropertySymbols: ut, getPrototypeOf: pt } = Object, R = globalThis, F = R.trustedTypes, ft = F ? F.emptyScript : "", bt = R.reactiveElementPolyfillSupport, S = (o, t) => o, N = { toAttribute(o, t) {
  switch (t) {
    case Boolean:
      o = o ? ft : null;
      break;
    case Object:
    case Array:
      o = o == null ? o : JSON.stringify(o);
  }
  return o;
}, fromAttribute(o, t) {
  let e = o;
  switch (t) {
    case Boolean:
      e = o !== null;
      break;
    case Number:
      e = o === null ? null : Number(o);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(o);
      } catch {
        e = null;
      }
  }
  return e;
} }, L = (o, t) => !ht(o, t), J = { attribute: !0, type: String, converter: N, reflect: !1, useDefault: !1, hasChanged: L };
Symbol.metadata ??= Symbol("metadata"), R.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let A = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = J) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const s = Symbol(), i = this.getPropertyDescriptor(t, s, e);
      i !== void 0 && ct(this.prototype, t, i);
    }
  }
  static getPropertyDescriptor(t, e, s) {
    const { get: i, set: n } = lt(this.prototype, t) ?? { get() {
      return this[e];
    }, set(r) {
      this[e] = r;
    } };
    return { get: i, set(r) {
      const h = i?.call(this);
      n?.call(this, r), this.requestUpdate(t, h, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? J;
  }
  static _$Ei() {
    if (this.hasOwnProperty(S("elementProperties"))) return;
    const t = pt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(S("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(S("properties"))) {
      const e = this.properties, s = [...dt(e), ...ut(e)];
      for (const i of s) this.createProperty(i, e[i]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [s, i] of e) this.elementProperties.set(s, i);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, s] of this.elementProperties) {
      const i = this._$Eu(e, s);
      i !== void 0 && this._$Eh.set(i, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const s = new Set(t.flat(1 / 0).reverse());
      for (const i of s) e.unshift(V(i));
    } else t !== void 0 && e.push(V(t));
    return e;
  }
  static _$Eu(t, e) {
    const s = e.attribute;
    return s === !1 ? void 0 : typeof s == "string" ? s : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise(((t) => this.enableUpdating = t)), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach(((t) => t(this)));
  }
  addController(t) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t), this.renderRoot !== void 0 && this.isConnected && t.hostConnected?.();
  }
  removeController(t) {
    this._$EO?.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), e = this.constructor.elementProperties;
    for (const s of e.keys()) this.hasOwnProperty(s) && (t.set(s, this[s]), delete this[s]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return at(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach(((t) => t.hostConnected?.()));
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach(((t) => t.hostDisconnected?.()));
  }
  attributeChangedCallback(t, e, s) {
    this._$AK(t, s);
  }
  _$ET(t, e) {
    const s = this.constructor.elementProperties.get(t), i = this.constructor._$Eu(t, s);
    if (i !== void 0 && s.reflect === !0) {
      const n = (s.converter?.toAttribute !== void 0 ? s.converter : N).toAttribute(e, s.type);
      this._$Em = t, n == null ? this.removeAttribute(i) : this.setAttribute(i, n), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const s = this.constructor, i = s._$Eh.get(t);
    if (i !== void 0 && this._$Em !== i) {
      const n = s.getPropertyOptions(i), r = typeof n.converter == "function" ? { fromAttribute: n.converter } : n.converter?.fromAttribute !== void 0 ? n.converter : N;
      this._$Em = i;
      const h = r.fromAttribute(e, n.type);
      this[i] = h ?? this._$Ej?.get(i) ?? h, this._$Em = null;
    }
  }
  requestUpdate(t, e, s) {
    if (t !== void 0) {
      const i = this.constructor, n = this[t];
      if (s ??= i.getPropertyOptions(t), !((s.hasChanged ?? L)(n, e) || s.useDefault && s.reflect && n === this._$Ej?.get(t) && !this.hasAttribute(i._$Eu(t, s)))) return;
      this.C(t, e, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: s, reflect: i, wrapped: n }, r) {
    s && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, r ?? e ?? this[t]), n !== !0 || r !== void 0) || (this._$AL.has(t) || (this.hasUpdated || s || (e = void 0), this._$AL.set(t, e)), i === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (e) {
      Promise.reject(e);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [i, n] of this._$Ep) this[i] = n;
        this._$Ep = void 0;
      }
      const s = this.constructor.elementProperties;
      if (s.size > 0) for (const [i, n] of s) {
        const { wrapped: r } = n, h = this[i];
        r !== !0 || this._$AL.has(i) || h === void 0 || this.C(i, void 0, n, h);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), this._$EO?.forEach(((s) => s.hostUpdate?.())), this.update(e)) : this._$EM();
    } catch (s) {
      throw t = !1, this._$EM(), s;
    }
    t && this._$AE(e);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    this._$EO?.forEach(((e) => e.hostUpdated?.())), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
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
    this._$Eq &&= this._$Eq.forEach(((e) => this._$ET(e, this[e]))), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
A.elementStyles = [], A.shadowRootOptions = { mode: "open" }, A[S("elementProperties")] = /* @__PURE__ */ new Map(), A[S("finalized")] = /* @__PURE__ */ new Map(), bt?.({ ReactiveElement: A }), (R.reactiveElementVersions ??= []).push("2.1.1");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const I = globalThis, T = I.trustedTypes, K = T ? T.createPolicy("lit-html", { createHTML: (o) => o }) : void 0, et = "$lit$", v = `lit$${Math.random().toFixed(9).slice(2)}$`, st = "?" + v, $t = `<${st}>`, g = document, k = () => g.createComment(""), P = (o) => o === null || typeof o != "object" && typeof o != "function", B = Array.isArray, vt = (o) => B(o) || typeof o?.[Symbol.iterator] == "function", j = `[ 	
\f\r]`, x = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Z = /-->/g, G = />/g, y = RegExp(`>|${j}(?:([^\\s"'>=/]+)(${j}*=${j}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Q = /'/g, X = /"/g, it = /^(?:script|style|textarea|title)$/i, _t = (o) => (t, ...e) => ({ _$litType$: o, strings: t, values: e }), yt = _t(1), w = Symbol.for("lit-noChange"), d = Symbol.for("lit-nothing"), Y = /* @__PURE__ */ new WeakMap(), m = g.createTreeWalker(g, 129);
function ot(o, t) {
  if (!B(o) || !o.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return K !== void 0 ? K.createHTML(t) : t;
}
const mt = (o, t) => {
  const e = o.length - 1, s = [];
  let i, n = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", r = x;
  for (let h = 0; h < e; h++) {
    const a = o[h];
    let l, u, c = -1, f = 0;
    for (; f < a.length && (r.lastIndex = f, u = r.exec(a), u !== null); ) f = r.lastIndex, r === x ? u[1] === "!--" ? r = Z : u[1] !== void 0 ? r = G : u[2] !== void 0 ? (it.test(u[2]) && (i = RegExp("</" + u[2], "g")), r = y) : u[3] !== void 0 && (r = y) : r === y ? u[0] === ">" ? (r = i ?? x, c = -1) : u[1] === void 0 ? c = -2 : (c = r.lastIndex - u[2].length, l = u[1], r = u[3] === void 0 ? y : u[3] === '"' ? X : Q) : r === X || r === Q ? r = y : r === Z || r === G ? r = x : (r = y, i = void 0);
    const $ = r === y && o[h + 1].startsWith("/>") ? " " : "";
    n += r === x ? a + $t : c >= 0 ? (s.push(l), a.slice(0, c) + et + a.slice(c) + v + $) : a + v + (c === -2 ? h : $);
  }
  return [ot(o, n + (o[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), s];
};
class O {
  constructor({ strings: t, _$litType$: e }, s) {
    let i;
    this.parts = [];
    let n = 0, r = 0;
    const h = t.length - 1, a = this.parts, [l, u] = mt(t, e);
    if (this.el = O.createElement(l, s), m.currentNode = this.el.content, e === 2 || e === 3) {
      const c = this.el.content.firstChild;
      c.replaceWith(...c.childNodes);
    }
    for (; (i = m.nextNode()) !== null && a.length < h; ) {
      if (i.nodeType === 1) {
        if (i.hasAttributes()) for (const c of i.getAttributeNames()) if (c.endsWith(et)) {
          const f = u[r++], $ = i.getAttribute(c).split(v), M = /([.?@])?(.*)/.exec(f);
          a.push({ type: 1, index: n, name: M[2], strings: $, ctor: M[1] === "." ? At : M[1] === "?" ? wt : M[1] === "@" ? Et : z }), i.removeAttribute(c);
        } else c.startsWith(v) && (a.push({ type: 6, index: n }), i.removeAttribute(c));
        if (it.test(i.tagName)) {
          const c = i.textContent.split(v), f = c.length - 1;
          if (f > 0) {
            i.textContent = T ? T.emptyScript : "";
            for (let $ = 0; $ < f; $++) i.append(c[$], k()), m.nextNode(), a.push({ type: 2, index: ++n });
            i.append(c[f], k());
          }
        }
      } else if (i.nodeType === 8) if (i.data === st) a.push({ type: 2, index: n });
      else {
        let c = -1;
        for (; (c = i.data.indexOf(v, c + 1)) !== -1; ) a.push({ type: 7, index: n }), c += v.length - 1;
      }
      n++;
    }
  }
  static createElement(t, e) {
    const s = g.createElement("template");
    return s.innerHTML = t, s;
  }
}
function E(o, t, e = o, s) {
  if (t === w) return t;
  let i = s !== void 0 ? e._$Co?.[s] : e._$Cl;
  const n = P(t) ? void 0 : t._$litDirective$;
  return i?.constructor !== n && (i?._$AO?.(!1), n === void 0 ? i = void 0 : (i = new n(o), i._$AT(o, e, s)), s !== void 0 ? (e._$Co ??= [])[s] = i : e._$Cl = i), i !== void 0 && (t = E(o, i._$AS(o, t.values), i, s)), t;
}
class gt {
  constructor(t, e) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = e;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: e }, parts: s } = this._$AD, i = (t?.creationScope ?? g).importNode(e, !0);
    m.currentNode = i;
    let n = m.nextNode(), r = 0, h = 0, a = s[0];
    for (; a !== void 0; ) {
      if (r === a.index) {
        let l;
        a.type === 2 ? l = new U(n, n.nextSibling, this, t) : a.type === 1 ? l = new a.ctor(n, a.name, a.strings, this, t) : a.type === 6 && (l = new xt(n, this, t)), this._$AV.push(l), a = s[++h];
      }
      r !== a?.index && (n = m.nextNode(), r++);
    }
    return m.currentNode = g, i;
  }
  p(t) {
    let e = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(t, s, e), e += s.strings.length - 2) : s._$AI(t[e])), e++;
  }
}
class U {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, e, s, i) {
    this.type = 2, this._$AH = d, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = s, this.options = i, this._$Cv = i?.isConnected ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const e = this._$AM;
    return e !== void 0 && t?.nodeType === 11 && (t = e.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, e = this) {
    t = E(this, t, e), P(t) ? t === d || t == null || t === "" ? (this._$AH !== d && this._$AR(), this._$AH = d) : t !== this._$AH && t !== w && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : vt(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== d && P(this._$AH) ? this._$AA.nextSibling.data = t : this.T(g.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: e, _$litType$: s } = t, i = typeof s == "number" ? this._$AC(t) : (s.el === void 0 && (s.el = O.createElement(ot(s.h, s.h[0]), this.options)), s);
    if (this._$AH?._$AD === i) this._$AH.p(e);
    else {
      const n = new gt(i, this), r = n.u(this.options);
      n.p(e), this.T(r), this._$AH = n;
    }
  }
  _$AC(t) {
    let e = Y.get(t.strings);
    return e === void 0 && Y.set(t.strings, e = new O(t)), e;
  }
  k(t) {
    B(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let s, i = 0;
    for (const n of t) i === e.length ? e.push(s = new U(this.O(k()), this.O(k()), this, this.options)) : s = e[i], s._$AI(n), i++;
    i < e.length && (this._$AR(s && s._$AB.nextSibling, i), e.length = i);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    for (this._$AP?.(!1, !0, e); t !== this._$AB; ) {
      const s = t.nextSibling;
      t.remove(), t = s;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class z {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, s, i, n) {
    this.type = 1, this._$AH = d, this._$AN = void 0, this.element = t, this.name = e, this._$AM = i, this.options = n, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = d;
  }
  _$AI(t, e = this, s, i) {
    const n = this.strings;
    let r = !1;
    if (n === void 0) t = E(this, t, e, 0), r = !P(t) || t !== this._$AH && t !== w, r && (this._$AH = t);
    else {
      const h = t;
      let a, l;
      for (t = n[0], a = 0; a < n.length - 1; a++) l = E(this, h[s + a], e, a), l === w && (l = this._$AH[a]), r ||= !P(l) || l !== this._$AH[a], l === d ? t = d : t !== d && (t += (l ?? "") + n[a + 1]), this._$AH[a] = l;
    }
    r && !i && this.j(t);
  }
  j(t) {
    t === d ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class At extends z {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === d ? void 0 : t;
  }
}
class wt extends z {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== d);
  }
}
class Et extends z {
  constructor(t, e, s, i, n) {
    super(t, e, s, i, n), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = E(this, t, e, 0) ?? d) === w) return;
    const s = this._$AH, i = t === d && s !== d || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, n = t !== d && (s === d || i);
    i && this.element.removeEventListener(this.name, this, s), n && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class xt {
  constructor(t, e, s) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    E(this, t);
  }
}
const St = I.litHtmlPolyfillSupport;
St?.(O, U), (I.litHtmlVersions ??= []).push("3.3.1");
const Ct = (o, t, e) => {
  const s = e?.renderBefore ?? t;
  let i = s._$litPart$;
  if (i === void 0) {
    const n = e?.renderBefore ?? null;
    s._$litPart$ = i = new U(t.insertBefore(k(), n), n, void 0, e ?? {});
  }
  return i._$AI(o), i;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const q = globalThis;
class C extends A {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Ct(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return w;
  }
}
C._$litElement$ = !0, C.finalized = !0, q.litElementHydrateSupport?.({ LitElement: C });
const kt = q.litElementPolyfillSupport;
kt?.({ LitElement: C });
(q.litElementVersions ??= []).push("4.2.1");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Pt = (o) => (t, e) => {
  e !== void 0 ? e.addInitializer((() => {
    customElements.define(o, t);
  })) : customElements.define(o, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ot = { attribute: !0, type: String, converter: N, reflect: !1, hasChanged: L }, Ut = (o = Ot, t, e) => {
  const { kind: s, metadata: i } = e;
  let n = globalThis.litPropertyMetadata.get(i);
  if (n === void 0 && globalThis.litPropertyMetadata.set(i, n = /* @__PURE__ */ new Map()), s === "setter" && ((o = Object.create(o)).wrapped = !0), n.set(e.name, o), s === "accessor") {
    const { name: r } = e;
    return { set(h) {
      const a = t.get.call(this);
      t.set.call(this, h), this.requestUpdate(r, a, o);
    }, init(h) {
      return h !== void 0 && this.C(r, void 0, o, h), h;
    } };
  }
  if (s === "setter") {
    const { name: r } = e;
    return function(h) {
      const a = this[r];
      t.call(this, h), this.requestUpdate(r, a, o);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function _(o) {
  return (t, e) => typeof e == "object" ? Ut(o, t, e) : ((s, i, n) => {
    const r = i.hasOwnProperty(n);
    return i.constructor.createProperty(n, s), r ? Object.getOwnPropertyDescriptor(i, n) : void 0;
  })(o, t, e);
}
var Mt = Object.defineProperty, Ht = Object.getOwnPropertyDescriptor, b = (o, t, e, s) => {
  for (var i = s > 1 ? void 0 : s ? Ht(t, e) : t, n = o.length - 1, r; n >= 0; n--)
    (r = o[n]) && (i = (s ? r(t, e, i) : r(i)) || i);
  return s && i && Mt(t, e, i), i;
};
let p = class extends C {
  constructor() {
    super(...arguments), this.variant = "primary", this.size = "default", this.type = "circle", this.state = "default", this.iconName = "home", this.disabled = !1, this.buttonAriaLabel = "Icon button";
  }
  createRenderRoot() {
    return this;
  }
  connectedCallback() {
    if (super.connectedCallback(), !document.querySelector('link[href*="Roboto"]')) {
      const o = document.createElement("link");
      o.rel = "stylesheet", o.href = "https://ui.renaissance.com/fonts/Roboto/style.css", document.head.appendChild(o);
    }
  }
  set shape(o) {
    this.type = o;
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
  handleClick(o) {
    if (this.disabled) {
      o.preventDefault(), o.stopPropagation();
      return;
    }
    this.dispatchEvent(new CustomEvent("icon-button-click", {
      bubbles: !0,
      composed: !0,
      detail: { originalEvent: o }
    }));
  }
  render() {
    return yt`
      <style>
        nds-icon-button {
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
        @click="${this.handleClick}"
      >
        <i class="fa-light fa-${this.iconName} nds-icon-button__icon" aria-hidden="true"></i>
      </button>
    `;
  }
};
b([
  _()
], p.prototype, "variant", 2);
b([
  _()
], p.prototype, "size", 2);
b([
  _()
], p.prototype, "type", 2);
b([
  _()
], p.prototype, "state", 2);
b([
  _({ attribute: "icon-name" })
], p.prototype, "iconName", 2);
b([
  _({ type: Boolean })
], p.prototype, "disabled", 2);
b([
  _({ attribute: "button-aria-label" })
], p.prototype, "buttonAriaLabel", 2);
b([
  _()
], p.prototype, "shape", 1);
p = b([
  Pt("nds-icon-button")
], p);
export {
  p as NdsIconButton
};
