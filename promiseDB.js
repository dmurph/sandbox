var pdb = {
  _transformRequestToPromise: function(thisobj, func, argArray) {
    return new Promise(function(resolve, reject) {
      var request = func.apply(thisobj, argArray);
      request.onsuccess = function() {
        resolve(request.result);
      };
      request.onerror = reject;
    })
  },

  transact: function(db, objectStores, style) {
    return Promise.resolve(db.transaction(objectStores, style));
  },

  openCursor: function(txn, indexOrObjectStore, keyrange, callback) {
    return new Promise(function(resolve, reject) {
      var request = indexOrObjectStore.openCursor(keyrange);
      request.onerror = reject;
      request.onsuccess = function() {
        var cursor = request.result;
        var cont = false;
        var control = {
          continue: function() {cont = true;}
        };
        if (cursor) {
          callback(control, cursor.value);
          if (cont) {
            cursor.continue();
          } else {
            resolve(txn);
          }
        } else {
          resolve(txn);
        }
      };
    });
  },

  get: function(indexOrObjectStore, key) {
    return this._transformRequestToPromise(indexOrObjectStore, indexOrObjectStore.get, [key]);
  },

  count: function(indexOrObjectStore, key) {
    return this._transformRequestToPromise(indexOrObjectStore, indexOrObjectStore.count, [key]);
  },

  put: function(objectStore, key, value) {
    return this._transformRequestToPromise(objectStore, objectStore.put, [key, value]);
  },

  add: function(objectStore, key, value) {
    return this._transformRequestToPromise(objectStore, objectStore.add, [key, value]);
  },

  delete: function(objectStore, key) {
    return this._transformRequestToPromise(objectStore, objectStore.delete, [key]);
  },

  clear: function(objectStore) {
    return this._transformRequestToPromise(objectStore, objectStore.clear, []);
  },

  getKey: function(index, key) {
    return this._transformRequestToPromise(index, index.getKey, [key]);
  },


  waitForTransaction: function(txn) {
    return new Promise(function(resolve, reject) {
      txn.oncomplete = resolve;
      txn.onerror = reject;
      txn.onabort = reject;
    });
  },
  waitForTransactionFcn: function(txn) {
    return function() {
      return this.waitForTransaction(txn);
    };
  },
}

var logToConsole = function(value) {
  console.log(value);
};

var db;
var version = 3.0;

function initDb(oncomplete) {
  var request = indexedDB.open("TestDatabase", version);
  request.onerror = function(evt) {
    console.log("Database error code: " + evt.target.errorCode);
  };
  request.onsuccess = function(evt) {
    db = request.result; 
    oncomplete();
  };
  request.onupgradeneeded = function (evt) {  
    var db = request.result;
    if (db.objectStoreNames.contains("books")) {
      db.deleteObjectStore("books");
    }
    var store = db.createObjectStore("books", {keyPath: "isbn"});
    var titleIndex = store.createIndex("by_title", "title", {unique: true});
    var authorIndex = store.createIndex("by_author", "author");

    // Populate with initial data.
    store.put({title: "Quarry Memories", author: "Fred", isbn: 123456});
    store.put({title: "Water Buffaloes", author: "Fred", isbn: 234567});
    store.put({title: "Bedrock Nights", author: "Barney", isbn: 345678});
  };
}

var main = function() {
  console.log("starting main");

  getBooks("Fred").then(function(books) {
    console.log(books.join(", "));
  }).then(function() {
    addMoreBooks();
  }).then(function() {
    return getBooks("Fred").then(function(books) {
     console.log(books.join(", "));
    });
  }).then(function() {
    return lookupBook("Bedrock Nights");
  }).then(logToConsole)
  .then(function() {
    return lookupBook("Test3");
  })
  .then(logToConsole)
  .then(function(x) { console.log("done!"); } )
  .catch(logToConsole);
}
initDb(main);

var lookupBook = function(bookName) {
  var book;
  return pdb.transact(db, "books", "readonly")
    .then(function(txn) {
      var store = txn.objectStore("books");
      var index = store.index("by_title");
      return pdb.get(index, bookName)
        .then(function (result) {
          book = result;
        }).then(pdb.waitForTransaction(txn));
    }).then(function() {
      return book;
    });
}

var addMoreBooks = function() {
  return pdb.transact(db, "books", "readwrite")
    .then(function(txn) {
      var objectStore = txn.objectStore("books");
      var p1 = pdb.put(objectStore, {title: "Test2", author: "Fred", isbn: 1234526});
      var p2 = pdb.put(objectStore, {title: "Test3", author: "Barney", isbn: 1234523});
      return Promise.all([p1, p2, pdb.waitForTransaction(txn)]);
    });
}

var getBooks = function(author) {
  var books = [];
  return pdb.transact(db, "books", "readonly")
    .then(function(txn) {
      var index = txn.objectStore("books").index("by_author");
      return pdb.openCursor(txn, index, IDBKeyRange.only(author), function(control, value) {
        books.push(value.title);
        control.continue();
      });
    }).then(pdb.waitForTransaction)
    .then(function() {
      return books;
    });
}
