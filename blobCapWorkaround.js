console.log("blob repro");

// (this is ugly, I know.  writen as a proof of concept)

// Workaround for saving blobs larger than 500MB.
// Main idea: add and then get the blob from indexeddb to
// force it to be file-backed.  Then concatinate all of the file-backed
// blobs to make the > 500MB blob that can then be downloaded.
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
				// blob.close();
				// ^^ this guarentees that the blob passed in is released.
				// you have to enable --enable-experimental-web-platform-features
				// (or see about://flags) to enable this.
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

var allblobs = [];
// you can create an array of promises, one for each chunk, and then resolve them all.
convertDataBlobToFileBlob(blob).then(function(blob) {
		console.log("did it! ", blob);
		allblobs.push(blob);
		var nextBlob = new Blob([new Uint8Array(200*1024*1024)], {type: 'application/octet-string'});
		return convertDataBlobToFileBlob(nextBlob);
	}).then(function(blob) {
		console.log("did it 2! ", blob);
		allblobs.push(blob);
		var nextBlob = new Blob([new Uint8Array(200*1024*1024)], {type: 'application/octet-string'});
		return convertDataBlobToFileBlob(nextBlob);
	}).then(function(blob) {
		console.log("did it 3!", blob);
		allblobs.push(blob);
	}).then(function() {
		var concat = new Blob(allblobs, {type: 'application/octet-string'});
		console.log("concatinated blob: ", concat);
		url_a = URL.createObjectURL(concat); // You can open url_a
		console.log(url_a);
		window.location = url_a;
	});



