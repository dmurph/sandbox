// For workaround, see blobCapWorkaround.js

var blob = new Blob([new Uint8Array(500*1024*1024 + 1)], {type: 'application/octet-string'});
console.log(blob);
var url_a = URL.createObjectURL(blob);
console.log(url_a);