/**
 * Apply a JsonPatch non-destructively with maximal sharing.
 */

var _ = require('lodash');

var _generation = 0;

function ensureFreshArray (value) {
  if (value.$generation !== _generation) {
    value = value.slice();
    Object.defineProperty(value, '$generation', {
      configurable: false,
      enumerable: false,
      value: _generation,
      writable: false
    });
  }
  return value;
}

function ensureFreshObject (value) {
  if (value.$generation !== _generation) {
    var copy = {};
    for (var key in value) { copy[key] = value[key]; }
    value = copy;
    value.$generation = _generation;
  }
  return value;
}

function patchOne (patch, indices, i, value) {
  if (_.isArray(value))
    return patchOneArray(patch, indices, i, value);
  if (_.isObject(value))
    return patchOneObject(patch, indices, i, value);
  throw 'bad path';
}

function patchOneArray (patch, indices, i, value) {
  var index = indices[i];
  if (index === '-')
    index = value.length;
  value = ensureFreshArray(value);
  if (i + 1 !== indices.length) {
    // patch inside
    value[index] = patchOne(patch, indices, i + 1, value[index]);
  } else {
    // patch here
    switch (patch.op) {
    case 'replace':
      value[index] = patch.value;
      break;
    case 'add':
      value.splice(index, 0, patch.value);
      break;
    case 'remove':
      value.splice(index, 1);
      break;
    default:
      throw 'unimplemented op ' + patch.op;
    }
  }
  return value;
}

function patchOneObject (patch, indices, i, value) {
  var index = indices[i];
  value = ensureFreshObject(value);
  if (i + 1 !== indices.length) {
    // patch inside
    value[index] = patchOne(patch, indices, i + 1, value[index]);
  } else {
    // patch here
    switch (patch.op) {
    case 'replace':
      value[index] = patch.value;
      break;
    case 'add':
      if (index in value)
        throw 'conflict on key ' + index;
      value[index] = patch.value;
      break;
    case 'remove':
      delete value[index];
      break;
    default:
      throw 'unimplemented op ' + patch.op;
    }
  }
  return value;
}

function patch (value, patches) {
  _generation += 1;
  for (var i = 0; i < patches.length; i += 1) {
    var item = patches[i];
    var indices = item.path.split('/');
    var j = indices[0].length === 0 ? 1 : 0;
    value = patchOne(item, indices, j, value);
  }
  return value;
}

module.exports.patch = patch;
