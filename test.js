(function () {
'use strict';

var FZ = require('./index'), React = FZ;

var NumberInput = React.createClass({
  // refs: model
  render: function () {
    return (
      <input className='form-control' type='number' value={this.props.model} onChange={this.onChange}/>
    );
  },
  onChange: function (event) {
    FZ.patchState([
      {op: 'replace', path: 'model', value: parseInt(event.target.value) || 0}
    ]);
  }
});

var Root = React.createClass({
  // refs: newCount, seq, items, order
  render: function () {
    return (
      <div className='panel panel-default container-fluid'>
        <h1>Counts</h1>
        <div className='form-inline'>
          <p>Items:</p>
          <ul>{this.props.order.map(this.renderItem)}</ul>
          <p>New items:</p>
          <div className='form-group'>
            <label>Initial value:</label>
            <NumberInput ref-model='newCount'/>
          </div>
          <input className='btn btn-default' type='button' value='add an item' onClick={this.addItem}/>
        </div>
      </div>
    );
  },
  renderItem: function (id, index) {
    return (<Item key={id} ref-item={'items/'+id}/>);
  },
  addItem: function () {
    var id = this.props.seq;
    var newItem = {id: id, val: this.props.newCount, inc: 1};
    FZ.patchState([
      {op: 'replace', path: 'seq', value: id + 1},
      {op: 'add', path: 'items/'+id, value: newItem},
      {op: 'add', path: 'order/-', value: id}
    ]);
  },
  deleteItem: function (id) {
    var index = this.props.order.indexOf(id);
    FZ.patchState([
      {op: 'remove', path: 'items/'+id},
      {op: 'remove', path: 'order/'+index}
    ]);
  }
});

var Item = React.createClass({
  // refs: item
  getDefaultProps: function () {
    return {
      color: '#'+(0xff7f7f & (0x404000 | Math.floor(Math.random()*0xffffff))).toString(16)
    };
  },
  render: function () {
    var item = this.props.item;
    var addLabel = item.inc >= 0 ? 'add ' + item.inc : 'subtract ' + -item.inc;
    return (
      <li key={item.id} style={{color: this.props.color}}>
        {item.val+' '}
        <input className='btn btn-default' type='button' value={addLabel} onClick={this.addClicked}/> {}
        <label>increment: </label>
        <NumberInput ref-model='item/inc'/>
        <input className='btn btn-default' type='button' value='X' onClick={this.deleteItem}/>
      </li>
    );
  },
  addClicked: function () {
    var item = this.props.item;
    FZ.patchState([
      {op: 'replace', path: 'item/val', value: item.val + item.inc}
    ]);
  },
  deleteItem: function () {
    FZ.emit('deleteItem', this.props.item.id);
  }
});

// Load the state from locale storage, if available.
var storedState = localStorage.getItem('state');
FZ.onSaveState(function () { // TODO: register an event handler
  localStorage.setItem('state', JSON.stringify(this.state));
});
FZ.init(document.body,
  storedState === null ? {seq: 1, items: {}, order: [], newCount: 1} : JSON.parse(storedState),
  function () {
    return (
      <div className='container'>
        <header>
          Flaming Zebra Test application
        </header>
        <Root ref-order='/order' ref-items='/items' ref-seq='/seq' ref-newCount='/newCount'/>
        <footer style={{textAlign: 'center'}}>
          Copyright 2015 <a href="http://epixode.fr">Epixode</a>
        </footer>
      </div>
    );
  });
FZ.mainLoop();

})();
