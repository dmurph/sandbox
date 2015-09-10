import time
import BaseHTTPServer
import SimpleHTTPServer


HOST_NAME = 'localhost' # !!!REMEMBER TO CHANGE THIS!!!
PORT_NUMBER = 8000 # Maybe set this to 9000.

REDIRECTS = 0

class MyHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
    def do_HEAD(self):
        print 'in HEAD, path is ' + self.path
        global REDIRECTS
        if "/index.html" in self.path and REDIRECTS == 0:
            self.send_response(301)
            self.send_header("Location", 'index2.html')
            self.end_headers()
            return
        if "/index2.html" in self.path:
            self.send_response(301)
            self.send_header("Location", 'index.html')
            self.end_headers()
            REDIRECTS += 1
            return
        SimpleHTTPServer.SimpleHTTPRequestHandler.do_HEAD(self)
    def do_GET(self):
        print 'in GET, path is ' + self.path
        global REDIRECTS
        if "/index.html" in self.path and REDIRECTS == 0:
            print 'is index, doing HEAD'
            self.do_HEAD()
            return
        if "/index2.html" in self.path:
            print 'is index2, doing HEAD'
            self.do_HEAD()
            return
        SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)

if __name__ == '__main__':
    server_class = BaseHTTPServer.HTTPServer
    httpd = server_class((HOST_NAME, PORT_NUMBER), MyHandler)
    print time.asctime(), "Server Starts - %s:%s" % (HOST_NAME, PORT_NUMBER)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print time.asctime(), "Server Stops - %s:%s" % (HOST_NAME, PORT_NUMBER)