var pdb = {
  transact: function(db, objectStores, style) {
    return Promise.resolve(db.transaction(objectStores, style));
  },

  openIndexCursor: function(txn, index, keyrange, callback) {
    return new Promise(function(resolve, reject) {
      var request = index.openCursor(keyrange);
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

  openObjectStoreCursor: function(txn, objectStore, keyrange, callback) {
    return new Promise(function(resolve, reject) {
      var request = objectStore.openCursor(keyrange);
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

  openObjectStoreCursor: function(txn, objectStore, keyrange, callback) {
    return new Promise(function(resolve, reject) {
      var request = objectStore.openCursor(keyrange);
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
  transactionDone: function(txn) {
    return new Promise(function(resolve, reject) {
      txn.oncomplete = resolve;
      txn.onerror = reject;
      txn.onabort = reject;
    });
  },
}


var db;
var version = 1.0;

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
    getBooks("Fred").then(function(books) {
     console.log(books.join(", "));
    });
  });
}
initDb(main);

/*var tx = db.transaction("books", "readwrite");
var store = tx.objectStore("books");

store.put({title: "Quarry Memories", author: "Fred", isbn: 123456});
store.put({title: "Water Buffaloes", author: "Fred", isbn: 234567});
store.put({title: "Bedrock Nights", author: "Barney", isbn: 345678});

tx.oncomplete = function() {
  // All requests have succeeded and the transaction has committed.
};*/

var addMoreBooks = function() {
  return pdb.transact(db, "books", "readwrite")
    .then(function(txn) {
      var objectStore = txn.objectStore("books");
      objectStore.put({title: "Test2", author: "Fred", isbn: 1234526});
      objectStore.put({title: "Test3", author: "Barney", isbn: 12526});
      return txn;
    }).then(pdb.transactionDone);
}

var getBooks = function(author) {
  var books = [];
  return pdb.transact(db, "books", "readonly")
    .then(function(txn) {
      var index = txn.objectStore("books").index("by_author");
      return pdb.openIndexCursor(txn, index, IDBKeyRange.only(author), function(control, value) {
        books.push(value.title);
        control.continue();
      });
    }).then(function(txn) {
      return books;
    });
}
