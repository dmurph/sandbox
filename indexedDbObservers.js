
(function(global) {
  // db name-> dict of objectstore name -> listener object.
  var connections = {};

  var addOpenDatabase = function(db, name){
    db._listeners = {};
    connections[name] = connections[name] || [];
    connections[name].push(db);
  };
  var closeDatabase = function(db) {
    db._listeners = {};
    var list = connections[this.name], index = list.indexOf(this);
    list.splice(index, 1);
  };

  var addListenerFunction = function(objectStore, fcn) {
    var db = objectStore.transaction.db;
    db._listeners[objectStore.name] = db._listeners[objectStore.name] || [];
    db._listeners[objectStore.name].push(fcn); 
    console.log(db._listeners);
  };

  var getListeners = function(dbName, objectStoreName) {
    if (!connections[dbName]) {
      return [];
    }
    var listeners = [];
    connections[dbName].forEach(function(db) {
      if (!db._listeners[objectStoreName]) {
        return;
      }
      listeners = listeners.concat(db._listeners[objectStoreName]);
    });
    return listeners;
  };

  var $open = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function(name /*, version*/) {
    var request = $open.apply(this, arguments);
    request.addEventListener('success', function() {
      var connection = request.result;
      addOpenDatabase(connection, name);
    });
    return request;
  };

  var $close = IDBDatabase.prototype.close;
  IDBDatabase.prototype.close = function() {
    $close.apply(this, arguments);
    closeDatabase(this);
  };
  
  var $transaction = IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction = function(scope, mode) {
    var tx = $transaction.apply(this, arguments);
    if (mode !== 'readwrite') return tx;
    tx._changes = [];
    tx.addEventListener('complete', function() {
      var changes = tx._changes;
      tx._changes = [];
      for (var objectStoreName in changes) {
        var listeners = getListeners(tx.db.name, objectStoreName);
        for (var index in listeners) {
          listeners[index](changes[objectStoreName]);
        }
      }
    });
    return tx;
  };
 
  IDBObjectStore.prototype.addChangeListener = function(fcn) {
    addListenerFunction(this, fcn);
  };

  var $put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function(value /*, key*/) {
    var $this = this;
    var request = $put.apply(this, arguments);
    request.addEventListener('success', function() {
      var key = request.result;
      $this.transaction._changes[$this.name] = $this.transaction._changes[$this.name] || [];
      $this.transaction._changes[$this.name].push([$this.name, 'put', key]);
    });
    return request;
  };
 
  var $add = IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = function(value /*, key*/) {
    var $this = this;
    var request = $add.apply(this, arguments);
    request.addEventListener('success', function() {
      var key = request.result;
      $this.transaction._changes[$this.name] = $this.transaction._changes[$this.name] || [];
      $this.transaction._changes[$this.name].push([$this.name, 'add', key]);
    });
    return request;
  };
 
  var $delete = IDBObjectStore.prototype.delete;
  IDBObjectStore.prototype.delete = function(key_or_range) {
    var $this = this;
    var request = $delete.apply(this, arguments);
    request.addEventListener('success', function() {
      $this.transaction._changes[$this.name] = $this.transaction._changes[$this.name] || [];
      $this.transaction._changes[$this.name].push([$this.name, 'delete', key_or_range]);
    });
    return request;
  };
 
  var $clear = IDBObjectStore.prototype.clear;
  IDBObjectStore.prototype.clear = function() {
    var $this = this;
    var request = $clear.apply(this, arguments);
    request.addEventListener('success', function() {
      $this.transaction._changes[$this.name] = $this.transaction._changes[$this.name] || [];
      $this.transaction._changes[$this.name].push([$this.name, 'clear']);
    });
    return request;
  };
 
  function effectiveStore(source) {
    return ('objectStore' in source) ? source.objectStore : source;
  }
 
  var $update = IDBCursor.prototype.update;
  IDBCursor.prototype.update = function(value) {
    var $this = this;
    var key = $this.primaryKey;
    var request = $update.apply(this, arguments);
    request.addEventListener('success', function() {
      var store = effectiveStore($this);
      store.transaction._changes[store.name] = store.transaction._changes[store.name] || [];
      store.transaction._changes[store.name].push([store.name, 'update', key]);
    });
    return request;
  };
 
  var $cursorDelete = IDBCursor.prototype.delete;
  IDBCursor.prototype.delete = function() {
    var $this = this;
    var key = $this.primaryKey;
    var request = $cursorDelete.apply(this, arguments);
    request.addEventListener('success', function() {
      var store = effectiveStore($this);
      store.transaction._changes[store.name] = store.transaction._changes[store.name] || [];
      store.transaction._changes[store.name].push([store.name, 'delete', key]);
    });
    return request;
  };
 
}(this));