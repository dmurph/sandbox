console.log("blob repro");

// Workaround for saving blobs larger than 500MB

function convertDataBlobToFileBlob(blob) {
	return new Promise(function(resolve, reject) {
		var db;
		var request = indexedDB.open("TestDB");
		var deleteEntry = function(key, blob) {
			console.log("delete got key ", key, " and blob ", blob);
			return new Promise(function(resolve, reject) {
				var t = db.transaction(["fileStore"], "readwrite");
				t.oncomplete = function(event) {
					console.log("delete trans opened");
				}
				t.onerror = function(event) {
					reject(event);
				}
				var objectStore = t.objectStore("fileStore");
	  			var objectStoreRequest = objectStore.delete(key);
	  			objectStoreRequest.onsuccess = function(event) {
					resolve(blob);
	  			}
			});
		};
		var putEntry = function(blob) {
			return new Promise(function(resolve, reject) {
				var t = db.transaction(["fileStore"], "readwrite");
				t.oncomplete = function(event) {
					console.log("save trans opened");
				}
				t.onerror = function(event) {
					reject(event);
				}
				var objectStore = t.objectStore("fileStore");
				var request = objectStore.put(blob);
				blob.close();
	  			request.onsuccess = function(event) {
					resolve(request.result);
	  			}
			});
		};
		var getEntry = function(key) {
			return new Promise(function(resolve, reject) {
				var t = db.transaction(["fileStore"], "readwrite");
				t.oncomplete = function(event) {
					console.log("save trans opened");
				}
				t.onerror = function(event) {
					reject(event);
				}
				var objectStore = t.objectStore("fileStore");
				var request = objectStore.get(key);
	  			request.onsuccess = function(event) {
					resolve({ blob: request.result, key: key });
	  			}
			});
		};

		request.onerror = function(evt) {
			reject("Database error code: " + evt.target.errorCode);
		};
		request.onupgradeneeded = function (evt) {  
			var db = event.target.result;
			db.onerror = function(event) {
			  console.log("Error onupgrade");
			};
			evt.currentTarget.result.createObjectStore(
			    "fileStore", { autoIncrement: true });
			
		};
		request.onsuccess = function(evt) {
			db = request.result;
			putEntry(blob).then(function(key) {
					return getEntry(key);
				}).then(function(blobkey) {
					return deleteEntry(blobkey.key, blobkey.blob);
				}).then(function(blob) {
					resolve(blob);
				}).catch(function(err) {
					console.log("Error!", err);
					reject(err);
				});
		};
	});
}



var blob = new Blob([new Uint8Array(200*1024*1024)], {type: 'application/octet-string'});
console.log(blob);

var done1;
var url_a;
convertDataBlobToFileBlob(blob).then(function(done) {
		console.log("did it! ", done);
		done1 = done;
		var blob2 = new Blob([new Uint8Array(490*1024*1024)], {type: 'application/octet-string'});
		return convertDataBlobToFileBlob(blob2);
	}).then(function(done) {
		console.log("did it 2, second blob: ", done);
		var concat = new Blob([done1, done], {type: 'application/octet-string'});
		console.log("concatinated blob: ", concat);
		url_a = URL.createObjectURL(concat); // You can open url_a
		console.log(url_a);
		window.location = url_a;
	});



