import { merge } from "./utils";

export function content(morph, helperName, context, params, hash, options, env) {
  var value, helper = this.lookupHelper(helperName, context, options);
  if (helper) {
    value = helper.call(context, params, hash, options, env);
  } else {
    if (options.type === 'value') {
      value = helperName;
    } else {
      value = this.simple(context, helperName, options);
    }
  }
  morph.update(value);
}

export function component(morph, tagName, context, hash, options, env) {
  var value, helper = this.lookupHelper(tagName, context, options);
  if (helper) {
    value = helper.call(context, null, hash, options, env);
  } else {
    value = this.componentFallback(morph, tagName, context, hash, options, env);
  }
  morph.update(value);
}

export function componentFallback(morph, tagName, context, hash, options, env) {
  var element = env.dom.createElement(tagName);
  var hashTypes = options.hashTypes;

  for (var name in hash) {
    if (hashTypes[name] === 'id') {
      element.setAttribute(name, this.simple(context, hash[name], options));
    } else {
      element.setAttribute(name, hash[name]);
    }
  }
  element.appendChild(options.render(context, env, morph.contextualElement));
  return element;
}

export function element(domElement, helperName, context, params, hash, options, env) {
  var helper = this.lookupHelper(helperName, context, options);
  if (helper) {
    helper.call(context, params, hash, options, env);
  }
}

export function attribute(domElement, attributeName, quoted, context, parts, options, env) {
  var attrValue;

  if (quoted) {
    attrValue = concat.call(this, parts, null, options, env);
  } else {
    attrValue = parts[0];
  }

  if (attrValue === null) {
    domElement.removeAttribute(attributeName);
  } else {
    domElement.setAttribute(attributeName, attrValue);
  }
}

export function concat(params, hash, options /*, env*/) {
  var value = "";
  for (var i = 0, l = params.length; i < l; i++) {
    if (options.paramTypes[i] === 'id') {
      value += this.simple(this, params[i], options);
    } else {
      value += params[i];
    }
  }
  return value;
}

export function partial(params, hash, options, env) {
  return env.partials[params[0]](this, env);
}

export function subexpr(helperName, context, params, hash, options, env) {
  var helper = this.lookupHelper(helperName, context, options);
  if (helper) {
    return helper.call(context, params, hash, options, env);
  } else {
    return this.simple(context, helperName, options);
  }
}

export function lookupHelper(helperName /*, context, options*/) {
  if (helperName === 'attribute') {
    return this.attribute;
  }
  else if (helperName === 'partial'){
    return this.partial;
  }
  else if (helperName === 'concat') {
    return this.concat;
  }
}

export function simple(context, name /*, options*/) {
  return context[name];
}

export function set(context, name, value) {
  context[name] = value;
}

export function hydrationHooks(extensions) {
  var base = {
    content: content,
    component: component,
    componentFallback: componentFallback,
    element: element,
    attribute: attribute,
    concat: concat,
    subexpr: subexpr,
    lookupHelper: lookupHelper,
    simple: simple,
    partial: partial,
    set: set
  };

  return extensions ? merge(extensions, base) : base;
}
