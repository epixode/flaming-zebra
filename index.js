var _ = require('lodash');
var diff = require('virtual-dom/diff');
var patch = require('virtual-dom/patch');
var vdCreateElement = require('virtual-dom/create-element');
var Delegator = require('dom-delegator');
var raf = require('raf');  // requestAnimationFrame
var h = require('virtual-dom/h');
var JsonPatch = require('./json-patch');

var fz = {
	_classes: {},
	_contextStack: [],
  delegator: Delegator()
};

function init (element, state, renderRoot) {
  fz.state = state;
  fz.prevState = state;
  fz.renderRoot = renderRoot;
  fz.rootComponent = null;
  fz.tree = renderRoot.call();
  fz.rootNode = vdCreateElement(fz.tree);
  element.appendChild(fz.rootNode);
};

function mainLoop () {
	_tick();
	raf(mainLoop);
};

function createClass (body) {
  var name = body.displayName;
  fz._classes[name] = body;
  return body;
};

function createElement (tagName, properties) {
  var children = Array.prototype.slice.call(arguments, 2);
  var parent = _currentContext();
  properties = properties || {};
  if (_.isString(tagName) && !(tagName in fz._classes)) {
    var props = _.clone(properties);
    if ('onClick' in properties) {
      delete props.onClick;
      props['ev-click'] = _wrapMethod(parent, properties.onClick);
    }
    if ('onChange' in properties) {
      delete props.onChange;
      props['ev-change'] = _wrapMethod(parent, properties.onChange);
    }
		// TODO: support more events
    return h(tagName, props, children);
  }
  // Instantiate the component.
  var isNew = false;
  var component = parent ? parent.children[properties.key] : fz.rootComponent;
  if (!component) {
    // Make a new component instance.
    var classBody = _.isObject(tagName) ? tagName : fz._classes[tagName];
    var component = Object.create(classBody);
    isNew = true;
    component.parent = parent;
    component.children = {}; // XXX garbage collection
    // Make a shallow copy of the properties into the component, collecting refs.
    // XXX getDefaultProps must return a new object each time it is called.
    var props = _.isFunction(component.getDefaultProps) ? component.getDefaultProps() : {};
    var refs = _.isObject(properties.refs) ? _.clone(properties.refs) : {};
    for (var key in properties) {
      if (key.startsWith('ref-')) {
        refs[key.substring(4)] = properties[key];
      } else {
        props[key] = properties[key];
      }
    }
    component.props = props;
    component.refs = refs;
    // If we have a parent, expand relative references.
    if (parent) {
      for (var key in refs) {
        refs[key] = _expandPointer(parent.refs, refs[key])
      }
    }
  }
  var props = component.props;
  var refs = component.refs;
  // Evaluate the references and update the properties.
  for (var key in refs) {
    props[key] = _lookup(fz.state, refs[key]);
  }
  // Store the component if it is new.
  if (isNew) {
    // Call the component's init method.
    if (_.isFunction(component.init)) {
      component.init();
    }
    if (!parent) {
      fz.rootComponent = component;
    } else if ('key' in properties) {
			// Keep track of the component instance using the provided key.
      parent.children[properties.key] = component;
    }
  }
  // Call the component's render method to build the virtual DOM.
  // return component.render(children);
  return _wrapMethod(component, component.render)(children);
}

function patchState (patches) {
  var context = _currentContext();
  var absPatches = [];
  for (var i in patches) {
    var item = _.clone(patches[i]);
    item.path = _expandPointer(context.refs, item.path);
    absPatches.push(item);
  }
  fz.state = JsonPatch.patch(fz.state, absPatches);
};

function emit (eventName) {
  var context = _currentContext();
  var parent = context.parent;
  if (!parent)
    throw 'warning: emit from root';
  if (!_.isFunction(parent[eventName]))
    throw 'warning: emit without a handler';
  var args = Array.prototype.slice.call(arguments, 1);
  fz._contextStack.push(parent);
  try {
    return parent[eventName].apply(parent, args);
  } finally {
    fz._contextStack.pop();
  }
};

function _tick () {
  if (fz.state !== fz.prevState) {
    var newTree = fz.renderRoot.call();
    var patches = diff(fz.tree, newTree);
    fz.rootNode = patch(fz.rootNode, patches);
    fz.tree = newTree;
    fz.prevState = fz.state;
    // TODO: trigger a save-changed event
		if (typeof fz.saveState === 'function')
		  fz.saveState();
  }
};

function _wrapMethod (component, func) {
  return function wrappedMethod () {
    fz._contextStack.push(component);
    try {
      return func.apply(component, arguments);
    } finally {
      fz._contextStack.pop();
    }
  }
};

function _currentContext () {
  return fz._contextStack[fz._contextStack.length - 1];
};

/**
 * Dereference a JsonPointer.
 */
function _lookup (value, pointer) {
  var indices = pointer.split('/');
  // Drop the empty element before the first '/'.
  var i = indices[0].length === 0 ? 1 : 0;
  while (i < indices.length) {
    var index = indices[i];
    if (_.isArray(value)) {
      if (index === '-')
        return void 0; // out of bounds
      index = parseInt(index);
      if (isNaN(index))
        return void 0; // invalid index
      value = value[index];
    } else if (typeof value === 'object') {
      value = value[index];
    } else {
      return void 0;
    }
    i += 1;
  }
  return value;
}

function _expandPointer (refs, pointer) {
  if (pointer[0] == '/')
    return pointer;
  var indices = pointer.split('/');
  var ref = indices[0];
  if (!(ref in refs))
    throw "bad reference in relative pointer";
  indices[0] = refs[ref];
  return indices.join('/');
}

module.exports = {
	init: init,
  mainLoop: mainLoop,
  createClass: createClass,
  createElement: createElement,
  patchState: patchState,
  emit: emit,
	onSaveState: function (callback) {
		fz.saveState = callback;
	}
};
